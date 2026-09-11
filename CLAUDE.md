# 和聖壇網站（媽祖官網）操作手冊

宮廟網站：React 19 + Vite + Tailwind(CDN) + Supabase。正式站 **https://heshengtan.tw**（2026-08-10 上線，GoDaddy 註冊、DNS 也在 GoDaddy）。
`https://machu-five.vercel.app` 是 Vercel 預設網域、**測試用**，仍指到同一個部署且沒有停用——舊的分享連結不會壞，但**對外一律用 heshengtan.tw**（廟方 2026-09-02 明確要求），不要再出現在 og:url、結構化資料或任何新發的連結。
Apex 用 A 記錄指 `216.198.79.1`（Vercel 新 IP 段，不是網路上常見的 76.76.21.21）；www 走 308 轉到 apex。
先讀全域制度 ~/.claude/CLAUDE.md；本檔只放這個 repo 的操作事實與陷阱。

## 目前狀態（2026-07-06）

- **法會報名表上線收件中**（太上慈悲普渡禮懺法會，9/13 舉行、9/06 截止）。`App.tsx` 模組層級的 `FAHUI_LANDING=true` 讓報名表蓋住**根路徑**——**這是刻意的**。主官網上線時改成 `false` 再部署，其他都不用動。
  判斷集中在 `shouldShowFahui()`（根路徑＋非後台＋非志工頁才顯示），初始值與 popstate 共用同一個函式；分開寫過會導致按上一頁被報名表吃掉。
- **天上聖母經的網址是 `/scripture`**（`SCRIPTURE_PATH`，2026-09-02 新增，內容在 `scripture-data.json`，136 段經文＋註解）。跟 `/fahui`、`/volunteer` 同一套模式：初始值看網址、popstate 同步、入口用 `openScripture()` 推網址、返回走 `closeScripture()`。
  **`shouldShowFahui()` 必須排除 `isScriptureUrl()`**：`/scripture` 在 `pageFromPath()` 眼中是未知路徑會回傳 `'home'`，非官方網域上會因此被判成「根路徑」而顯示報名表，經文就打不開。新增這類路徑時都要記得加排除。
  **分享圖是廟方的書籍封面**（`public/og-scripture.jpg`，由 `scripts/build-og-scripture.js` 產生，換封面時重跑）。封面原圖是 A4 直式 1414×2000，**不能直接當 og:image**——LINE／FB 要 1200×630，直式會被裁掉、標題整個不見。腳本的作法是整張封面縮到卡片高度 94% 置中，底色取封面四角平均色 `rgb(222,198,169)`（那就是封面自己的外框色，所以接縫連續、畫面不多一種顏色）。`prerender.js` 的 ROUTES 支援 `image`／`imageAlt`，**`og:image` 與 `twitter:image` 必須一起換**，只換一個會讓 X 顯示另一張。
  **只給網址不預渲染等於半殘**：貼到 LINE 的預覽卡片會沿用靜態 index.html 的法會報名標題。已加進 `scripts/prerender.js` 的 ROUTES、`vercel.json` 的 rewrite（**放在萬用規則之前**）與 `sitemap.xml`。`App.tsx` 的 `document.title` 也要給——聖母經與志工報名有網址但不是 `PAGE_PATHS` 的一員，不明確指定就會沿用法會標題。
- **手機選單的順序是：社群 → 會員中心 → 天上聖母經 → 導覽項目 → 次要項目**。會員中心原本在最底下，項目一多就被 `max-h-[80vh]` 推到要捲動才看得到。**會員鈕要放在社群的條件式之外**——後台把社群清空時 `visibleSocials` 回傳空陣列，會員入口不能跟著消失。
- **法會報名表在官網的網址是 `/fahui`**（`FAHUI_PATH`，2026-09-02 新增）。原本報名表只在「非官方網域的根路徑」顯示，所以 heshengtan.tw 上沒有任何網址能直接開它，og:url 與 Event 只好填測試網域。現在 `shouldShowFahui()` 是「`isFahuiUrl()` **或** 原本那條非官方網域規則」，舊分享連結行為完全不變。兩顆「報名普渡法會」按鈕走 `openFahui()`，會把網址推成 `/fahui`——報名表因此可分享、重新整理不會掉回首頁。
  **改這段一定要兩種網域身分各測一遍**：把 `localhost` 暫時加進 `OFFICIAL_HOSTS` 就能在本機驗官方網域那一半，測完務必撤掉（我用 `TEMP-HOSTTEST` 標記並在部署前 grep 確認為 0）。要測的路徑：`/`、`/fahui`、`/booking`、`/volunteer`、`/?admin=1`，外加「點報名鈕→網址變 /fahui→按上一頁」。
- **志工報名表也上線了**（VolunteerRegistration.tsx，migration：`supabase/migrations/volunteer_registration.sql`）。入口只在**法會報名成功頁**（刻意不放主表單，避免拉低法會報名轉換率）。點入口會把法會表已填的聯絡資料自動帶入（precedence：連結帶入 > 志工草稿 > 法會草稿）。後台「志工報名」分頁可看名單、標記已聯絡、匯出 Excel。只收 5 項基本資料（姓名/電話/地址/生日/LINE），無排班。
- **四項服務已各自獨立成分頁**（2026-08-05）：`/booking` 預約問事、`/lamps` 祈福點燈、`/blessing` 祈福活動、`/repair` 神尊修復。首頁只剩 Hero／最新活動／關於我們／祀奉神尊／宮廟服務／隨喜捐獻。
  路由是 `page` state ＋ `history.pushState`，設定在 `PAGE_PATHS`；`NAV_PRIMARY`／`NAV_MORE` 的 `kind` 區分「分頁」與「首頁區塊」，統一走 `navTo()`。
  從分頁點首頁區塊時，區塊還沒掛上 DOM，先把目標存進 `pendingScrollRef`，等 `page` 變 home 的 effect 再捲。
  新增分頁時：加進 `PAGE_PATHS`、`SitePage`、對應的 `{page === '…' && (…)}` 區塊，`vercel.json` 的 SPA rewrite 已涵蓋任意路徑不必改。
- 導覽列：主要七項＋「更多」下拉（祈福活動／隨喜捐獻／常見問題；神尊修復由 `ENABLE_REPAIR=false` 隱藏中）。手機選單不做下拉，用分隔線區隔；展開上限是 `max-h-[80vh]`＋內層 `overflow-y-auto`（固定 px 會裁掉最後幾項）。
- 後台入口：`https://heshengtan.tw/?admin=1`（會自動跳管理員登入；`?admin=1` 會讓 `FAHUI_LANDING` 失效，所以這也是收件期間預覽官網首頁的方法）。管理員只有 armand7951@gmail.com 與 lqtech2026@gmail.com（admin_profiles 表控管）。
- 全部資料表已啟用 RLS（migration：`supabase/migrations/mainsite_rls.sql`）。訪客只能 INSERT 報名、讀公開內容；統計數字走 SECURITY DEFINER RPC。

- **`vercel env rm` 只影響「之後」的部署**：移除環境變數不會改變線上那份函式，它仍帶著舊值。
  要真正生效必須再部署一次。（拆彈時誤以為移除即生效，結果按鈕又被按了兩次、正式站又被蓋掉。）
- **Deploy Hook 與 `/api/republish`**：後台「重新發布」按鈕會打 `api/republish.ts`，那支再去打 Vercel 的 Deploy Hook。**Hook 網址存在 Vercel 的 `VERCEL_DEPLOY_HOOK_URL`（Production，加密），刻意不加 `VITE_` 前綴**——加了會被 Vite 內嵌進前端 JS，等於把「觸發正式站部署」的權限公開給所有人。授權是把登入者的 Supabase token 丟去讀 `admin_profiles`，該表 RLS 只讓人讀自己那一列，非管理員必然拿到空陣列 → 403。實測：沒帶 token 401、假 token 401、GET 405、前端 bundle 與 git 都找不到那串網址。

