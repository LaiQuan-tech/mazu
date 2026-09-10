/**
 * `public/` 底下的資產網址（含內容版本戳記）
 *
 * Vite 只幫 `import` 進來的資產加指紋，`public/` 的檔名永遠一樣——換了圖，
 * 信眾的瀏覽器／CDN／公司 proxy 只要有一層沒照 must-revalidate 做就會餵舊圖。
 * 最難察覺的是混搭：2026-09-02 首頁同時出現舊的二媽與新的三媽，看起來像
 * 兩尊一模一樣的神像並排。
 *
 * 作法是建置時算內容雜湊注入 `__HERO_V__`（見 vite.config.ts），網址變成
 * `/hero-sanma.webp?v=2651625a`——內容一改雜湊就變，等於換了網址。
 * **換圖不必手動改版號**，但新增會替換的檔案要記得加進 vite.config 的 HERO_FILES。
 *
 * 這支原本寫在 App.tsx 裡，2026-09-11 抽出來讓 PatternMedallion 也能用。
 */
declare const __HERO_V__: Record<string, string>;

export const heroSrc = (file: string): string => {
  const v = __HERO_V__?.[file];
  return v ? `/${file}?v=${v}` : `/${file}`;
};
