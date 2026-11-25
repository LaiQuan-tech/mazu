# Supabase、SQL、RLS、權限

> 2026-11-26 自 CLAUDE.md 原文搬來，未改寫。「上一條／下面」等字眼依原順序；`原 L` 是搬移前行號。

<!-- 原 L116-116 -->
- **訪客與會員送出報名時，後台欄位由資料庫強制**（2026-11-24，`public_insert_guard.sql`，六張報名表的 BEFORE INSERT 觸發器）：狀態、建立時間、通知章、對帳欄位改成正確值，祈福方案費以後台為準，法會報名單只能掛法會活動。後台人員與 service role 不受影響。**報名表新增「後台才填」的欄位時，要加進那支的 patch。** 同日 `rls_holes_2026_11.sql` 移除早期手建的 `USING (true)` 規則；**不要在 Dashboard 手動加「authenticated 全放行」，登入會員也是 authenticated**。

<!-- 原 L117-118 -->
- 全部資料表已啟用 RLS（migration：`supabase/migrations/mainsite_rls.sql`）。訪客只能 INSERT 報名、讀公開內容；統計數字走 SECURITY DEFINER RPC。

<!-- 原 L164-165 -->
## Supabase 陷阱（每一條都真實踩過）

<!-- 原 L166-175 -->
| 症狀 | 原因與處置 |
|---|---|
| 所有請求 HTTP 521 | 免費方案閒置自動暫停。到 Dashboard（專案 ref `keosbjepuvqqqhzyuplb`）按 Restore，等 1-2 分鐘。 |
| 單一表 404 | 表不存在（migration 沒跑）。migration 一律由使用者在 Dashboard SQL Editor 手動執行。 |
| anon 寫入後報 RLS 42501 | anon 只有 INSERT 權限：**insert 後不可 `.select()` 讀回**。要 id 就客戶端 `crypto.randomUUID()` 先產。 |
| 登入狀態下送出報名表失敗、未登入卻正常 | INSERT 政策只給 `TO anon` 沒給 `authenticated`。管理員登入後（存在 Supabase session）送出走 authenticated 角色 → 被 RLS 擋。**報名表的 insert 政策要 `TO anon, authenticated` 兩者都給**。症狀：只有你自己（登入測試）連續失敗、curl 與無痕視窗正常。曾耗數輪才定位。|
| RPC 只想給登入者用，訪客卻仍叫得動 | 函式執行權有兩條路：Postgres 預設 GRANT TO PUBLIC，Supabase 的 default privileges 又直接 GRANT 給 anon。**要 `REVOKE EXECUTE ... FROM PUBLIC, anon;` 一起收再 `GRANT TO authenticated`**，只收其中一個沒用。驗證方式：拿 anon key 當 Bearer 打 `/rest/v1/rpc/<fn>`，要看到 42501 才算收乾淨（2026-09-12 `get_my_shared_history` 踩過）。 |
| 本機 supabase CLI 連到別的專案 | CLI 連結的是 PikTag，不是本專案。DDL 無法用 CLI/anon key 跑，只能 Dashboard。 |
| 前台要顯示統計（名額/累計） | 不要開放整表 SELECT。用既有 RPC：`get_booking_session_counts`、`get_repair_totals`、`get_blessing_event_stats`、`get_shared_session`。新需求照這模式加 SECURITY DEFINER RPC。 |

<!-- 原 L327-327 -->
- **舊資料的三個生日格式問題**（2026-08-11 清查 55 筆，修好 4 筆）：(1) 農曆十二月存成簡體「腊」——程式月份字表用繁體「臘」，`parseBirthDate` 的 `indexOf` 會找不到、回頭解析失敗；(2) 閏月存成「閏闰六月」繁簡重複；(3) 春節前出生的農曆年沒標出來（`民國107年2月1日（農曆臘月十六）` 實際是農曆 106 年）。三者現行程式都已修正。**寫比對用的 SQL 時注意繁簡**：用 `LIKE '%臘月%'` 找不到存成「腊」的舊資料，會靜默失效。另有 4 筆是會員中心帶入的純農曆格式（無國曆），無法回推，屬已知限制。

<!-- 原 L1104-1107 -->
- **會員的信箱不在 `member_profiles`，在 `auth.users`**（2026-10-29 廟方要求用信箱搜尋會員時確認）。那張表只有姓名／電話／生日／生肖／性別／地址。前端是 anon key，讀不到 auth schema，**也不該為了這件事把 service key 放進瀏覽器**，所以走 SECURITY DEFINER 的 RPC（`get_member_emails()`，權限一律 `public.is_admin()`）。
  **不要去 `CREATE OR REPLACE` 既有的 `get_users_last_login`**：那支是在 Supabase 後台手動建的、repo 裡沒有定義，用猜的內容覆蓋一支看不見的函式，猜錯權限判斷就會把全站會員的信箱放寬給任何登入者，而那不會報錯。所以是**新增一支**，前端兩支併發呼叫。
  **信箱搜尋永遠找不到 LINE 登入的會員**——LINE 不給信箱，那種帳號在 auth 裡的 email 是 NULL。所以會員搜尋必須同時吃姓名與電話，不可以只靠信箱。