## 常用指令（nvm 環境，直接跑 npm/vercel 會 command not found）

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"   # 每個 shell 都要先跑這行
npm run build        # 建置（vite 不做型別檢查！）
npx tsc --noEmit     # 型別檢查（build 過了不代表型別對）
vercel --prod --yes  # 部署正式站（已連結專案 machu）
```

開發伺服器：用 preview_start（名稱 `dev`，port 3000），不要用 Bash 起 server。設定在 `.claude/launch.json`；若遺失，重建時 runtimeExecutable 要用 bash 包 nvm 載入（參考 git 歷史或本檔常用指令段）。

## 部署紀律（每次必做）

0. **一律先 commit＋push，讓 git 成為部署來源**，不要只用 `vercel --prod` 上傳本機檔案。
   為什麼寫成第 0 條：2026-08-11 之前半年都只用 `vercel --prod` 部署，git 停在幾個月前的
   commit，本機與線上落差 84 個檔案。後台的「重新發布」按鈕走 Deploy Hook 從 **git** 重建，
   一按就把正式站換成幾個月前的版本，連續發生兩次。只要 repo 落後，任何 git 觸發的部署
   （Deploy Hook、GitHub 自動部署、別台機器 clone）都是一顆未爆彈。
   趕時間可以先 `vercel --prod` 讓改動上線，但**當天要補 commit＋push**，不要讓落差過夜。
1. **`git push` 必須先成功，被拒絕就停手，不要部署。**
   `vercel --prod` 上傳的是**本機檔案**、不看 git，所以本機落後遠端時部署＝把別人的改動從正式站抹掉。
   2026-09-04 我踩過：本機落後 3 個 commit（志工停收、歲時祭曆、分享圖腳本共 16 檔），
   push 被拒但我把 push 與 vercel 寫在同一串指令的不同行，部署照跑，正式站被退回舊版約兩分鐘
   （靠 `og-hero.jpg` 的檔案大小 202452 vs 164570 確認災情）。
   正確順序是 `git fetch` → 確認沒落後 → push 成功 → 才 build＋deploy；
   指令要用 `&&` 串起來，讓 push 失敗能擋下部署。
2. `npx tsc --noEmit` 通過 → `npm run build` 通過 → 部署。
3. 部署後三驗：`curl -s https://heshengtan.tw/ | grep -o '/assets/index-[^"]*\.js'` 確認 bundle 更新；本機 preview 跑關鍵流程 DOM 斷言；preview_console_logs 零新錯誤。
   誤判防呆：若「頁面載入正常但資料全部抓不到（console 大量 fetch 失敗／對 supabase.co 的請求 521）」＝Supabase 專案暫停，**不是部署失敗**——先去 Dashboard Restore，不要回滾部署。
4. 報名表正在收件：任何影響 `FahuiRegistration.tsx`、`services/supabase.ts` 送出路徑的改動都算高風險，改完要實測一筆送出（然後用 SQL 刪測試資料，姓名用「測試」開頭以便清理）。

## Supabase 陷阱（每一條都真實踩過）

| 症狀 | 原因與處置 |
|---|---|
| 所有請求 HTTP 521 | 免費方案閒置自動暫停。到 Dashboard（專案 ref `keosbjepuvqqqhzyuplb`）按 Restore，等 1-2 分鐘。 |
| 單一表 404 | 表不存在（migration 沒跑）。migration 一律由使用者在 Dashboard SQL Editor 手動執行。 |
| anon 寫入後報 RLS 42501 | anon 只有 INSERT 權限：**insert 後不可 `.select()` 讀回**。要 id 就客戶端 `crypto.randomUUID()` 先產。 |
| 登入狀態下送出報名表失敗、未登入卻正常 | INSERT 政策只給 `TO anon` 沒給 `authenticated`。管理員登入後（存在 Supabase session）送出走 authenticated 角色 → 被 RLS 擋。**報名表的 insert 政策要 `TO anon, authenticated` 兩者都給**。症狀：只有你自己（登入測試）連續失敗、curl 與無痕視窗正常。曾耗數輪才定位。|
| 本機 supabase CLI 連到別的專案 | CLI 連結的是 PikTag，不是本專案。DDL 無法用 CLI/anon key 跑，只能 Dashboard。 |
| 前台要顯示統計（名額/累計） | 不要開放整表 SELECT。用既有 RPC：`get_booking_session_counts`、`get_repair_totals`、`get_blessing_event_stats`、`get_shared_session`。新需求照這模式加 SECURITY DEFINER RPC。 |

## 程式陷阱

- **localStorage 草稿**（`fahui_registration_draft_v1`）：改報名表欄位結構時，還原邏輯已有正規化（依 SERVICE_CONFIGS 重建），維持這個模式；新欄位要能吃舊草稿。這裡曾造成正式站白屏。
- **TSX 泛型**：泛型箭頭函式在本專案推導失敗（參數變 unknown）。泛型 helper 放模組層級 `function` 宣告＋呼叫端明確標參數型別。
- **狀態欄位可能為 null**：渲染前 `String(x ?? '')`。
- **日期**：一律本地時區組字串（`getFullYear/getMonth/getDate`），不用 `toISOString().slice(0,10)`（台灣早上 8 點前會差一天）。
- **datetime-local**：DB 的 UTC ISO 要先轉本地字串再塞 input（參考 AdminDashboard 的 `toLocalDatetimeInput`），否則每存一次漂 8 小時。
- **生日輸入全站只有一種**（2026-08-13 統一）：預設國曆，旁邊一行「我只知道農曆」是給不記得國曆的長者的次要入口。**兩條路徑輸出完全相同的合併字串**（`民國72年6月20日（農曆五月初十）`，跨年時農曆會多帶年份），所以資料庫裡只有一種格式。`solarOnly` prop 已移除。
  為什麼不留對等的「國曆／農曆」切換鈕：問題不在複雜，而在**選錯無法察覺**——信眾在農曆模式下填了國曆生日，系統照收，事後沒有任何方法分辨對錯，疏文寫錯也沒人發現。
  `parseBirthDate` 同時吃得下合併格式與舊的純農曆格式（`民國72年農曆五月初十`），舊資料照樣還原。純農曆**算得回國曆**（`Lunar.fromYmd(...).getSolar()`），先前記為「無法回推」是錯的。
- 生日元件 `BirthDatePicker`：`solarOnly` 只收國曆、自動換算農曆＋生肖；年份顯示民國年。共用元件，改動會影響官網其他表單。`solarOnly` 模式輸出「民國72年6月20日（農曆五月初十）」合併字串（含國曆與農曆），後台匯出用 `splitBirthday()` 拆成兩欄；非 solarOnly 維持舊農曆字串。舊資料無國曆月日，匯出國曆欄會空白（無法回補）。
- **會員資料自動帶入**（App.tsx 的 `selfDefaults`／`selfWithBirth` ＋ 那支 effect）：已登入且填過會員中心資料時，**標記為「本人」的那張卡片**自動帶入姓名／生日／生肖／性別／地址；其他人的卡片只帶地址。四個表單（問事／點燈／祈福／捐獻）共用同一套，送出後重置也會重新帶入。兩個必須遵守的細節：(1) **只補空欄位**，使用者改過的一律不動，沒有變動時 `fillEmptyFields` 回傳原參考避免多餘重繪；(2) **帶入生日一定要遞增 `_bKey`**——`BirthDatePicker` 的年月日是內部 state，只在掛載時從 value 初始化一次，光改字串畫面不會動（三個下拉會停在「吉年／吉月／吉日」）。新增表單時照這個模式接上。
- **生肖一律由生日推算，不開放手選**（2026-08-11）：填了生日之後生肖欄位變唯讀，只有「沒有生日」的項目（嬰靈、冤親債主常不知生辰）才保留下拉。舊版是「自動帶入但仍可改」，結果出現過生日與生肖矛盾的資料（民國112年11月5日是兔年卻存成蛇）。三個地方都改了：`FahuiRegistration` 的報名項目、`MemberPortal` 的會員資料與通訊錄。法會聯絡人與志工本來就只由 `BirthDatePicker` 寫入，沒有手選入口。
- **舊資料的三個生日格式問題**（2026-08-11 清查 55 筆，修好 4 筆）：(1) 農曆十二月存成簡體「腊」——程式月份字表用繁體「臘」，`parseBirthDate` 的 `indexOf` 會找不到、回頭解析失敗；(2) 閏月存成「閏闰六月」繁簡重複；(3) 春節前出生的農曆年沒標出來（`民國107年2月1日（農曆臘月十六）` 實際是農曆 106 年）。三者現行程式都已修正。**寫比對用的 SQL 時注意繁簡**：用 `LIKE '%臘月%'` 找不到存成「腊」的舊資料，會靜默失效。另有 4 筆是會員中心帶入的純農曆格式（無國曆），無法回推，屬已知限制。
- **會員中心不再有自己的曆法邏輯**（2026-08-13）：原本 `MemberPortal.tsx` 複製了一整套（月份字表、`buildSolarResult`／`buildLunarResult`／`parseBirthDate`）與兩份生日 UI，與 `BirthDatePicker` 平行維護——那正是資料庫裡出現兩種生日格式的原因。全部刪除改用共用元件，檔案從 1360 行降到 972 行。要改生日的行為只有一個地方。
- ~~會員生日的儲存格式是**農曆字串**~~（已統一為合併格式，保留此條說明歷史）（`民國72年農曆五月初十`，MemberPortal 產生），不是 solarOnly 的合併字串；`parseBirthDate` 只吃得下前者，測試時別用錯格式。
- 後台匯出/篩選：`inDateRange()` 依報名日期（本地時區）篩選、`DateRangeFilter` 共用元件；匯出走 `filtered` 會跟著日期範圍。法會/志工兩分頁都有。
- **Hero 香煙（`components/IncenseSmoke.tsx`）**：**畫一條會捲的曲線，不要用粒子**。第一版做粒子模擬，粒子一散開單顆濃度就掉到看不見，整體只剩一片霧——廟方要的是「細細長長的一縷白煙」，粒子做不出來。三個關鍵：(1) **螺旋要 x、y 同時繞**（`COIL`）——只讓 x 擺動、y 單調往上，畫出來是鋸齒像閃電；真實的煙是繞著上升軸的螺旋，側看會投影成一串壓扁的橢圓、甚至自我交疊，那才是麻花感。(2) **擾動隨高度才加進來**（`LAMINAR`/`TRANSITION`），下段直、上段捲，這是線香層流轉紊流的真實行為。(3) **柔邊靠疊四道**（`PASSES`）由寬而淡到窄而濃，只畫一道不是銳利得像鐵絲就是糊得像霧。形狀的相位隨時間往上跑、速度等於煙速（`RISE_SECONDS` 換算），煙的形狀是被氣流整段帶著走的。線很細所以要照實際像素畫，用一半解析度會糊掉。(4) **整條一次 `fill()`，不要分段 `stroke()`**——舊版把曲線切成 40 段各自描邊，`lineCap:'round'` 讓每段的圓頭與下一段重疊、螺旋自我交疊處又再疊一次，alpha 相加就是一串「反光顆粒」（離線量到沿線 35 個亮點，接近 240/6=40 個接縫）。改成沿中心線推出半個線寬、繞一圈成封閉多邊形整條填滿：沒有接縫，而且 nonzero 填充規則對自我交疊只填一次。濃度改用垂直線性漸層（`alphaAt` 只跟高度有關，剛好對得上）。改完亮點數降到 4、相鄰起伏降到 1/10；因為不再疊加，平均亮度掉 17%，`PASSES` 的 a 要乘 1.3 補回來。捲離 Hero 或切分頁會停掉 rAF；可見與否一律以 `getBoundingClientRect` 為準，不採信 IntersectionObserver 的 isIntersecting（誤報一次 false 就會永遠停住）。
- **首頁分享圖 `public/og-hero.jpg` 由 `scripts/build-og-hero.js` 產生，Hero 一改就要重跑**（用法在檔頭，第二個參數可指到暫存目錄先驗收）。兩件事寫在腳本裡：(1) **三尊的座標是量出來的不是排出來的**——把視窗設成 1200×630（正好是 og:image 尺寸）開正式站，抄三張 `<img>` 的 `getBoundingClientRect()`，卡片與首屏因此是同一個版面，不必自己換算比例；重量的程式片段附在檔尾。(2) **背景不是單純的 hero-gold**——Hero 上方有暗化（頂端只保留 0.54，到 y=300 回到 1.0），腳本不寫死那條曲線，而是拿 `scripts/assets/og-hero-wordmark.jpg`（左側字標帶素材）除以金底反推，素材換了也不會失準。字標帶直接沿用素材，不重排文字，免得字型不同產生差異。
- **`scripts/` 底下的腳本有兩種合法寫法，別混**（`package.json` 是 `type: module`）：
  **ESM（`.js`）** 要取 npm 套件必須用 `createRequire`——`NODE_PATH` 對 `import` 沒作用。`prerender.js`、`build-icons.js`、`build-og-scripture.js` 是這一類。
  **CommonJS 必須叫 `.cjs`**。副檔名寫 `.js` 會被當成 ESM，頂層的 `require` 直接 `ReferenceError: require is not defined`。`build-hero-assets.cjs`、`cutout-lib.cjs` 是這一類（2026-09-02 從 `.js` 改過來——在那之前它們**完全跑不起來**，檔頭寫的用法是失效的，而這件事光看程式碼看不出來，要真的執行才會發現）。
