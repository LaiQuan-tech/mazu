# GA4、像素、UTM、流量來源

> 2026-11-26 自 CLAUDE.md 原文搬來，未改寫。「上一條／下面」等字眼依原順序；`原 L` 是搬移前行號。

<!-- 原 L673-674 -->
## 流量追蹤與 UTM（2026-09-09 建置）

<!-- 原 L675-683 -->
- **追蹤碼掛載在 `components/Analytics.tsx`，編號填在後台「追蹤碼」分頁**（`site_settings` 的 `ga4_id`／`meta_pixel_id`／`gtm_id`）。刻意只存編號不存整段 `<script>`：後台一被盜就能對所有訪客植入任意腳本。
  **2026-10-13 的設定是對的**——`gtm_id` 清空、`ga4_id` 填了 `G-LHGFX80NXY`、`meta_pixel_id` 也填了，線上確認只載入 `gtag/js?id=G-LHGFX80NXY`，沒有再載 GTM。
  **但當時那句「實測通過」是假的通過**（2026-10-24 廟方回報 GA4 沒有資料才查出來）：`loadGa4()` 的 gtag 墊片把命令推成**真陣列**而不是 `arguments` 物件，Google 的 gtag/js 是用 `Object.prototype.toString` 認出 Arguments 才把那一筆當成命令，真陣列會被當成 GTM 式的資料推送而**靜靜地忽略**。所以 GA4 **從上線到 2026-10-24 一筆資料都沒有收到**，而且補不回來。
  **這個 bug 的隱蔽程度值得記住**：腳本照樣載入、`window.gtag` 照樣是函式、dataLayer 照樣長大、console 一個錯都沒有。**「有沒有載入 gtag/js」這一關它是過的**——當時驗的正是這一關。
  **要驗 GA4 只有兩個指標算數**：(1) 有沒有 `_ga` 與 `_ga_<ID>` cookie；(2) `performance.getEntriesByType('resource')` 裡有沒有 `google-analytics.com/g/collect`。兩者都是前端就看得到的，不必登入 GA4。`gtag('get', id, 'client_id', cb)` 的 callback 回不來也是同一個症狀。
  **判斷是不是環境擋掉的**：看同一頁的 Meta Pixel。它有自己的載入器，不走 gtag——`_fbp` cookie 與 `/tr/` 請求都正常就表示網路沒被擋，是 GA4 自己的問題。
  **Meta Pixel 不受影響**，那一路一直都是通的；本站自己那套「報名來源」（六張表的 `source` 欄）也與 GA4 無關、一直在記，所以這段期間的轉換來源查得到，只是沒有流量面的數字。
  ~~**2026-09-09 實測：GTM 容器 `GTM-NW9Z5NWQ` 是空的**~~——`curl 'https://www.googletagmanager.com/gtm.js?id=GTM-NW9Z5NWQ'` 回 `"tags":[]`、`"predicates":[]`、`"rules":[]`，GA4 與像素兩欄也空白。**等於整站沒有在收任何流量資料**，卻讓每個訪客白載 331KB 的 GTM。容器內容是公開的，要確認廟方到底掛了什麼直接 curl 那支 gtm.js 抓 `"tags":`，不必登入 GTM 後台。
  建議改成後台直接填 GA4 ID、清空 GTM 欄：`Analytics.tsx` 本來就內建 SPA 換頁的 page_view，走 GTM 反而要在容器裡自己建 `spa_page_view` 觸發器（現在沒有），多一層就是多一個沒人維護的地方。

<!-- 原 L684-684 -->
- **`<Analytics>` 掛在 App 的四個 return 分支**（首頁／法會／聖母經／志工），那四個分支的根節點型別不同，**切換分支時 React 會整個卸載再重新掛載**。所以它的狀態（`loaded`／`settings`／`lastSentPath`／`entryViewSent`）**一律放模組層級，不要用 useRef**——放 ref 就會每切一次分支重新注入一次 GTM／GA4 腳本，並且把那一次當成「進站第一次」再送一遍 UTM。

<!-- 原 L685-685 -->
- **StrictMode 會讓「只跑一次的守衛 + cancelled 旗標」這個組合永遠載不起來**：第一次掛載啟動 fetch → cleanup 把 `cancelled` 設 true → 第二次掛載被 `loadedRef` 擋掉直接 return → fetch 回來時已經沒有人採用它。正式站沒有 StrictMode 所以看不出來，**但本機也就永遠驗不了追蹤碼**——空的 GTM 容器長期沒被發現，這是原因之一。兩者只能擇一。

<!-- 原 L686-691 -->
- **UTM 來源歸因在 `services/attribution.ts`**。四件事各有理由，改動前先讀完：
  1. 進站時把 `utm_*` 收進 **sessionStorage**（不是 localStorage）。UTM 描述的是「這一次來訪」；放 localStorage 會讓幾個月前那檔活動的來源黏在裝置上，之後每一筆報名都算給那一檔。
  2. `withKeptParams(path, alsoDrop)` 給所有 pushState 用：洗掉 `utm_*`／`fbclid`／`gclid`，**保留功能性參數**。原本推的是純路徑，所以 `?share=`（揪團）與 `?preview=1`（工作人員預覽）進站後點一下導覽就消失、重新整理找不回那場共享報名——那是既有 bug，一併修掉了。
  3. **`closeVolunteer` 必須額外拿掉 `volunteer`**：`isVolunteerUrl()` 認得 `?volunteer`，只換路徑而留著這個參數等於沒關掉。
  4. **進站那一頁刻意不清網址列上的 UTM**。GA4／GTM 初始化時會讀真實的 `document.location`，一載入就清掉的話，日後廟方把 GA4 掛進 GTM 容器（而不是後台那個欄位）歸因就整個失效。UTM 是在**第一次站內換頁**時才從網址上拿掉的。
  **只有進站第一次的 page_view 帶 UTM**，換頁不帶——同一個來源重複宣告只會在報表製造雜訊。也刻意不把 `?share=<uuid>`／`?admin=1` 送進 `page_location`：那是識別碼不是流量維度，送進去只會製造高基數的雜訊。

