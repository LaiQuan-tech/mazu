# 照片、影片、素材

> 2026-11-26 自 CLAUDE.md 原文搬來，未改寫。「上一條／下面」等字眼依原順序；`原 L` 是搬移前行號。

<!-- 原 L72-112 -->
- **首頁 Hero 正下方有一支影片，2026-11-09 起由後台「多媒體管理」設定**（原本叫「照片管理」，同一個分頁改名）。
  存在 `site_settings` 的 `home_video_id`／`_heading`／`_title`／`_author`／`_cover`，不用 migration。
  讀寫在 `services/supabase.ts` 的 `getHomeVideo()`／`saveHomeVideo()`，後台元件是 `components/AdminHomeVideoSection.tsx`。
  資料庫沒有 `home_video_id` 時整組退回 `DEFAULT_HOME_VIDEO`（下面那支進香回顧），所以沒設定過的話首頁跟以前一模一樣。
  **封面在後台存檔那一刻從 i.ytimg.com 抓進 `site-images/home-video/`**，信眾載首頁時不向 Google 要任何東西（VideoFacade 的原則）；
  抓不到才退回直連 i.ytimg.com，後台會提示廟方重存一次。保底那一支仍用 public/ 預先做好的封面（`homeVideoCover()` 決定走哪一條）。
  標題與拍攝者用 YouTube oEmbed 自動帶入（有開 CORS）。**刻意沒有「隱藏影片」開關**：拿掉影片區，Hero 的收邊色 `HERO_FADE_RGB` 就對不上下一區（見下面那條）。
  **已知限制：Shorts（直式）也貼得進去，但首頁的框是 16:9**，封面會被裁成中間一條，播放器也是橫的。
  **影片下方是 IG 最新四則**（2026-11-09，`components/InstagramStrip.tsx` ＋ `api/ig.ts`）。清單與縮圖都經 `api/ig` 從我們的網域送出，信眾瀏覽器不連 IG；縮圖只收貼文 id、不收網址（防 SSRF，同 `api/si.ts`）。
  **權杖**：第一次放 Vercel 的 `IG_ACCESS_TOKEN`（不加 VITE_），之後 `api/ig` 每 7 天自己續期、寫進 Supabase 的 `app_secrets`（`supabase/migrations/app_secrets.sql`，RLS 開、零政策，只有 service role 讀得到；**不可以放 site_settings，那張 anon 讀得到**）。表沒建也能跑，但 60 天後權杖過期。
  沒權杖／過期／IG 掛了 → 回空清單 → 整排連同「追蹤」鈕都不畫。帳號網址用後台「社群」的 IG 那一欄，清空也整排不畫。**本機 `vite dev` 不跑 `api/`，一定看不到這一排**；驗法是 esbuild 打包後 stub fetch 跑（同 notify-confirm）。
  抓 8 則、過濾掉 permalink 不是 instagram.com 的、取 4 則（少於 4 則就取偶數，手機 2×2 不空格）。
  以下是 2026-10-24 那支影片當初的紀錄（`HOME_VIDEO` 常數已移除，改叫 `DEFAULT_HOME_VIDEO`）。
  **刻意不放進 Hero**——廟方問的是「hero 左邊的空間可不可以放」，桌機確實空著（量過：
  字標右緣 100px 到最左那尊濟公的 547px 之間有 447×550 的空白），但**手機上沒有那個空間**：
  三尊神尊橫跨整個寬度（x −6 到 381），字標下緣 151 到神尊頂端 372 之間只剩一條 221px 的橫帶，
  而 16:9 的影片在 375px 寬就是 193px 高，等於整個卡死在主神的冠帽上面。
  何況 Hero 換過三輪才定在「不動」，放一顆播放鈕上去是往反方向走。
  放在 Hero 正下方是「首頁最上面」的誠實版本：捲一下就看到，也不必動 Hero 那層疊放順序。
  **代價量過**：手機整區 442px（0.54 屏），首頁 7,605 → 8,075px（9.4 → 9.9 屏）。
  **插進來的同時要改 `HERO_FADE_RGB`，這件事當時漏了**（廟方 2026-10-25 回報「hero 跟影片的漸層切到很突兀」）：
  Hero 底部那道收邊淡進的顏色必須等於**它下一個區塊的底色**，而影片區一插進來，
  下一區就從公佈欄（`bg-white`）變成影片區（`bg-temple-bg` #F5F0E8）。沒改的結果是
  Hero 收邊淡進純白、底下卻是米色，交界多出一條白帶——金箔與米色本來銜接得很好，
  那條白帶才是「突兀」的來源，不是漸層長度的問題（128px／手機 88px 都沒動過）。
  **這個相依靠註解提醒已經失敗兩次**（第一次是公佈欄改白底），所以 2026-10-25 加了
  一支只在開發模式跑的檢查：比對 Hero 收邊色與下一區實際算出來的底色，不一致就在
  console 印一行指名要改哪個常數。正式站不跑、只讀樣式不動畫面。
  **所以動首頁區塊順序或底色時，開著 `npm run dev` 看一眼 console 就知道有沒有踩到。**
  **影片一律走 `components/VideoFacade.tsx`**（2026-10-24 從 ShowerPage 抽出來共用）：
  預設只畫封面、按下去才載 iframe，網域用 `youtube-nocookie`。首頁與 /shower 共用這一支，
  各頁自己的只有配色與圖說。封面自己存 `public/`，由
  `scripts/build-shower-covers.js --prefix=home-video- --width=1280 <id>` 產生，
  **檔名要加進 `vite.config.ts` 的 `HERO_FILES`**。
  **播放鈕的兩個顏色都要用方括號寫死**：青花紙主題會把 `.bg-white` 壓成
  `rgba(255,255,255,.07)`（鈕直接消失），也會把 `text-temple-red` 映成泥金——
  泥金壓在米白的鈕上實測只有 **2.17:1**，三角形幾乎看不見。現在是
  `bg-[#FDFBF7]` ＋ `text-[#6B4A14]`，兩個都不在 inkTheme 的名單上，量到 7.77:1。
  **區塊大標與封面上的字刻意不同**：封面印的是片頭設計「薪火相傳　承前啟後」，
  大標寫「2025 進香回顧」——前者是美術，後者是這一區的名字（同 ShowerPage 那條）。
  拍攝者（拾九影像創作）要標出來，不是我們自己拍的。

