# 和聖壇網站（媽祖官網）操作手冊

宮廟網站：React 19 + Vite + Tailwind(CDN) + Supabase。正式站 **https://heshengtan.tw**（2026-08-10 上線，GoDaddy 註冊、DNS 也在 GoDaddy）。
`https://machu-five.vercel.app` 是 Vercel 預設網域、**測試用**，仍指到同一個部署且沒有停用——舊的分享連結不會壞，但**對外一律用 heshengtan.tw**（廟方 2026-09-02 明確要求），不要再出現在 og:url、結構化資料或任何新發的連結。
Apex 用 A 記錄指 `216.198.79.1`（Vercel 新 IP 段，不是網路上常見的 76.76.21.21）；www 走 308 轉到 apex。
先讀全域制度 ~/.claude/CLAUDE.md；本檔只放這個 repo 的操作事實與陷阱。

## 手冊路由（動手前先讀對應文件）

細節都在 `docs/handbook/`。**改到哪一塊就先讀哪一份**；檔案大的先 `grep -n 關鍵字 docs/handbook/` 再分段讀。程式註解裡寫「見 CLAUDE.md」的，也到這裡 grep。

| 要動的東西 | 文件 |
|---|---|
| Supabase、SQL、RLS、權限 | `docs/handbook/db.md` |
| 後台畫面與操作 | `docs/handbook/admin.md` |
| 財務、收據、應收、憑證、匯款帳戶 | `docs/handbook/admin-finance.md` |
| 前台報名表單、代為報名、揪團 | `docs/handbook/forms.md` |
| 法會專屬（開新場次另讀 admin、forms） | `docs/handbook/fahui.md` |
| LINE／email 通知、提醒、cron、api | `docs/handbook/notify.md` |
| GA4、像素、UTM、流量來源（事件清單尚無文件，看 Analytics.tsx） | `docs/handbook/analytics.md` |
| SEO、AI 檢索、預渲染、網址、vercel.json | `docs/handbook/seo.md` |
| 樣式、動畫、版面、無障礙 | `docs/handbook/ui.md` |
| 文案與 UI 慣例（廟方明確要求過） | `docs/handbook/copy.md` |
| 首頁 hero、青花紙（INK_MODE） | `docs/handbook/hero-ink.md` |
| 沐浴車、17bath | `docs/handbook/shower.md` |
| 遷址募款、捐款 | `docs/handbook/relocation.md` |
| 天上聖母經 | `docs/handbook/scripture.md` |
| 會員、登入、信眾名冊 | `docs/handbook/member.md` |
| 聊天機器人、後台小幫手 | `docs/handbook/assistant.md` |
| 照片、影片、素材 | `docs/handbook/media.md` |
| 歲時節慶行事曆 | `docs/handbook/calendar.md` |
| 太歲點燈 | `docs/handbook/lamps.md` |
| 公佈欄 | `docs/handbook/bulletins.md` |
| HiNet 封鎖與 DNS | `docs/handbook/dns.md` |
| TS／腳本／本機開發的坑 | `docs/handbook/dev.md` |
| 未完成待辦 | `docs/handbook/todo.md` |
| 已完成或已被取代的紀錄 | `docs/handbook/history.md` |

技能：改資料庫用 `heshengtan-sql`、辦法會用 `heshengtan-fahui`（都在 `.claude/skills/`）；部署後用 `deploy-verify`（個人技能，另一台可能沒有，沒有就照下面的部署後三驗）。

## 紅線（違反會外洩、算錯錢或弄壞正式站）