<!-- 原 L692-696 -->
- **報名來源存在六張轉換表的 `source` 欄**（2026-09-09，migration：`supabase/migrations/utm_source_column.sql`）：bookings／donations／lamp_registrations／blessing_registrations／fahui_registrations／volunteer_registrations。值由 `getSource()` 產生，格式 `line/broadcast/pudu2026`；沒有 UTM 就退回 referrer 網域（`google.com`），再沒有就是 `direct`。
  **為什麼要存自己這一份而不是只看 GA4**：GA4 只說得出「300 人從 IG 來」，廟方要的是「這 12 筆點燈是抖音那支影片帶來的」。而且 **LINE 的內建瀏覽器不送 referrer**，GA4 會把 LINE 來的人全算成「直接流量」——只有這一欄看得到 LINE 群發到底有沒有效。
  **`NULL` 與 `'direct'` 是兩件事**：NULL＝這筆早於追蹤上線（2026-09-09 以前），`direct`＝有追蹤但這個人沒有來源。所以那欄刻意不給 DEFAULT，給了就再也分不出來。
  **那一欄刻意不加 CHECK constraint**：這是報名的送出路徑，CHECK 一旦擋下來整筆報名就失敗——追蹤欄位絕對不可以把轉換擋掉。長度與字元由 `cleanSource()`（attribution.ts）負責，同時處理了 Excel 公式注入（`=cmd|…` 開頭的值會被清成安全字串）。
  注入點集中在 `services/supabase.ts` 的 6 個 insert，UI 完全沒動。讀取端 6 支 getter 都是逐欄 map，各補一行；blessing 走共用的 `mapBlessingReg`，改一處兩支 getter 一起受惠。

<!-- 原 L697-699 -->
- **後台看得到來源的地方**：問事／捐獻／點燈／祈福四類共用 `MemberInfoModal`（點整列展開），來源顯示在「登記時間」下面；法會在展開區的聯絡資料那一行；志工在卡片右下角。
  **匯出有七支加了「報名來源」**：法會明細、法會總表、志工、預約、捐款、點燈、祈福。
  **三支刻意沒加**：`信眾名冊`（跨表聚合，而且它已經有一個叫「參與管道」的欄，成本高又容易混淆）、`法會報名完整表`（35 欄固定索引的列印用表格，動欄位會擾亂既有版面）、`法會多分頁活頁簿`（8 個項目分頁各自欄序不同，而來源是「報名層級」的值，每個牌位重複一次只是雜訊）。法會本身已有兩支匯出帶來源，不缺這一份。

<!-- 原 L700-705 -->
- **後台「流量來源」分頁（`TrafficTab`，2026-09-09）**：`ROLE_ALLOWED_TABS` 開給 admin 與 staff，財務組不給（他們只看應收）。分成「總表」（依來源彙總：筆數、佔比、金額、六種服務各幾筆）與「明細」（每一筆報名的時間／服務／姓名／金額／來源），共用同一組日期區間篩選，各自可匯出 Excel。
  **統計一律排除 `source` 為空的舊資料**：那是追蹤上線前的，混進來會把每個來源的比例稀釋到看不出差別。但它的筆數要顯示在卡片上（「未追蹤」），否則剛上線時整頁空白會被當成壞掉。
  **空狀態要講「怎麼做才會有數字」**，不要只寫「尚無資料」——廟方看到的第一個畫面就是空的，那一頁得自己把 `?utm_source=…&utm_medium=…&utm_campaign=…` 的用法講完。
  金額的算法與應收管理（`ReceivablesTab`）共用同一套規則：點燈的金額不在報名紀錄上要去 `lampConfigs` 對、祈福是方案費加上加購總和。**不要另立一套**，兩頁對不起來就沒人信。
  **「已取消」的報名一律不計**（問事／點燈／祈福三張表都有這個狀態）：它既不是收入也不算成功的轉換，算進去等於幫每個管道灌水。
  **金額是「報名金額」不是「已入帳」**，法會的待匯款也在裡面。頁面上必須寫明這個口徑——不寫的話廟方會拿它當收入看，而實際入帳在「應收管理」那頁。問事與志工沒有金額，只計筆數。

<!-- 原 L748-749 -->
- **`source` 這個名字在本專案有兩個意思，不要弄混**：`services/devoteeRoster.ts` 的 `DevoteeSource` 是「參與管道」（法會報名／志工／問事／捐款／點燈），在信眾名冊那一頁篩選與匯出用；本節講的 `source` 是 UTM 流量來源。UI 文案一律寫「報名來源」與「參與管道」區隔，不要只寫「來源」。

<!-- 原 L750-751 -->
- **規劃全文與 UTM 命名對照表在 `docs/utm-plan.md`**，包含廟方要照抄的 source／medium／campaign 固定值。三條鐵律：站內連結絕對不加 UTM（會被判成新的來訪、蓋掉原本的歸因）、值一律小寫英數、一個檔期固定一組值不要手打。
