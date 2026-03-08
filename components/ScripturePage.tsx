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

  // Reveal on scroll — re-observe whenever verses change
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('sp-in'); }),
      { threshold: 0.10, rootMargin: '0px 0px -30px 0px' }
    );
    document.querySelectorAll('.sp-up, .sp-left, .sp-right').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [verses]);

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

  // ── Unified scroll effects ────────────────────────────────────────────────
  // 1. 插圖視差 + 縮放呼吸感   (desktop: parallax 0.45x + scale 0.95~1.04)
  // 2. 多層視差：水印數字        (desktop: 0.10x — 慢 = 更遠)
  // 3. Hero 視差                 (三字 0.25x / 光暈 0.12x / 副標 0.08x)
  // 4. 閱讀焦點淡出              (desktop: 已過章節 opacity 0.55)
  useEffect(() => {
    if (verses.length === 0) return;
    const tick = () => {
      const isMobile = window.innerWidth < 768;
      const vhCenter = window.innerHeight / 2;
      const scrollY = window.scrollY;

      // 1. Illustration: desktop = parallax + scale, mobile = scroll-to-center drift
      document.querySelectorAll<HTMLElement>('.sp-parallax-wrap').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const raw = (rect.top + rect.height / 2) - vhCenter;

        if (isMobile) {
          // Scroll-to-center: image is full-width, slides in from left/right edge
          const progress = Math.max(0, Math.min(1,
            (window.innerHeight - rect.top) / (window.innerHeight * 0.60)
          ));
          const maxOffset = 92;
          const dir = el.dataset.side === 'left' ? -1 : 1;
          el.style.transform = `translateX(${dir * maxOffset * (1 - progress)}px)`;
          return;
        }

        // Desktop: parallax + scale breathing
        const offset = raw * 0.45;
        const normalized = Math.min(1, Math.abs(raw) / (window.innerHeight * 0.75));
        const scale = 1.04 - 0.09 * normalized; // 1.04 at center → 0.95 at edge
        el.style.transform = `translateY(${offset}px) scale(${scale})`;
      });

      // 2. Watermark number: slower speed = deeper layer
      if (!isMobile) {
        document.querySelectorAll<HTMLElement>('.sp-watermark').forEach((el) => {
          const rect = el.getBoundingClientRect();
          const raw = (rect.top + rect.height / 2) - vhCenter;
          el.style.transform = `translateY(calc(-50% + ${raw * 0.10}px))`;
        });
      }

      // 3. Hero parallax (only while hero section is visible)
      if (scrollY < window.innerHeight * 1.2) {
        document.querySelectorAll<HTMLElement>('.hero-char').forEach((el) => {
          el.style.transform = `translateY(${-scrollY * 0.25}px)`;
        });
        const heroGlow = document.querySelector<HTMLElement>('.hero-glow');
        if (heroGlow) heroGlow.style.transform = `translateX(-50%) translateY(${-scrollY * 0.12}px)`;
        const heroSub = document.querySelector<HTMLElement>('.hero-sub');
        if (heroSub) heroSub.style.transform = `translateY(${-scrollY * 0.08}px)`;
      }

      // 4. Reading focus: past sections dim (desktop only)
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
    tick();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
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
        /* ── Entrance animations (spring easing + blur) ── */
        .sp-up   { opacity:0; transform:translateY(64px);  filter:blur(4px);
                   transition:opacity 1.15s cubic-bezier(0.16,1,0.3,1),
                              transform 1.15s cubic-bezier(0.16,1,0.3,1),
                              filter 1.0s ease; }
        .sp-left { opacity:0; transform:translateX(-88px) scale(0.96);
                   transition:opacity 1.15s cubic-bezier(0.16,1,0.3,1),
                              transform 1.15s cubic-bezier(0.16,1,0.3,1); }
        .sp-right{ opacity:0; transform:translateX(88px)  scale(0.96);
                   transition:opacity 1.15s cubic-bezier(0.16,1,0.3,1),
                              transform 1.15s cubic-bezier(0.16,1,0.3,1); }
        .sp-up.sp-in   { opacity:1; transform:translateY(0);      filter:blur(0); }
        .sp-left.sp-in { opacity:1; transform:translateX(0) scale(1); }
        .sp-right.sp-in{ opacity:1; transform:translateX(0) scale(1); }
        .sp-d1 { transition-delay:.14s; } .sp-d2 { transition-delay:.30s; } .sp-d3 { transition-delay:.48s; }
        /* ── Parallax wrappers ── */
        .sp-parallax-wrap { will-change:transform; }
        .sp-watermark     { will-change:transform; }
        /* ── Helpers ── */
        .vert { writing-mode:vertical-rl; text-orientation:mixed; }
        .brush-line { border:none; height:1px; background:linear-gradient(to right, transparent, #c9a870, transparent); opacity:.3; margin:0 auto; max-width:560px; }
        .scroll-rail { position:fixed; top:0; bottom:0; width:4px; background:linear-gradient(to bottom,#8b1a1a,#c0392b,#8b1a1a); opacity:.12; pointer-events:none; z-index:40; }
        @keyframes sp-bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(10px)} }
        /* ── Mobile adjustments ── */
        @media (max-width: 767px) {
          /* 圖片包裝器改全寬，讓「至中」有意義；超出邊緣由 section overflow:hidden 裁切 */
          .sp-parallax-wrap { width:100% !important; flex:none !important; }
          /* translateX 由 JS 控制；CSS 只負責 opacity */
          .sp-left, .sp-right {
            transform: none !important;
            transition: opacity 1.0s cubic-bezier(0.16,1,0.3,1) !important;
          }
          .sp-left.sp-in, .sp-right.sp-in { transform: none !important; }
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
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b4010', fontSize: 13, background: 'rgba(107,64,16,.08)', border: '1px solid rgba(107,64,16,.2)', borderRadius: 999, padding: '5px 14px', cursor: 'pointer' }}>
            <ChevronLeft size={15} /> 返回首頁
          </button>
          <span style={{ color: '#5a3010', fontSize: 15, letterSpacing: '.35em' }}>天 上 聖 母 經</span>
          <div style={{ width: 88 }} />
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, #f0dbb8, #f5edd8 65%)' }} />
        {/* hero-glow: moves at 0.12x scroll speed */}
        <div className="hero-glow" style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 480, background: 'radial-gradient(ellipse, rgba(188,140,60,.12), transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <p style={{ color: 'rgba(107,64,16,.5)', fontSize: 12, letterSpacing: '.65em', marginBottom: 32 }}>台 北 古 亭 和 聖 壇</p>
          {/* hero-char: five title characters move at 0.25x */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(10px,3vw,44px)', marginBottom: 36 }}>
            {['天', '上', '聖', '母', '經'].map((ch, i) => (
              <span key={i} className="hero-char" style={{ fontSize: 'clamp(46px,7.5vw,100px)', color: '#3a2008', fontWeight: 300, lineHeight: 1, textShadow: '2px 3px 12px rgba(107,64,16,.12)', opacity: 0.9, display: 'inline-block' }}>{ch}</span>
            ))}
          </div>
          <hr className="brush-line" style={{ marginBottom: 28, maxWidth: 280 }} />
          {/* hero-sub: subtitle drifts at 0.08x */}
          <p className="hero-sub" style={{ color: 'rgba(90,48,16,.6)', fontSize: 14, letterSpacing: '.35em', lineHeight: 2.2 }}>天上聖母護佑眾生・慈悲顯化・靈感無邊</p>
          <p style={{ color: 'rgba(90,48,16,.4)', fontSize: 12, letterSpacing: '.2em', marginTop: 16 }}>
            {loading ? '載入中…' : `全經共 ${verses.length} 節`}
          </p>
        </div>
        <div onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
          style={{ position: 'absolute', bottom: 32, left: '50%', color: 'rgba(107,64,16,.4)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, animation: 'sp-bounce 2.2s ease-in-out infinite' }}>
          <span style={{ fontSize: 11, letterSpacing: '.3em' }}>scroll</span>
          <ChevronDown size={17} />
        </div>
      </div>

      {/* ── 開場 ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '72px 32px 56px', textAlign: 'center' }}>
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
            <section style={{ minHeight: '70vh', padding: 'clamp(48px,7vh,80px) clamp(20px,5vw,72px)', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>

              {/* Subtle per-section background glow */}
              <div style={{
                position: 'absolute',
                [isEven ? 'right' : 'left']: '-8%',
                top: '15%',
                width: '55%', height: '70%',
                background: 'radial-gradient(ellipse, rgba(188,140,60,.045), transparent 68%)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }} />

              {/* Watermark section number — sp-watermark for multi-layer parallax */}
              <span className="sp-watermark" style={{ position: 'absolute', top: '50%', [isEven ? 'right' : 'left']: '3%', transform: 'translateY(-50%)', fontSize: 'clamp(60px,11vw,150px)', color: 'rgba(184,145,90,.05)', fontWeight: 700, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                {String(section.sectionNumber).padStart(3, '0')}
              </span>

              <div style={{ maxWidth: 1060, margin: '0 auto', width: '100%', display: 'flex', flexDirection: isEven ? 'row' : 'row-reverse', alignItems: 'center', gap: 'clamp(24px,5vw,72px)', flexWrap: 'wrap' }}>

                {/* Illustration: parallax + scale wrapper + entrance animation */}
                {imgUrl && (
                  <div className="sp-parallax-wrap" data-side={isEven ? 'left' : 'right'} style={{ flex: '0 0 auto', width: 'clamp(180px,38%,400px)' }}>
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

                {/* Text */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  {/* Vertical verse */}
                  <div className="sp-up sp-d1" style={{ display: 'flex', justifyContent: isEven ? 'flex-end' : 'flex-start', marginBottom: 26 }}>
                    <div className="vert" style={{ color: '#3a2008', fontSize: 'clamp(18px,2.6vw,32px)', fontWeight: 300, letterSpacing: '.28em', lineHeight: 1.75, height: 'clamp(110px,16vw,200px)', overflow: 'hidden' }}>
                      {section.verse}
                    </div>
                  </div>
                  <div className="sp-up sp-d2" style={{ height: 1, marginBottom: 20, background: isEven ? 'linear-gradient(to right, rgba(184,145,90,.35), transparent)' : 'linear-gradient(to left, rgba(184,145,90,.35), transparent)' }} />
                  <div className="sp-up sp-d3" style={{ color: 'rgba(58,32,8,.62)', fontSize: 'clamp(12.5px,1.5vw,14.5px)', lineHeight: 2.2, letterSpacing: '.05em', maxWidth: 460 }}>
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
            <button onClick={onBack} style={{ color: '#6b4010', fontSize: 13, background: 'rgba(107,64,16,.07)', border: '1px solid rgba(107,64,16,.2)', borderRadius: 999, padding: '9px 26px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, letterSpacing: '.1em' }}>
              <ChevronLeft size={15} /> 返回首頁
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScripturePage;