- **神尊去背（`scripts/build-hero-assets.cjs`＋`scripts/cutout-lib.cjs`）**：廟方給新照片時跑這支就好，用法寫在檔頭（sharp 裝在暫存資料夾，別寫進 package.json）。**輸出目錄可用第一個參數指定，驗證改動時務必指到暫存目錄**——預設會直接覆蓋 `public/`，而現在那三張是廟方給的去背圖、不是這支產的。作法是「顏色判定＋從四邊長進來的連通元件＋斷細頸」，不是單純的色鍵。兩個踩過的坑：(1) **sharp 對單通道 raw 做 `blur()` 會自動升成 3 通道**，沒接 `.toColourspace('b-w')` 拿回來的 buffer 長度是 3 倍，alpha 會整片錯位；(2) 不要用 sharp 的 `trim()` 裁透明邊界——它比的是 RGB，而透明處的 RGB 還留著原始背景，會裁到莫名其妙的範圍，自己算 bbox 再 `extract()`。原則：**寧可留一點背景也不要咬掉神尊**（Hero 底是金色，殘留的黃牆幾乎看不出來，缺一塊袍子很明顯）。實際咬過頭的兩個原因：(1) **形態學開運算（fgOpen）會刪掉細長突出物**——濟公手上的法器、帽尖、冠帽流蘇都是這樣消失的，已經拿掉不再使用；(2) **顏色門檻抓太鬆**：白背板實測 s 只有 0.03–0.04，用 s<0.18 會把神尊身上的銀線繡、珍珠、淺色布一起判成背景。灰背板改用色相切（背板偏藍 h≈205，神尊是暖色 h≈42）比用亮度安全得多。驗收要用 `-tmp-mask.png` 這種**未裁切的全幅遮罩**疊回原圖看，拿裁切後的 PNG 去對位會因為 bbox 不對稱產生假的「被咬掉」。
- **Hero 神尊在平板直立會被切（`HERO_DEITIES`）**：桌機那組尺寸原本是純 vh，平板直立（iPad 第十代 820×1180）螢幕又高又窄，整組寬到 949px 卻只有 820px 可放，最左邊的濟公被切掉快一半。解法是每個 vh 都包 `min(A vh, A×1.10 vw)`，**1.10 這個比例八個值要一起改**；長寬比 1/1.10≈0.909 是分界，比這寬走 vh（桌機完全不受影響），比這窄走 vw。同時要把 `sm:max-w-[…vw]` 改成 `sm:max-w-none`——那三個上限加起來是 156vw，窄螢幕上同時觸頂反而是撐寬的元凶。負邊距要寫 `mb-[calc(min(…)*-1)]`，寫 `-mb-[min(…)]` 會產出無效的 `-calc(...)`。係數之前是 0.79，那是配「三尊並排、總寬 121vh」算的；改成前後疊之後整組只剩約 80vh 寬，才放寬回 1.10。實測 820×1180 組寬 717px、1024×1366 組寬 895px，都塞得下。
- **手機的 Hero 也要 vh clamp，否則主神會被切頭（`HERO_DEITIES`）**：stage 是 `h-[121vw] max-h-[64vh]`，畫面偏矮偏寬時（高寬比 < 1.89，例如瀏覽器網址列吃掉可視高度）`max-h` 會把 stage 壓短，但神尊若是純 vw 就不跟著縮，**最高的那尊被切頭——而那正好是主神**（實測 479×816 時三媽冠帽被切 19px）。手機那組每個值也要包 `min(A vw, A×0.529 vh)`，**八個值一起改**；0.529 = 64/121，即 stage 上限與基準高的比值，這樣 `max-h` 一生效整組等比縮小、比例不變。負邊距一樣要寫 `mb-[calc(min(…)*-1)]`。實測 479×816／393×660／360×640／430×932／375×812 五種比例，主神頂被裁都是 0。
- **Hero 三尊的身分弄錯過三次（`HERO_DEITIES`）**：左前＝濟公、中後＝**天上聖母三媽（主神、橘袍黑面）**、右前＝**天上聖母二媽（黃袍金冠）**。
  依據是**廟方自己的檔名**：`~/Downloads/神明正照/三媽.jpg` 就是橘袍黑面那尊；2026-09-02 廟方給的正面照 `神明正照 (1)/天上二聖母.png` 是黃袍、`五師父.png` 是濟公。
  **已知資料衝突，動身分之前一定要問廟方**：舊那批 `神明正照/二媽.jpg` 是「紅袍藍龍紋」那尊、不是黃袍，新舊兩批對「二媽」的指認不一致。現行採用新那批＋廟方 2026-09-02 的指認。
  歷史：2026-09-01 的「正名」把兩尊媽祖對調過一次；2026-09-02 我誤讀敘述又往錯的方向對調第二次，同一天修回來。**只看檔名不看圖會錯，只看圖不問廟方一樣會錯。**
  分辨兩尊媽祖：取袍身下半部的色相中位數——三媽約 21°（橘）、二媽約 45°（黃）。濟公約 27°，跟三媽接近，這招只用來分辨兩尊媽祖。
  換照片時 `drop` 一定要重算：`臉高 = 圖高×(1−臉在圖中的相對位置) − drop`。現行值：濟公 0.24、三媽 0.28、二媽 0.35。臉的位置用「每 5% 一條網格」目視讀，別寫顏色規則自動找——三媽是黑面，她的手與軀幹跟臉同色，程式會抓到胸口。
- **Hero 構圖是「主神在後、二媽與濟公在她面前」**（廟方 2026-09-02 給合成圖指定）：三媽最高最大但 `z-1` 疊最底層，身體被前面兩尊擋住、只露出頭與冠帽；前兩尊的臉大致齊高。高度比 57:98:76（濟公:三媽:二媽）是從那張合成圖量出來的。
  **驗收只看「頭有沒有被蓋到」**——身體被蓋是刻意的。用實際像素判定（`上層不透明 ∩ 下層頭部不透明`），頭部矩形會誤判因為四角本來就透明。現況 1280×800 是 0.00/0.00/0.36%、375×812 是 0.00/0.00/0.22%。
  `scripts/build-hero-assets.cjs` **產不出現在 public/ 那三張**：2026-09-01 起廟方直接給已去背的原圖，只需裁 alpha 邊界＋縮到 1600 高（腳本輸出的是 1400、且會再跑一次 cutout）。要重跑先確認手上的原始檔是不是未去背。
