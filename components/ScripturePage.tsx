import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// 【資料結構】每一個段落放在這裡，之後把自己的圖片和文字填進去
// ─────────────────────────────────────────────────────────────────
interface ScriptureSection {
  id: number;
  chapter: string;       // 章節標題，例如「第一章・降誕」
  verse: string;         // 經文原文（用 \n 換行）
  annotation: string;    // 你的文字說明／註解
  illustration?: string; // 圖片路徑，例如 '/illustrations/ch1.jpg'
}

const SCRIPTURE_DATA: ScriptureSection[] = [
  {
    id: 1,
    chapter: '序章・靈感',
    verse: '天上聖母\n聖德昭彰\n慈航普渡\n護佑眾生',
    annotation:
      '天上聖母，名林默，生於宋太祖建隆元年（960年）農曆三月廿三日。傳說誕生時，祥雲繚繞，紅光滿室，異香飄散，其父母遂以「默」名之，因其自幼靜默沉思，慧根深厚。',
    illustration: undefined, // ← 把你的圖片路徑放這裡
  },
  {
    id: 2,
    chapter: '第一章・誓願',
    verse: '誓願救苦\n海上顯靈\n風浪平息\n漁民得安',
    annotation:
      '媽祖十六歲時，自井中得一神符，習得諸法，能預知吉凶，為鄉里治病解難。每逢海難，必顯神通，乘蓆渡海，化險為夷，漁民無不感念其恩德。',
    illustration: undefined,
  },
  {
    id: 3,
    chapter: '第二章・護國',
    verse: '護國庇民\n威靈顯赫\n四海咸服\n萬邦來朝',
    annotation:
      '宋廷多次封賜，由「夫人」晉升至「天妃」，再至「天后」。歷代帝王之所以崇祀，皆因其屢次在國家危難之際，顯化護佑，護軍民安渡難關，功德無量。',
    illustration: undefined,
  },
  {
    id: 4,
    chapter: '第三章・慈悲',
    verse: '聞聲救苦\n慈悲為懷\n有求必應\n靈感無邊',
    annotation:
      '天上聖母廣施慈悲，不分貧富貴賤，但凡虔誠祈請，無不感應。民間流傳無數神蹟，或海難獲救，或疾病痊癒，或迷途知返，皆仰賴聖母護佑之德。',
    illustration: undefined,
  },
  {
    id: 5,
    chapter: '結章・永祀',
    verse: '萬古流芳\n香火鼎盛\n信眾虔誠\n聖恩永沐',
    annotation:
      '時至今日，媽祖信仰已遍及全球華人社會，廟宇逾萬座，信眾逾億人。每年農曆三月，繞境遶街，香火鼎盛，展現了跨越世代的虔誠信仰與文化傳承。',
    illustration: undefined,
  },
];