**資料與權限**
- 祕密／權杖不可放 site_settings（anon 可讀），放 app_secrets（RLS 零政策）。
- 報名表加後台才填欄位要進 public_insert_guard patch；勿加 authenticated 全放行。
- Deploy Hook／金鑰類環境變數一律不加 VITE_ 前綴，否則被內嵌進前端 JS 而公開。
- 財務憑證表只給 has_finance_access()；REVOKE 同收 PUBLIC 與 anon
- 發票附件只放私有 bucket finance-docs 用簽名網址，不放 site-images
- 不可用較鬆的權限覆蓋 get_users_last_login（現定義在 rls_holes_2026_11.sql，限 is_admin()）；service key 不得進瀏覽器，信箱 RPC 限 is_admin()
- 帳號合併只准 identity linking，禁用未驗證電話自動併（外洩通訊錄）；也不自動幫報名者開帳號
- anon 只有 INSERT：報名 insert 後不可 .select() 讀回，id 由前端 crypto.randomUUID() 先產，否則送出失敗
- 會員資料（member_profiles／member_contacts／shared_sessions）一律限 user_id＝auth.uid() 本人（主揪為 created_by），不要放寬
- 財務簽名網址不可存進資料庫或快取
- 法會備份表 fahui_registrations_backup_20261124 不可擅自刪；舊 fahui SQL 不要重跑
- 揪團名單只有主揪可見；被揪者須遮掉主揪登記表（isSharedGuest），連結會被轉傳
- 後台小幫手（admin-help.ts）不得讀或送任何信眾資料給 Gemini，只送手冊、角色、問題

**錢**
- 後台金額一律走 services/serviceAmount.ts；祈福＝方案費優先、否則活動 fee，再加加購與供品。
- 款項彙總（應收、總覽、流量）一律走共用 buildIncomeRows()，不可另寫算法；已取消不計
- 法會金額用存的 total_amount 不套祈福算法；祈福 getter 須濾掉 entries 有值者
- donations.type 存文字不存id，改名不重寫歷史；有紀錄類別禁刪
- 匯款帳戶兩個不可混用：BANK_GENERAL 一般、BANK_RELOCATION 遷址專款
- 遷址捐款存 type='遷址護持'，與神尊修復都須排除於一般捐獻下拉（含DB清單）
- 收據作廢不得刪除（連號不可缺號）；配號與寫入須在同一交易（create_receipt RPC），金額為快照

**網站與部署**
- api/ 共用模組放根目錄 lib/，相對 import 加 .js；動 api/ 後必須 curl 線上端點驗證。
- 報名通知端點前端只送 id、內容由後端撈；不 await、不丟例外；信箱不寫進公開 repo。
- vercel.json 不可加 comment 等非法欄位，否則整份失效、部署不成立
- VITE_SUPABASE_URL 尾端帶換行，串進輸出前必須 .trim()
- 報名 source 欄不可加 CHECK／DEFAULT，追蹤絕不可擋掉報名送出
- 翻 INK_MODE 旗標要同時改 App.tsx 與 index.html 防閃 script；現況以程式為準不看文件

## 常用指令

**2026-10-30：這台機器上 nvm 已經不存在了**（`~/.nvm` 整個目錄沒有），node 走 Homebrew
的 `/opt/homebrew/bin/node`（v26.8.1）。所以本檔原本那行載入 nvm 的指令會噴
`no such file or directory` 並讓整串 `&&` 停住——**症狀是 exit 127，看起來像 npm 壞了**。
現在只要確保 PATH 有 Homebrew 即可；兩種環境都可能遇到，所以兩行都留著。

```bash
export PATH="/opt/homebrew/bin:$PATH"                # 現在用這行
# export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" # 舊環境（nvm）才需要
npm run build        # 建置（vite 不做型別檢查！）
npx tsc --noEmit     # 型別檢查（build 過了不代表型別對）
vercel --prod --yes  # 部署正式站（已連結專案 machu）
```

## 部署紀律（每次必做）

0. **一律先 commit＋push，讓 git 成為部署來源**，不要只用 `vercel --prod` 上傳本機檔案。
   為什麼寫成第 0 條：2026-08-11 之前半年都只用 `vercel --prod` 部署，git 停在幾個月前的
   commit，本機與線上落差 84 個檔案。後台的「重新發布」按鈕走 Deploy Hook 從 **git** 重建，
   一按就把正式站換成幾個月前的版本，連續發生兩次。只要 repo 落後，任何 git 觸發的部署
   （Deploy Hook、GitHub 自動部署、別台機器 clone）都是一顆未爆彈。
   趕時間可以先 `vercel --prod` 讓改動上線，但**當天要補 commit＋push**，不要讓落差過夜。
