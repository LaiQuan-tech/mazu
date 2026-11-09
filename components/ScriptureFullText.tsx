import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ScriptureVerseRecord } from '../types';
import { getScriptureVerses, getScriptureFullText } from '../services/supabase';
import { scriptureLines, fullTextFromVerses, MAX_UNBREAKABLE } from '../services/scriptureText';
import { INK, SUTRA } from './inkTheme';

/**
 * 天上聖母經全文（/scripture/full，2026-11-09 廟方：「要不要有一個天上聖母經全文，
 * 這樣給不同需求的信眾，也幫助 seo」）。
 *
 * **與 /scripture 是同一份資料、兩種讀法**：那一頁是逐段配圖與白話註解，給要理解的人；
 * 這一頁只有經文，給要誦讀的人——一路讀下去不被插圖與註解打斷。
 * **全文 2026-11-09 起可以另存一份**（後台「天上聖母經」最上面的全文編輯）：
 * 存過就用那一份；沒存過才退回由 `scripture_verses` 的 136 段接起來。
 *
 * **橫排不直排**：註解版的直排是為了寫經本的觀感；這一頁的用途是拿著手機一路念，
 * 直排在手機上要左右來回捲，長輩念到一半會找不到下一欄。
 *
 * **不分段、不標段號**（廟方 2026-11-09：「段落是我自己為了畫圖而做的，不是經文本身
 * 的段落」）。那 136 段是解說版配插圖用的切法，不出現在這一頁。
 *
 * **排版照後台打的樣子**（同日廟方：「換行與空白會影響顯示」）：一行就是一行、空行是段落
 * 間的空白、行內空格照留。中間有一版是「四欄格子、一行固定四句」，那只對 510 句都是
 * 「三字＋句號」的經文成立；廟方貼進完整經本（爐香讚、淨心神咒、長短不一的咒語）之後
 * 就排不下了。規則與理由見 `services/scriptureText.ts`。
 *
 * **每一句（到「。」為止）是一個不換行的單位**：手機上自然折行會把「可先知」
 * 拆成「可先／知」，念的人會在半句卡住，所以一行太長時只在句與句之間折。
 *
 * **字級照「四字咒語一行四句」算**（廟方 2026-11-09：「全文的字不用這麼大，讓四個字的咒語
 * 能四句一行」）。經本裡有一大段咒語是「驅邪縛魅。保命護身。…」，一句四字加句號 5 個字寬，
 * 四句 20 個字寬；原本照三字經文算的 ÷18 放不下，第四句一定折行。現在
 * (視窗寬 − 左右內距 40) ÷ 20.5（留半個字的餘裕），字距歸零：375 寬約 16.3px、上限 26px。
 */

interface Props {
  onBack: () => void;
  /** 換到逐段註解版（/scripture） */
  onOpenAnnotated: () => void;
}

