# 未完成待辦

> 2026-11-26 自 CLAUDE.md 原文搬來，未改寫。「上一條／下面」等字眼依原順序；`原 L` 是搬移前行號。

<!-- 原 L671-672 -->
- **尚未做**：收入憑證的「從既有報名／捐獻開立」選取介面。資料表與型別都支援（`source_table`／`source_id`，編輯器也會顯示「來自捐獻」標籤），缺的是挑選來源紀錄的 UI。法會那 7 個對帳欄位也還沒搬進憑證。

<!-- 原 L952-953 -->
## 待辦與未修事項

<!-- 原 L1108-1108 -->
> 【待確認：2026-10 記為尚未執行，現況未查證；不要為了確認而重跑】

- **`supabase/migrations/blessing_contact_label.sql` 要跑過**（2026-10-29 新增，**使用者尚未執行**）：給 `blessing_registrations` 加 `contact_label`。沒跑祈福報名照樣送得出去（`insertOptional` 會把這一欄退掉），只是關係存不下來。

<!-- 原 L1109-1109 -->
> 【待確認：2026-10 記為尚未執行，現況未查證；不要為了確認而重跑】

- **`supabase/migrations/member_auth_email.sql` 要跑過**（2026-10-29 新增，**使用者尚未執行**）：新增 `get_member_emails()` RPC，讓後台能用信箱搜尋會員。沒跑的症狀是會員搜尋少了信箱這一路（console 會指名要跑哪一支），其餘照常。

<!-- 原 L1110-1111 -->
> 【待確認：2026-10 記為尚未執行，現況未查證；不要為了確認而重跑】

- **`supabase/migrations/registration_email.sql` 要在 Supabase SQL Editor 跑過**（2026-10-13 新增，**使用者尚未執行**）：給問事／點燈／祈福／捐獻加 `email`，給五張表加 `confirm_sent_at`。
  **沒跑不會壞掉，只是收不到信**：送出路徑有 `insertOptional()` 的退路（見程式陷阱那節），信箱欄位寫不進去就捨棄那一欄重送；`confirm_sent_at` 不存在則是信寄得出去但蓋不了章，於是下次確認會重寄一封——端點認得這一種並在回應裡指名要跑哪一支（`/confirm_sent_at/.test(why)`）。

<!-- 原 L1112-1112 -->
> 【待確認：2026-10 記為尚未執行，現況未查證；不要為了確認而重跑】

- **`supabase/migrations/notify_features_2026_10.sql` 要跑過**（2026-10-16 新增，**使用者尚未執行**）：六個通知功能的蓋章欄位、點燈的 `expires_at`，以及把匯款帳號搬進 `site_settings`。沒跑的症狀是各種「信沒來」或「重複寄」，端點會在回應裡指名要跑哪一支。

<!-- 原 L1113-1113 -->
> 【已過時：vercel.json:146-151 crons 只剩 keepalive，提醒改手動（原文 257 行）；cron-reminders.ts 僅在要恢復排程時才需 CRON_SECRET】

- **Vercel 要加 `CRON_SECRET`**（值自訂、夠長即可，Production）：沒有它排程不會自動跑。加完要重新部署才生效。

<!-- 原 L1114-1115 -->
> 【待確認：2026-10 記為尚未執行，現況未查證；不要為了確認而重跑】

- **`supabase/migrations/lamp_blessing_payment_status.sql` 要跑過**（2026-10-13 新增，**使用者尚未執行**）：把點燈／祈福的狀態值從「處理進度」改成收款（`待處理`／`待確認`／`已確認`／`已完成` → `待匯款`／`已收款`／`已取消`），並拿掉可能卡住新值的 CHECK。
  **沒跑不會壞掉**：讀取端有 `normalizeLampStatus()` 折舊值、寫入端遇到 23514 會改用舊值送出，所以這支的作用是讓資料**收斂**而不是讓功能可用。

<!-- 原 L1116-1116 -->
> 【待確認：2026-10 記為尚未執行，現況未查證；不要為了確認而重跑】

- **`supabase/migrations/fahui_member_read.sql` 也還沒跑**：讓會員在會員中心看得到自己的法會報名紀錄。

<!-- 原 L1117-1118 -->
> 【待確認：2026-10 記為尚未執行，現況未查證；不要為了確認而重跑】

- **`supabase/migrations/relocation_donation_fields.sql` 要跑過**（2026-10-23 新增，**使用者尚未執行**）：給 `donations` 加 `birth_date`／`relocation_plan`／`relocation_tier`。
  **沒跑不會壞掉，但遷址登記表的生日與方案會安靜地掉**——捐款本身收得到，廟方卻不知道那個人選的是月供養還是單次供養。送出時瀏覽器 console 會印一行「資料庫還沒有 … 欄位」，可以用來確認跑了沒。

<!-- 原 L1119-1120 -->
- **後台「關於我們」第二張卡的數字還是舊的**：要改成 `80+` / `祀奉神尊`（資料庫目前仍是 `10萬+` / `年度信眾`）。前台已經先顯示 80+ 的過渡值，所以畫面是對的、資料庫是舊的。

<!-- 原 L1121-1122 -->
> 【已過時：FAHUI_LANDING 必須維持 true，改 false 會讓 /fahui 失效（App.tsx shouldShowFahui）；Event 節點已不在 index.html。其餘未查證】

- 主官網上線 checklist：`FAHUI_LANDING` 改 false、index.html title／OG 換回官網用、hero 圖 fallback 是外連 Unsplash 建議換本地圖、Google Maps iframe 在部分環境載入失敗待驗證。
  **同時要處理 index.html 的法會 Event JSON-LD**：`url` 與 `offers.url` 指向 `machu-five.vercel.app` 根路徑，而 `FAHUI_LANDING` 一關那裡就不再是報名表；法會 9/13 過後整個 Event 節點也該移除或換成下一場，否則 Search Console 會回報過期活動。
- **`supabase/migrations/thanks_certificates.sql` 要在 Supabase SQL Editor 跑過**（2026-11-27 新增）：點燈、捐獻加 `thanks_letter`，新表 `thanks_certificates`、RPC `get_thanks_certificate`。沒跑之前：點燈與捐獻填編號會跳提示、無法標記已收款；感謝狀不能存也不能發。
- **`supabase/migrations/thanks_certificates_merge.sql` 要跑**（2026-11-27 合開感謝狀）：快照改成一個編號一張。沒跑之前按預覽的列印／複製連結／發送會跳提示。
