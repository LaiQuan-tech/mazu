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
 * **不分段、不標段號，從頭到尾一整篇**（廟方 2026-11-09：「段落是我自己為了畫圖
 * 而做的，不是經文本身的段落」）。那 136 段是註解版配插圖用的切法，經文本身沒有；
 * 放進全文版會讓人以為經書就是這樣分章的。資料裡的空行同理，一併不理。
 *
 * **每一句（到「。」為止）是一個不換行的單位**：手機上自然折行會把「可先知」
 * 拆成「可先／知」，念的人會在半句卡住，所以只准在句與句之間換行。
 * 一句一個單位、而不是資料裡的一行（兩句）一個單位：手機上兩句一組一行只放得下一組，
 * 整篇會變成一長條；一句一組一行放得下三、四句，頁面短一半。
 */

interface Props {
  onBack: () => void;
  /** 換到逐段註解版（/scripture） */
  onOpenAnnotated: () => void;
}

/** 整部經 → 一句一句（句尾的標點跟著那一句；沒有標點的舊資料就是一行一句） */
const phrasesOf = (verses: ScriptureVerseRecord[]): string[] =>
  verses.flatMap(v => v.verse.split('\n'))
    .map(l => l.trim()).filter(Boolean)
    .flatMap(l => l.match(/[^。，、；！？]+[。，、；！？]?/g) ?? [l]);

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
            {loading ? '載入中…' : '誦讀版'}
          </p>
          <hr className="brush-line" style={{ border: 'none', height: 1, background: `linear-gradient(to right, transparent, ${INK.gold}, transparent)`, opacity: .55, margin: '28px auto', maxWidth: 280 }} />
          <p style={{ color: INK.inkBody, fontSize: 15, lineHeight: 2.2, letterSpacing: '.05em' }}>
            天上聖母即媽祖，這部經民間也稱媽祖經。本頁只列經文，方便一路誦讀；<br />
            想知道每一句在講什麼，請看逐段的白話註解。
          </p>
          <button type="button" onClick={onOpenAnnotated} style={{ ...linkBtn, marginTop: 20 }}>看逐段白話註解</button>
        </header>

        <p style={{ color: INK.ink, fontSize: 'clamp(19px,2.4vw,22px)', lineHeight: 2.3, letterSpacing: '.12em' }}>
          {phrasesOf(verses).map((ph, i) => (
            <span key={i} style={{ whiteSpace: 'nowrap', display: 'inline-block', marginRight: '.5em' }}>{ph}</span>
          ))}
        </p>

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
