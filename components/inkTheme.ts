/**
 * 青花紙配色（廟方 2026-10-17 指定，參考泥金寫經本：靛藍紙、泥金字、金欄線）
 *
 * 2026-10-17 從 ScripturePage 抽出來共用——廟方要把這個風格推到其他頁，
 * 複製一份色票到第二個檔案的那一刻，「兩頁的藍不一樣」就只是時間問題。
 *
 * ── 深底不是把色相換掉就好，透明度要一起調 ──
 * 米黃底上的深色字用 50% 透明還讀得到；靛藍底上的金字用 50% 會直接糊進背景。
 * 這裡每一個 rgba 的 alpha 都是在瀏覽器裡量過對比之後定的，不是只換色相。
 *
 * 實測（WCAG，量的不是估的）：`ink` 對 `paper` 11.27:1、`inkBody` 8.61:1，
 * 遠高於 4.5:1 的門檻。**深底配金比淺底配金好讀**，這不是直覺的結果——
 * 改版前那些金色小字壓在米黃上才是真正吃力的。
 *
 * ── 要加新色之前 ──
 * 先問這個色是不是已經有了。這張表刻意只有十幾個值：值一多就會開始出現
 * 「差一點點」的兩個金色，而那正是色票存在要避免的事。
 */
export const INK = {
  paper:     '#16233F',                    // 靛藍紙
  paperDeep: '#0F1A2E',                    // 漸層的深處
  navBar:    'rgba(18,28,50,0.97)',        // 導覽列實心時的底
  ink:       '#F0D9A4',                    // 大標與主要文字：全頁最亮
  inkBody:   'rgba(236,212,156,.88)',      // 長段內文。要比裝飾性文字亮
  inkSoft:   'rgba(201,168,106,.78)',      // 次要說明
  inkFaint:  'rgba(201,168,106,.82)',      // 標籤、頁碼。**不要再調低**：12px 的小字，.62 時量到只有 3.5:1
  gold:      '#C9A86A',
  goldLine:  'rgba(201,168,106,.35)',      // 分隔線
  rule:      'rgba(201,168,106,.20)',      // 欄線
  frame:     'rgba(201,168,106,.28)',      // 框線
  /**
   * 輸入框的底。**不要用純色、要用白色的低透明度**：純色一旦與 paper 差太少就看
   * 不出哪裡可以打字，差太多又像貼了一塊補丁；用白色疊上去，深淺跟著紙色走，
   * 之後換紙色也不必重調。
   */
  fieldFace: 'rgba(255,255,255,.06)',
  btnFace:   'rgba(201,168,106,.12)',
  btnEdge:   'rgba(201,168,106,.35)',
  glow:      'rgba(201,168,106,.10)',
  shadow:    'rgba(0,0,0,.45)',
} as const;

/**
 * ── 做過但收回來的：深底表單（2026-10-17）──
 *
 * 曾經把 /urgent 整頁改成青花紙當試作，當天廟方決定**只有聖母經用這個風格**，
 * 所以那一版收回去了。程式碼不留（沒有人引用的 CSS 會爛掉），但那一趟學到的
 * 三件事留在這裡——哪天再要把深底推到別的頁，這三件就是會卡住的地方：
 *
 * 1. **`color-scheme: dark` 是最關鍵的一行。** 少了它，`<select>` 展開的那張清單
 *    與日期欄位的原生圖示會沿用作業系統的淺色外觀——畫面上是靛藍的表單，點下去
 *    跳出一張白底清單，而且那是原生 UI、CSS 碰不到。
 * 2. **placeholder 與 focus 光環一定要自己給。** inline style 做不到這兩件事，
 *    而深底上正好最需要它們：看不出哪裡可以打字、打了也不知道焦點在哪。
 *    輸入框的底用白色低透明度（不要用純色），深淺會跟著紙色走。
 * 3. **共用元件的淺色外觀從外面蓋掉，不要去改元件本身。** BirthDatePicker 是六個
 *    表單共用的，為了一頁改它會動到另外五個還在米黃底上的表單。正解是給容器一個
 *    scope class，用後代選擇器壓掉 `.text-gray-*`／`.bg-white` 那幾個 Tailwind 類。
 *
 * 另外導覽列也要跟著變深，否則米黃的 bar 壓在靛藍紙上像兩個網站拼起來；
 * 頁尾不必動（#2E2A22 近黑色，接在靛藍下面沒有違和）。
 */

