---
name: heshengtan-fahui
description: 和聖壇（heshengtan.tw／mazu 專案）法會從開辦、收件、截止到收尾的清單。只要提到下一場法會、普渡、禮斗、法會報名表開放或截止、法會品項或價錢、法會志工、額滿提前截止、法會收尾或對帳，就使用本 skill，即使只要改其中一個日期。一般祈福活動（不用法會報名表的）在後台就能建，不用本 skill。
---

# 和聖壇法會開辦

**為什麼有這份**：法會報名表的日期、截止、品項、價錢、文案寫死在程式，後台建活動不會帶動它。
以前的事故：截止四天後首頁還掛著報名鈕；首頁搜尋標題被換成過期的法會。

行號會變，下面只給識別字，用 `grep -n` 找。先讀 `docs/handbook/fahui.md`、`forms.md`、`admin.md`，衝突時以程式為準。
**手冊裡「主官網上線把 `FAHUI_LANDING` 改 false」是舊話**：改了 `/fahui` 會失效，保持 `true`。

## 0. 先問廟方（一次問完，沒答的不要猜）

1. 法會名稱、國曆與農曆日期、星期、年度；是不是普渡。
2. 開始收件日、截止日、名額。**程式沒有名額機制**，額滿只能提早截止並部署，誰通知？
3. 品項與價錢（逐項）；物資單位上限；平安餐贊助是否保留。
4. 主辦、協辦單位；地點；橫幅圖是否換。
5. 供品領取截止時間與選項。
6. 志工：是否收、日期時段、供餐、截止日。
7. 匯款帳戶（一般 `BANK_GENERAL`；不可用遷址專款）、電話、LINE。
8. 首頁要不要放報名鈕、何時撤；要不要讓搜尋與 AI 看到（決定活動是否上架）。
9. 要不要按場次分開對帳；要不要法會前提醒（目前兩者都沒有，要開發）。
10. 上一場資料是否已匯出、對帳完。

## 1. 程式

`components/FahuiRegistration.tsx`
- `REGISTRATION_DEADLINE`（含當日；**改晚就等於開放收件**）
- `SHARE_TEXT`、開放版與截止版兩組橫幅文案（名稱、日期、農曆、截止、主協辦、年度），兩組都要改
- `SERVICE_CONFIGS`（品項、價錢、上限）、`ZANPU_OFFERING_OPTIONS`（領取日期）、平安餐說明、橫幅圖、電話、LINE
- `DRAFT_KEY`：上一場未送出的內容會被還原給信眾。是否換 key 由結構有沒有變決定；
  換了要同步 `VolunteerRegistration.tsx` 的 `FAHUI_DRAFT_KEY`。不換就必須測「帶著舊草稿打開」。

`services/fahuiServices.ts` 的 `FAHUI_SERVICE_META`：**與 `SERVICE_CONFIGS` 的 key、名稱、價錢必須一致**。
改價會連帶改到**舊場次**的逐項金額顯示（總額是存下來的，不會變）。要改價或重用 key 之前，
先確認舊場次已匯出對帳，並告訴使用者這個影響；不接受就要先做「依場次取價」。匯出 Excel 也會一起受影響。
**舊 key 永遠不刪不改名**：後台明細與匯出靠 key 篩，刪了舊場次的牌位明細會消失。非普渡法會（例如禮斗）用新 key，
舊品項只從 `SERVICE_CONFIGS`（前台）拿掉、留在 `FAHUI_SERVICE_META`；「中元贊普」等名稱與供品選項也不能沿用。

`components/VolunteerRegistration.tsx`：`VOL_DAYS`、`VOL_SLOTS`、服務期間文案、範例文字、電話。
`VOL_DRAFT_KEY` 的舊草稿也會還原舊日期的出勤，改日期時換 key。志工表沒有場次欄位，新舊會混在同一份；`VOLUNTEER_OPEN` 沒有自動截止。改用餐選項要同步資料庫 CHECK（用 heshengtan-sql）。

