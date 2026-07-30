# Threads Cleaner(脆脆清道夫)

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

一個 Chrome 擴充功能,讓你可以封鎖特定 Threads 使用者,封鎖後的貼文不會出現在動態消息、單篇貼文頁面或搜尋結果裡。

> [!IMPORTANT]
> **本地端作用說明**
> 因 Threads 官方未提供開放的封鎖 API，本擴充功能的封鎖效力**僅作用於當前電腦的瀏覽器**，無法同步至手機端 App。
> 如果未來官方開放，將會補上後端封鎖的功能

---

## 📸 功能截圖

### 1. 一鍵封鎖惱人廣告

![封鎖功能截圖](./screenshots/feed-block-button.png)

### 2. 更新社群封鎖清單

![更新功能截圖](./screenshots/popup-main.png)

### 3. 個別封鎖解除

![封鎖解除功能截圖](./screenshots/popup-search.png)

## ✨ 核心特色

- **就地封鎖**:貼文的使用者名稱旁直接出現 🚫 按鈕,點擊後會先跳出確認提示,確認後才會生效,避免手滑誤觸
- **支援三大核心頁面**:涵蓋首頁動態消息、單篇貼文頁（含底下熱門回覆）以及搜尋結果
- **本地封鎖清單管理**:在 popup 裡新增、搜尋、解除封鎖,不需要離開分頁
- **匯出 / 匯入**:本地清單可以匯出成純文字檔備份或分享,也可以匯入合併,匯入時會自動略過重複與格式錯誤的內容
- **訂閱社群清單**:一鍵從遠端網址下載共用的封鎖名單並套用,更新時只抓有變化的內容,並顯示這次新增/移除了幾筆
- **保留使用者的最終決定權**:即使某個使用者是社群清單封鎖的,也可以在 popup 個別解除封鎖,之後社群清單再更新也不會把他加回來
- **即時同步**:不論是在頁面上點封鎖按鈕、或是在 popup 新增/刪除/更新社群清單,所有已開啟的 Threads 分頁都會立刻反映最新狀態,不需要重新整理頁面

## 🛠 技術棧

- **[TypeScript](https://www.typescriptlang.org/)**(strict mode)— 全專案型別檢查,不使用 `any`
- **[Vite](https://vite.dev/)** + **[@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)** — Chrome Extension Manifest V3 的打包與開發環境
- **Chrome Extension APIs** — `chrome.storage.local`(資料儲存與跨頁面同步)、`chrome.storage.onChanged`
- **原生 DOM API** — `MutationObserver` 監看頁面變化,不依賴任何前端框架(無 React / Vue),純 vanilla TypeScript class
- **Web Crypto API** — `crypto.subtle.digest` 計算社群清單內容雜湊,用來判斷是否需要更新
- **vite-plugin-zip-pack** — 建置完成後自動打包成可上傳 Chrome 線上應用程式商店的 zip

## 🚀 開發與建置說明

### 前置需求

- [Node.js](https://nodejs.org/) 18 以上版本
- npm

### 安裝依賴

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

接著在 Chrome 開啟 `chrome://extensions`,開啟右上角的「開發人員模式」,點選「載入未封裝項目」,選擇專案底下由 Vite 產生的 `dist` 資料夾。修改程式碼後,Vite 會自動重新建置,擴充功能也會跟著熱更新。

### 正式建置

```bash
npm run build
```

會先跑 `tsc` 做型別檢查,通過後用 Vite 打包到 `dist/`,並自動產生一份可直接上傳的 zip 到 `release/` 資料夾。

### 專案結構

```
src/
  content/   進到 Threads 頁面時執行的 content script 進入點
  core/      跟畫面無關的純邏輯:封鎖名單管理、清單格式解析、共用工具函式
  dom/       只有 content script 會用到、專門處理 Threads 頁面 DOM 的部分
  storage/   chrome.storage.local 的存取層
  popup/     點擊擴充功能圖示後顯示的 popup 畫面
```

`core/` 與 `storage/` 不依賴瀏覽器 DOM,由 content script 與 popup 共用;`dom/` 只被 content script 使用。

## 🔒 隱私與安全性

- **資料只留在本機**:封鎖清單(手動新增的、訂閱的社群清單)全部存在 `chrome.storage.local`,只存在你自己的瀏覽器裡,沒有任何後端伺服器,開發者也拿不到你的封鎖名單內容
- **唯一的對外連線**:只有在你主動按下「更新」社群清單時,才會對外發出一個 GET 請求下載清單內容,不會回傳任何資料給對方,也不會夾帶任何識別身分的資訊
- **不收集任何個人資料**:不會讀取、蒐集、回傳你的 Threads 帳號資訊、瀏覽紀錄或任何個人資料
- **最小權限原則**:
  - `storage`:讀寫本機的封鎖清單資料
  - `host_permissions`(僅限 `cdn.jsdelivr.net`):只用來下載社群清單這個純文字檔案
  - content script 只會在 `https://www.threads.com/*` 上執行,不會讀取或影響其他網站
- **開源透明**:程式碼公開,任何人都可以檢視實際的行為是否符合以上說明

## 📄 授權條款 (License)

本專案採用 **[MIT License](https://rem.mit-license.org)** 授權條款。

您可以自由地複製、修改、分發此軟體，甚至用於商業用途，唯獨需在所有副本中包含原始的版權聲明與許可聲明。軟體依「現狀」提供，不承擔任何擔保責任。