1. **`git push` 必須先成功，被拒絕就停手，不要部署。**
   `vercel --prod` 上傳的是**本機檔案**、不看 git，所以本機落後遠端時部署＝把別人的改動從正式站抹掉。
   2026-09-04 我踩過：本機落後 3 個 commit（志工停收、歲時節慶、分享圖腳本共 16 檔），
   push 被拒但我把 push 與 vercel 寫在同一串指令的不同行，部署照跑，正式站被退回舊版約兩分鐘
   （靠 `og-hero.jpg` 的檔案大小 202452 vs 164570 確認災情）。
   正確順序是 `git fetch` → 確認沒落後 → push 成功 → 才 build＋deploy；
   指令要用 `&&` 串起來，讓 push 失敗能擋下部署。
2. `npx tsc --noEmit` 通過 → `npm run build` 通過 → 部署。
3. 部署後三驗：`curl -s https://heshengtan.tw/ | grep -o '/assets/index-[^"]*\.js'` 確認 bundle 更新；本機 preview 跑關鍵流程 DOM 斷言；preview_console_logs 零新錯誤。
   誤判防呆：若「頁面載入正常但資料全部抓不到（console 大量 fetch 失敗／對 supabase.co 的請求 521）」＝Supabase 專案暫停，**不是部署失敗**——先去 Dashboard Restore，不要回滾部署。
4. **兩台電腦（筆電與桌機）同步開發**（2026-11-18 起廟方兩台都在用）：**動手前先 `git fetch`，落後就先 `git pull --rebase`；換到另一台之前先把這台的 commit push 上去**。
   2026-11-18 踩過：這台落後 9 筆，其中一筆（另一台的「後台清單去掉每行重複的資訊」）改的正是同一批後台表格，rebase 時 `AdminDashboard.tsx` 衝突 9 處，只能逐處把兩邊的規則合起來。**解衝突時兩邊都是廟方要的，不要整段取一邊**——那次是另一台的「空值用 `<Dash />`、整欄空不畫」加上這台的「`data-more` 收折、隱私欄位就地展開」。
   本機有沒推的 commit 時另一台看不到、正式站也沒有；而 Deploy Hook／GitHub 自動部署都從 git 建，沒 push 的東西等於不存在（同第 0 條）。
   **這台的 Vercel CLI 可能沒登入**（`vercel` 會卡在 device login 等人按），那時 push 到 GitHub 就會自動部署，約 40 秒後 bundle 雜湊會換——用第 3 條的 curl 輪詢確認，不必跑 `vercel --prod`。
5. 報名表正在收件：任何影響 `FahuiRegistration.tsx`、`services/supabase.ts` 送出路徑的改動都算高風險，改完要實測一筆送出（然後用 SQL 刪測試資料，姓名用「測試」開頭以便清理）。

- **`vercel env rm` 只影響「之後」的部署**：移除環境變數不會改變線上那份函式，它仍帶著舊值。
  要真正生效必須再部署一次。（拆彈時誤以為移除即生效，結果按鈕又被按了兩次、正式站又被蓋掉。）

## 未完成待辦（細節 docs/handbook/todo.md）

- 7 支 2026-10 的 SQL 是否執行過待確認：blessing_contact_label、member_auth_email、registration_email、notify_features_2026_10、lamp_blessing_payment_status、fahui_member_read、relocation_donation_fields。
- 後台「關於我們」第二卡數字、收入憑證選取介面。

## 維護規則

- 本檔只放路由、紅線、指令、部署紀律，**上限 20 KB**。新的坑寫進對應的 `docs/handbook/*.md`，不要寫回這裡。
- 只有「違反會外洩、算錯錢、弄壞正式站、不可還原」才加進紅線，一行寫完。
- 手冊與程式不符時以程式為準，當場在那一段標【已過時：證據】。
- 舊 SQL 不要為了確認而重跑（有些會把已補的權限打開）。寫入正式資料前先備份並取得使用者同意。

## Changelog

- 2026-11-26 瘦身：327 KB 拆成 docs/handbook/，原文照搬。更早的紀錄在 docs/handbook/history.md
