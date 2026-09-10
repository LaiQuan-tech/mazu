import React from 'react';
import PatternMedallion, { PatternMotif } from './PatternMedallion';

/**
 * 圖文穿插的長頁版型（關於我們、遷址捐款共用）
 *
 * 這類頁面的重點是「讀得下去」，所以有兩個刻意的設計：
 *   1. 純文字段落限制在 65ch 以內——一行超過這個寬度，眼睛換行時容易跳行。
 *   2. 有照片的段落左右交錯，避免整頁照片都在同一側變成單調的兩欄。
 * 段落資料由呼叫端提供，版型不碰內容。
 */

export interface StoryBlock {
  /** 小節標題，留空則只有內文（適合承接上一段的補述） */
  heading?: string;
  /** 每個元素是一段。用陣列而不是一整串換行字，段距才由版型統一控制 */
  paragraphs: string[];
  /** 照片路徑（public/ 底下）。留空則此段為滿版文字 */
  image?: string;
  imageAlt?: string;
  /** 照片說明，會以細字排在照片下方 */
  caption?: string;
}

/**
 * 後台內文支援兩種標記：**粗體** 與 [文字](網址)
 *
 * 刻意不存 HTML、也不用 dangerouslySetInnerHTML：那等於讓後台的輸入直接變成
 * 頁面上的標籤，後台帳號一旦外洩就能植入腳本。這裡自己解析成 React 元素，
 * 文字永遠是文字，沒有注入的可能。只支援兩種標記也讓廟方好記。
 */
const MARKUP = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

/** 只放行 http(s) 與站內相對路徑，擋掉 javascript: 這類協定 */
const safeHref = (raw: string): string | null => {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('#')) return url;
  return null;
};