- **`public/` 的圖換了，信眾會看到舊圖（`vite.config.ts` 的 `__HERO_V__`）**：Vite 只幫 `import` 進來的資產加指紋，`public/` 底下的檔名永遠一樣。線上回應本來就是 `cache-control: public, max-age=0, must-revalidate`，**但那是請求不是保證**——只要瀏覽器記憶體快取／CDN／公司 proxy 有一層沒照做就餵舊圖。最難察覺的是**混搭**：2026-09-02 首頁同時出現舊的二媽與新的三媽，而那兩版剛好是同一尊，看起來就是兩尊一模一樣的神像並排。
  作法是建置時算內容雜湊注入 `__HERO_V__`，網址變成 `/hero-sanma.webp?v=2651625a`，內容一改雜湊就變＝換了網址。**換圖不需要手動改版號**（會忘記的東西不要交給人記）。新增會替換的 `public/` 圖檔時，把檔名加進 `vite.config.ts` 的 `HERO_FILES`，前端用 `heroSrc('檔名')` 取網址。
  `index.html` 的 preload 由 `transformIndexHtml` plugin 補同一個版號——**兩邊不一致等於預載了另一個網址，白預載一次**。
- **遷址方案手機卡片**（`components/RelocationPage.tsx`）：只列「這一級有的」項目，沒有的不要畫灰色「—」。桌機是矩陣表格、橫向能比較各級差異，畫「—」才有意義；手機一級一張卡沒有比較對象，列一堆「—」是干擾（廟方明確反映過）。金額的「元」由 `withCurrency()` 在渲染層補，後台只存數字，「隨喜」這種非數字不會被加上單位。
- **滾動視差／進場（`hooks/useScrollMotion.ts`）**：全站一個引擎，App 掛一次掃全 document。元素只要掛 class：`.sr`＋`.sr-up/left/right`（進場）、`.sr-figure`（正向位移 96px）、`.sr-counter`（反向 56px），`data-par` 可覆寫幅度。**三件事必須分在三層元素上**：進場的 transform 由 CSS 給、視差的 transform 由 JS 寫成 inline、卡片自己的 `hover:-translate-y-*` 又是第三個 transform——疊在同一個元素上只會剩一個生效。另外 Tailwind CDN 排在自訂 `<style>` 之後，元素若帶 `transition-all` 會把 `.sr` 的 0.85s 曲線壓成 150ms，這種卡片要把 `.sr` 放外層包一層。
- **把既有元素包進新容器時，檢查它有沒有「靠父容器生效」的 class**：`flex-1`、`col-span-*`，以及最容易漏的**隱性依賴**——輸入框沒寫 `w-full`、單純靠 grid 自動拉滿。包一層 `<label>` 之後，grid 的子元素變成 label，input 只剩瀏覽器預設寬度；而預設寬度取決於字級，**小字級的裝置上看起來變窄、大字級的裝置上反而溢出被裁掉**（同一個 bug 兩種表現，2026-08-13 踩過）。驗收時要比對寬度，不能只確認新元素有出現。
- **歲時祭曆（`/calendar`，2026-09-02 建置、2026-09-09 上線）**：神明聖誕與壇務活動的年度條列。
  **兩種資料刻意分兩張表**：`deity_feasts` 存「每年重複的規則」（農曆／國曆／節氣三種型態），`blessing_events` 存「今年這一場」的確定國曆日。聖誕是農曆固定日、換算成國曆每年都不同（媽祖三月廿三：2026 是 5/9、2027 是 4/29），塞進 blessing_events 就得每年手動補 38 筆。前台把兩者合併排序。
  **算不出日期時要據實顯示「今年無此日」**，不要拿鄰近日期頂替——閏月每 19 年才輪 7 次，指定的閏月該年沒有就是沒有。`lunarToSolar()` 會反查確認，因為 lunar-javascript 對不存在的日期是回鄰近值而不是報錯。
  **農曆三十是唯一的例外**：三十講的就是「該月最後一天」，小月那年沒有三十，但鬼門關（七月三十，地藏王菩薩聖誕）年年都關，只是提前到廿九——廟方 2026-09-09 確認這尊記的正是「農曆七月最後一天」。所以 `resolveFeastDate()` 回 `{ date, adjusted }`，三十遇小月退到廿九並把 `adjusted` 設 true，前後台都標「小月改列廿九」。**不可以讓換算過的日期跟原日期長得一樣**，否則廟方會以為自己填的三十那年真的存在。實測 2024–2035，七月是小月的只有 2026、2029、2035。
  **節氣不能用 `getJieQiTable()`**：那張表以農曆年為範圍，查 2026 會拿到 2025-12-21 的冬至。改用掃描該國曆年每一天比對 `getJieQi()`。
  **農曆字表在 `services/lunarCalendar.ts`**（2026-09-02 從 BirthDatePicker 抽出共用）。行事曆與生日欄位用同一份，不要再各抄一份——會員中心平行維護整套曆法邏輯正是兩種生日格式的成因。月份一律用這份字表，函式庫的 `getMonthInChinese()` 十二月會給簡體「腊」。
  **後台每一列即時顯示今年與明年換算後的國曆日期**：廟方填的是「農曆三月廿三」，但要對的是「今年到底哪一天」，不當場換算就沒有任何地方會發現填錯。
  **資料由廟方逐筆確認後才建立（2026-09-09 完成，共 28 筆）**：先以 sim.org.tw 台灣神明生日一覽表與聖弘文創對照表兩份來源交叉比對填 27 筆，再由廟方指認本壇特有稱謂的本尊（茉莉媽祖＝媽祖、天觀音＝觀世音菩薩、老駕／和緣／顧爐太子＝三太子、天官武財神＝中路財神趙元帥）與提供其餘日期。**黃府千歲日期未知，廟方明確要求不建立**——這張表沒有「有這尊但日期不明」的表示法，硬填一個日期會讓信眾照著跑一趟。
  **同一位神明的多尊合併成一筆**：天上聖母（七尊）、觀世音菩薩（兩尊）、濟公師父（兩尊）、三太子（三尊）都同日，一尊一筆會讓前台出現連續七列日期一樣只有名字不同的項目。同日的土地公是另一位神明，不併。**合併後不要在 `note` 裡列出本壇奉祀哪幾尊**——標題已經寫明是哪一位，再列一次是同一件事講兩次（廟方 2026-09-09 指出）。`note` 只留別名與規則說明（順天夫人的三個別稱、火神＝火德星君、地藏王的「七月最後一天」）。
  **歲時祭曆與祀奉神尊刻意不綁定**（2026-09-09 廢除 `deity_id`）：原本每筆聖誕可關聯 `deities` 的一尊，但合併筆是一對多、1:1 外鍵接不住只能填 NULL；前台唯一用途是在日期後再掛一次神尊名（「農曆五月十八　張天師」），標題已經是「張天師聖誕」純屬重複；後台每建一筆就多選一次，設定變麻煩卻沒有回報。欄位與程式端都已清除，不要再加回來。
  **`ENABLE_CALENDAR` 開關要三個地方一起改**：本旗標、`scripts/prerender.js` 裡 `/calendar` 那筆的 `enabled`（sitemap 也由它產生）、`vercel.json` 的 rewrite 要排在萬用規則之前。**關閉時刻意不擋網址**——廟方要一邊在後台建資料一邊開前台核對，照 ENABLE_REPAIR 讓網址跳回首頁就沒法預覽；沒有連結指過去也不在 sitemap，信眾走不到。
  **預渲染只產生靜態殼**（meta 與 noscript 說明，見 `dist/calendar.html`），聖誕列表是執行期才向 Supabase 抓的。所以資料庫改 `is_visible` 之後前台立刻反映，不必重新建置；反過來說，開旗標前要先確認有 `is_visible = true` 的資料，否則信眾看到的是「行事曆尚未建立」。
  `prerender.js` 的 `ACTIVE_ROUTES = ROUTES.filter(r => r.enabled !== false)` 是這次加的，未開放的頁不預渲染、不進 sitemap、也不出現在各頁 noscript 的站內連結。
- **前台區塊要暫時隱藏就加旗標**，不要註解掉整段：照 `ENABLE_REPAIR`／`ENABLE_BULLETIN` 的模式，同時處理導覽列項目、區塊本身、捲動高亮，以及**其他頁面指向它的連結**（漏掉最後一項會變成「按了沒反應」）。
- **不透明度修飾詞的數字必須落在 Tailwind 的級距上，否則整條規則靜默消失**：`bg-[#F0E9CE]/98` 產不出任何東西（級距沒有 98），元素變成完全沒有背景。手機選單就是這樣變成「沒有底色的純毛玻璃」——只剩 `backdrop-blur`，疊在 Hero 的金箔上文字幾乎看不見（廟方回報「玻璃霧面透明、看不清楚 menu 的內容」）。**它不會報錯**，class 明明寫著顏色卻毫無作用，只能靠量 `getComputedStyle(...).backgroundColor` 是不是 `rgba(0, 0, 0, 0)` 抓出來。要用 98 這種數字得寫 `/[0.98]`，或直接給 inline style。查的時候注意 `hover:` 前綴的 class 沒 hover 本來就沒值，那是誤判。
- **導覽列的底色、文字色、品牌淡入共用 `navSolid`**（`!navOverHero || isMenuOpen`），不要各自去看 `navOverHero`。各寫各的就會兜不起來：底色改成「選單展開也上色」而 X 關閉鈕還在看 `navOverHero`，結果米色底配白色 X、對比只有 1.24:1，按鈕等於消失。
- **選單裡要「凸顯」某一項時，不要沿用「目前所在頁」那組 `bg-temple-gold/15 + text-temple-red`**：金底在導覽列本來代表「你在這裡」，語意會打架；而且那組實測只有 4.54:1，比旁邊的純文字項目（11.49:1）還難讀——凸顯的那一項反而最看不清楚。用更濃的金底配深字（`bg-temple-gold/30 + text-[#3D2800]`，量到 9.22:1）。
  **桌機導覽列已經沒有空間**：實測 1024px 時那一列用掉 949px、可用 945px，已經超出 4px。要再加一個頂層項目，必須先拿掉一個現有的。天上聖母經因此是放在「更多」下拉的最上方，不是外層。
