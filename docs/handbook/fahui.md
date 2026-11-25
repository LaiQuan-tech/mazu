# 法會專屬

> 2026-11-26 自 CLAUDE.md 原文搬來，未改寫。「上一條／下面」等字眼依原順序；`原 L` 是搬移前行號。

<!-- 原 L10-11 -->
> 【已過時：2026-09-06 已截止；FAHUI_LANDING 維持 true。開下一場照技能 heshengtan-fahui】

- **法會報名表上線收件中**（太上慈悲普渡禮懺法會，9/13 舉行、9/06 截止）。`App.tsx` 模組層級的 `FAHUI_LANDING=true` 讓報名表蓋住**根路徑**——**這是刻意的**。主官網上線時改成 `false` 再部署，其他都不用動。
  判斷集中在 `shouldShowFahui()`（根路徑＋非後台＋非志工頁才顯示），初始值與 popstate 共用同一個函式；分開寫過會導致按上一頁被報名表吃掉。

<!-- 原 L44-45 -->
- **法會報名表在官網的網址是 `/fahui`**（`FAHUI_PATH`，2026-09-02 新增）。原本報名表只在「非官方網域的根路徑」顯示，所以 heshengtan.tw 上沒有任何網址能直接開它，og:url 與 Event 只好填測試網域。現在 `shouldShowFahui()` 是「`isFahuiUrl()` **或** 原本那條非官方網域規則」，舊分享連結行為完全不變。兩顆「報名普渡法會」按鈕走 `openFahui()`，會把網址推成 `/fahui`——報名表因此可分享、重新整理不會掉回首頁。
  **改這段一定要兩種網域身分各測一遍**：把 `localhost` 暫時加進 `OFFICIAL_HOSTS` 就能在本機驗官方網域那一半，測完務必撤掉（我用 `TEMP-HOSTTEST` 標記並在部署前 grep 確認為 0）。要測的路徑：`/`、`/fahui`、`/booking`、`/volunteer`、`/?admin=1`，外加「點報名鈕→網址變 /fahui→按上一頁」。

<!-- 原 L482-482 -->
- **法會報名 2026-11-24 起併入 `blessing_registrations`**（廟方：「資料也要合併」「要整批搬移」；取代下一條與「報名流程維持獨立」的說法）：一張法會報名單＝一筆，`entries` 有值就是法會，id 沿用舊表。**上層仍然拿 `FahuiRegistrationRecord`**，差異全在 `services/supabase.ts`（`fahuiRows`／`updateFahuiRow`）；`getBlessingRegistrations` 一律濾掉 `entries` 有值的，否則應收與名冊會算兩次。**金額用存的 `total_amount`，不可以套祈福算法**；未匯款提醒排除法會；通知端點仍用 `fahui_registrations` 這個名字指名，由後端找實際的表。後台是祈福管理裡的一列（財務組沒有祈福管理，保留「法會報名」）。`event_id` 外鍵改成 RESTRICT：有報名的活動刪不掉。SQL：`fahui_merge_2_columns.sql` → 部署程式 → `fahui_merge_3_move.sql`；舊表改名 `fahui_registrations_backup_20261124` 保留。
