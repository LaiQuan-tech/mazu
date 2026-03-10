import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { ScriptureVerseRecord } from '../types';
import { getScriptureVerses } from '../services/supabase';

const STORAGE_BASE = 'https://keosbjepuvqqqhzyuplb.supabase.co/storage/v1/object/public/site-images';

interface ScripturePageProps {
  onBack: () => void;
}

const ScripturePage: React.FC<ScripturePageProps> = ({ onBack }) => {
  const [atTop, setAtTop] = useState(true);
  const [verses, setVerses] = useState<ScriptureVerseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const rafRef = useRef<number>(0);

  // 掛載時把 body 背景改成頁面底色，避免捲動慣性時露白
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#f5edd8';
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  // 每次開啟頁面都重新 fetch 最新資料
  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    getScriptureVerses()
      .then(setVerses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Nav transparency + scroll progress bar
  useEffect(() => {
    const onScroll = () => {
      setAtTop(window.scrollY < window.innerHeight * 0.9);
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? window.scrollY / docHeight : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Current section tracker
  useEffect(() => {
    if (verses.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          const idx = parseInt((e.target as HTMLElement).dataset.sectionIdx || '0');
          setCurrentSection(idx + 1);
        }
      }),
      { threshold: 0.4 }
    );
    document.querySelectorAll('[data-section-idx]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [verses]);

  // ── Scroll effects：視差 ＋ scroll-based reveal（整合在同一個 tick）──────
  // Reveal 用 scroll event + pending[] 取代 IntersectionObserver，
  // 避免非同步競態（資料載入後 user 已滑過的節不補觸發）以及
  // lazy 圖片高度為 0 時 IntersectionObserver 偵測不到的問題。
  useEffect(() => {
    if (verses.length === 0) return;

    let pending: Element[] = [];
    let initRaf = 0;

    const tick = () => {
      const isMobile = window.innerWidth < 768;
      const vhCenter = window.innerHeight / 2;
      const scrollY = window.scrollY;

      // ── 1. Reveal：批次顯示進入視口的節 ──
      // 閾值用 1.15 × vh：元素在進入畫面「前」就先觸發動畫，
      // 確保使用者滑到時內容已完全可見，不會感覺一頁空白。
      pending = pending.filter(el => {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.15) {
          el.querySelectorAll('.sp-up, .sp-left, .sp-right')
            .forEach(child => child.classList.add('sp-in'));
          return false;
        }
        return true;
      });

      // ── 2. 插圖視差 + 縮放呼吸感（desktop only）──
      // 原 section 的 overflow:hidden 已移除，translateY 可正常顯示。
      // 係數 0.12（原 0.45）→ ±50px 最大位移，視差感明顯但不過激。
      if (!isMobile) {
        document.querySelectorAll<HTMLElement>('.sp-parallax-wrap').forEach((el) => {
          const rect = el.getBoundingClientRect();
          const raw = (rect.top + rect.height / 2) - vhCenter;
          const offset = Math.max(-52, Math.min(52, raw * 0.12));
          const normalized = Math.min(1, Math.abs(raw) / (window.innerHeight * 0.75));
          const scale = 1.03 - 0.05 * normalized;
          el.style.transform = `translateY(${offset}px) scale(${scale})`;
        });
      }

      // ── 3. 水印數字視差（desktop only）──
      if (!isMobile) {
        document.querySelectorAll<HTMLElement>('.sp-watermark').forEach((el) => {
          const rect = el.getBoundingClientRect();
          const raw = (rect.top + rect.height / 2) - vhCenter;
          el.style.transform = `translateY(calc(-50% + ${raw * 0.10}px))`;
        });
      }

      // ── 4. Hero 視差 ──
      if (scrollY < window.innerHeight * 1.2) {
        document.querySelectorAll<HTMLElement>('.hero-char').forEach((el) => {
          el.style.transform = `translateY(${-scrollY * 0.25}px)`;
        });
        const heroGlow = document.querySelector<HTMLElement>('.hero-glow');
        if (heroGlow) heroGlow.style.transform = `translateX(-50%) translateY(${-scrollY * 0.12}px)`;
        const heroSub = document.querySelector<HTMLElement>('.hero-sub');
        if (heroSub) heroSub.style.transform = `translateY(${-scrollY * 0.08}px)`;
      }

      // ── 5. 閱讀焦點淡出（desktop only）──
      if (!isMobile) {
        document.querySelectorAll<HTMLElement>('[data-section-idx]').forEach((el) => {
          const rect = el.getBoundingClientRect();
          el.style.transition = 'opacity 0.9s ease';
          el.style.opacity = rect.bottom < -80 ? '0.55' : '1';
        });
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // rAF：確保 React DOM commit 完成後再查 DOM（layout 穩定）
    initRaf = requestAnimationFrame(() => {
      pending = Array.from(
        document.querySelectorAll('[data-intro], [data-section-idx]')
      );
      tick();
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(initRaf);
    };
  }, [verses]);

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return null;
    return `${STORAGE_BASE}/${imagePath}`;
  };

  // 解析「• 」開頭的行為清單，其餘保持段落
  const renderAnnotation = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let bullets: string[] = [];

    const flushBullets = (key: string) => {
      if (bullets.length === 0) return;
      nodes.push(
        <ul key={key} style={{ margin: '6px 0', padding: 0, listStyle: 'none' }}>
          {bullets.map((b, j) => (
            <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4em', marginBottom: 3 }}>
              <span style={{ color: '#c9a870', flexShrink: 0, lineHeight: 'inherit' }}>•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      );
      bullets = [];
    };

    lines.forEach((line, i) => {
      if (line.startsWith('• ')) {
        bullets.push(line.slice(2));
      } else {
        flushBullets(`ul-${i}`);
        if (line.trim()) {
          nodes.push(<span key={`t-${i}`}>{line}<br /></span>);
        }
      }
    });
    flushBullets('ul-last');
    return nodes;
  };

  return (
    <div style={{ background: '#f5edd8', minHeight: '100vh', fontFamily: '"Noto Serif TC", "思源宋體", Georgia, serif', overflowX: 'hidden' }}>
      <style>{`
        /* ── Entrance animations ── */
        .sp-up   { opacity:0; transform:translateY(40px);
                   transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),
                              transform 0.85s cubic-bezier(0.16,1,0.3,1); }
        .sp-left { opacity:0; transform:translateX(-72px) scale(0.96);
                   transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),
                              transform 0.85s cubic-bezier(0.16,1,0.3,1); }
        .sp-right{ opacity:0; transform:translateX(72px)  scale(0.96);
                   transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),
                              transform 0.85s cubic-bezier(0.16,1,0.3,1); }
        .sp-up.sp-in   { opacity:1; transform:translateY(0); }
        .sp-left.sp-in { opacity:1; transform:translateX(0) scale(1); }
        .sp-right.sp-in{ opacity:1; transform:translateX(0) scale(1); }
        .sp-d1 { transition-delay:.10s; } .sp-d2 { transition-delay:.22s; } .sp-d3 { transition-delay:.36s; }
        /* ── Parallax wrappers ── */
        .sp-parallax-wrap { will-change:transform; }
        .sp-watermark     { will-change:transform; }
        /* ── Helpers ── */
        .vert { writing-mode:vertical-rl; text-orientation:mixed; }
        .brush-line { border:none; height:1px; background:linear-gradient(to right, transparent, #c9a870, transparent); opacity:.3; margin:0 auto; max-width:560px; }
        .scroll-rail { position:fixed; top:0; bottom:0; width:4px; background:linear-gradient(to bottom,#8b1a1a,#c0392b,#8b1a1a); opacity:.12; pointer-events:none; z-index:40; }
        @keyframes sp-bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(8px)} }
        @keyframes sp-ring   { 0%{box-shadow:0 0 0 0 rgba(184,145,90,.45)} 70%{box-shadow:0 0 0 16px rgba(184,145,90,.0)} 100%{box-shadow:0 0 0 0 rgba(184,145,90,.0)} }
        .sp-scroll-btn { transition: opacity .25s, transform .25s; }
        .sp-scroll-btn:hover { opacity:.95; transform: translateX(-50%) scale(1.04) !important; }
        /* ── Mobile ── */
        @media (max-width: 767px) {
          /* 圖片包裝器全寬，讓繪圖永遠在最上方 */
          .sp-parallax-wrap { width:100% !important; flex:none !important; }
          /* 手機內容方向強制改 column：繪圖在上，經文與註解在下 */
          .sp-section-inner { flex-direction: column !important; }
          /* 手機版入場：小幅 translateX（不用 110vw，否則 getBoundingClientRect 會偏移） */
          .sp-left  { opacity:0; transform:translateX(-40px) scale(0.96) !important;
                      transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),
                                 transform 0.85s cubic-bezier(0.16,1,0.3,1) !important; }
          .sp-right { opacity:0; transform:translateX(40px)  scale(0.96) !important;
                      transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),
                                 transform 0.85s cubic-bezier(0.16,1,0.3,1) !important; }
          .sp-left.sp-in  { opacity:1; transform:translateX(0) scale(1) !important; }
          .sp-right.sp-in { opacity:1; transform:translateX(0) scale(1) !important; }
          .sp-progress { display:none !important; }
        }
      `}</style>

      {/* Left decorative rail */}
      <div className="scroll-rail" style={{ left: 0 }} />

      {/* ── Right-side scroll progress indicator ── */}
      <div className="scroll-rail" style={{ right: 0 }} />
      {!loading && verses.length > 0 && (
        <div className="sp-progress" style={{
          position: 'fixed', right: 10, top: '50%', transform: 'translateY(-50%)',
          zIndex: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          pointerEvents: 'none',
        }}>
          <span style={{
            color: 'rgba(107,64,16,.45)', fontSize: 9, letterSpacing: '.1em',
            writingMode: 'vertical-rl', lineHeight: 1.2, textAlign: 'center',
          }}>
            {currentSection > 0 ? currentSection : '―'}&thinsp;/&thinsp;{verses.length}
          </span>
          <div style={{ width: 2, height: 72, background: 'rgba(184,145,90,.18)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              width: '100%', height: `${scrollProgress * 100}%`,
              background: 'linear-gradient(to bottom, #8b1a1a, #c9a870)',
              borderRadius: 1, transition: 'height .2s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: atTop ? 'transparent' : 'rgba(245,237,216,0.92)',
        backdropFilter: atTop ? 'none' : 'blur(10px)',
        borderBottom: atTop ? 'none' : '1px solid rgba(184,145,90,0.25)',
        transition: 'all .4s ease',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b4010', background: 'rgba(107,64,16,.08)', border: '1px solid rgba(107,64,16,.2)', borderRadius: 999, padding: '6px 8px', cursor: 'pointer' }} title="返回首頁">
            <ChevronLeft size={18} />
          </button>
          <span style={{ color: '#5a3010', fontSize: 15, letterSpacing: '.35em' }}>天 上 聖 母 經</span>
          <div style={{ width: 88 }} />
        </div>
      </div>

      {/* ── Hero（無獨立背景 div，與內文頁同色，自然銜接） ── */}
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div className="hero-glow" style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 480, background: 'radial-gradient(ellipse, rgba(188,140,60,.12), transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <p style={{ color: 'rgba(107,64,16,.5)', fontSize: 12, letterSpacing: '.65em', marginBottom: 32 }}>台 北 古 亭 和 聖 壇</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(10px,3vw,44px)', marginBottom: 16 }}>
            {['天', '上', '聖', '母', '經'].map((ch, i) => (
              <span key={i} className="hero-char" style={{ fontSize: 'clamp(46px,7.5vw,100px)', color: '#3a2008', fontWeight: 900, lineHeight: 1, textShadow: '2px 3px 12px rgba(107,64,16,.12)', opacity: 0.9, display: 'inline-block' }}>{ch}</span>
            ))}
          </div>
          <p style={{ color: 'rgba(107,64,16,.55)', fontSize: 'clamp(13px,2vw,20px)', letterSpacing: '.55em', marginBottom: 28, fontWeight: 500 }}>的　註　解　與　故　事</p>
          <hr className="brush-line" style={{ marginBottom: 28, maxWidth: 280 }} />
          <p className="hero-sub" style={{ color: 'rgba(90,48,16,.6)', fontSize: 14, letterSpacing: '.35em', lineHeight: 2.2 }}>天上聖母護佑眾生・慈悲顯化・靈感無邊</p>
          <p style={{ color: 'rgba(90,48,16,.4)', fontSize: 12, letterSpacing: '.2em', marginTop: 16 }}>
            {loading ? '載入中…' : `全經共 ${verses.length} 節`}
          </p>
        </div>
        <div className="sp-scroll-btn"
          onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
          style={{ position: 'absolute', bottom: 36, left: '50%', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animation: 'sp-bounce 2.4s ease-in-out infinite', userSelect: 'none' }}>
          <span style={{ color: 'rgba(90,48,16,.65)', fontSize: 12, letterSpacing: '.6em' }}>開 始 閱 讀</span>
          <div style={{
            width: 50, height: 50, borderRadius: '50%',
            border: '1.5px solid rgba(184,145,90,.6)',
            background: 'rgba(188,140,60,.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(107,64,16,.80)',
            animation: 'sp-ring 2.1s ease-out infinite',
          }}>
            <ChevronDown size={22} />
          </div>
        </div>
      </div>

      {/* ── 開場 ── */}
      <div data-intro="true" style={{ maxWidth: 680, margin: '0 auto', padding: '20px 32px 40px', textAlign: 'center' }}>
        <p className="sp-up" style={{ color: 'rgba(90,48,16,.55)', fontSize: 12, letterSpacing: '.5em', marginBottom: 18 }}>✦ 按章節閱讀 ✦</p>
        <p className="sp-up sp-d1" style={{ color: 'rgba(58,32,8,.7)', fontSize: 15, lineHeight: 2.4, letterSpacing: '.07em' }}>
          聖母經乃歷代信眾虔誠奉誦之頌詞，記載天上聖母慈悲護佑之事蹟。<br />
          以下各節，輔以圖繪與說解，願讀者沐浴聖恩，心生清淨。
        </p>
      </div>

      {/* ── 各章節 ── */}
      {verses.map((section, idx) => {
        const isEven = idx % 2 === 0;
        const imgUrl = getImageUrl(section.imagePath);
        return (
          <div key={section.id} data-section-idx={idx}>
            <hr className="brush-line" />
            <section style={{ minHeight: '70vh', padding: 'clamp(48px,7vh,80px) clamp(20px,5vw,72px)', display: 'flex', alignItems: 'center', position: 'relative' }}>

              {/* Per-section background glow */}
              <div style={{
                position: 'absolute',
                [isEven ? 'right' : 'left']: '-8%',
                top: '15%',
                width: '55%', height: '70%',
                background: 'radial-gradient(ellipse, rgba(188,140,60,.045), transparent 68%)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }} />

              {/* Watermark section number */}
              <span className="sp-watermark" style={{ position: 'absolute', top: '50%', [isEven ? 'right' : 'left']: '3%', transform: 'translateY(-50%)', fontSize: 'clamp(60px,11vw,150px)', color: 'rgba(184,145,90,.05)', fontWeight: 700, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                {String(section.sectionNumber).padStart(3, '0')}
              </span>

              {/* sp-section-inner：手機版 CSS 強制 column（繪圖在上） */}
              <div className="sp-section-inner" style={{ maxWidth: 1060, margin: '0 auto', width: '100%', display: 'flex', flexDirection: isEven ? 'row' : 'row-reverse', alignItems: 'center', gap: 'clamp(24px,5vw,72px)', flexWrap: 'wrap' }}>

                {/* 插圖：視差 + 縮放 + 入場動畫 */}
                {imgUrl && (
                  <div className="sp-parallax-wrap" style={{ flex: '0 0 auto', width: 'clamp(180px,38%,400px)' }}>
                    <div className={isEven ? 'sp-left' : 'sp-right'}>
                      <img
                        src={imgUrl}
                        alt=""
                        loading="lazy"
                        style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 8px 32px rgba(90,48,16,.13))' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>
                )}

                {/* 文字 */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="sp-up sp-d1" style={{ display: 'flex', justifyContent: isEven ? 'flex-end' : 'flex-start', marginBottom: 26 }}>
                    <div className="vert" style={{ color: '#3a2008', fontSize: 'clamp(18px,2.6vw,32px)', fontWeight: 900, letterSpacing: '.28em', lineHeight: 1.75, whiteSpace: 'pre' }}>
                      {section.verse}
                    </div>
                  </div>
                  <div className="sp-up sp-d2" style={{ height: 1, marginBottom: 20, background: isEven ? 'linear-gradient(to right, rgba(184,145,90,.35), transparent)' : 'linear-gradient(to left, rgba(184,145,90,.35), transparent)' }} />
                  <div className="sp-up sp-d3" style={{ color: 'rgba(58,32,8,.62)', fontSize: 'clamp(14px,1.5vw,16px)', lineHeight: 2.2, letterSpacing: '.05em', maxWidth: 640 }}>
                    {renderAnnotation(section.annotation)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      })}

      {/* ── 結尾 ── */}
      <hr className="brush-line" />
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '72px 32px', background: 'linear-gradient(to bottom, #f5edd8, #efe3c4)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="vert sp-up" style={{ color: '#3a2008', fontSize: 'clamp(16px,2.5vw,28px)', fontWeight: 300, letterSpacing: '.35em', lineHeight: 1.9, height: 'clamp(180px,26vw,320px)', margin: '0 auto' }}>
            {'天上聖母\n護佑眾生\n萬古流芳\n聖恩永沐'}
          </div>
          <hr className="brush-line sp-up sp-d1" style={{ margin: '40px auto' }} />
          <p className="sp-up sp-d2" style={{ color: 'rgba(90,48,16,.45)', fontSize: 13, letterSpacing: '.4em', lineHeight: 2.4 }}>台北古亭和聖壇　敬獻</p>
          <div className="sp-up sp-d3" style={{ marginTop: 44 }}>
            <button onClick={onBack} style={{ color: '#6b4010', background: 'rgba(107,64,16,.07)', border: '1px solid rgba(107,64,16,.2)', borderRadius: 999, padding: '10px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="返回首頁">
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScripturePage;