- **聖母經內頁的插圖位置由內容決定（`components/ScripturePage.tsx`）**：手機版原本 `.sp-section-inner { flex-direction: column }`，不管經文多短插圖一律在最上方，短經文旁邊就留一大片空白（廟方回報）。現在插圖與**經文**並排、塞不下才被擠到上面。
  關鍵是 `.sp-text { display: contents }`：把「文字」那一層的框拿掉，讓經文／分隔線／註解升格成 `.sp-section-inner` 的 flex 項目——插圖與經文因此同層才可能並排，註解則用 `flex-basis:100%` 自己一行。桌機不受影響（規則只在 767px 以下）。
  換行門檻＝插圖的 `flex-basis`（140px）＋間距：實測 375px 螢幕上經文寬 ≤158 並排、≥189 插圖被擠到上面。改門檻就改那個 basis。
  兩個對齊細節：**經文 `align-self: flex-start`**（直排閱讀起點在右上；短經文靠下會沉在插圖底部），**整列 `justify-content: center`**（插圖有 `max-width:60%` 上限吃不下剩餘空間，預設 flex-start 會把餘白全堆在尾端——短經文那幾節整組被推到一邊、另一邊空 79px）。
  插圖的 `align-self` 實測**永遠不生效**：它一定是該列最高的元素、自己定義列高。留著只是為了將來字級變大讓經文超過插圖時仍有合理行為。
- **`ScripturePage.tsx` 的 CSS 寫在 JSX 的樣板字串裡，註解**不能**出現反引號**：會直接把字串截斷，型別檢查噴一長串 `'}' expected`，但錯誤位置指向別處，很難一眼看出是註解害的（2026-09-02 踩過）。
- **Tailwind preflight 的預設邊框色是 gray-200**（`rgb(229,231,235)`，看起來就是白線）。所以**不要靠加減 `border-*` class 來決定「有沒有線」**：class 一移除顏色立刻跳回那個灰白色，而 `transition-all` 讓寬度花 300ms 從 1px 縮到 0——那 300ms 就是一條很明顯的白線（導覽列踩過，廟方回報「往下滑 menu 下緣會出現白線」）。正確作法是**邊框常駐、只換顏色**：`border-b` 一直掛著，在 `border-transparent` 與目標色之間過渡。
- **導覽高亮（`handleScroll` 的捲動高亮）**：判定線用 `innerHeight*0.35`（夾在 120–300），不要改回固定 120px——`section[id]` 的 `scroll-margin-top` 是 80px，捲到定位時區塊頂端就在 80，跟 120 只差 40px，平滑捲動少捲 41px 高亮就退回上一個區塊（症狀：點「祀奉神尊」卻亮「關於我們」）。另有 `navLockRef`：點導覽後的平滑捲動期間停掉捲動高亮，否則途中每經過一個區塊就改一次。換頁的 `window.scrollTo` 要指定 `behavior:'instant'`，CSS 有全域 `scroll-behavior: smooth`。

## 流量追蹤與 UTM（2026-09-09 建置）

- **追蹤碼掛載在 `components/Analytics.tsx`，編號填在後台「追蹤碼」分頁**（`site_settings` 的 `ga4_id`／`meta_pixel_id`／`gtm_id`）。刻意只存編號不存整段 `<script>`：後台一被盜就能對所有訪客植入任意腳本。
  **2026-09-09 實測：GTM 容器 `GTM-NW9Z5NWQ` 是空的**——`curl 'https://www.googletagmanager.com/gtm.js?id=GTM-NW9Z5NWQ'` 回 `"tags":[]`、`"predicates":[]`、`"rules":[]`，GA4 與像素兩欄也空白。**等於整站沒有在收任何流量資料**，卻讓每個訪客白載 331KB 的 GTM。容器內容是公開的，要確認廟方到底掛了什麼直接 curl 那支 gtm.js 抓 `"tags":`，不必登入 GTM 後台。
  建議改成後台直接填 GA4 ID、清空 GTM 欄：`Analytics.tsx` 本來就內建 SPA 換頁的 page_view，走 GTM 反而要在容器裡自己建 `spa_page_view` 觸發器（現在沒有），多一層就是多一個沒人維護的地方。
- **`<Analytics>` 掛在 App 的四個 return 分支**（首頁／法會／聖母經／志工），那四個分支的根節點型別不同，**切換分支時 React 會整個卸載再重新掛載**。所以它的狀態（`loaded`／`settings`／`lastSentPath`／`entryViewSent`）**一律放模組層級，不要用 useRef**——放 ref 就會每切一次分支重新注入一次 GTM／GA4 腳本，並且把那一次當成「進站第一次」再送一遍 UTM。
- **StrictMode 會讓「只跑一次的守衛 + cancelled 旗標」這個組合永遠載不起來**：第一次掛載啟動 fetch → cleanup 把 `cancelled` 設 true → 第二次掛載被 `loadedRef` 擋掉直接 return → fetch 回來時已經沒有人採用它。正式站沒有 StrictMode 所以看不出來，**但本機也就永遠驗不了追蹤碼**——空的 GTM 容器長期沒被發現，這是原因之一。兩者只能擇一。
- **UTM 來源歸因在 `services/attribution.ts`**。四件事各有理由，改動前先讀完：
  1. 進站時把 `utm_*` 收進 **sessionStorage**（不是 localStorage）。UTM 描述的是「這一次來訪」；放 localStorage 會讓幾個月前那檔活動的來源黏在裝置上，之後每一筆報名都算給那一檔。
  2. `withKeptParams(path, alsoDrop)` 給所有 pushState 用：洗掉 `utm_*`／`fbclid`／`gclid`，**保留功能性參數**。原本推的是純路徑，所以 `?share=`（揪團）與 `?preview=1`（工作人員預覽）進站後點一下導覽就消失、重新整理找不回那場共享報名——那是既有 bug，一併修掉了。
  3. **`closeVolunteer` 必須額外拿掉 `volunteer`**：`isVolunteerUrl()` 認得 `?volunteer`，只換路徑而留著這個參數等於沒關掉。
  4. **進站那一頁刻意不清網址列上的 UTM**。GA4／GTM 初始化時會讀真實的 `document.location`，一載入就清掉的話，日後廟方把 GA4 掛進 GTM 容器（而不是後台那個欄位）歸因就整個失效。UTM 是在**第一次站內換頁**時才從網址上拿掉的。
  **只有進站第一次的 page_view 帶 UTM**，換頁不帶——同一個來源重複宣告只會在報表製造雜訊。也刻意不把 `?share=<uuid>`／`?admin=1` 送進 `page_location`：那是識別碼不是流量維度，送進去只會製造高基數的雜訊。
- **報名來源存在六張轉換表的 `source` 欄**（2026-09-09，migration：`supabase/migrations/utm_source_column.sql`）：bookings／donations／lamp_registrations／blessing_registrations／fahui_registrations／volunteer_registrations。值由 `getSource()` 產生，格式 `line/broadcast/pudu2026`；沒有 UTM 就退回 referrer 網域（`google.com`），再沒有就是 `direct`。
  **為什麼要存自己這一份而不是只看 GA4**：GA4 只說得出「300 人從 IG 來」，廟方要的是「這 12 筆點燈是抖音那支影片帶來的」。而且 **LINE 的內建瀏覽器不送 referrer**，GA4 會把 LINE 來的人全算成「直接流量」——只有這一欄看得到 LINE 群發到底有沒有效。
  **`NULL` 與 `'direct'` 是兩件事**：NULL＝這筆早於追蹤上線（2026-09-09 以前），`direct`＝有追蹤但這個人沒有來源。所以那欄刻意不給 DEFAULT，給了就再也分不出來。
  **那一欄刻意不加 CHECK constraint**：這是報名的送出路徑，CHECK 一旦擋下來整筆報名就失敗——追蹤欄位絕對不可以把轉換擋掉。長度與字元由 `cleanSource()`（attribution.ts）負責，同時處理了 Excel 公式注入（`=cmd|…` 開頭的值會被清成安全字串）。
  注入點集中在 `services/supabase.ts` 的 6 個 insert，UI 完全沒動。讀取端 6 支 getter 都是逐欄 map，各補一行；blessing 走共用的 `mapBlessingReg`，改一處兩支 getter 一起受惠。
