import React, { useEffect, useState } from 'react';
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

  // 每次開啟頁面都重新 fetch 最新資料
  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    getScriptureVerses()
      .then(setVerses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < window.innerHeight * 0.9);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal on scroll — re-observe whenever verses change
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('sp-in'); }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.sp-up, .sp-left, .sp-right').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [verses]);

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return null;
    return `${STORAGE_BASE}/${imagePath}`;
  };

  return (
    <div style={{ background: '#f5edd8', minHeight: '100vh', fontFamily: '"Noto Serif TC", "思源宋體", Georgia, serif', overflowX: 'hidden' }}>
      <style>{`
        .sp-up   { opacity:0; transform:translateY(36px);  transition:opacity .9s ease, transform .9s ease; }
        .sp-left { opacity:0; transform:translateX(-40px);  transition:opacity .9s ease, transform .9s ease; }
        .sp-right{ opacity:0; transform:translateX(40px);   transition:opacity .9s ease, transform .9s ease; }
        .sp-up.sp-in, .sp-left.sp-in, .sp-right.sp-in { opacity:1; transform:translate(0,0); }
        .sp-d1 { transition-delay:.12s; } .sp-d2 { transition-delay:.26s; } .sp-d3 { transition-delay:.42s; }
        .vert { writing-mode:vertical-rl; text-orientation:mixed; }
        .brush-line { border:none; height:1px; background:linear-gradient(to right, transparent, #c9a870, transparent); opacity:.3; margin:0 auto; max-width:560px; }
        .scroll-rail { position:fixed; top:0; bottom:0; width:5px; background:linear-gradient(to bottom,#8b1a1a,#c0392b,#8b1a1a); opacity:.15; pointer-events:none; z-index:40; }
        @keyframes sp-bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(10px)} }
      `}</style>

      <div className="scroll-rail" style={{ left: 0 }} />
      <div className="scroll-rail" style={{ right: 0 }} />

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
          <span style={{ color: '#5a3010', fontSize: 15, letterSpacing: '.35em' }}>聖 母 經</span>
          <div style={{ width: 88 }} />
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, #f0dbb8, #f5edd8 65%)' }} />
        <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 480, background: 'radial-gradient(ellipse, rgba(188,140,60,.10), transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <p style={{ color: 'rgba(107,64,16,.5)', fontSize: 12, letterSpacing: '.65em', marginBottom: 32 }}>台 北 古 亭 和 聖 壇</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(24px,5vw,60px)', marginBottom: 36 }}>
            {['聖', '母', '經'].map((ch, i) => (
              <span key={i} style={{ fontSize: 'clamp(60px,9vw,112px)', color: '#3a2008', fontWeight: 300, lineHeight: 1, textShadow: '2px 3px 12px rgba(107,64,16,.12)', opacity: 0.9 }}>{ch}</span>
            ))}
          </div>
          <hr className="brush-line" style={{ marginBottom: 28, maxWidth: 280 }} />
          <p style={{ color: 'rgba(90,48,16,.6)', fontSize: 14, letterSpacing: '.35em', lineHeight: 2.2 }}>天上聖母護佑眾生・慈悲顯化・靈感無邊</p>
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
          <div key={section.id}>
            <hr className="brush-line" />
            <section style={{ minHeight: '70vh', padding: 'clamp(48px,7vh,80px) clamp(20px,5vw,72px)', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* watermark number */}
              <span style={{ position: 'absolute', top: '50%', [isEven ? 'right' : 'left']: '3%', transform: 'translateY(-50%)', fontSize: 'clamp(60px,11vw,150px)', color: 'rgba(184,145,90,.05)', fontWeight: 700, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                {String(section.sectionNumber).padStart(3, '0')}
              </span>

              <div style={{ maxWidth: 1060, margin: '0 auto', width: '100%', display: 'flex', flexDirection: isEven ? 'row' : 'row-reverse', alignItems: 'center', gap: 'clamp(24px,5vw,72px)', flexWrap: 'wrap' }}>
                {/* illustration */}
                {imgUrl && (
                  <div className={isEven ? 'sp-left' : 'sp-right'} style={{ flex: '0 0 auto', width: 'clamp(180px,38%,400px)' }}>
                    <img
                      src={imgUrl}
                      alt={`第${section.sectionNumber}節`}
                      loading="lazy"
                      style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 6px 24px rgba(90,48,16,.10))' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* text */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  {/* vertical verse */}
                  <div className="sp-up sp-d1" style={{ display: 'flex', justifyContent: isEven ? 'flex-end' : 'flex-start', marginBottom: 26 }}>
                    <div className="vert" style={{ color: '#3a2008', fontSize: 'clamp(18px,2.6vw,32px)', fontWeight: 300, letterSpacing: '.28em', lineHeight: 1.75, height: 'clamp(110px,16vw,200px)', overflow: 'hidden' }}>
                      {section.verse}
                    </div>
                  </div>
                  <div className="sp-up sp-d2" style={{ height: 1, marginBottom: 20, background: isEven ? 'linear-gradient(to right, rgba(184,145,90,.35), transparent)' : 'linear-gradient(to left, rgba(184,145,90,.35), transparent)' }} />
                  <p className="sp-up sp-d3" style={{ color: 'rgba(58,32,8,.62)', fontSize: 'clamp(12.5px,1.5vw,14.5px)', lineHeight: 2.2, letterSpacing: '.05em', maxWidth: 460 }}>
                    {section.annotation}
                  </p>
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
