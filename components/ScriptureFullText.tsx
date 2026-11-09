import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ScriptureVerseRecord } from '../types';
import { getScriptureVerses } from '../services/supabase';
import { INK } from './inkTheme';

/**
 * 天上聖母經全文（/scripture/full，2026-11-09 廟方：「要不要有一個天上聖母經全文，
 * 這樣給不同需求的信眾，也幫助 seo」）。
 *
 * **與 /scripture 是同一份資料、兩種讀法**：那一頁是逐段配圖與白話註解，給要理解的人；
 * 這一頁只有經文，給要誦讀的人——一路讀下去不被插圖與註解打斷。
 * 資料同樣來自 `scripture_verses`，後台改一段兩頁一起變，不另存一份。
 *
 * **橫排不直排**：註解版的直排是為了寫經本的觀感；這一頁的用途是拿著手機一路念，
 * 直排在手機上要左右來回捲，長輩念到一半會找不到下一欄。
 *
 * 經文的斷句照資料裡的換行：一行一句、空行是段落裡的停頓。句與句接著排、
 * 停頓處換行——這是經書排印的慣例，比一句一行省一半長度。
 * **每一句是一個不換行的單位**：手機上自然折行會把「可先知」拆成「可先／知」，
 * 念的人會在半句卡住，所以只准在句與句之間換行。
 */

interface Props {
  onBack: () => void;
  /** 換到逐段註解版（/scripture） */
  onOpenAnnotated: () => void;
}

/** 經文 → 停頓分出的區塊 → 每塊裡的句子 */
const verseBlocks = (verse: string): string[][] =>
  verse.split(/\n\s*\n/).map(block => block.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length > 0);

const ScriptureFullText: React.FC<Props> = ({ onBack, onOpenAnnotated }) => {
  const [verses, setVerses] = useState<ScriptureVerseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 與註解版同一個底色，避免捲動慣性時露白
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = INK.paper;
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    getScriptureVerses().then(setVerses).catch(console.error).finally(() => setLoading(false));
  }, []);

  const linkBtn: React.CSSProperties = {
    color: INK.ink, background: INK.btnFace, border: `1px solid ${INK.btnEdge}`, borderRadius: 999,
    padding: '10px 22px', fontSize: 15, letterSpacing: '.15em', cursor: 'pointer',
  };

  return (
    <div style={{ background: INK.paper, minHeight: '100vh', fontFamily: '"Noto Serif TC", "思源宋體", Georgia, serif', overflowX: 'clip' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: INK.navBar, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${INK.goldLine}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} aria-label="返回首頁" title="返回首頁"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK.ink, background: INK.btnFace, border: `1px solid ${INK.btnEdge}`, borderRadius: 999, padding: '6px 8px', cursor: 'pointer' }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ color: INK.inkSoft, fontSize: 15, letterSpacing: '.35em' }}>天 上 聖 母 經</span>
          <div style={{ width: 34 }} />
        </div>
      </div>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 96px' }}>
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: INK.inkFaint, fontSize: 12, letterSpacing: '.5em', marginBottom: 16 }}>台 北 古 亭 和 聖 壇</p>
          <h1 style={{ color: INK.ink, fontSize: 'clamp(30px,6vw,44px)', fontWeight: 900, letterSpacing: '.2em', marginBottom: 12 }}>天上聖母經全文</h1>
          <p style={{ color: INK.inkSoft, fontSize: 15, letterSpacing: '.2em' }}>
            誦讀版・{loading ? '載入中…' : `共 ${verses.length} 段`}
          </p>
          <hr className="brush-line" style={{ border: 'none', height: 1, background: `linear-gradient(to right, transparent, ${INK.gold}, transparent)`, opacity: .55, margin: '28px auto', maxWidth: 280 }} />
          <p style={{ color: INK.inkBody, fontSize: 15, lineHeight: 2.2, letterSpacing: '.05em' }}>
            天上聖母即媽祖，這部經民間也稱媽祖經。本頁只列經文，方便一路誦讀；<br />
            想知道每一句在講什麼，請看逐段的白話註解。
          </p>
          <button type="button" onClick={onOpenAnnotated} style={{ ...linkBtn, marginTop: 20 }}>看逐段白話註解</button>
        </header>

        {/* 每段一個 p，段號淡淡的放在句首：對照註解版時找得到是第幾段，誦讀時又不會念到它 */}
        <div style={{ color: INK.ink, fontSize: 'clamp(19px,2.4vw,22px)', lineHeight: 2.3, letterSpacing: '.12em' }}>
          {verses.map(v => (
            <p key={v.id} style={{ margin: '0 0 1.1em' }}>
              <span aria-hidden="true" style={{ color: INK.inkFaint, fontSize: 12, letterSpacing: 0, marginRight: '.6em', verticalAlign: 'super' }}>
                {v.sectionNumber}
              </span>
              {verseBlocks(v.verse).map((block, bi) => (
                <React.Fragment key={bi}>
                  {bi > 0 && <br />}
                  {block.map((line, li) => (
                    <span key={li} style={{ whiteSpace: 'nowrap', marginRight: '1em', display: 'inline-block' }}>{line}</span>
                  ))}
                </React.Fragment>
              ))}
            </p>
          ))}
        </div>

        {!loading && verses.length > 0 && (
          <footer style={{ textAlign: 'center', marginTop: 56 }}>
            <p style={{ color: INK.inkFaint, fontSize: 13, letterSpacing: '.4em', marginBottom: 24 }}>台北古亭和聖壇　敬獻</p>
            <button type="button" onClick={onOpenAnnotated} style={linkBtn}>看逐段白話註解</button>
          </footer>
        )}
      </main>
    </div>
  );
};

export default ScriptureFullText;