- **後台看得到來源的地方**：問事／捐獻／點燈／祈福四類共用 `MemberInfoModal`（點整列展開），來源顯示在「登記時間」下面；法會在展開區的聯絡資料那一行；志工在卡片右下角。
  **匯出有七支加了「報名來源」**：法會明細、法會總表、志工、預約、捐款、點燈、祈福。
  **三支刻意沒加**：`信眾名冊`（跨表聚合，而且它已經有一個叫「參與管道」的欄，成本高又容易混淆）、`法會報名完整表`（35 欄固定索引的列印用表格，動欄位會擾亂既有版面）、`法會多分頁活頁簿`（8 個項目分頁各自欄序不同，而來源是「報名層級」的值，每個牌位重複一次只是雜訊）。法會本身已有兩支匯出帶來源，不缺這一份。
- **後台「流量來源」分頁（`TrafficTab`，2026-09-09）**：`ROLE_ALLOWED_TABS` 開給 admin 與 staff，財務組不給（他們只看應收）。分成「總表」（依來源彙總：筆數、佔比、金額、六種服務各幾筆）與「明細」（每一筆報名的時間／服務／姓名／金額／來源），共用同一組日期區間篩選，各自可匯出 Excel。
  **統計一律排除 `source` 為空的舊資料**：那是追蹤上線前的，混進來會把每個來源的比例稀釋到看不出差別。但它的筆數要顯示在卡片上（「未追蹤」），否則剛上線時整頁空白會被當成壞掉。
  **空狀態要講「怎麼做才會有數字」**，不要只寫「尚無資料」——廟方看到的第一個畫面就是空的，那一頁得自己把 `?utm_source=…&utm_medium=…&utm_campaign=…` 的用法講完。
  金額的算法與應收管理（`ReceivablesTab`）共用同一套規則：點燈的金額不在報名紀錄上要去 `lampConfigs` 對、祈福是方案費加上加購總和。**不要另立一套**，兩頁對不起來就沒人信。
  **「已取消」的報名一律不計**（問事／點燈／祈福三張表都有這個狀態）：它既不是收入也不算成功的轉換，算進去等於幫每個管道灌水。
  **金額是「報名金額」不是「已入帳」**，法會的待匯款也在裡面。頁面上必須寫明這個口徑——不寫的話廟方會拿它當收入看，而實際入帳在「應收管理」那頁。問事與志工沒有金額，只計筆數。
  **新增後台分頁要動五個地方**：`type Tab`、`allNavItems`、`NAV_GROUPS`、`types.ts` 的 `ROLE_ALLOWED_TABS`、以及渲染區塊的 `{tab === '…' && <XxxTab />}`。漏掉 `ROLE_ALLOWED_TABS` 會被 `navItems` 濾掉、選單上完全看不到，而且沒有任何錯誤訊息。
- **後台分頁的 UI 要怎麼驗（它需要登入，開發時進不去）**：用 Vite 的模組圖把單一 tab 元件掛到一個浮層上測。
  **關鍵陷阱：`await import('react')` 拿到的不是 app 那份 React**（index.html 走 esm.sh，Vite 內部走預打包那份），混用會直接噴 `Invalid hook call`。要 `await import('/node_modules/.vite/deps/react.js')` 與 `.../react-dom_client.js`，才是同一個實例。
  元件平常不 export，測的時候暫時加 `export`、測完撤掉即可。這個方法能餵假資料驗聚合數字、空狀態與 RWD，比開後台快得多。
- **`admin-table` 的每個 `<td>` 都必須有 `data-label`**（class 定義在 `index.css:89-135`）：1023px 以下整張表會變成卡片，欄位名就是從 `data-label` 來的，漏掉的那一欄在手機上會變成沒有標題的孤兒值。
- **`DateRangeFilter` 一定要 `flex-wrap`**（2026-09-09 補）：兩個 date input 加標籤實測要 384px，手機 390px 扣掉頁面內距只剩 348px，不換行整頁會橫向溢出 36px。法會、志工、流量來源三個分頁共用這支，桌機夠寬不會觸發、版面不變。

- **`source` 這個名字在本專案有兩個意思，不要弄混**：`services/devoteeRoster.ts` 的 `DevoteeSource` 是「參與管道」（法會報名／志工／問事／捐款／點燈），在信眾名冊那一頁篩選與匯出用；本節講的 `source` 是 UTM 流量來源。UI 文案一律寫「報名來源」與「參與管道」區隔，不要只寫「來源」。

- **規劃全文與 UTM 命名對照表在 `docs/utm-plan.md`**，包含廟方要照抄的 source／medium／campaign 固定值。三條鐵律：站內連結絕對不加 UTM（會被判成新的來訪、蓋掉原本的歸因）、值一律小寫英數、一個檔期固定一組值不要手打。

## SEO 與 AI 檢索（2026-08-10 建置）

本站是純前端渲染的 SPA，**原始 HTML 的可見文字是 0 個字**。Google 會執行 JS 所以看得到，但 GPTBot／ClaudeBot／PerplexityBot 這類 AI 檢索器**不執行 JS**——沒有下面這些東西，AI 對本站一無所知。

- **預渲染（`scripts/prerender.js`）**：由 `npm run build` 自動接著跑。拿剛建好的 `dist/index.html` 當模板，為 /about /booking /lamps /blessing /relocation 各產一份靜態 HTML，換掉 title／description／canonical／og，再補該頁的 JSON-LD 與 `<noscript>` 內容。**必須跑在 vite build 之後**（資產 hash 要對得上）。它不會真的執行 React，所以後台資料（公告、神尊、關於我們內文）不會進靜態 HTML；要連那些一起靜態化得換 puppeteer 版，屆時注意 `/` 在非官網網域會顯示報名表，快照時要讓瀏覽器以 heshengtan.tw 的身分解析。
- **`sitemap.xml` 由 `scripts/prerender.js` 從 ROUTES 產生**（2026-09-02 起），`public/sitemap.xml` 已刪除並列入 .gitignore。原本是手寫的，新增 `/scripture` 時要記得回去補一筆——漏掉不會有任何錯誤訊息，只是那頁比較晚被收錄（`/deities` 甚至連 `lastmod` 都漏了）。新增預渲染頁時只要加進 ROUTES，sitemap 自動跟上。`lastmod` 必須**明確釘住 `Asia/Taipei`**（`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })`）。兩層坑都踩過：先用 `toISOString().slice(0,10)`（UTC，早上 8 點前少一天），改成「本地時區」之後本機對了、**正式站還是錯**——因為那是**建置機器**的本地時區，而 Vercel 的建置機跑在 UTC。前端那條「用本地時區」的規則講的是使用者的裝置（在台灣），**建置腳本沒有這個前提**。驗證方法：`TZ=UTC npm run build` 模擬 Vercel。
- **首頁的 `<title>` 給 Google、`og:title` 給 LINE，兩者刻意不同**：同一份 index.html 服務官網首頁與法會報名頁，而 **canonical 指的是官網首頁**，所以 `<title>`／`description` 必須是官網版。2026-09-02 之前是報名版，等於 Google 收錄的官網首頁標題是「和聖壇法會線上報名」，信眾搜「古亭 媽祖廟」看到的是一場法會的報名頁。分享卡片讀的是 `og:*`，維持報名版不受影響。收件結束時 `og:*` 也要換回官網版。
- **不執行 JS 的爬蟲只看得到 `<noscript>`**（GPTBot／ClaudeBot／PerplexityBot 都不執行 JS）。兩個要顧的點：(1) **內容深度**——分頁原本只有兩句手寫概括（約 50 字），而且 `/deities` 那句與資料庫的 38 尊名單不符（列了不存在的「中壇元帥」）；現在 `/deities` 會把資料庫名單接進去，抓不到就退回手寫版。(2) **站內連結**——原本每頁只有一個「回首頁」，爬蟲走不到兄弟頁；現在由 ROUTES 自動產生全站連結，新增分頁不必回來改。
- **`vercel.json` 的陷阱**：**不要開 `cleanUrls`**。開了之後 `/about` 仍然會被最後那條 SPA 萬用 rewrite 吃掉、回傳 index.html（實測過兩次都失敗，拿掉才正常）。正確作法是在萬用規則**之前**逐條寫 `/about → /about.html`。新增預渲染頁時，`vercel.json` 與 `scripts/prerender.js` 的 ROUTES 要一起加。
- **分頁標題**：`App.tsx` 有一份 `titles` 對照表，內容要與 `scripts/prerender.js` 的 ROUTES 一致，否則爬蟲看到的和使用者看到的不一樣。
- **基本資料（地址／電話／開放時間）在資料庫**：`site_settings` 的 `info_*` 系列（後台「基本資料」分頁，migration：`supabase/migrations/site_info.sql`）。**不要再把這三項寫死在程式裡**——它們原本散在六處各寫一份，改一次要記得六個都動，漏一個就是網站自己跟自己說不一樣的話（2026-08-11 網站寫 22:30、首頁問答寫 22:00，持續數小時才被發現）。現在的分工：頁尾／隱私政策／地圖是執行期讀 DB；`PlaceOfWorship` 的 telephone／address／openingHours 由 App.tsx **執行期覆寫**靜態那份（只改這三個欄位，不整包重寫——那節點還有 hasOfferCatalog 等等，整包重寫等於維護第二份定義）；`llms.txt` 與 noscript 由 `scripts/prerender.js` 建置時寫入，按後台「重新發布」更新。開放時間存 `HH:MM` 兩欄不是一段文字：`opens`／`closes` 要機器可讀，Google 對格式不符是**靜默忽略**。電話轉國際格式只把開頭的 0 換成 `+886-`，保留連字號分組。
- ~~**開放時間 06:00–23:00 寫在五個地方**~~（已改由資料庫管理，保留此條說明歷史）：`index.html` 的 JSON-LD `closes` 與 noscript、`public/llms.txt`、`scripts/prerender.js` 的 noscript、`content/faq.json`、App.tsx 的頁尾與隱私政策。改一個就要五個一起改（2026-08-10 曾經頁尾 21:00、其餘 23:00 各說各話）。
- **捐款類別**：內容在**資料庫 `donation_types`**（後台「捐獻管理」分頁上方的可收合區塊，migration：`supabase/migrations/donation_types.sql`）。`types.ts` 的 `DonationType` 列舉降為保底。**最重要的一件事：`donations.type` 存的是類別的「文字」不是 id**，所以後台改名只影響之後的捐款，歷史紀錄維持原樣——那是財務資料，不擅自重寫；改名時 UI 會顯示受影響筆數並詢問要不要一併更新。有紀錄的類別**禁止刪除**（會讓報表指向不存在的類別），只能隱藏。「神尊修復」刻意不進這張表：那一項走神尊修復專頁、金額綁定專案，前台下拉一律排除。
- **常見問題**：內容在**資料庫 `faq_items`**（後台「常見問題」分頁可增刪改、拖拉排序，migration：`supabase/migrations/faq_items.sql`）。三份輸出的時效性不同，改動前先搞清楚：首頁畫面執行期讀資料庫（存檔就變）；`FAQPage` 結構化資料由 App.tsx 在**執行期覆蓋**預渲染那份（Google 執行 JS，所以標記與畫面永遠一致，這是 FAQPage 最容易踩的雷）；`<noscript>` 純文字是 `scripts/prerender.js` 建置時抓資料庫的快照，**下次部署才更新**。`content/faq.json` 降級為保底，資料表沒建或 Supabase 暫停時前台與建置都靠它，不會開天窗。後台有「重新發布」按鈕可自行觸發重新建置，讓那份 noscript 快照跟上（`api/republish.ts`）。執行期注入的那份 `<script id="faq-jsonld">` **只掛在首頁**，換頁要清掉——分頁上看不到問答，掛了就是「標記的內容使用者看不到」。
- （舊寫法備查）`content/faq.json` 曾經是**三個地方共用同一份**——首頁 `#faq` 區塊（App.tsx 讀 JSON 渲染）、`FAQPage` 結構化資料、`<noscript>` 純文字（後兩者由 `scripts/prerender.js` 注入 `dist/index.html`）。Google 的 FAQPage 規則要求標記的內容必須在頁面上看得到，所以**只改 JSON、不要在任何一邊另寫一份**。答案是廟方確認過的事實，不要為了 SEO 自己補。 首頁那份是**折疊的**（原生 `<details>`，樣式在 index.css 的 `.faq-item`）：Google 的 FAQPage 規則要求標記的內容使用者要看得到，「點一下就展開」算數，但**不能為了縮短頁面把答案整段拿掉**——那會讓結構化資料與畫面不一致。
- **靜態檔**：`public/robots.txt`（明確開放 GPTBot／ClaudeBot／PerplexityBot 等）、`public/sitemap.xml`、`public/llms.txt`。這三個都要靠 rewrite 之外的靜態檔案供應，之前它們回傳的是整頁 HTML。
- **結構化資料**：`index.html` 的 JSON-LD 有 PlaceOfWorship／WebSite／Event 三個節點。地址、電話、開放時間（每日 06:00–23:00）、法會日期改了要同步。

