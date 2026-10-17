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
 * 深底頁面共用的一小段樣式。靠 inline style 做不到的那幾件事放這裡：
 * placeholder 的顏色、focus 的光環、下拉選單展開後那張清單的底色。
 *
 * **`color-scheme: dark` 是其中最重要的一行**：少了它，`<select>` 展開的那張
 * 清單、以及日期欄位的原生圖示，會沿用作業系統的淺色外觀——畫面上是靛藍的表單，
 * 點下去跳出一張白底清單，而且那是原生 UI，CSS 改不到。
 */
export const INK_FORM_CSS = `
  .ink-scope { color-scheme: dark; }
  .ink-field {
    background: ${INK.fieldFace};
    border: 1px solid ${INK.btnEdge};
    color: ${INK.ink};
  }
  .ink-field::placeholder { color: rgba(201,168,106,.55); }
  .ink-field:focus {
    outline: none;
    border-color: ${INK.gold};
    box-shadow: 0 0 0 3px rgba(201,168,106,.18);
  }
  .ink-field option { background: ${INK.paperDeep}; color: ${INK.ink}; }

  /*
    共用元件的淺色外觀在深底上要壓掉——BirthDatePicker 是全站六個表單共用的，
    **不要為了這一頁去改它**（那會動到另外五個在米黃底上的表單）。
    改成從外面用後代選擇器蓋掉：壞了只壞這一個 scope，而且新頁套 .ink-scope
    就自動跟著對。缺點是靠 Tailwind 產生的 class 名，Tailwind 改版時要回來看一眼。
  */
  .ink-scope select { background: ${INK.fieldFace}; border-color: ${INK.btnEdge}; color: ${INK.ink}; }
  .ink-scope select option { background: ${INK.paperDeep}; color: ${INK.ink}; }
  .ink-scope .text-gray-400 { color: ${INK.inkFaint} !important; }
  .ink-scope .text-gray-500 { color: ${INK.inkFaint} !important; }
  .ink-scope .text-gray-600 { color: ${INK.inkBody} !important; }
  .ink-scope .text-gray-700 { color: ${INK.inkBody} !important; }
  .ink-scope .text-temple-dark { color: ${INK.ink} !important; }
  .ink-scope .text-temple-red  { color: ${INK.gold} !important; }
  .ink-scope .bg-temple-bg     { background: ${INK.fieldFace} !important; }
  .ink-scope .bg-white         { background: ${INK.fieldFace} !important; }
  .ink-scope .border-gray-200  { border-color: ${INK.btnEdge} !important; }
`;
