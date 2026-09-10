import React, { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import StoryPage, { StoryBlock, splitParagraphs, renderInline } from './StoryPage';
import { getAboutSections, getRelocationPlans, getSiteImagePublicUrl } from '../services/supabase';
import { AboutSection, RelocationPlan } from '../types';

/**
 * 遷址捐款（獨立頁）
 *
 * 圖文段落與捐款方案表格都來自後台，廟方自行維護：
 *   段落 → about_sections（page = 'relocation'）
 *   方案 → relocation_plans（金額當欄、回饋項目當列的矩陣）
 * 匯款方式先不放在這一頁（廟方要求），需要時再加回來。
 */

const toStoryBlock = (s: AboutSection): StoryBlock => ({
  heading: s.heading || undefined,
  paragraphs: splitParagraphs(s.body),
  image: s.imagePath ? getSiteImagePublicUrl(s.imagePath) : undefined,
  imageAlt: s.heading || '遷址',
  caption: s.caption || undefined,
});

/** 空字串的格子在表格裡留白，用「—」比空白更明確地表示「這一級沒有」 */
const cellText = (v: string): string => (v.trim() === '' ? '—' : v.trim());
const isYes = (v: string): boolean => /^[✓✔V v]$/.test(v.trim());

/**
 * 金額級距補上「元」。
 *
 * 後台存的是純數字字串（`600`、`1,000`），畫面上只有數字看不出單位。
 * 在渲染層補而不是改資料，後台之後新增級距也自動有單位，不會有人忘記打。
 *
 * 三種格式都要顧到：
 *   `600`          → `600 元`
 *   `100,000 以上` → `100,000 元以上`（單位插在數字後面，不是整串後面）
 *   `隨喜`         → 原樣（沒有數字就不是金額，加了會變成「隨喜元」）
 */
const withCurrency = (tier: string): string => {
  const m = tier.trim().match(/^([\d,]+)\s*(.*)$/);
  if (!m) return tier;
  return m[2] ? `${m[1]} 元${m[2]}` : `${m[1]} 元`;
};

/**
 * 一張方案表
 *
 * 桌機用真表格：金額橫向並列才看得出「多捐一級多什麼」。
 * 手機改成一張金額一張卡：六欄的矩陣在 375px 寬會擠成無法閱讀的字串，
 * 橫向捲動又會讓左邊的項目名稱捲出畫面，看了也不知道在對哪一列。
 */
const PlanTable: React.FC<{ plan: RelocationPlan }> = ({ plan }) => {
  if (plan.tiers.length === 0 || plan.rows.length === 0) return null;
  return (
    // sr/sr-up 由 StoryPage 的共用捲動處理接手；整頁都會動，表格原地不動會突兀
    <section className="mt-12 sr sr-up">
      {plan.title && (
        <h3 className="balance-text text-2xl sm:text-3xl font-bold text-temple-dark font-serif text-center">
          {plan.title}
        </h3>
      )}
      <div className="flex items-center justify-center gap-3 mt-3 mb-6">
        <span className="w-12 h-px bg-temple-gold/70" />
        <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
        <span className="w-12 h-px bg-temple-gold/70" />
      </div>

      {/* 上下說明都不設 max-w：要與表格同寬，而表格是 w-full 撐滿容器 */}
      {plan.intro && (
        <p className="mb-6 text-gray-600 leading-loose">{renderInline(plan.intro)}</p>
      )}

      {/* 手機：一個金額一張卡 */}
      <div className="space-y-4 md:hidden">
        {plan.tiers.map((tier, ti) => (
          <div key={ti} className="bg-white rounded-lg shadow-md border-l-4 border-temple-gold p-5">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-sm text-gray-500">{plan.amountHeader}</span>
              <span className="text-xl font-bold text-temple-red font-serif">{withCurrency(tier)}</span>
            </div>
            <ul className="space-y-1.5">
              {/*
                手機卡片只列「這一級有的」。桌機是矩陣表格，橫向能一眼比較各級差異，
                沒有的畫「—」才有意義；手機一級一張卡，沒有比較對象，
                列一堆灰色的「—」只是干擾（廟方回報前四級的「祖廟宮印黃布」就是這樣）。
              */}
              {plan.rows.map((row, ri) => {
                const v = row.cells[ti] ?? '';
                const has = isYes(v) || cellText(v) !== '—';
                if (!has) return null;
                return (
                  <li key={ri} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-4 shrink-0 text-center font-bold">✓</span>
                    <span>{row.label}</span>
                    {/* 格子不是打勾也不是空的（例如寫「2份」）就把內容一起顯示 */}
                    {!isYes(v) && <span className="text-gray-600">（{cellText(v)}）</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* 桌機：矩陣表格。欄位多時容器自己橫捲，不讓整頁被撐寬 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow-md overflow-hidden text-center">
          <thead>
            <tr className="bg-temple-gold/15 text-temple-red">
              <th scope="col" className="text-left font-serif font-bold px-5 py-4 whitespace-nowrap">
                {plan.amountHeader}
              </th>
              {plan.tiers.map((t, i) => (
                <th key={i} scope="col" className="font-serif font-bold px-5 py-4 whitespace-nowrap">{withCurrency(t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-temple-bg/50' : ''}>
                <th scope="row" className="text-left font-medium text-temple-dark px-5 py-3 whitespace-nowrap">
                  {row.label}
                </th>
                {plan.tiers.map((_, ti) => {
                  const v = row.cells[ti] ?? '';
                  return (
                    <td key={ti} className={`px-5 py-3 ${isYes(v) ? 'text-temple-red font-bold' : 'text-gray-400'}`}>
                      {isYes(v) ? '✓' : cellText(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.note && (
        <p className="mt-4 text-sm text-gray-500 leading-relaxed">{renderInline(plan.note)}</p>
      )}
    </section>
  );
};

/**
 * 遷址募資的專屬匯款帳號（行動呼籲）
 *
 * 這是整頁的收尾：前面講完為什麼要遷址、有哪些方案，這裡是「怎麼捐」。
 * 原本看完沒有下一步，只能自己想辦法問——轉換就斷在這裡。
 *
 * **與網站其他地方的匯款資訊不同**：那是中國信託的一般帳戶，這是遷址專款專用的
 * 第一銀行帳號，兩者不可混用，改動前先跟廟方確認是哪一個。
 *
 * 帳號給一顆複製鈕：手機上要一邊看畫面一邊在銀行 App 輸入 12 位數字，
 * 抄錯一碼錢就進不來。桌機瀏覽器不支援 clipboard API 時退回什麼都不做，
 * 數字本身仍然選得起來。
 */
const REMITTANCE = {
  bank: '第一銀行',
  bankCode: '007',
  branch: '古亭分行',
  account: '171-68-143732',
  holder: '王順文',
};

const RemittanceCard: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(REMITTANCE.account.replace(/-/g, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* 不支援就算了，數字還是看得到、選得起來 */ }
  };

  return (
    <section className="mt-16 sr sr-up">
      <div className="rounded-2xl border-2 border-temple-gold bg-temple-gold/10 overflow-hidden">
        <div className="bg-temple-gold px-6 py-4 text-center">
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
            遷址募資專屬匯款帳號
          </h3>
        </div>

        <div className="px-6 py-7 sm:px-10">
          <dl className="max-w-md mx-auto space-y-4">
            <div className="flex items-baseline gap-4">
              <dt className="w-20 shrink-0 text-sm text-gray-500">銀行</dt>
              <dd className="font-serif text-lg font-bold text-temple-dark">
                {REMITTANCE.bank}
                <span className="ml-2 text-sm font-normal text-gray-500">代碼 {REMITTANCE.bankCode}</span>
              </dd>
            </div>
            <div className="flex items-baseline gap-4">
              <dt className="w-20 shrink-0 text-sm text-gray-500">分行</dt>
              <dd className="font-serif text-lg font-bold text-temple-dark">{REMITTANCE.branch}</dd>
            </div>
            <div className="flex items-baseline gap-4">
              <dt className="w-20 shrink-0 text-sm text-gray-500">帳號</dt>
              <dd className="flex items-center gap-3 flex-wrap">
                {/* 數字用等寬字：對帳時一位一位比對才不會看錯 */}
                <span className="font-mono text-xl sm:text-2xl font-bold text-temple-red tracking-wider">
                  {REMITTANCE.account}
                </span>
                {/*
                  手機上排不下（內容區 195px，數字＋按鈕要 246px），與其把字縮到
                  難讀，不如讓按鈕整條攤開——手指本來就比較好按 44px 高的橫條，
                  勝過 64px 寬的小藥丸。桌機空間夠，維持行內的小按鈕。
                */}
                <button
                  type="button"
                  onClick={copy}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-sm sm:text-xs px-3 py-2 sm:py-1 rounded-lg sm:rounded-full border border-temple-gold text-temple-dark hover:bg-temple-gold/20 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                  {copied ? '已複製' : '複製帳號'}
                </button>
              </dd>
            </div>
            <div className="flex items-baseline gap-4">
              <dt className="w-20 shrink-0 text-sm text-gray-500">戶名</dt>
              <dd className="font-serif text-lg font-bold text-temple-dark">{REMITTANCE.holder}</dd>
            </div>
          </dl>

          <div className="flex items-center justify-center gap-3 mt-7">
            <span className="w-12 h-px bg-temple-gold/70" />
            <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
            <span className="w-12 h-px bg-temple-gold/70" />
          </div>

          <p className="text-center text-sm text-gray-600 leading-loose mt-5">
            匯款後請透過官方 LINE 或電話告知<strong>姓名、金額與帳號後五碼</strong>，
            以便廟方核對並登錄功德芳名。
          </p>
        </div>
      </div>
    </section>
  );
};

const RelocationPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [blocks, setBlocks] = useState<StoryBlock[]>([]);
  const [plans, setPlans] = useState<RelocationPlan[]>([]);

  useEffect(() => {
    let alive = true;
    getAboutSections(false, 'relocation')
      .then(rows => { if (alive) setBlocks(rows.map(toStoryBlock)); })
      .catch(e => console.warn('讀取遷址段落失敗:', e));
    getRelocationPlans()
      .then(p => { if (alive) setPlans(p); })
      .catch(e => console.warn('讀取捐款方案失敗:', e));
    return () => { alive = false; };
  }, []);

  return (
    <StoryPage eyebrow="護持遷址" title="遷址捐款" blocks={blocks} onBack={onBack} medallion="dragon">
      {plans.map(p => <PlanTable key={p.id} plan={p} />)}
      <RemittanceCard />
    </StoryPage>
  );
};

export default RelocationPage;
