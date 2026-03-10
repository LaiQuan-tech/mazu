import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { ScriptureVerseRecord } from '../types';
import { getScriptureVerses } from '../services/supabase';

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

  // body 背景色：避免捲動慣性時露出白底
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#e8dfbf';
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  // 每次開啟頁面都重新 fetch
  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    getScriptureVerses()
      .then(setVerses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Nav 透明度 + 進度條（獨立 handler，不依賴 verses）
  useEffect(() => {
    const onScroll = () => {
      setAtTop(window.scrollY < window.innerHeight * 0.9);
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docH > 0 ? window.scrollY / docH : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── 核心：scroll-based reveal ＋ 多層視差 ──────────────────────────────
  // 用 scroll event 取代 IntersectionObserver：可靠、無競態、跨裝置一致
  useEffect(() => {
    if (verses.length === 0) return;

    // pending: 尚未顯示的區塊列表（只查一次 DOM，後續用 filter 縮小）
    let pending: Element[] = [];

    const tick = () => {
      const isMobile = window.innerWidth < 768;
      const scrollY = window.scrollY;
      const vhCenter = window.innerHeight / 2;

      // ── 1. Reveal：批次顯示已進入視口的區塊 ──
      pending = pending.filter(el => {
        const top = el.getBoundingClientRect().top;
        if (top < window.innerHeight * 0.88) {
          el.querySelectorAll('.sp-up').forEach(child => child.classList.add('sp-in'));
          return false; // 已顯示，移出 pending
        }
        return true;
      });

      // ── 2. Hero 視差 ──
      if (scrollY < window.innerHeight * 1.2) {
        document.querySelectorAll<HTMLElement>('.hero-char').forEach(el => {
          el.style.transform = `translateY(${-scrollY * 0.25}px)`;
        });
        const heroGlow = document.querySelector<HTMLElement>('.hero-glow');
        if (heroGlow) heroGlow.style.transform = `translateX(-50%) translateY(${-scrollY * 0.12}px)`;
        const heroSub = document.querySelector<HTMLElement>('.hero-sub');
        if (heroSub) heroSub.style.transform = `translateY(${-scrollY * 0.08}px)`;
      }

      // ── 3. 桌機：內容多層視差 ──
      if (!isMobile) {
        // 經文字體（主體）：最慢，彷彿漂浮在前景
        document.querySelectorAll<HTMLElement>('.sp-verse').forEach(el => {
          const rect = el.getBoundingClientRect();
          const raw = (rect.top + rect.height / 2) - vhCenter;
          el.style.transform = `translateY(${raw * 0.10}px)`;
        });

        // 註解文字：稍快，稍遠的層次
        document.querySelectorAll<HTMLElement>('.sp-anno').forEach(el => {
          const rect = el.getBoundingClientRect();
          const raw = (rect.top + rect.height / 2) - vhCenter;
          el.style.transform = `translateY(${raw * 0.16}px)`;
        });

        // 水印數字：最慢，最深的背景層
        document.querySelectorAll<HTMLElement>('.sp-watermark').forEach(el => {
          const rect = el.getBoundingClientRect();
          const raw = (rect.top + rect.height / 2) - vhCenter;
          el.style.transform = `translateY(calc(-50% + ${raw * 0.05}px))`;
        });

        // 閱讀焦點：已過節淡出
        document.querySelectorAll<HTMLElement>('[data-section-idx]').forEach(el => {
          const rect = el.getBoundingClientRect();
          el.style.transition = 'opacity 0.8s ease';
          el.style.opacity = rect.bottom < -80 ? '0.45' : '1';
        });
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // rAF：確保 React commit 後瀏覽器完成 layout，再查 DOM
    const initRaf = requestAnimationFrame(() => {
      pending = Array.from(
        document.querySelectorAll('[data-intro], [data-section-idx]')
      );
      tick(); // 立即檢查（處理資料載入時已滑到的節）
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(initRaf);
    };
  }, [verses]);

  // 當前節追蹤（IntersectionObserver 只用於計數顯示，不影響可見性）
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

  // 解析「• 」開頭的行為清單
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
              <span style={{ color: '#c9a870', flexShrink: 0 }}>•</span>
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
        if (line.trim()) nodes.push(<span key={`t-${i}`}>{line}<br /></span>);
      }
    });
    flushBullets('ul-last');
    return nodes;
  };

  return (
    <div style={{
      background: 'linear-gradient(158deg, #cfc09a 0%, #f0e5c8 18%, #ede8d0 50%, #e8dfbf 80%, #c8b882 100%)',
      minHeight: '100vh',
      fontFamily: '"Noto Serif TC", "思源宋體", Georgia, serif',
      overflowX: 'hidden',
    }}>
      <style>{`
        /* ── 入場動畫：只用 opacity + translateY，穩定可靠 ── */
        .sp-up {
          opacity: 0;
          transform: translateY(48px);
          filter: blur(3px);
          transition:
            opacity 1.1s cubic-bezier(0.16,1,0.3,1),
            transform 1.1s cubic-bezier(0.16,1,0.3,1),
            filter 0.9s ease;
        }
        .sp-up.sp-in {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }
        .sp-d1 { transition-delay: .12s; }
        .sp-d2 { transition-delay: .26s; }
        .sp-d3 { transition-delay: .42s; }

        /* ── 視差包裝器 will-change ── */
        .sp-verse, .sp-anno, .sp-watermark { will-change: transform; }

        /* ── 工具 ── */
        .vert { writing-mode: vertical-rl; text-orientation: mixed; }
        .brush-line {
          border: none; height: 1px;
          background: linear-gradient(to right, transparent, #c9a870, transparent);
          opacity: .28; margin: 0 auto; max-width: 560px;
        }
        .scroll-rail {
          position: fixed; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(to bottom, #8b1a1a, #c0392b, #8b1a1a);
          opacity: .10; pointer-events: none; z-index: 40;
        }
        @keyframes sp-bounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(10px); }
        }

        /* ── 仿古紙質三層 ── */
        .paper-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 100;
          background-image:
            radial-gradient(circle, rgba(90,55,8,.22) 1px, transparent 1px),
            radial-gradient(circle, rgba(80,48,6,.14) 1px, transparent 1px),
            radial-gradient(circle, rgba(70,42,5,.10) 1px, transparent 1px);
          background-size: 3px 3px, 7px 7px, 5px 5px;
          background-position: 0 0, 2px 3px, 4px 1px;
        }
        .paper-vignette {
          position: fixed; inset: 0; pointer-events: none; z-index: 100;
          background:
            radial-gradient(ellipse at 50% 44%, transparent 36%, rgba(75,40,5,.28) 100%),
            linear-gradient(to bottom, rgba(80,48,5,.10) 0%, transparent 12%, transparent 88%, rgba(80,48,5,.12) 100%),
            linear-gradient(to right,  rgba(70,40,5,.06) 0%, transparent 10%, transparent 90%, rgba(70,40,5,.06) 100%);
          box-shadow: inset 0 0 140px rgba(70,38,5,.14);
        }
        .paper-aging {
          position: fixed; inset: 0; pointer-events: none; z-index: 100;
          background:
            radial-gradient(ellipse at  3%  5%, rgba(120,70,8,.20)  0%, transparent 30%),
            radial-gradient(ellipse at 97%  4%, rgba(105,58,5,.17)  0%, transparent 27%),
            radial-gradient(ellipse at  2% 97%, rgba(125,72,8,.20)  0%, transparent 29%),
            radial-gradient(ellipse at 98% 96%, rgba(110,62,5,.17)  0%, transparent 25%),
            radial-gradient(ellipse at 28% 32%, rgba(130,75,10,.06) 0%, transparent 18%),
            radial-gradient(ellipse at 72% 68%, rgba(120,65,8,.05)  0%, transparent 16%);
        }
      `}</style>

      {/* 紙質覆蓋層 */}
      <div className="paper-grain" />
      <div className="paper-vignette" />
      <div className="paper-aging" />

      {/* 側邊裝飾線 */}
      <div className="scroll-rail" style={{ left: 0 }} />
      <div className="scroll-rail" style={{ right: 0 }} />

      {/* 右側進度指示器 */}
      {!loading && verses.length > 0 && (
        <div className="sp-progress" style={{
          position: 'fixed', right: 10, top: '50%', transform: 'translateY(-50%)',
          zIndex: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          pointerEvents: 'none',
        }}>
          <span style={{
            color: 'rgba(107,64,16,.4)', fontSize: 9, letterSpacing: '.1em',
            writingMode: 'vertical-rl', lineHeight: 1.2, textAlign: 'center',
          }}>
            {currentSection > 0 ? currentSection : '—'}&thinsp;/&thinsp;{verses.length}
          </span>
          <div style={{ width: 2, height: 72, background: 'rgba(184,145,90,.15)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              width: '100%', height: `${scrollProgress * 100}%`,
              background: 'linear-gradient(to bottom, #8b1a1a, #c9a870)',
              borderRadius: 1, transition: 'height .2s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── 導覽列 ── */}
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

      {/* ── 封面 ── */}
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
        <div onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
          style={{ position: 'absolute', bottom: 32, left: '50%', color: 'rgba(107,64,16,.4)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, animation: 'sp-bounce 2.2s ease-in-out infinite' }}>
          <span style={{ fontSize: 11, letterSpacing: '.3em' }}>scroll</span>
          <ChevronDown size={17} />
        </div>
      </div>

      {/* ── 開場說明 ── */}
      <div data-intro="true" style={{ maxWidth: 640, margin: '0 auto', padding: '72px 32px 56px', textAlign: 'center' }}>
        <p className="sp-up" style={{ color: 'rgba(90,48,16,.5)', fontSize: 11, letterSpacing: '.55em', marginBottom: 20 }}>✦ 按章節閱讀 ✦</p>
        <p className="sp-up sp-d1" style={{ color: 'rgba(58,32,8,.65)', fontSize: 15, lineHeight: 2.4, letterSpacing: '.07em' }}>
          聖母經乃歷代信眾虔誠奉誦之頌詞，記載天上聖母慈悲護佑之事蹟。<br />
          以下各節，輔以說解，願讀者沐浴聖恩，心生清淨。
        </p>
      </div>

      {/* ── 各章節（無底圖版，文字為主） ── */}
      {verses.map((section, idx) => {
        const isEven = idx % 2 === 0;
        return (
          <div key={section.id} data-section-idx={idx}>
            <hr className="brush-line" />
            <section style={{
              minHeight: '85vh',
              padding: 'clamp(56px,8vh,100px) clamp(20px,6vw,80px)',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}>

              {/* 光暈（每節右或左上角） */}
              <div style={{
                position: 'absolute',
                [isEven ? 'right' : 'left']: '-5%',
                top: '10%',
                width: '50%', height: '80%',
                background: 'radial-gradient(ellipse, rgba(188,140,60,.04), transparent 65%)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }} />

              {/* 水印數字（最慢層，視差 0.05x） */}
              <span className="sp-watermark" style={{
                position: 'absolute',
                top: '50%',
                [isEven ? 'right' : 'left']: '2%',
                fontSize: 'clamp(80px,14vw,200px)',
                color: 'rgba(184,145,90,.04)',
                fontWeight: 900,
                lineHeight: 1,
                userSelect: 'none',
                pointerEvents: 'none',
              }}>
                {String(section.sectionNumber).padStart(2, '0')}
              </span>

              {/* 主要內容：經文 ＋ 註解 並排 */}
              <div style={{
                maxWidth: 960,
                margin: '0 auto',
                width: '100%',
                display: 'flex',
                flexDirection: isEven ? 'row' : 'row-reverse',
                alignItems: 'center',
                gap: 'clamp(32px,7vw,96px)',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>

                {/* 經文：竪排，視差 0.10x */}
                <div className="sp-verse" style={{ flex: '0 0 auto' }}>
                  <div className="sp-up">
                    <div className="vert" style={{
                      color: '#3a2008',
                      fontSize: 'clamp(22px,3.5vw,46px)',
                      fontWeight: 900,
                      letterSpacing: '.32em',
                      lineHeight: 1.85,
                      whiteSpace: 'pre',
                    }}>
                      {section.verse}
                    </div>
                  </div>
                </div>

                {/* 分隔線 ＋ 註解：視差 0.16x */}
                <div className="sp-anno" style={{ flex: '1 1 220px', maxWidth: 520 }}>
                  <div className="sp-up sp-d1" style={{
                    height: 1,
                    marginBottom: 22,
                    background: isEven
                      ? 'linear-gradient(to right, rgba(184,145,90,.4), transparent)'
                      : 'linear-gradient(to left, rgba(184,145,90,.4), transparent)',
                  }} />
                  <div className="sp-up sp-d2" style={{
                    color: 'rgba(58,32,8,.60)',
                    fontSize: 'clamp(13px,1.4vw,15px)',
                    lineHeight: 2.3,
                    letterSpacing: '.05em',
                  }}>
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
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '72px 32px' }}>
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