## 無障礙（2026-08-13 用 ui-ux-pro-max 的準則實測後修）

- **焦點樣式在 `index.css`，不要在 `index.html` 再寫一條全域 `:focus-visible`**——兩條會打架。淺色區用褐 `#7C5C1E`（白底 6.16:1），深色區（footer／hero／#booking）用金 `#C49820`（深底 5.34:1）。原本全站只有一條金色的，白底 2.67:1、米底 2.36:1，都低於 WCAG 2.2 對焦點指示的 3:1。
- **檢測焦點樣式不能用 `.focus()`**：程式呼叫不會觸發 `:focus-visible`，會得到「沒有焦點樣式」的假陰性（我踩過，還據此寫錯了結論）。要驗證請真的送 Tab 鍵，或直接檢查樣式表裡有沒有那條規則。
- **表單欄位一律要有「可及名稱」**：優先用 `<label htmlFor>` ＋ input 的 `id`；沒有可見標籤時才用 `aria-label`。**已經有可見標籤的欄位不要再加 `aria-label`**——它會蓋掉可見標籤，畫面寫「電子郵件」螢幕閱讀器卻念 placeholder 的說明文字（我加過一輪又撤掉）。`aria-label` 的內容要是欄位名，不要把「*」或「（選填）」念進去。
- 送出失敗的提示要有 `role="alert"` 才會被朗讀；旁邊的裝飾圖示加 `aria-hidden="true"`。
- 頁尾一類的小連結要有足夠的點擊區（WCAG 最小 24px），用 `py-2` 撐開比改字級安全。

## 文案與 UI 慣例（使用者明確要求過）

- **全站不用 emoji**。裝飾用線條與色塊。
- LINE 官方帳號連結用短網址 `https://lin.ee/lj0gLqR`（@725utjch）。
- 匯款資訊有**兩個不同的帳戶，不可混用**：
  一般捐獻用中國信託 822 大安分行 6025-4035-6010 王順文；
  **遷址募資專款**用第一銀行 007 古亭分行 171-68-143732 王順文（只出現在 `/relocation` 頁尾的行動呼籲區塊）。
- 欄位用語：「陽上姓名」「陽上地址」（不用報恩人/懺悔人）；牌位欄位叫「牌位地址」，提示「請填完整地址與位置」。
- 用字：**「拔渡」不是「拔度」**（法會文案，2026-08-10 更正）。
- 主色 #C49820（金）、#7C5C1E、背景 #F5F0E8；標題襯線字。
- **區塊標題只有一種寫法**（2026-08-11 全站統一過，別再各寫各的）：

  小標 `<h2>` → 大標 `<h3>`（獨立頁是 `<h1>`）→ 分隔飾 → 說明。

  **「獨立頁是 h1」這條 2026-09-04 才補齊**：`/booking`／`/lamps`／`/blessing`／`/repair` 是 2026-08-05 從首頁區塊拆成獨立頁的，標題卻留著區塊版的 `<h3> text-4xl`——結果那幾頁**一個 h1 都沒有**（SEO 與螢幕閱讀器都靠 h1 判斷「這頁在講什麼」），字級也比 `/about`／`/relocation`／`/deities` 的 48px 小一級（廟方回報「標題字大小跟其他頁不同」）。
  改動時要分清楚：`#bulletin`／`#deities`／`#donation`／`#faq` 仍是**首頁區塊**，維持 `<h3>`；只有 `{page === '…'}` 包住的才是獨立頁。驗收方法：每頁 `document.querySelectorAll('h1')` 應該剛好 1 個。

  | | 小標 | 短棒 |
  |---|---|---|
  | 置中的區塊 | `text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3` | 左右各一根 `<span className="w-8 h-1 bg-temple-gold" />` |
  | 靠左的區塊（右邊接照片欄） | 同上但去掉 `justify-center` | **只有左邊一根** |

  分隔飾一律 `<span className="w-12 h-px bg-temple-gold/70" />` ＋ `<span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />` ＋ 再一條短線，外層 `flex items-center gap-3 mt-3`（置中的再加 `justify-center`）。

  **不要**在小標放 icon、底線（`border-b-2`）、`✦` 字元，或改用別的色（`text-amber-700` 之類）——這四種都曾經出現過，已全部清掉。唯一例外是預約問事區：底色是深紅，小標用 `text-temple-gold` 才看得見。
  同一個小標文字在首頁與獨立頁短棒數可能不同（首頁靠左單邊、獨立頁置中雙邊），那是版型差異不是漏改。獨立頁的標題由 `components/StoryPage.tsx` 共用，改一處兩頁都會變。

## 待辦與未修事項

- 主官網上線 checklist：`FAHUI_LANDING` 改 false、index.html title／OG 換回官網用、hero 圖 fallback 是外連 Unsplash 建議換本地圖、Google Maps iframe 在部分環境載入失敗待驗證。
  **同時要處理 index.html 的法會 Event JSON-LD**：`url` 與 `offers.url` 指向 `machu-five.vercel.app` 根路徑，而 `FAHUI_LANDING` 一關那裡就不再是報名表；法會 9/13 過後整個 Event 節點也該移除或換成下一場，否則 Search Console 會回報過期活動。
