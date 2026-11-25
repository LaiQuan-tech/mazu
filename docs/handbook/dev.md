# TS／腳本／本機開發的坑

> 2026-11-26 自 CLAUDE.md 原文搬來，未改寫。「上一條／下面」等字眼依原順序；`原 L` 是搬移前行號。

<!-- 原 L138-139 -->
> 【已過時：.claude/launch.json 不存在（repo 根目錄只有 CLAUDE.md，無 .claude/）。僅 launch.json 目前不存在，重建方法仍有效】

開發伺服器：用 preview_start（名稱 `dev`，port 3000），不要用 Bash 起 server。設定在 `.claude/launch.json`；若遺失，重建時 runtimeExecutable 要用 bash 包 nvm 載入（參考 git 歷史或本檔常用指令段）。

<!-- 原 L176-177 -->
## 程式陷阱

<!-- 原 L313-313 -->
- **TSX 泛型**：泛型箭頭函式在本專案推導失敗（參數變 unknown）。泛型 helper 放模組層級 `function` 宣告＋呼叫端明確標參數型別。

<!-- 原 L314-314 -->
- **狀態欄位可能為 null**：渲染前 `String(x ?? '')`。

<!-- 原 L315-315 -->
- **日期**：一律本地時區組字串（`getFullYear/getMonth/getDate`），不用 `toISOString().slice(0,10)`（台灣早上 8 點前會差一天）。

<!-- 原 L316-316 -->
- **datetime-local**：DB 的 UTC ISO 要先轉本地字串再塞 input（參考 AdminDashboard 的 `toLocalDatetimeInput`），否則每存一次漂 8 小時。

<!-- 原 L397-399 -->
- **`scripts/` 底下的腳本有兩種合法寫法，別混**（`package.json` 是 `type: module`）：
  **ESM（`.js`）** 要取 npm 套件必須用 `createRequire`——`NODE_PATH` 對 `import` 沒作用。`prerender.js`、`build-icons.js`、`build-og-scripture.js` 是這一類。
  **CommonJS 必須叫 `.cjs`**。副檔名寫 `.js` 會被當成 ESM，頂層的 `require` 直接 `ReferenceError: require is not defined`。`build-hero-assets.cjs`、`cutout-lib.cjs` 是這一類（2026-09-02 從 `.js` 改過來——在那之前它們**完全跑不起來**，檔頭寫的用法是失效的，而這件事光看程式碼看不出來，要真的執行才會發現）。

<!-- 原 L979-986 -->
- **`@types/react` 以前沒有裝，所以 JSX 的屬性從來沒被檢查過**（2026-10-30 補上）。`React.FC<Props>` 裡的 `React` 解析成 `any`，整個型別就塌了——**`tsc --noEmit` 通過對元件屬性完全沒有保證**。
  查出來的經過：把 `ReceiptIssueDialog` 的參數從 `items`／`preset` 改成 `groups`，呼叫端一行都沒改，`tsc` 卻一聲不吭；但故意寫 `const x: number = '字串'` 它立刻就抓。所以不是檢查器沒跑，是 React 的型別不存在。
  **判斷「型別檢查有沒有在保護我」要用對照實驗**，不要看 exit code——那只證明「沒有它看得懂的錯」。

  裝上去之後只冒出 3 個錯，其中**一個是真的 bug**：
  - `<button onClick={fetchAll}>` ——`fetchAll(initial = false)` 會收到 React 傳進來的滑鼠事件當第一個參數，而事件物件是 **truthy**，於是 `initial` 永遠是真、那個判斷等於沒寫。**所有「參數有預設值的函式」直接當 `onClick` 都踩得到這個坑**，要包一層箭頭函式。
  - `fillEmptyFields<T extends Record<string, unknown>>` ——interface 沒有隱含的索引簽章，所以 `DonationPersonEntry` 這種 interface 永遠不滿足那個限制。限制放寬成 `T extends object`（`Object.keys` 與展開對任何物件都成立），函式內部的 `{ ...entry }` 改用斷言而不是型別標註。

<!-- 原 L1077-1078 -->
- **`submitRegistration()` 與 `bulletin_registrations` 是死碼**（2026-10-30 查證）：全專案沒有任何呼叫端，前台沒有「活動報名」這條路。真正的活動系統是 `blessing_events`（`event_type` 有祈福／法會／進香／祭典／其他）。`getRegistrations()` 還在用——信眾名冊與會員統計會讀那張表的舊資料，所以**不要直接把表刪掉**。