/**
 * 首頁的青花紙試裝（`?ink=1`，2026-10-17 廟方「測試看看」）
 *
 * ── 為什麼是一層覆蓋而不是逐個元件改 ──
 * 首頁有上千行 JSX、四十幾種顏色類別散在各處。逐個改要一整天，而這是**要給廟方
 * 看了才決定的東西**——看完說不要，那一天就白花了。覆蓋層十分鐘寫完、十秒鐘移除，
 * 而且正式站一個像素都不會動（預設關閉，要加 ?ink=1 才看得到）。
 * 這沿用站上既有的比稿機制（`?hero=blue`／`?hero=porcelain`），廟方已經熟悉。
 *
 * **這不是上線用的寫法。** 決定要採用的話，要改成每個元件自己帶顏色；
 * `!important` 疊在 Tailwind 上只適合拿來看，長期維護會變成兩套顏色在打架。
 *
 * ── 已知的妥協 ──
 * 白卡上的陰影（shadow-lg）在深底上幾乎看不到，所以卡片的層次會比米黃版弱；
 * 真要上線得把陰影換成邊框或內發光。
 */
export const INK_PAPER_CSS = `
  .ink-paper { background: ${INK.paper}; color-scheme: dark; }

  /* 版面底：米黃的區塊讓紙色透出來，白卡改成極淡的白疊色（深淺跟著紙色走） */
  .ink-paper .bg-temple-bg { background: transparent !important; }
  .ink-paper .bg-white,
  .ink-paper .bg-gray-50    { background: rgba(255,255,255,.045) !important; }
  /* 「跳至主要內容」是 a.bg-white＋寫死的 text-[#7C5C1E]，上一條會把它的白底
     換掉、而寫死的那個色沒有類別可以蓋，結果深褐字壓在深底上（量到 2.53:1）。
     這顆是給鍵盤使用者的唯一捷徑，不能讓它看不見——直接給金底深字。 */
  .ink-paper a.bg-white { background: ${INK.gold} !important; color: ${INK.paper} !important; }

  /* bg-temple-red 身兼兩職：整片的區塊底，以及按鈕。用標籤名分開——
     區塊變成更深的紙（不要變成一大塊金），按鈕才變金底深字 */
  .ink-paper section.bg-temple-red { background: ${INK.paperDeep} !important; }
  .ink-paper button.bg-temple-red,
  .ink-paper a.bg-temple-red { background: ${INK.gold} !important; color: ${INK.paper} !important; }

  /* 文字。alpha 都是量過對比才定的，見本檔開頭 */
  .ink-paper .text-temple-dark { color: ${INK.ink} !important; }
  .ink-paper .text-gray-700,
  .ink-paper .text-gray-600,
  .ink-paper .text-amber-900   { color: ${INK.inkBody} !important; }
  .ink-paper .text-gray-500    { color: ${INK.inkSoft} !important; }
  .ink-paper .text-gray-400,
  .ink-paper .text-gray-300    { color: ${INK.inkFaint} !important; }
  .ink-paper .text-temple-red  { color: ${INK.gold} !important; }
  .ink-paper .text-temple-red\\/70 { color: ${INK.inkSoft} !important; }

  /* 框線。灰框在深底上會消失，一律換成金的細框 */
  .ink-paper .border-gray-100,
  .ink-paper .border-gray-200,
  .ink-paper .border-gray-300,
  .ink-paper .border-temple-red\\/30 { border-color: ${INK.frame} !important; }

  /* 常見問題用的是原生 <details>，樣式寫在 index.css 的 .faq-item，
     不是 Tailwind 類別——所以上面那一串後代選擇器碰不到它，要另外指名。
     不補的話整個問答區是深褐字壓在靛藍上，量到 1.12:1（等於看不見）。 */
  .ink-paper .faq-item > summary { color: ${INK.ink} !important; }
  .ink-paper .faq-item > summary:hover { color: ${INK.gold} !important; }
  .ink-paper .faq-item .faq-answer,
  .ink-paper .faq-item > div { color: ${INK.inkBody} !important; }

  /* 匯款資訊那一塊是琥珀色系（bg-amber-50 ＋ text-amber-*）。
     **底色一定要跟著換**：只換文字的話會變成金字壓在米黃底上，量到 1.34:1
     ——那是整頁最不能看不清楚的一塊（銀行代碼與帳號）。 */
  .ink-paper .bg-amber-50     { background: ${INK.btnFace} !important; }
  .ink-paper .border-amber-200 { border-color: ${INK.btnEdge} !important; }
  .ink-paper .text-amber-800  { color: ${INK.ink} !important; }
  .ink-paper .text-amber-700  { color: ${INK.inkSoft} !important; }

  /*
    導覽列的「更多」下拉與手機選單。這兩塊的字色是寫死的任意值
    （text-[#3D2800]），沒有語意類別可以蓋，上面那串後代選擇器碰不到——
    量到 1.39:1，打開就是一片看不見的字。用屬性選擇器指名。
    它們平常是收起來的，所以光看畫面不會發現；是掃全頁對比才抓到的。
  */
  .ink-paper nav [class*="text-[#3D2800]"] { color: ${INK.ink} !important; }
  .ink-paper nav [class*="bg-[#3D2800]"]   { background: ${INK.goldLine} !important; }
  .ink-paper nav [class*="bg-[#F0E9CE]"]   { background: ${INK.paperDeep} !important; }
  /* 導覽列裡的 text-temple-red 會落在金色的「目前頁」底上，用 gold 量到 4.44:1
     ——差 0.06 就過不了 AA。導覽列裡一律用最亮的那一階。 */
  .ink-paper nav .text-temple-red { color: ${INK.ink} !important; }

  /* 頁尾本來是 #2E2A22 的暖黑，接在靛藍下面偏棕，換成紙色的深處 */
  .ink-paper footer { background: ${INK.paperDeep} !important; }

  /* 團紋在深底上要更濃一點才看得到（同 PatternMedallion 的 onDark） */
  .ink-paper .pattern-phoenix { opacity: .26; }
  .ink-paper .pattern-dragon  { opacity: .20; }

  /*
    ── 讓青花＋泥金讀起來是「現在」而不是「廟宇網站」（廟方 2026-10-17）──

    現在這個版面會顯得舊，不是顏色的問題，是**金用得太多**：每一條框、每一顆
    圖示、每一個標題、每一節下面的菱形飾都是金的。當代的奢侈品視覺剛好相反——
    金屬色是**稀有的重音**，一個畫面只出現一兩次，其餘靠留白與線的粗細說話。

    所以這一段做四件事，每一件都是「拿掉」不是「加上」：
      1. 金框 → 極細的冷色線。框線不該是裝飾，它只是界線。
      2. 圓角與陰影 → 幾乎拉平。浮起來的圓角卡片是上一個十年的語言，
         當代編輯式版面是貼齊的平面。
      3. 每節標題下面的菱形分隔飾 → 收起來。那個符號重複了八次，
         重複的裝飾不會變高級，只會變壁紙。
      4. 小標 → 更小、更細、字距拉到 0.5em，和巨大的襯線主標形成反差。
         字級的落差才是時尚感的來源，不是多加一個圖案。

    **金沒有被拿掉，是被省下來**：留給宮壇名、主標與按鈕——那幾個地方金才有份量。
  */
  .ink-paper [class*="border-temple-gold"],
  .ink-paper [class*="border-temple-red"] { border-color: rgba(214,228,255,.14) !important; }
  .ink-paper .rounded-xl, .ink-paper .rounded-2xl, .ink-paper .rounded-lg { border-radius: 3px !important; }
  .ink-paper .shadow-sm, .ink-paper .shadow-md, .ink-paper .shadow-lg,
  .ink-paper .shadow-xl, .ink-paper .shadow-2xl { box-shadow: none !important; }
  /* 菱形分隔飾（span.w-2.h-2.rotate-45）與它兩側的短線 */
  .ink-paper section span.rotate-45 { display: none !important; }
  .ink-paper section span.w-12.h-px { width: 84px !important; opacity: .45; }
  /* 小標兩側那兩根粗短棒 → 一條細長線 */
  .ink-paper section span.w-8.h-1 { height: 1px !important; width: 56px !important; opacity: .5; }
  .ink-paper section h2.tracking-widest {
    font-weight: 400 !important;
    font-size: 11px !important;
    letter-spacing: .5em !important;
  }

  /* 表單控制項：同 /urgent 試作學到的那三件事 */
  .ink-paper input, .ink-paper textarea, .ink-paper select {
    background: ${INK.fieldFace} !important;
    border-color: ${INK.btnEdge} !important;
    color: ${INK.ink} !important;
  }
  .ink-paper input::placeholder, .ink-paper textarea::placeholder { color: rgba(201,168,106,.55) !important; }
  .ink-paper option { background: ${INK.paperDeep}; color: ${INK.ink}; }
`;
