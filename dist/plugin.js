// Login Enhancer - a friendlier login dialog for HFS 3
//
// When the session is lost (for example after a server restart) HFS pops up its
// login dialog as soon as a protected page is reloaded. This plugin keeps that
// dialog but adds:
//   - a big countdown above the username field (default 30 seconds), then it
//     goes back to the home page (skipped when the home page itself needs a login)
//   - a "Home" shortcut below the countdown
//   - a thin separator between the shortcut and the credential fields
//   - a "Login" button instead of "Continue"
//
// Everything is done in the frontend: no backend hooks, no config changes.

exports.version = 1.7
exports.description = "Improves the login dialog: big countdown back to the home page, Home shortcut and a clearer Login button."
exports.apiRequired = 8.65 // plugin's own hfs-lang files + HFS.getPluginConfig
exports.repo = "hugo529100/hfs-Login-enhancer"
exports.frontend_js = "main.js"
exports.frontend_css = "style.css"

exports.config = {
    seconds: {
        type: 'number',
        label: 'Countdown to home page (seconds)',
        defaultValue: 30,
        min: 0,
        max: 3600,
        frontend: true,
        helperText: 'Seconds to wait before going back to the home page. Use 0 to disable the countdown.',
    },
    sessionCheckSeconds: {
        type: 'number',
        label: 'Server check interval (seconds)',
        defaultValue: 30,
        min: 0,
        max: 3600,
        frontend: true,
        helperText: 'How often open pages ask the server whether the session is still valid, so a restart shows the login dialog without reloading. Only logged-in visitors are checked, only while the page is visible, with randomized intervals and backoff. 0 disables it.',
    },
    skipWhenHomeRequiresLogin: {
        type: 'boolean',
        label: 'Skip countdown when the home page requires a login',
        defaultValue: true,
        frontend: true,
        helperText: 'If the home page would show this same login dialog, going back there is useless, so the countdown is not started.',
    },
}

exports.changelog = [
    { version: 1.0, message: "First release: countdown to home page, Home/Close-page buttons, separator, Login button." },
    { version: 1.1, message: "Removed the Close-page button, made the countdown number much bigger and reworked the layout." },
    { version: 1.2, message: "Full-width taller Login button, and the page banner is hidden while the login dialog is open." },
    { version: 1.3, message: "The big Unauthorized heading is hidden behind the dialog and shown at the top of the dialog instead." },
    { version: 1.4, message: "Breathing outline on the dialog frame, and the two lines above the countdown sit closer together." },
    { version: 1.5, message: "Faster, stronger breathing frame; open pages now detect a server restart and show the login dialog without reloading (throttled session check)." },
    { version: 1.6, message: "Both timings are configurable in the plugin options: countdown duration and server check interval." },
    { version: 1.7, message: "Text and outline colors now follow the current page/theme palette (light, dark, semi-transparent)." },
]
