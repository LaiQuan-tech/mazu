import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// 【資料結構】把自己的圖片路徑和文字填進來
// ─────────────────────────────────────────────────────────────────
interface ScriptureSection {
  id: number;
  chapter: string;
  verse: string;
  annotation: string;
  illustration?: string;
}

const SCRIPTURE_DATA: ScriptureSection[] = [
  {
    id: 1,
    chapter: '序章・靈感',
    verse: '天上聖母\n聖德昭彰\n慈航普渡\n護佑眾生',
    annotation:
      '天上聖母，名林默，生於宋太祖建隆元年（960年）農曆三月廿三日。傳說誕生時，祥雲繚繞，紅光滿室，異香飄散，其父母遂以「默」名之，因其自幼靜默沉思，慧根深厚。',
    illustration: undefined,
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
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
      setAtTop(window.scrollY < window.innerHeight * 0.9);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 捲動淡入
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('sp-in');
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.sp-up, .sp-left, .sp-right').forEach((el) =>
      observer.observe(el)
    );
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        background: '#f5edd8',
        minHeight: '100vh',
        fontFamily: '"Noto Serif TC", "思源宋體", Georgia, serif',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        /* 宣紙質感背景 */
        .sp-page-bg {
          background-color: #f5edd8;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        }

        /* 捲動進場動畫 */
        .sp-up {
          opacity: 0; transform: translateY(40px);
          transition: opacity 1s ease, transform 1s ease;
        }
        .sp-left {
          opacity: 0; transform: translateX(-44px);
          transition: opacity 1s ease, transform 1s ease;
        }
        .sp-right {
          opacity: 0; transform: translateX(44px);
          transition: opacity 1s ease, transform 1s ease;
        }
        .sp-up.sp-in, .sp-left.sp-in, .sp-right.sp-in {
          opacity: 1; transform: translate(0, 0);
        }
        .sp-d1 { transition-delay: 0.12s; }
        .sp-d2 { transition-delay: 0.26s; }
        .sp-d3 { transition-delay: 0.42s; }

        /* 直書 */
        .vert { writing-mode: vertical-rl; text-orientation: mixed; }

        /* 細線分節（毛筆感） */
        .brush-line {
          border: none; height: 1px;
          background: linear-gradient(to right, transparent 0%, #b8915a 20%, #c9a870 50%, #b8915a 80%, transparent 100%);
          opacity: 0.35;
          margin: 0 auto;
          max-width: 560px;
        }

        /* 捲軸兩側紅邊 */
        .scroll-rail {
          position: fixed; top: 0; bottom: 0; width: 6px;
          background: linear-gradient(to bottom, #8b1a1a, #c0392b, #8b1a1a);
          opacity: 0.18;
          pointer-events: none; z-index: 40;
        }
      `}</style>

      {/* 捲軸兩側紅邊線 */}
      <div className="scroll-rail" style={{ left: 0 }} />
      <div className="scroll-rail" style={{ right: 0 }} />

      {/* ══ 頂部導覽 ══ */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: atTop ? 'transparent' : 'rgba(245,237,216,0.92)',
        backdropFilter: atTop ? 'none' : 'blur(10px)',
        borderBottom: atTop ? 'none' : '1px solid rgba(184,145,90,0.25)',
        transition: 'all 0.4s ease',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '10px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#6b4010', fontSize: 13,
              background: 'rgba(107,64,16,0.08)',
              border: '1px solid rgba(107,64,16,0.2)',
              borderRadius: 999, padding: '5px 14px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <ChevronLeft size={15} />
            返回首頁
          </button>
          <span style={{
            color: '#5a3010', fontSize: 15, letterSpacing: '0.35em',
          }}>
            聖 母 經
          </span>
          <div style={{ width: 88 }} />
        </div>
      </div>

      {/* ══ HERO ══ */}
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* 視差背景暈染 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 45%, #f0dbb8 0%, #f5edd8 65%)',
          transform: `translateY(${scrollY * 0.3}px)`,
        }} />
        {/* 柔和暈光 */}
        <div style={{
          position: 'absolute',
          top: '25%', left: '50%', transform: `translate(-50%, ${scrollY * 0.15}px)`,
          width: 480, height: 480,
          background: 'radial-gradient(ellipse, rgba(188,140,60,0.10) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <p style={{
            color: 'rgba(107,64,16,0.5)', fontSize: 12,
            letterSpacing: '0.65em', marginBottom: 32,
          }}>
            台 北 古 亭 和 聖 壇
          </p>

          {/* 大標題 — 直書橫排並列 */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            gap: 'clamp(24px, 5vw, 60px)', marginBottom: 36,
          }}>
            {['聖', '母', '經'].map((ch, i) => (
              <span key={i} style={{
                fontSize: 'clamp(60px, 9vw, 112px)',
                color: '#3a2008',
                fontWeight: 300,
                letterSpacing: '0.04em',
                lineHeight: 1,
                textShadow: '2px 3px 12px rgba(107,64,16,0.12)',
                opacity: 0.9,
              }}>{ch}</span>
            ))}
          </div>

          {/* 細毛筆線 */}
          <hr className="brush-line" style={{ marginBottom: 28, maxWidth: 280 }} />

          <p style={{
            color: 'rgba(90,48,16,0.6)', fontSize: 14,
            letterSpacing: '0.35em', lineHeight: 2.2,
          }}>
            天上聖母護佑眾生・慈悲顯化・靈感無邊
          </p>
        </div>

        {/* 往下提示 */}
        <div
          onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
          style={{
            position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(107,64,16,0.4)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            animation: 'sp-bounce 2.2s ease-in-out infinite',
          }}
        >
          <style>{`@keyframes sp-bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(10px)} }`}</style>
          <span style={{ fontSize: 11, letterSpacing: '0.3em' }}>scroll</span>
          <ChevronDown size={17} />
        </div>
      </div>

      {/* ══ 開場 ══ */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '72px 32px 56px', textAlign: 'center' }}>
        <p className="sp-up" style={{
          color: 'rgba(90,48,16,0.55)', fontSize: 12,
          letterSpacing: '0.5em', marginBottom: 18,
        }}>✦ 按章節閱讀 ✦</p>
        <p className="sp-up sp-d1" style={{
          color: 'rgba(58,32,8,0.7)', fontSize: 15,
          lineHeight: 2.4, letterSpacing: '0.07em',
        }}>
          聖母經乃歷代信眾虔誠奉誦之頌詞，記載天上聖母慈悲護佑之事蹟。
          <br />以下各章，輔以圖繪與說解，願讀者沐浴聖恩，心生清淨。
        </p>
      </div>

      {/* ══ 各章節 ══ */}
      {SCRIPTURE_DATA.map((section, idx) => {
        const isEven = idx % 2 === 0;
        return (
          <div key={section.id}>
            <hr className="brush-line" />

            <section style={{
              minHeight: '75vh',
              padding: 'clamp(56px,8vh,96px) clamp(24px,6vw,80px)',
              display: 'flex', alignItems: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* 章節號浮水印 */}
              <span style={{
                position: 'absolute',
                top: '50%', [isEven ? 'right' : 'left']: '3%',
                transform: 'translateY(-50%)',
                fontSize: 'clamp(72px,13vw,170px)',
                color: 'rgba(184,145,90,0.06)',
                fontWeight: 700, lineHeight: 1,
                userSelect: 'none', pointerEvents: 'none',
              }}>
                {String(section.id).padStart(2, '0')}
              </span>

              <div style={{
                maxWidth: 1060, margin: '0 auto', width: '100%',
                display: 'flex',
                flexDirection: isEven ? 'row' : 'row-reverse',
                alignItems: 'center',
                gap: 'clamp(28px,6vw,80px)',
                flexWrap: 'wrap',
              }}>

                {/* ── 插圖（無邊框）── */}
                <div
                  className={isEven ? 'sp-left' : 'sp-right'}
                  style={{
                    flex: '0 0 auto',
                    width: 'clamp(200px, 40%, 420px)',
                  }}
                >
                  {section.illustration ? (
                    <img
                      src={section.illustration}
                      alt={section.chapter}
                      style={{
                        width: '100%',
                        display: 'block',
                        // 無邊框，只有極淡的陰影讓圖自然浮出
                        filter: 'drop-shadow(0 6px 24px rgba(90,48,16,0.12))',
                      }}
                    />
                  ) : (
                    /* 插圖預留（淡色宣紙感，無邊框） */
                    <div style={{
                      width: '100%', paddingBottom: '122%',
                      background: 'linear-gradient(160deg, #efe3c8 0%, #e8d4a8 100%)',
                      borderRadius: 2, position: 'relative',
                      boxShadow: '0 4px 32px rgba(90,48,16,0.08)',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 14,
                      }}>
                        <div style={{
                          width: 64, height: 64, borderRadius: '50%',
                          background: 'rgba(184,145,90,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 22, color: 'rgba(107,64,16,0.3)' }}>繪</span>
                        </div>
                        <p style={{
                          color: 'rgba(107,64,16,0.25)', fontSize: 12,
                          letterSpacing: '0.2em', textAlign: 'center', lineHeight: 2,
                        }}>
                          {section.chapter}<br />插圖放置處
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 文字區 ── */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p className="sp-up" style={{
                    color: 'rgba(107,64,16,0.45)', fontSize: 12,
                    letterSpacing: '0.55em', marginBottom: 22,
                  }}>
                    {section.chapter}
                  </p>

                  {/* 直書經文 */}
                  <div className="sp-up sp-d1" style={{
                    display: 'flex',
                    justifyContent: isEven ? 'flex-end' : 'flex-start',
                    marginBottom: 30,
                  }}>
                    <div className="vert" style={{
                      color: '#3a2008',
                      fontSize: 'clamp(20px, 3vw, 38px)',
                      fontWeight: 300,
                      letterSpacing: '0.32em',
                      lineHeight: 1.85,
                      height: 'clamp(130px, 18vw, 220px)',
                    }}>
                      {section.verse}
                    </div>
                  </div>

                  {/* 短分線 */}
                  <div className="sp-up sp-d2" style={{
                    height: 1, marginBottom: 22,
                    background: isEven
                      ? 'linear-gradient(to right, rgba(184,145,90,0.4), transparent)'
                      : 'linear-gradient(to left, rgba(184,145,90,0.4), transparent)',
                  }} />

                  {/* 橫書說明 */}
                  <p className="sp-up sp-d3" style={{
                    color: 'rgba(58,32,8,0.65)',
                    fontSize: 'clamp(13px,1.6vw,15px)',
                    lineHeight: 2.3,
                    letterSpacing: '0.06em',
                    maxWidth: 480,
                  }}>
                    {section.annotation}
                  </p>
                </div>
              </div>
            </section>
          </div>
        );
      })}

      {/* ══ 結尾 ══ */}
      <hr className="brush-line" />
      <div style={{
        minHeight: '55vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '80px 32px',
        background: 'linear-gradient(to bottom, #f5edd8, #efe3c4)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 暈染 */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%', transform: `translate(-50%, -50%) translateY(${(scrollY - 3000) * 0.1}px)`,
          width: 500, height: 400,
          background: 'radial-gradient(ellipse, rgba(188,140,60,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <div className="vert sp-up" style={{
            color: '#3a2008',
            fontSize: 'clamp(16px, 2.5vw, 28px)',
            fontWeight: 300,
            letterSpacing: '0.35em',
            lineHeight: 1.9,
            height: 'clamp(180px,26vw,320px)',
            margin: '0 auto',
            opacity: 0,
          }}>
            {'天上聖母\n護佑眾生\n萬古流芳\n聖恩永沐'}
          </div>

          <hr className="brush-line sp-up sp-d1" style={{ margin: '40px auto' }} />

          <p className="sp-up sp-d2" style={{
            color: 'rgba(90,48,16,0.45)', fontSize: 13,
            letterSpacing: '0.4em', lineHeight: 2.4,
          }}>
            台北古亭和聖壇　敬獻
          </p>

          <div className="sp-up sp-d3" style={{ marginTop: 44 }}>
            <button
              onClick={onBack}
              style={{
                color: '#6b4010', fontSize: 13,
                background: 'rgba(107,64,16,0.07)',
                border: '1px solid rgba(107,64,16,0.2)',
                borderRadius: 999, padding: '9px 26px',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                letterSpacing: '0.1em',
              }}
            >
              <ChevronLeft size={15} />
              返回首頁
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScripturePage;