- **heshengtan.tw 被 HiNet 上網守衛誤判封鎖**（2026-09-02 發現）：`safebrowsing.hinet.net` 把 `*.heshengtan.tw` 的 DNS 全導到 `202.39.161.53`，那台沒有本站憑證，Safari 直接跳「此連線並非私人連線」。**網站與憑證都正常**（Let's Encrypt，走正確 IP 是 HTTP 200、TLS 驗證 0）。
  怎麼分辨這類問題：權威 NS 與 DoH 都回正確 IP，但明文 UDP 查詢回別的 IP、TTL 固定不倒數、**連不存在的子網域也回同一個 IP**＝有人現場合成假回答，不是設定錯也不是快取。
  攔截頁的「仍要前往」按鈕對 HTTPS 網站沒用——瀏覽器在 TLS 階段就先失敗，使用者只會看到憑證警告。申訴管道：中華電信客服 0800-080-123。Google Search Console 確認過沒有安全性問題，只有 HiNet 這一家。
- **法會 Event 結構化資料要制度化（普渡 9/13 後做，廟方 2026-09-02 決定延後）**：現在是寫死在 `index.html` 的一段 JSON-LD，每辦一場就要工程師改程式——跟 FAQ／捐款類別／基本資料那些「後台可編輯」的東西不同層級。
  **不必新建資料表**：`blessing_events` 已經有需要的每一個欄位（`title`→name、`start_date`/`end_date`、`registration_deadline`→offers.validThrough、`fee`/`packages`→lowPrice/highPrice、`image_url`→image、`is_active`→要不要輸出），後台也已能編輯。缺的只是「接到 JSON-LD」那一段，照 FAQ 現成的三層機制抄：`App.tsx` 執行期覆寫、`scripts/prerender.js` 建置時快照。過期活動自動不輸出，就永久解決 Search Console 的「過期活動」回報。
  **廟方已決定（2026-09-02）：以後的法會也在「祈福活動」後台建一筆 `blessing_events`。** 所以 Event JSON-LD **只讀這一張表**，不要為了相容而支援兩個來源——多一個來源就多一種「兩邊不一致」的可能。
  這次的普渡法會走的是 `fahui_registrations` 那套獨立流程、不在該表裡，屬於過渡期的特例：9/13 過後把寫死的那段 Event 直接刪掉即可，不需要回頭補建一筆。報名流程本身維持獨立（`blessing_events` 只負責「這場活動是什麼」，不取代法會的報名表）。
- **Hero 底圖比稿中（2026-09-09）**：正式站維持金箔牆，網址加 `?hero=blue` 可看藍金流體畫版，給廟方與內部人員在真正的首頁上比較（不是靜態截圖，三尊／導覽列／香煙／按鈕都在）。切換寫在 `App.tsx` 的 `HERO_VARIANTS`，決定要換就把 `DEFAULT_HERO` 改成 `'blue'`。
  沒有任何連結指過去、不在 sitemap、query string 不會產生新的可索引網址，所以不影響 SEO。
  **要換過去的話，連帶要處理三件事**：`index.html` 的 preload 指向的是金箔牆；`og-hero.jpg` 是用金箔底反推暗化比例算出來的（見 `build-og-hero.js`），換底圖等於整支腳本的背景邏輯要重寫、三尊座標也要重量；還有全站配色是廟紅＋金，往下捲一屏就回到紅金，首屏藍金會像兩個網站。
  藍金版用 `tone="flat"`（SilkSheen 新增的模式）：流體畫沒有金屬或緞面光澤，會動的光帶只會像鏡頭髒了。flat 連 pointermove／陀螺儀監聽與 rAF 迴圈都不掛，不是把效果調到看不見。
- 遷廟募款區塊尚未動工（使用者要求「新增一個區塊」，待確認目標金額／進度條、收款方式、說明內容、後台可編輯欄位）。
- **揪團已上線**（2026-09-09，普渡報名結束後合併 `feature/group-booking` 的 a4fd261）。
  資料表 `shared_sessions`／`shared_session_entries` 與 RPC `get_shared_session` 都在資料庫裡。流程：建立共享場次 → 拿 `?share=<id>` 連結 → 親友各自填 → 一起送出；支援點燈／祈福／問事，連結 7 天到期。
  合併當天在現行 main 上重跑完整流程：`/lamps` 建立場次 → `?share=` 連結 → 填民國72年6月20日 → 生肖轉唯讀「豬年　依生日自動換算」→ 加入報名表 → RPC 讀回 `birth_date = 民國72年6月20日（農曆五月初十）`、`zodiac = 豬`，與標準合併格式一致。
  **`/blessing` 的揪團按鈕在活動報名 modal 裡，不在頁面上**：沒有任何 `blessing_events` 時開不了 modal，也就看不到按鈕（普渡法會走 `fahui_registrations` 獨立流程，不算）。找不到按鈕先確認後台有沒有上架中的祈福活動，不要當成壞掉。
  **名單只有主揪看得到**（2026-09-12 廟方定調「要登入會員、發起揪團，才會顯示共享報名單」）：那張列出所有人的「單」是主揪的，被揪的人只看到「已有 N 人加入」的人數與自己要填的表，看不到別人的姓名、生肖、選了什麼——分享連結會被轉傳，任何拿到連結的人都不該看到別人的個資。面板標題也跟著換：主揪是「共享報名表」，被揪的人是「揪團報名」，免得以為自己在看整張單。
  **被邀請者與主揪看到的不一樣**（2026-09-10）：開了 `?share=` 但不是建立者的人，只顯示共享面板——服務介紹、方案行銷卡、以及**主揪自己的登記表**全部遮掉。最後那項是安全問題不是版面問題：那張表的「送出登記」會開一筆與揪團無關的獨立訂單，而它就長在共享面板正下方。實測改前 `/lamps?share=` 頁高 4221px、面板在 1238px、下方 3147px 起是主揪的表；改後頁高 1998px、面板在 220px。判斷式是 `isSharedGuest(type)`。
  **主揪必須登入會員，被揪的人不必**（2026-09-10 廟方定調，概念同 Uber Eats 揪團）：主揪有帳號才有「誰開的」可查，換裝置也找得回未送出的表；被揪的人點連結進來選方案、填資料、加入即可，不必註冊——那正是揪團要好用的關鍵。
  `shared_sessions.created_by` 記主揪的 user id。RLS：建立需 `created_by = auth.uid()`（WITH CHECK，不能只靠前端擋）、主揪 SELECT 得到自己的場次、加名單維持開放給 anon。`get_my_shared_sessions()` 回未送出且未過期的場次含名單。
  **順帶修掉一個安全問題**：`mark_shared_session_submitted` 原本 anon 也能呼叫，**任何拿到分享連結的人都能把整團送出**，主揪還沒收齊就被結單。改成只有 `created_by` 本人能送；`created_by IS NULL` 的舊場次維持原行為，否則這次改動前開的表會卡住送不出去。
  **`isCreator` 判斷要直接問 `supabase.auth.getUser()`，不要讀 `member` 狀態**：載入 `?share=` 與 `getSession()` 是兩個各自進行的非同步流程，讀 member 會賽跑——主揪自己開連結時常常還是 null，就被當成被揪的人。
  **主揪要找得回未送出的表**：共享場次是 capability 模式、沒有擁有者欄位，主揪身分只記在自己的瀏覽器，而場次 id 原本只存在網址列的 `?share=` 裡——關掉分頁就再也找不回來（廟方回報「整張訂單都不見」）。改成把清單存進 localStorage（`services/sharedSessionStore.ts`），三個服務頁的**最上方**顯示提示卡。放在表單上方量到是 1238px，手機得先滑過四張行銷卡，等於沒提醒；移到區塊頂端後是 160px。換手機仍然找不回來，這是不要求登入的必然代價。
  **旗標的值就是正式站的值**：main 上 `ENABLE_GROUP_BOOKING` 是什麼，廟方按後台「重新發布」觸發 Deploy Hook 從 git 重建後就是什麼。要再停用或改動，未驗過的先留在分支（本檔部署紀律第 0 條記載的事故）。
  **教訓：停用中的功能不會出現在任何掃描結果裡，全站統一規則時要主動把旗標關閉的區塊列進清單。**2026-08-11 全站統一生肖規則時，揪團就是因為停用而被漏掉（原本還是「自動帶入可手動修改」的下拉，那正是造成生日與生肖矛盾的寫法），拖到 9/02 才補。
- 歷史遺留：檢測報告 17 項問題已全修（2026-07-06），詳見 memory 的 project_main_site_prelaunch。

## Changelog
- 2026-07-06 建檔（Fable 5 立制度 session）
- 2026-07-06 對抗審查修正：工具名 fallback、輪數精確定義、門檻優先序、fresh-context 定義、521 誤判防呆
- 2026-08-05 四項服務拆獨立分頁、導覽改名與「更多」收納、法會著陸改 FAHUI_LANDING 旗標、公告加照片
- 2026-08-10 正式網域上線、預渲染與 AI SEO、首頁常見問題區塊（content/faq.json 單一來源）
- 2026-08-11 會員資料自動帶入四表單、香煙改緞帶填滿、平板直立 Hero 修正、全站區塊標題統一
- 2026-09-02 Hero 改為「主神三媽在後、二媽與濟公在前」，二媽與濟公換成廟方新給的正面照；身分確認為三媽＝橘袍黑面、二媽＝黃袍；神尊圖底部淡出對齊背景；public/ 圖檔加內容版本戳記