const ScriptureFullText: React.FC<Props> = ({ onBack, onOpenAnnotated }) => {
  const [verses, setVerses] = useState<ScriptureVerseRecord[]>([]);
  /** 後台另存的全文；空字串＝沒存過 */
  const [stored, setStored] = useState('');
  const [loading, setLoading] = useState(true);
  /** 讀到哪裡了，0～1。與註解版同一套進度條（2026-11-09 廟方：「也要像註解頁一樣有進度條」） */
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [loading]);   // 經文與全文都到了、頁面長度定了才算

  // 與註解版同一個底色，避免捲動慣性時露白
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = INK.paper;
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    // 兩支一起等：只等經文就先畫，全文晚到時整頁會當面換一次字
    Promise.all([
      getScriptureVerses().then(setVerses).catch(console.error),
      getScriptureFullText().then(setStored),
    ]).finally(() => setLoading(false));
  }, []);

  const linkBtn: React.CSSProperties = {
    color: INK.ink, background: INK.btnFace, border: `1px solid ${INK.btnEdge}`, borderRadius: 999,
    padding: '10px 22px', fontSize: 15, letterSpacing: '.15em', cursor: 'pointer',
  };

  return (
    <div style={{ background: INK.paper, minHeight: '100vh', fontFamily: '"Noto Serif TC", "思源宋體", Georgia, serif', overflowX: 'clip' }}>
      {/* 進度條：手機頂端一條橫的、桌機右側一條直的，與 ScripturePage 同一個樣子與斷點。
          **桌機那條不標「第幾節」**：全文版刻意不分段（見檔頭），標了等於把段號加回來。
          手機用 scaleX 不用 width，理由同 ScripturePage 那條（每次捲動都在變，只跑合成層）。 */}
      <style>{`
        .sf-progress   { display: flex; }
        .sf-progress-m { display: none; }
        @media (max-width: 767px) {
          .sf-progress   { display: none; }
          .sf-progress-m { display: block; }
        }
      `}</style>
      <div className="sf-progress-m" aria-hidden="true" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 51, transformOrigin: 'left center',
        transform: `scaleX(${loading ? 0 : progress})`,
        background: `linear-gradient(to right, ${INK.gold}, ${INK.ink})`,
        transition: 'transform .12s linear', pointerEvents: 'none',
      }} />
      {!loading && verses.length > 0 && (
        <div className="sf-progress" aria-hidden="true" style={{
          position: 'fixed', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 46,
          flexDirection: 'column', alignItems: 'center', pointerEvents: 'none',
        }}>
          <div style={{ width: 2, height: 72, background: 'rgba(201,168,106,.22)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              width: '100%', height: `${progress * 100}%`,
              background: `linear-gradient(to bottom, ${INK.gold}, ${INK.ink})`,
              borderRadius: 1, transition: 'height .2s ease',
            }} />
          </div>
        </div>
      )}
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
          <h1 style={{ color: SUTRA.gold, textShadow: `0 0 24px ${SUTRA.glow}`, fontSize: 'clamp(30px,6vw,44px)', fontWeight: 900, letterSpacing: '.2em', marginBottom: 12 }}>天上聖母經全文</h1>
          <p style={{ color: INK.inkSoft, fontSize: 15, letterSpacing: '.2em' }}>
            {loading ? '載入中…' : '誦讀版'}
          </p>
          <hr className="brush-line" style={{ border: 'none', height: 1, background: `linear-gradient(to right, transparent, ${INK.gold}, transparent)`, opacity: .55, margin: '28px auto', maxWidth: 280 }} />
          <p style={{ color: INK.inkBody, fontSize: 15, lineHeight: 2.2, letterSpacing: '.05em' }}>
            天上聖母即媽祖，這部經民間也稱媽祖經。本頁只列經文，方便一路誦讀；<br />
            想知道每一句在講什麼，請看逐段的白話解說。
          </p>
          <button type="button" onClick={onOpenAnnotated} style={{ ...linkBtn, marginTop: 20 }}>看逐段白話解說</button>
        </header>

        <div style={{
          color: SUTRA.gold, fontSize: 'min(26px, calc((100vw - 40px) / 20.5))', lineHeight: 2.3, letterSpacing: 0,
          // 桌機字級到頂之後版面很寬，收在一個好讀的行長、整塊置中
          maxWidth: '24em', margin: '0 auto',
        }}>
          {scriptureLines(stored || fullTextFromVerses(verses)).map((line, i) => (
            line === null
              ? <div key={i} style={{ height: '1em' }} aria-hidden="true" />
              : (
                /* **懸掛縮排**：手機上一行四句（約 20 字）放不下會折行，折下來的那截往右縮一字，
                   行與行之間再多留一點距離——不這樣做，折下來的半行跟真正的下一行長得一模一樣，
                   念的人分不出原本一行在哪裡結束。 */
                <p key={i} style={{ margin: '0 0 .3em', lineHeight: 1.9, paddingLeft: '1em', textIndent: '-1em' }}>
                  {line.map((t, j) => (
                    t.kind === 'space'
                      ? <span key={j} style={{ whiteSpace: 'pre' }}>{t.text}</span>
                      : <span key={j} style={{ whiteSpace: t.text.length <= MAX_UNBREAKABLE ? 'nowrap' : 'normal' }}>{t.text}</span>
                  ))}
                </p>
              )
          ))}
        </div>

        {!loading && verses.length > 0 && (
          <footer style={{ textAlign: 'center', marginTop: 56 }}>
            <p style={{ color: INK.inkFaint, fontSize: 13, letterSpacing: '.4em', marginBottom: 24 }}>台北古亭和聖壇　敬獻</p>
            <button type="button" onClick={onOpenAnnotated} style={linkBtn}>看逐段白話解說</button>
          </footer>
        )}
      </main>
    </div>
  );
};

export default ScriptureFullText;