`App.tsx`：`FAHUI_LANDING` 保持 true；`FAHUI_SIGNUP_OPEN`（首頁鈕，文字寫死）；`VOLUNTEER_OPEN`；法會分頁標題。
其他寫死「普渡／中元」：後台匯出檔名（AdminDashboard）、`services/fahuiWorkbook.ts`；另 grep `lib/`、`types.ts`、`components/ChatWidget.tsx`。

**不要改 `index.html` 的 title／og**：那是官網首頁，曾害 Google 首頁變成過期法會。
`/fahui` 目前沒有自己的分享卡，要做就新增預渲染路由（`scripts/prerender.js`＋`vercel.json`，先讀 seo.md）。

改完掃一次殘留：
```bash
grep -nE "9/13|9/06|9/1[12]|8/03|丙午|普渡|中元|2026-09" components/FahuiRegistration.tsx components/VolunteerRegistration.tsx services/fahui*.ts App.tsx
```
（關鍵字換成上一場的日期與名稱。）

## 2. 後台活動（收件前一定要先建好）

祈福管理 → 新增活動 → 報名方式選「法會報名表」。由使用者在後台操作。
- 報名送出時掛到「法會報名表」活動中**開始日最晚**的一筆。新活動開始日必須晚於所有舊的，且不可空白。
- **沒建活動就開表單，等於全部送不出去**。
- **活動比程式先建**：建好後到程式開放前不會收件；但若舊場次仍在收件，先建會把還在報的人掛到新場，要等舊場截止才建。
- 後台的截止日不控制表單，只影響顯示，要與 `REGISTRATION_DEADLINE` 一致。
- 上架與否：上架才會進 /blessing 與搜尋用 Event；不上架仍在行事曆。不要改舊活動的報名方式，不要刪舊活動。

## 3. 上線順序

1. 廟方答覆 → 2. 改程式、`tsc`、`build` → 3. 本機用 `?preview=1` 看開放版與截止版、舊草稿、手機寬度；
逐品項核對前台小計＝`FAHUI_SERVICE_META` 金額 → 4. 使用者建好活動並回報 → 5. `git fetch` 確認沒落後、使用者同意後 push →
6. deploy-verify（沒有就照 CLAUDE.md 部署後三驗）→ 7. 使用者同意後實測送出一筆「測試…」：確認掛到新活動、金額、後台名單、通知信、會員中心，
再給清除 SQL（heshengtan-sql）→ 8. 使用者按後台「重新發布」，更新搜尋與機器人資料 →
9. 公佈欄要手動貼，法會活動不會自動產生公告。

改到送出路徑、金額、`entries` 結構時，另開 Agent 驗收，只給條件與路徑。

## 4. 收件期間

- 額滿提前截止（經使用者同意後部署）：
  1. `REGISTRATION_DEADLINE` 改成昨天（填今天仍收件到今天結束）
  2. 兩組橫幅、截止畫面、`SHARE_TEXT` 的截止日是寫死的，一起改；後台活動截止日也改
  3. `FAHUI_SIGNUP_OPEN` 改 false
  4. 告知廟方：截止只在前端判斷，**已開著表單的人仍送得出去**，當天要再看一次名單
- 未匯款不會自動提醒，要人工追；確認信沒有場次與日期。
- 財務組「法會報名」頁與匯出是**所有場次合併**；單場資料從祈福管理的那個活動進去。
- 收件中不要改品項 key 或價錢。

## 5. 收尾

- [ ] 截止日過後，線上 `/fahui` 確實是截止畫面，文案是這一場的
- [ ] `FAHUI_SIGNUP_OPEN`、`VOLUNTEER_OPEN` 改 false 並部署（**當天就排**，沒有自動關閉）
- [ ] 後台對帳、感謝狀編號、單場匯出備份（使用者保存）
- [ ] 活動下架，不刪除
- [ ] 公佈欄公告下架，按「重新發布」
- [ ] 測試資料清乾淨
- [ ] 把這次的新坑寫進 `docs/handbook/fahui.md`，並更新本清單

截止與收尾日期確定後，問使用者要不要設定提醒。

## 回報

列：改了什麼、廟方還沒答的、使用者要操作的、實測到的證據、未驗項目。沒有實際送出測試報名，就不能說「報名正常」。