// ─────────────────────────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────────────────────────
const ScripturePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [scrollY, setScrollY] = useState(0);
  const [heroVisible, setHeroVisible] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);

  // 滾動監聽（用於視差）
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 捲回頁頂
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Hero 是否仍在畫面
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  // 滾動進入時的淡入動畫
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('sp-revealed');
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -60px 0px' }
    );
    const targets = document.querySelectorAll('.sp-reveal, .sp-reveal-left, .sp-reveal-right');
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="scripture-page" style={{ background: '#0a0705', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* ── 全域 CSS ── */}
      <style>{`
        /* 進場動畫 */
        .sp-reveal {
          opacity: 0;
          transform: translateY(48px);
          transition: opacity 1.1s cubic-bezier(.4,0,.2,1), transform 1.1s cubic-bezier(.4,0,.2,1);
        }
        .sp-reveal-left {
          opacity: 0;
          transform: translateX(-56px);
          transition: opacity 1.1s cubic-bezier(.4,0,.2,1), transform 1.1s cubic-bezier(.4,0,.2,1);
        }
        .sp-reveal-right {
          opacity: 0;
          transform: translateX(56px);
          transition: opacity 1.1s cubic-bezier(.4,0,.2,1), transform 1.1s cubic-bezier(.4,0,.2,1);
        }
        .sp-reveal.sp-revealed,
        .sp-reveal-left.sp-revealed,
        .sp-reveal-right.sp-revealed {
          opacity: 1;
          transform: translate(0, 0);
        }
        /* 延遲 */
        .sp-delay-1 { transition-delay: 0.15s; }
        .sp-delay-2 { transition-delay: 0.32s; }
        .sp-delay-3 { transition-delay: 0.50s; }

        /* 直書文字 */
        .writing-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }

        /* 英雄區塊漸層 */
        @keyframes sp-shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.7; }
          100% { opacity: 0.4; }
        }
        .sp-shimmer { animation: sp-shimmer 5s ease-in-out infinite; }

        /* 分節線光暈 */
        .sp-divider {
          border: none;
          height: 1px;
          background: linear-gradient(to right, transparent, #c8a84b, transparent);
          margin: 0 auto;
          width: 320px;
        }

        /* 捲軸箭頭動畫 */
        @keyframes sp-bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(10px); }
        }
        .sp-bounce { animation: sp-bounce 2s ease-in-out infinite; }

        /* 頁面捲軸顏色 */
        .scripture-page::-webkit-scrollbar { width: 6px; }
        .scripture-page::-webkit-scrollbar-track { background: #0a0705; }
        .scripture-page::-webkit-scrollbar-thumb { background: #6b4e1e; border-radius: 3px; }
      `}</style>

      {/* ══════════════ 頂部導覽 ══════════════ */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          background: heroVisible ? 'transparent' : 'rgba(10,7,5,0.92)',
          backdropFilter: heroVisible ? 'none' : 'blur(12px)',
          transition: 'background 0.4s ease, backdrop-filter 0.4s ease',
          borderBottom: heroVisible ? 'none' : '1px solid rgba(200,168,75,0.2)',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#c8a84b', fontSize: 14, fontFamily: 'serif',
              background: 'rgba(200,168,75,0.1)', border: '1px solid rgba(200,168,75,0.3)',
              borderRadius: 999, padding: '6px 14px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,168,75,0.2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,168,75,0.1)';
            }}
          >
            <ChevronLeft size={16} />
            返回首頁
          </button>
          <span style={{ color: '#c8a84b', fontFamily: 'serif', fontSize: 16, letterSpacing: '0.3em' }}>
            聖母經
          </span>
          <div style={{ width: 90 }} /> {/* spacer */}
        </div>
      </div>

      {/* ══════════════ HERO 英雄區 ══════════════ */}
      <div
        ref={heroRef}
        style={{
          height: '100vh', position: 'relative', display: 'flex',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        {/* 視差背景層 */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 40%, #2a1505 0%, #0a0705 65%)',
            transform: `translateY(${scrollY * 0.35}px)`,
          }}
        />
        {/* 裝飾光暈 */}
        <div className="sp-shimmer" style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 600,
          background: 'radial-gradient(ellipse, rgba(200,168,75,0.08) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        {/* 左右裝飾線 */}
        <div style={{
          position: 'absolute', top: '15%', bottom: '15%', left: '8%',
          width: 1, background: 'linear-gradient(to bottom, transparent, rgba(200,168,75,0.4), transparent)',
        }} />
        <div style={{
          position: 'absolute', top: '15%', bottom: '15%', right: '8%',
          width: 1, background: 'linear-gradient(to bottom, transparent, rgba(200,168,75,0.4), transparent)',
        }} />

        {/* 主標題 */}
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <p style={{
            color: 'rgba(200,168,75,0.6)', fontSize: 13, letterSpacing: '0.6em',
            fontFamily: 'serif', marginBottom: 24,
          }}>
            台 北 古 亭 和 聖 壇
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 40 }}>
            {['聖', '母', '經'].map((char, i) => (
              <span
                key={i}
                style={{
                  color: '#e8c870',
                  fontSize: 'clamp(64px, 10vw, 120px)',
                  fontFamily: 'serif',
                  fontWeight: 300,
                  letterSpacing: '0.05em',
                  textShadow: '0 0 60px rgba(200,168,75,0.3)',
                  lineHeight: 1,
                  display: 'block',
                  animation: `sp-shimmer ${3 + i * 0.5}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                {char}
              </span>
            ))}
          </div>
          <hr className="sp-divider" style={{ marginBottom: 28 }} />
          <p style={{
            color: 'rgba(232,200,112,0.7)', fontSize: 15,
            letterSpacing: '0.4em', fontFamily: 'serif', lineHeight: 2,
          }}>
            天上聖母護佑眾生・慈悲顯化・靈感無邊
          </p>
        </div>

        {/* 往下捲動提示 */}
        <div className="sp-bounce" style={{
          position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(200,168,75,0.5)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 4, cursor: 'pointer',
        }} onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })}>
          <span style={{ fontSize: 11, letterSpacing: '0.3em', fontFamily: 'serif' }}>scroll</span>
          <ChevronDown size={18} />
        </div>
      </div>

      {/* ══════════════ 開場說明 ══════════════ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 32px 60px', textAlign: 'center' }}>
        <div className="sp-reveal">
          <p style={{
            color: 'rgba(232,200,112,0.5)', fontSize: 12, letterSpacing: '0.5em',
            fontFamily: 'serif', marginBottom: 20,
          }}>
            ✦ 按章節閱讀 ✦
          </p>
          <p style={{
            color: 'rgba(232,200,112,0.75)', fontSize: 16, lineHeight: 2.2,
            fontFamily: 'serif', letterSpacing: '0.08em',
          }}>
            聖母經乃歷代信眾虔誠奉誦之頌詞，記載天上聖母慈悲護佑之事蹟。
            <br />
            以下各章，輔以圖繪與說解，願讀者沐浴聖恩，心生清淨。
          </p>
        </div>
      </div>

      {/* ══════════════ 各章節 ══════════════ */}
      {SCRIPTURE_DATA.map((section, idx) => {
        const isEven = idx % 2 === 0;
        return (
          <div key={section.id}>
            <hr className="sp-divider" />

            <section
              style={{
                minHeight: '80vh',
                padding: '80px 5vw',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* 章節號碼浮水印 */}
              <span style={{
                position: 'absolute',
                top: '50%', [isEven ? 'right' : 'left']: '4%',
                transform: 'translateY(-50%)',
                fontSize: 'clamp(80px, 14vw, 180px)',
                color: 'rgba(200,168,75,0.04)',
                fontFamily: 'serif',
                fontWeight: 700,
                lineHeight: 1,
                userSelect: 'none',
                pointerEvents: 'none',
              }}>
                {String(section.id).padStart(2, '0')}
              </span>

              <div style={{
                maxWidth: 1100, margin: '0 auto', width: '100%',
                display: 'flex',
                flexDirection: isEven ? 'row' : 'row-reverse',
                alignItems: 'center',
                gap: 'clamp(32px, 6vw, 80px)',
              }}>

                {/* ── 插圖區 ── */}
                <div
                  className={isEven ? 'sp-reveal-left' : 'sp-reveal-right'}
                  style={{ flex: '0 0 auto', width: 'clamp(220px, 42%, 480px)' }}
                >
                  {section.illustration ? (
                    <img
                      src={section.illustration}
                      alt={section.chapter}
                      style={{
                        width: '100%', borderRadius: 4,
                        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
                        border: '1px solid rgba(200,168,75,0.2)',
                      }}
                    />
                  ) : (
                    /* 插圖預留位 */
                    <div style={{
                      width: '100%',
                      paddingBottom: '125%', // 4:5 ratio
                      background: 'linear-gradient(145deg, #1a1008, #0e0a05)',
                      border: '1px dashed rgba(200,168,75,0.25)',
                      borderRadius: 4,
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 12,
                      }}>
                        {/* 簡易水墨圓裝飾 */}
                        <div style={{
                          width: 80, height: 80, borderRadius: '50%',
                          border: '1px solid rgba(200,168,75,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 28, color: 'rgba(200,168,75,0.3)' }}>繪</span>
                        </div>
                        <p style={{
                          color: 'rgba(200,168,75,0.25)', fontSize: 12,
                          fontFamily: 'serif', letterSpacing: '0.2em', textAlign: 'center',
                          lineHeight: 2,
                        }}>
                          {section.chapter}<br />插圖放置處
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 文字區 ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 章節標題 */}
                  <p className="sp-reveal sp-delay-1" style={{
                    color: 'rgba(200,168,75,0.5)', fontSize: 12,
                    letterSpacing: '0.5em', fontFamily: 'serif', marginBottom: 20,
                  }}>
                    {section.chapter}
                  </p>

                  {/* 直書經文 */}
                  <div className="sp-reveal sp-delay-2" style={{
                    display: 'flex',
                    justifyContent: isEven ? 'flex-end' : 'flex-start',
                    marginBottom: 32,
                  }}>
                    <div
                      className="writing-vertical"
                      style={{
                        color: '#e8c870',
                        fontSize: 'clamp(22px, 3.5vw, 40px)',
                        fontFamily: 'serif',
                        fontWeight: 300,
                        letterSpacing: '0.3em',
                        lineHeight: 1.8,
                        textShadow: '0 0 30px rgba(200,168,75,0.2)',
                        height: 'clamp(140px, 20vw, 240px)',
                      }}
                    >
                      {section.verse}
                    </div>
                  </div>

                  {/* 分隔線 */}
                  <div className="sp-reveal sp-delay-2" style={{
                    height: 1, marginBottom: 24,
                    background: 'linear-gradient(to right, rgba(200,168,75,0.4), transparent)',
                  }} />

                  {/* 橫書說明 */}
                  <p className="sp-reveal sp-delay-3" style={{
                    color: 'rgba(232,200,112,0.7)',
                    fontSize: 'clamp(13px, 1.8vw, 16px)',
                    fontFamily: 'serif',
                    lineHeight: 2.2,
                    letterSpacing: '0.06em',
                    maxWidth: 500,
                  }}>
                    {section.annotation}
                  </p>
                </div>
              </div>
            </section>
          </div>
        );
      })}

      {/* ══════════════ 結尾祝詞 ══════════════ */}
      <hr className="sp-divider" />
      <div style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', padding: '80px 32px',
      }}>
        {/* 視差背景 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 60%, #1e0d02 0%, #0a0705 70%)',
          transform: `translateY(${(scrollY - (SCRIPTURE_DATA.length + 1) * 600) * 0.2}px)`,
        }} />
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <div className="sp-reveal sp-delay-1">
            <p style={{ color: 'rgba(200,168,75,0.4)', fontSize: 12, letterSpacing: '0.6em', fontFamily: 'serif', marginBottom: 24 }}>
              ✦ 聖母保佑 ✦
            </p>
          </div>
          <div className="writing-vertical sp-reveal" style={{
            color: '#e8c870',
            fontSize: 'clamp(18px, 3vw, 32px)',
            fontFamily: 'serif',
            fontWeight: 300,
            letterSpacing: '0.35em',
            lineHeight: 1.9,
            height: 'clamp(200px, 28vw, 360px)',
            margin: '0 auto',
            textShadow: '0 0 40px rgba(200,168,75,0.25)',
          }}>
            {'天上聖母\n護佑眾生\n萬古流芳\n聖恩永沐'}
          </div>
          <div className="sp-reveal sp-delay-2">
            <hr className="sp-divider" style={{ margin: '40px auto' }} />
            <p style={{
              color: 'rgba(200,168,75,0.45)', fontSize: 13,
              letterSpacing: '0.4em', fontFamily: 'serif', lineHeight: 2.2,
            }}>
              台北古亭和聖壇　敬獻
            </p>
          </div>
          <div className="sp-reveal sp-delay-3" style={{ marginTop: 48 }}>
            <button
              onClick={onBack}
              style={{
                color: '#c8a84b', fontFamily: 'serif', fontSize: 14,
                letterSpacing: '0.2em',
                background: 'rgba(200,168,75,0.08)',
                border: '1px solid rgba(200,168,75,0.3)',
                borderRadius: 999, padding: '10px 28px',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,168,75,0.18)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,168,75,0.08)'; }}
            >
              <ChevronLeft size={16} />
              返回首頁
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScripturePage;
