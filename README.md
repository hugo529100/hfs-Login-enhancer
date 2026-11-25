# Login Enhancer（登錄界面改進）

深色主題：

![效果圖](screenshot.png)

淺色主題（同一個插件，自動跟隨頁面配色）：

![淺色效果圖](screenshot-light.png)

HFS 3 的會話丟失後（例如服務器重啓），已打開的頁面一刷新就會彈出登錄框。這個插件在 HFS 原有登錄框上做如下改進：

- 賬號密碼輸入框上方顯示 30 秒倒計時（可在插件設置裏改秒數），倒計時數字放大顯示，時間到自動回到站點首頁；
- 如果首頁本身就需要登錄，則不顯示倒計時、也不會自動跳轉（免得跳過去又是一個登錄框）；
- 倒計時下方一個整行寬的「首頁」按鈕，直接前往首頁；
- 按鈕下方一條細綫分隔下面的賬號／密碼填寫框；
- 把 `Continue` 按鈕改成 `Login`，並讓它整行寬、加高；
- 登錄框外框線條會「呼吸」發光（1px → 4px 描邊，1.6 秒一輪）；
- 後端服務器重啓（或會話失效）後，**已打開的頁面不用刷新**就會自動彈出登錄框；
- 登錄框顯示時，把頁面頂部的 banner（`Banner-footer-plugin` 的 `#banner`）和背後那個大字「Unauthorized」都隱藏起來，改爲在登錄框頂部顯示「Unauthorized」；關閉登錄框後自動恢復。
- 界面風格跟隨當前頁面的配色：標題、倒計時數字與說明文字用 `color: inherit`（等於頁面當前的文字顏色，連半透明也算在內），呼吸外框用 `currentColor`，所以日間／夜間模式、以及主題動態改色時都會自動一致。

登錄框本身仍是 HFS 原生的那個（賬號、密碼、IP 選項、2FA 等插件的輸入項都不受影響），本插件只是在 `beforeLogin` 位置插入內容，以及改寫提交按鈕的文字與樣式。

## 安裝

1. 把整個 `Login-enhancer` 文件夾放到 HFS 的 `plugins` 文件夾裏；
2. 打開 HFS 後台 → Plugins，找到 **Login Enhancer** 並啓用（Enable）；
3. 需要時在插件設置裏調整（兩個時間都可以在面板上直接改）：

| 設置 | 默認 | 說明 |
| --- | --- | --- |
| Countdown to home page (seconds) | `30` | 倒計時秒數，`0` 表示關閉倒計時（只保留「首頁」按鈕） |
| Server check interval (seconds) | `30` | 後端通訊密度：每隔多少秒檢查一次會話是否仍然有效；`0` 表示關閉這個功能 |
| Skip countdown when the home page requires a login | 開 | 首頁也需要登錄時不顯示倒計時、不自動跳轉 |

![插件設置面板](settings.png)

## 行爲說明

- 只有 HFS **自動**彈出的登錄框（即當前頁面未授權）才會出現頂部「Unauthorized」標題、倒計時和「首頁」按鈕；從菜單手動點「Login」打開的登錄框不加這些，但仍會把 `Continue` 改成 `Login`、按鈕整行寬並隱藏 banner。
- 只要用戶開始提交賬號密碼，倒計時立即停止，不會把人從登錄過程中帶走。
- 語言跟隨頁面：英文、簡體中文、繁體中文均有翻譯（`hfs-lang-*.json`），其他語言回退到英文。
- 判斷「首頁是否需要登錄」用的是 HFS 標準的 `?get=list` 純文本列表：被登錄保護的文件夾會返回 GUI 頁面而不是純文本，據此跳過倒計時。判斷失敗時（例如網絡異常）仍然保留倒計時。
- 反代掛在子路徑時（`prefixUrl`）首頁地址會自動帶上前綴。
- 倒計時數字大小為 `min(10em, 30vw, 25vh)`，桌面上約為正常字號的 10 倍，窄屏或矮屏會自動縮小以免溢出。
- 隱藏 banner 用的是 `body.lge-login-open #banner { display: none }`，只在登錄框存在期間生效；沒安裝 Banner-footer-plugin 時沒有任何影響。
- 同樣在登錄框期間用 `body.lge-login-open .unauthorized { display: none }` 隱藏頁面背後的「Unauthorized」大字，並在本插件區塊頂部顯示 `HFS.t('Unauthorized')`（跟隨頁面語言，繁中為「未授權」）。
- 「Unauthorized」和倒計時說明兩行字用 `margin-top: -.8em` 收緊間距（實測 1.2px）；數字上下用 `padding: .12em 0 .012em`（em 基於數字本身，會跟着數字大小縮放），讓數字到上方兩行與到下方「seconds」的**視覺間距相等**（實測各 18.4px）。
- 呼吸外框由 JS 以 `style.setProperty('animation', ..., 'important')` 啟動：因為像 Orange-theme 這類主題會在高效能模式下全局 `animation: none !important`，普通 CSS 動畫會被它關掉；關閉登錄框時會自動移除這條 inline 樣式。
- 重啓檢測：插件每 `Detect server restart every` 秒呼叫一次很小的 `refresh_session` API；若返回的用戶名為空（說明服務器已重啓、會話已失效），就把 HFS 的 `state.username` 清空並把 `state.loginRequired` 設為 `true`，HFS 自己就會立刻彈出登錄框，頁面不會重新加載。
  - 節流：只對**已登錄**的頁面檢查；頁面在後台（`document.hidden`）時跳過；間隔帶 ±15% 隨機抖動；請求失敗時按 1×→2×→4× 退避（上限 4 倍），避免服務器離線時被打；頁面重新可見或網絡恢復時立即補一次檢查。
  - 只有登錄狀態下才會產生這些請求，匿名瀏覽的頁面完全沒有額外流量。

## 文件

- `plugin.js` — 插件聲明與配置
- `public/main.js` — 前端邏輯（React 組件）
- `public/style.css` — 樣式（使用 HFS 的主題變量，自動適應深色/淺色）
- `hfs-lang-zh.json`、`hfs-lang-zh-hant.json` — 翻譯
- `screenshot.png` — 效果圖

## 相容性

- 需要 HFS 3（`apiRequired = 8.65`），在 HFS 3.4.2 上測試通過（含與 Banner-footer-plugin 一起使用的測試）。
- 使用的都是 HFS 文檔化的前端接口：`HFS.onEvent('beforeLogin')`、`HFS.getPluginConfig()`、`HFS.t()`、`HFS.prefixUrl`。