export const renderInline = (text: string): React.ReactNode[] =>
  text.split(MARKUP).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-temple-dark">{part.slice(2, -2)}</strong>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <React.Fragment key={i}>{link[1]}</React.Fragment>;
      const external = /^https?:\/\//i.test(href);
      return (
        <a
          key={i}
          href={href}
          className="text-temple-red underline underline-offset-4 decoration-temple-gold/70 hover:decoration-temple-red transition-colors"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {link[1]}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

/** 內文段落。文字若還沒給，維持空陣列即可，不會渲染出空的 <p> */
const Paragraphs: React.FC<{ items: string[]; className?: string; reveal?: boolean }> = ({ items, className = '', reveal = false }) => (
  <>
    {items.filter(Boolean).map((text, i) => (
      <p
        key={i}
        className={`text-gray-600 leading-loose text-lg mb-5 last:mb-0 ${className} ${
          reveal ? `sr sr-up ${['', 'sr-d1', 'sr-d2', 'sr-d3'][Math.min(i, 3)]}` : ''
        }`}
      >
        {renderInline(text)}
      </p>
    ))}
  </>
);

/** 後台是一整塊文字，空一行＝新的一段 */
export const splitParagraphs = (body: string): string[] =>
  body.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

/** 金色細線＋菱形的分隔飾樣，與站上其他區塊一致（全站不用 emoji） */
const Rule: React.FC<{ center?: boolean }> = ({ center = false }) => (
  <div className={`flex items-center gap-3 mt-3 mb-6 ${center ? 'justify-center' : ''}`}>
    <span className="w-12 h-px bg-temple-gold/70" />
    <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
    <span className="w-12 h-px bg-temple-gold/70" />
  </div>
);

/** fromRight：照片在版面右側時從右邊滑入，方向跟著版型走才不會覺得動線亂。
    進場（.sr）與視差（.sr-figure）分屬兩層——兩者都寫 transform，同一層會互相覆蓋。 */
const StoryFigure: React.FC<{ src: string; alt: string; caption?: string; eager?: boolean; fromRight?: boolean }> = ({ src, alt, caption, eager = false, fromRight = false }) => (
  <div className={`sr ${fromRight ? 'sr-right' : 'sr-left'}`}>
    <div className="sr-figure">
      <figure className="relative">
        {/* 偏移的金框：與首頁「關於我們」的照片同一個語彙 */}
        <div className="absolute -top-3 -left-3 w-full h-full border-2 border-temple-gold/70 rounded-lg z-0" aria-hidden="true" />
        <img
          src={src}
          alt={alt}
          // 第一張圖在首屏，延遲載入只會讓它慢一拍才出現；其餘才 lazy
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          className="relative z-10 rounded-lg shadow-xl w-full h-72 sm:h-96 object-cover"
        />
        {caption && <figcaption className="relative z-10 mt-3 text-sm text-gray-500 leading-relaxed">{caption}</figcaption>}
      </figure>
    </div>
  </div>
);

export interface StoryPageProps {
  /**
   * 底紋。這個版型兩頁共用（/about 與 /relocation），兩頁量出來都是
   * 左邊界空 6/10、右邊界只有 1/10 與 0/10，所以固定放左側。
   */
  medallion?: PatternMotif;
  /** 小標（例如「關於和聖壇」） */
  eyebrow: string;
  /** 大標 */
  title: string;
  /** 開場段，排在標題下方、置中，作為整頁的引言 */
  lead?: string[];
  blocks: StoryBlock[];
  /** 接在圖文之後的內容，例如遷址捐款的方案表格 */
  children?: React.ReactNode;
  onBack: () => void;
}

// 進場與視差的計算搬到全站共用的 hooks/useScrollMotion.ts（App 掛一次），
// 這裡只負責掛上 .sr / .sr-figure / .sr-counter 這些 class。
const StoryPage: React.FC<StoryPageProps> = ({ eyebrow, title, lead = [], blocks, children, onBack, medallion }) => (
  // pt-20 讓出固定導覽列的高度，否則標題會被壓在導覽列底下
  // overflow-hidden 是給底紋的：紋樣往外推四成，不裁掉會撐出水平捲軸
  <div className="relative pt-20 bg-temple-bg overflow-hidden">
    {medallion && <PatternMedallion motif={medallion} side="l" />}
    {/* 祥雲底圖暫時撤下，等廟方提供高解析度的圖再換上。
        元件與切好的圖都保留在 components/CloudBackdrop.tsx 與 public/cloud-*.png，
        新圖切好後把 <CloudBackdrop /> 放回這裡即可。 */}

    <section className="page-content py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-14">
          <h2 className="sr sr-up text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
            <span className="w-8 h-1 bg-temple-gold" />
            {eyebrow}
            <span className="w-8 h-1 bg-temple-gold" />
          </h2>
          <h1 className="sr sr-up sr-d1 text-4xl sm:text-5xl font-bold text-temple-dark font-serif">{title}</h1>
          <Rule center />
          {lead.length > 0 && (
            <div className="max-w-[60ch] mx-auto text-left sm:text-center">
              <Paragraphs items={lead} reveal />
            </div>
          )}
        </header>

        <div className="space-y-16 sm:space-y-20">
          {blocks.map((b, i) => (
            <article key={i}>
              {b.image ? (
                // 有照片：左右交錯。md 以下一律照片在上、文字在下，直式螢幕硬要兩欄會兩邊都太窄
                <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
                  <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                    <StoryFigure src={b.image} alt={b.imageAlt || b.heading || title} caption={b.caption} eager={i === 0} fromRight={i % 2 === 1} />
                  </div>
                  <div className={`sr-counter ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                    {b.heading && (
                      <>
                        <h3 className="sr sr-up balance-text text-2xl sm:text-3xl font-bold text-temple-dark font-serif">{b.heading}</h3>
                        <Rule />
                      </>
                    )}
                    <Paragraphs items={b.paragraphs} reveal />
                  </div>
                </div>
              ) : (
                // 純文字：限制行寬並置中，長段落才讀得下去
                <div className="max-w-[65ch] mx-auto">
                  {b.heading && (
                    <>
                      <h3 className="sr sr-up balance-text text-2xl sm:text-3xl font-bold text-temple-dark font-serif">{b.heading}</h3>
                      <Rule />
                    </>
                  )}
                  <Paragraphs items={b.paragraphs} reveal />
                </div>
              )}
            </article>
          ))}
        </div>

        {children}

        <div className="mt-16 text-center">
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-full border border-temple-gold/60 text-temple-red hover:bg-temple-gold/10 transition-colors"
          >
            返回首頁
          </button>
        </div>
      </div>
    </section>
  </div>
);

export default StoryPage;
