# 和聖壇網站（媽祖官網）操作手冊

宮廟網站：React 19 + Vite + Tailwind(CDN) + Supabase。正式站 https://machu-five.vercel.app。
先讀全域制度 ~/.Codex/AGENTS.md；本檔只放這個 repo 的操作事實與陷阱。

## 目前狀態（2026-07-06）

- **法會報名表上線收件中**（太上慈悲普渡禮懺法會，9/13 舉行、9/06 截止）。`App.tsx` 的 `showFahui=true` 讓報名表蓋住主官網首頁——**這是刻意的**。主官網上線時改回 `false` 再部署。
- **志工報名表也上線了**（VolunteerRegistration.tsx，migration：`supabase/migrations/volunteer_registration.sql`）。入口只在**法會報名成功頁**（刻意不放主表單，避免拉低法會報名轉換率）。點入口會把法會表已填的聯絡資料自動帶入（precedence：連結帶入 > 志工草稿 > 法會草稿）。後台「志工報名」分頁可看名單、標記已聯絡、匯出 Excel。只收 5 項基本資料（姓名/電話/地址/生日/LINE），無排班。
- 後台入口：`https://machu-five.vercel.app/?admin=1`（會自動跳管理員登入）。管理員由 admin_profiles 表控管（信箱不寫進公開 repo）。
- 全部資料表已啟用 RLS（migration：`supabase/migrations/mainsite_rls.sql`）。訪客只能 INSERT 報名、讀公開內容；統計數字走 SECURITY DEFINER RPC。

## 常用指令（nvm 環境，直接跑 npm/vercel 會 command not found）

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"   # 每個 shell 都要先跑這行
npm run build        # 建置（vite 不做型別檢查！）
npx tsc --noEmit     # 型別檢查（build 過了不代表型別對）
vercel --prod --yes  # 部署正式站（已連結專案 machu）
```

開發伺服器：用 preview_start（名稱 `dev`，port 3000），不要用 Bash 起 server。設定在 `.Codex/launch.json`；若遺失，重建時 runtimeExecutable 要用 bash 包 nvm 載入（參考 git 歷史或本檔常用指令段）。

## 部署紀律（每次必做）

1. `npx tsc --noEmit` 通過 → `npm run build` 通過 → 部署。
2. 部署後三驗：`curl -s https://machu-five.vercel.app/ | grep -o '/assets/index-[^"]*\.js'` 確認 bundle 更新；本機 preview 跑關鍵流程 DOM 斷言；preview_console_logs 零新錯誤。
   誤判防呆：若「頁面載入正常但資料全部抓不到（console 大量 fetch 失敗／對 supabase.co 的請求 521）」＝Supabase 專案暫停，**不是部署失敗**——先去 Dashboard Restore，不要回滾部署。
3. 報名表正在收件：任何影響 `FahuiRegistration.tsx`、`services/supabase.ts` 送出路徑的改動都算高風險，改完要實測一筆送出（然後用 SQL 刪測試資料，姓名用「測試」開頭以便清理）。

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
- 生日元件 `BirthDatePicker`：`solarOnly` 只收國曆、自動換算農曆＋生肖；年份顯示民國年。共用元件，改動會影響官網其他表單。`solarOnly` 模式輸出「民國72年6月20日（農曆五月初十）」合併字串（含國曆與農曆），後台匯出用 `splitBirthday()` 拆成兩欄；非 solarOnly 維持舊農曆字串。舊資料無國曆月日，匯出國曆欄會空白（無法回補）。
- 後台匯出/篩選：`inDateRange()` 依報名日期（本地時區）篩選、`DateRangeFilter` 共用元件；匯出走 `filtered` 會跟著日期範圍。法會/志工兩分頁都有。

## 文案與 UI 慣例（使用者明確要求過）

- **全站不用 emoji**。裝飾用線條與色塊。
- LINE 官方帳號連結用短網址 `https://lin.ee/lj0gLqR`（@725utjch）。
- 匯款資訊：中國信託 822 大安分行 6025-4035-6010 王順文。
- 欄位用語：「陽上姓名」「陽上地址」（不用報恩人/懺悔人）；牌位欄位叫「牌位地址」，提示「請填完整地址與位置」。
- 主色 #C49820（金）、#7C5C1E、背景 #F5F0E8；標題襯線字。

## 待辦與未修事項

- 主官網上線 checklist：`showFahui` 改 false、index.html title 換回官網用、hero 圖 fallback 是外連 Unsplash 建議換本地圖、Google Maps iframe 在部分環境載入失敗待驗證。
- 歷史遺留：檢測報告 17 項問題已全修（2026-07-06），詳見 memory 的 project_main_site_prelaunch。

## Changelog
- 2026-07-06 建檔（Fable 5 立制度 session）
- 2026-07-06 對抗審查修正：工具名 fallback、輪數精確定義、門檻優先序、fresh-context 定義、521 誤判防呆
