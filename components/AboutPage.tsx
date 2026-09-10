import React, { useEffect, useState } from 'react';
import StoryPage, { StoryBlock, splitParagraphs } from './StoryPage';
import { getAboutSections, getSiteImagePublicUrl } from '../services/supabase';
import { AboutSection } from '../types';

/**
 * 關於我們（完整版獨立頁）
 *
 * 內容來自後台「關於我們」分頁（about_sections 表），廟方自行增減段落與照片。
 * 讀不到資料時退回下面這份 FALLBACK：Supabase 免費方案會閒置自動暫停，
 * 那時整頁開天窗比顯示一段舊文案糟得多。
 *
 * 建壇年份／年度信眾那兩張數字卡只放在首頁摘要，這裡不重複——
 * 完整頁的重點是讀完整篇沿革，結尾再擺兩個數字反而打斷閱讀。
 */

/** 資料庫抓不到時的保底內容，與 about_sections.sql 帶入的初始資料一致 */
/** 資料庫真的沒有段落時才用的保底文案（含照片） */
const FALLBACK_BLOCKS: StoryBlock[] = [
  {
    heading: '心中有善不畏苦；家有溫暖路有光。',
    paragraphs: [
      '和聖壇創立近四十年，秉持著天上聖母傳道的精神。我們深信，心中有善不畏苦；家有溫暖路有光。信仰不止於燒香祈福，更是落實於日常的為人處世。以信仰安頓身心，以善念引領前行，將媽祖的教誨實踐於生活之中，讓慈悲與善念一路延續。',
    ],
    image: '/picture/Introduction 1.jpg',
    imageAlt: '和聖壇壇內一景',
  },
];

/** 還在讀資料庫時顯示的版本：文案相同但不帶照片，見下方 return 的說明 */
const LOADING_BLOCKS: StoryBlock[] = FALLBACK_BLOCKS.map(({ image, imageAlt, ...rest }) => rest);

/** 把資料庫的一列轉成版型要的段落；照片存的是 storage 路徑，這裡才轉成公開網址 */
export const toStoryBlock = (s: AboutSection): StoryBlock => ({
  heading: s.heading || undefined,
  paragraphs: splitParagraphs(s.body),
  image: s.imagePath ? getSiteImagePublicUrl(s.imagePath) : undefined,
  imageAlt: s.heading || '和聖壇',
  caption: s.caption || undefined,
});

const AboutPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [blocks, setBlocks] = useState<StoryBlock[] | null>(null);

  useEffect(() => {
    let alive = true;
    getAboutSections()
      .then(rows => { if (alive) setBlocks(rows.length > 0 ? rows.map(toStoryBlock) : FALLBACK_BLOCKS); })
      .catch(e => { console.warn('讀取關於我們段落失敗，改用保底文案:', e); if (alive) setBlocks(FALLBACK_BLOCKS); });
    return () => { alive = false; };
  }, []);

  // blocks 尚未載入時先給保底，避免標題閃一下才出現內容
  // 載入中用「無圖版」的保底：有圖的話會立刻下載 419KB，而資料庫幾乎一定有值、
  // 回來就把它換掉，等於白載（同樣的坑在 App.tsx 的 aboutImageUrl 也修過）。
  return <StoryPage eyebrow="關於和聖壇" title="關於我們" blocks={blocks ?? LOADING_BLOCKS} onBack={onBack} medallion="phoenix" />;
};

export default AboutPage;
