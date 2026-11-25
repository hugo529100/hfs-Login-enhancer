'use strict'; {
    // Login Enhancer - frontend part.
    // Hooks into the "beforeLogin" section of HFS' own login dialog, so the
    // native fields keep working exactly as before.

    const HFS = window.HFS
    if (HFS && HFS.h && HFS.React && HFS.onEvent)
        init(HFS)

    function init(HFS) {
        const { h, React, onEvent } = HFS
        const { useEffect, useRef, useState } = React

        let config = {}
        try { config = HFS.getPluginConfig() || {} } catch {}

        const SECONDS = clamp(config.seconds === undefined ? 30 : Number(config.seconds), 0, 3600)
        const SKIP_WHEN_HOME_LOCKED = config.skipWhenHomeRequiresLogin !== false
        const SESSION_CHECK = clamp(config.sessionCheckSeconds === undefined ? 30 : Number(config.sessionCheckSeconds), 0, 3600)

        // HFS may be mounted on a sub-path by a reverse proxy ("prefixUrl").
        const PREFIX = String(HFS.prefixUrl || '').replace(/\/+$/, '')
        const HOME_URL = PREFIX + '/'
        const HOME_KEY = safeNormalizePath(HOME_URL)

        const DEFAULT_TEXT = {
            countdownLabel: 'Returning to the home page in',
            countdownUnit: 'seconds',
            home: 'Home',
        }

        // The login dialog may be rendered before translations are loaded,
        // so ask for a reactive translator when available.
        function useT() {
            const i18n = HFS.i18n
            if (i18n && typeof i18n.useI18N === 'function')
                try { return i18n.useI18N().t } catch {}
            return HFS.t
        }

        function LoginTools() {
            const t = useT()
            const box = useRef(null)
            const stopped = useRef(false)   // the user is logging in, or we already left
            const [counting, setCounting] = useState(false)
            const [deadline, setDeadline] = useState(0)
            const [remaining, setRemaining] = useState(SECONDS)
            // HFS opens this dialog by itself only when the page is unauthorized.
            // A dialog opened from the "Login" menu must stay where it is.
            const automatic = Boolean(HFS.state && HFS.state.loginRequired === true)

            // HFS labels its submit button "Continue": turn it into "Login",
            // following the language of the page.
            useEffect(() => {
                const dialog = document.querySelector('.login-dialog')
                if (!dialog) return
                const label = t('Login')
                const apply = () => {
                    const btn = dialog.querySelector('.submit button')
                    if (btn && btn.textContent !== label) btn.textContent = label
                }
                apply()
                const mo = new MutationObserver(apply)
                mo.observe(dialog, { childList: true, subtree: true, characterData: true })
                return () => mo.disconnect()
            }, [t])

            // Keep the page banner (if any) out of sight while the login dialog is in front.
            useEffect(() => {
                document.body.classList.add('lge-login-open')
                return () => document.body.classList.remove('lge-login-open')
            }, [])

            // Breathe the dialog frame. The animation is set inline with priority
            // because themes like Orange-theme turn off CSS animations to save power.
            useEffect(() => {
                const dialog = document.querySelector('.login-dialog .dialog')
                if (!dialog) return
                dialog.style.setProperty('animation', 'lge-frame-breath 1.6s ease-in-out infinite', 'important')
                return () => dialog.style.removeProperty('animation')
            }, [])

            // Decide whether this dialog deserves the countdown at all.
            useEffect(() => {
                if (!automatic || SECONDS <= 0) return
                if (isAtHome()) return
                let alive = true
                void (async () => {
                    if (SKIP_WHEN_HOME_LOCKED && await homeNeedsLogin()) return
                    if (alive && !stopped.current) setCounting(true)
                })()
                return () => { alive = false }
            }, [])

            // Countdown on a deadline, so that a throttled background tab
            // cannot stretch it indefinitely.
            useEffect(() => {
                if (!counting) return
                setDeadline(Date.now() + SECONDS * 1000)
            }, [counting])

            useEffect(() => {
                if (!counting || !deadline) return
                const tick = () => {
                    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
                    setRemaining(left)
                    if (!left) goHome()
                }
                tick()
                const id = setInterval(tick, 500)
                return () => clearInterval(id)
            }, [counting, deadline])

            // Never navigate away while the user is submitting credentials,
            // and stop as soon as the login succeeds.
            useEffect(() => {
                if (!automatic) return
                const form = box.current && box.current.closest('form')
                const stop = () => {
                    stopped.current = true
                    setCounting(false)
                }
                form && form.addEventListener('submit', stop, true)
                const off = onEvent('loginOk', stop)
                return () => {
                    form && form.removeEventListener('submit', stop, true)
                    if (typeof off === 'function') off()
                }
            }, [])

            if (!automatic) return null

            return h('div', { className: 'lge-box', ref: box },
                h('div', { className: 'lge-unauthorized' }, t('Unauthorized')),
                counting && h('div', { className: 'lge-countdown' },
                    h('div', { className: 'lge-countdown-label' },
                        t('loginEnhancer_countdownLabel', DEFAULT_TEXT.countdownLabel)),
                    h('div', { className: 'lge-count' }, String(remaining)),
                    h('div', { className: 'lge-countdown-unit' },
                        t('loginEnhancer_countdownUnit', DEFAULT_TEXT.countdownUnit)),
                ),
                h('button', {
                    type: 'button', className: 'lge-btn lge-home',
                    onClick: goHome,
                }, t('loginEnhancer_home', DEFAULT_TEXT.home)),
                h('div', { className: 'lge-sep', 'aria-hidden': 'true' }),
            )

            function goHome() {
                if (stopped.current) return
                stopped.current = true
                setCounting(false)
                location.assign(HOME_URL)
            }

            function isAtHome() {
                try { return normalizePath(location.pathname) === HOME_KEY }
                catch { return false }
            }
        }

        // Ask HFS for a plain-text listing of the home page ("?get=list" is a
        // standard HFS feature). A login-protected folder answers with the GUI
        // page instead, which tells us that going home would not help.
        async function homeNeedsLogin() {
            const controller = window.AbortController && new AbortController()
            const timeout = controller && setTimeout(() => controller.abort(), 2500)
            try {
                const res = await fetch(HOME_URL + '?get=list', {
                    credentials: 'same-origin',
                    cache: 'no-store',
                    signal: controller ? controller.signal : undefined,
                })
                const type = String(res.headers.get('content-type') || '').toLowerCase()
                if (res.status === 401 || res.status === 403) return true
                if (!res.ok) return false
                return !type.includes('text/plain')
            }
            catch {
                return false // when unsure, keep the countdown
            }
            finally {
                if (timeout) clearTimeout(timeout)
            }
        }

        function normalizePath(path) {
            const p = decodeURI(path || '/').replace(/\/+$/, '') || '/'
            // HFS on Windows is case-insensitive, while on Linux it is not
            return HFS.pathSeparator && HFS.pathSeparator !== '\\' ? p : p.toLowerCase()
        }

        function safeNormalizePath(path) {
            try { return normalizePath(path) } catch { return '/' }
        }

        function clamp(n, min, max) {
            if (!Number.isFinite(n)) return min
            return Math.min(max, Math.max(min, Math.round(n)))
        }

        // HFS keeps sessions in memory: when the server restarts (or a session
        // simply expires) open pages stay on their old content until a request
        // fails. Here we ask a tiny API now and then, and when the session is
        // gone we flip HFS' own "login required" flag, which opens the login
        // dialog on the spot, without reloading the page.
        //
        // Throttling: only logged-in users are checked, only while the page is
        // visible, with a randomized interval, exponential backoff while the
        // server is unreachable, and immediate checks when the page comes back
        // into view or the network returns.
        function watchSession() {
            if (SESSION_CHECK <= 0) return
            const base = SESSION_CHECK * 1000
            let timer = 0
            let failures = 0
            let running = false
            let lastCheck = 0

            function nextDelay() {
                // first failure keeps the normal tempo (a quick restart is
                // usually caught by the next check), then slow down to 2x/4x
                const factor = failures ? Math.min(4, Math.pow(2, failures - 1)) : 1
                const jitter = 0.85 + Math.random() * 0.3
                return Math.round(base * factor * jitter)
            }

            function schedule(ms) {
                clearTimeout(timer)
                timer = setTimeout(check, ms === undefined ? nextDelay() : ms)
            }

            // The server no longer knows this session: show HFS' login dialog.
            function sessionLost() {
                const state = HFS.state
                if (!state) return
                if (state.username) state.username = ''
                state.loginRequired = true
            }

            async function check() {
                if (running) return
                const state = HFS.state
                if (!state || !state.username || state.loginRequired
                    || document.visibilityState !== 'visible'
                    || navigator.onLine === false)
                    return schedule()
                running = true
                lastCheck = Date.now()
                try {
                    const res = await HFS.apiCall('refresh_session')
                    failures = 0
                    if (res && !res.username)
                        sessionLost()
                }
                catch (err) {
                    if (err && (err.code === 401 || err.code === 403))
                        sessionLost()
                    else // server unreachable: slow down, up to 8x
                        failures = Math.min(failures + 1, 3)
                }
                finally {
                    running = false
                    schedule()
                }
            }

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && Date.now() - lastCheck > base)
                    schedule(0)
            })
            window.addEventListener('online', () => schedule(0))

            schedule() // first check after one interval, not immediately
        }

        onEvent('beforeLogin', () => h(LoginTools))
        watchSession()
    }
}