<!-- 原 L400-400 -->
- **神尊去背（`scripts/build-hero-assets.cjs`＋`scripts/cutout-lib.cjs`）**：廟方給新照片時跑這支就好，用法寫在檔頭（sharp 裝在暫存資料夾，別寫進 package.json）。**輸出目錄可用第一個參數指定，驗證改動時務必指到暫存目錄**——預設會直接覆蓋 `public/`，而現在那三張是廟方給的去背圖、不是這支產的。作法是「顏色判定＋從四邊長進來的連通元件＋斷細頸」，不是單純的色鍵。兩個踩過的坑：(1) **sharp 對單通道 raw 做 `blur()` 會自動升成 3 通道**，沒接 `.toColourspace('b-w')` 拿回來的 buffer 長度是 3 倍，alpha 會整片錯位；(2) 不要用 sharp 的 `trim()` 裁透明邊界——它比的是 RGB，而透明處的 RGB 還留著原始背景，會裁到莫名其妙的範圍，自己算 bbox 再 `extract()`。原則：**寧可留一點背景也不要咬掉神尊**（Hero 底是金色，殘留的黃牆幾乎看不出來，缺一塊袍子很明顯）。實際咬過頭的兩個原因：(1) **形態學開運算（fgOpen）會刪掉細長突出物**——濟公手上的法器、帽尖、冠帽流蘇都是這樣消失的，已經拿掉不再使用；(2) **顏色門檻抓太鬆**：白背板實測 s 只有 0.03–0.04，用 s<0.18 會把神尊身上的銀線繡、珍珠、淺色布一起判成背景。灰背板改用色相切（背板偏藍 h≈205，神尊是暖色 h≈42）比用亮度安全得多。驗收要用 `-tmp-mask.png` 這種**未裁切的全幅遮罩**疊回原圖看，拿裁切後的 PNG 去對位會因為 bbox 不對稱產生假的「被咬掉」。

<!-- 原 L414-416 -->
- **`public/` 的圖換了，信眾會看到舊圖（`vite.config.ts` 的 `__HERO_V__`）**：Vite 只幫 `import` 進來的資產加指紋，`public/` 底下的檔名永遠一樣。線上回應本來就是 `cache-control: public, max-age=0, must-revalidate`，**但那是請求不是保證**——只要瀏覽器記憶體快取／CDN／公司 proxy 有一層沒照做就餵舊圖。最難察覺的是**混搭**：2026-09-02 首頁同時出現舊的二媽與新的三媽，而那兩版剛好是同一尊，看起來就是兩尊一模一樣的神像並排。
  作法是建置時算內容雜湊注入 `__HERO_V__`，網址變成 `/hero-sanma.webp?v=2651625a`，內容一改雜湊就變＝換了網址。**換圖不需要手動改版號**（會忘記的東西不要交給人記）。新增會替換的 `public/` 圖檔時，把檔名加進 `vite.config.ts` 的 `HERO_FILES`，前端用 `heroSrc('檔名')` 取網址。
  `index.html` 的 preload 由 `transformIndexHtml` plugin 補同一個版號——**兩邊不一致等於預載了另一個網址，白預載一次**。

<!-- 原 L575-577 -->
- **EXIF 方向（`shrinkImage`，`services/supabase.ts`）**：`createImageBitmap(file)` 沒有傳 `{ imageOrientation: 'from-image' }`，方向完全交給瀏覽器預設值。2026-09-26 拿一張 `Orientation=6` 的手機直拍照（儲存 3088×2316、應顯示 2316×3088）實測，現行 Chromium **三種寫法都回 2316×3088**（連 `'none'` 都無效），`uploadBulletinImage` 輸出 1200×1600 是正的——所以**現代瀏覽器上沒有壞**。但這是靠瀏覽器預設值，不是靠程式；真要保險就把那個參數補上。
  另外注意 `shrinkImage` 有四條早退路徑會**原檔直傳、EXIF 原封不動**（GIF、`createImageBitmap` 失敗、縮放比為 1 且 ≤800KB、壓完比原檔大），那些檔案的方向是靠瀏覽器渲染 `<img>` 時處理的。
  **還有五支上傳完全沒走 `shrinkImage`**（`uploadSiteImage`／`uploadHeroSlide`／`uploadScriptureImage`／`uploadBlessingImage`／`uploadLampImage`），改 `shrinkImage` 只會影響公佈欄、神尊、修復專案、關於我們這四支。
