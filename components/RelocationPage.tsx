import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, HeartHandshake } from 'lucide-react';
import BankInfoBox, { BANK_RELOCATION } from './BankInfoBox';
import StoryPage, { StoryBlock, splitParagraphs, renderInline } from './StoryPage';
import BirthDatePicker from './BirthDatePicker';
import { getAboutSections, getRelocationPlans, getSiteImagePublicUrl, submitDonation } from '../services/supabase';
import { sendDonationThanks } from '../services/notifyConfirm';
import { AboutSection, DonationType, RelocationPlan } from '../types';

/** 會員已填過的資料，由 App 往下傳（這一頁是懶載入的，不能反向 import App） */
export interface RelocationDonorDefaults {
  name?: string;
  gender?: string;
  address?: string;
  birthDate?: string;
  phone?: string;
}

/**
 * 遷址捐款（獨立頁）
 *
 * 圖文段落與捐款方案表格都來自後台，廟方自行維護：
 *   段落 → about_sections（page = 'relocation'）
 *   方案 → relocation_plans（金額當欄、回饋項目當列的矩陣）
 * 匯款帳號 2026-09-12 起先撤下（等協會與專款帳戶成立），頁尾改放說明，見 RemittanceNotice。
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
 * 頁尾收束：遷址募資的專屬匯款帳號（廟方 2026-10-23 提供）
 *
 * 2026-09-12 曾經整個撤下（當時要等協會成立、專款帳戶設好），頁尾只放一段
 * 「之後主動通知」的說明——**那段時間這一頁等於沒有行動點**：信眾看完方案表
 * 想護持，畫面上沒有任何一個地方告訴他下一步做什麼。
 *
 * 現在的帳號是廟方自己重新給的，不是從 git 歷史翻回來的。
 * **下次再撤下又放回來時一樣要重新確認**，專款帳戶不保證是同一個。
 *
 * 帳號與「一般捐獻」是**兩個不同的帳戶，絕對不可混用**，所以這裡用
 * BANK_RELOCATION 這個具名常數，而不是元件自己預設一個（見 BankInfoBox 檔頭）。
 *
 * 感恩那幾句是廟方的文案，逐字照放；每行各自一個 <p> 而不是用 <br> 硬斷，
 * 手機上塞不下的那行才能自然折行、不會斷在奇怪的地方。
 */
const THANKS_LINES = [
  '感恩您的耐心與護持',
  '每一份願意同行的心意',
  '都是陪伴和聖壇走向新家的重要力量',
];

/**
 * 遷址護持登記表（廟方 2026-10-23：「遷址捐款，最後面的捐款也要填寫姓名、性別、
 * 出生年月日、地址，還有要哪個捐款方案」）
 *
 * 在這之前這一頁只有一組匯款帳號：信眾匯了款，廟方只看得到一筆入帳，
 * 不知道是誰、選的是月供養還是單次供養——而方案裡寫著「誦經祈福」與
 * 「遷址功德簿」，兩樣都要姓名生辰地址才做得出來。
 *
 * **寫進既有的 donations 表，type = '遷址護持'**（同「神尊修復」那一套）。
 * 不另開一張表：後台的捐獻管理、應收、流量來源、信眾名冊與感謝信全部已經讀
 * donations，另開一張等於那五個地方各漏一塊。
 * 收款帳戶仍然是遷址專款（BANK_RELOCATION），與一般捐獻**不是同一個帳戶**。
 *
 * **金額跟著方案走，不讓人自己打**——方案表上就是那幾級，自由輸入只會出現
 * 對不上任何一級的金額，廟方得回頭一個一個問。只有「隨喜」與「以上」這兩種
 * 級距本來就沒有固定數字，那時才開一格讓他填。
 */
const GENDERS = ['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'];

const inputCls = 'w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

/** 這一級是不是「沒有固定金額」——隨喜，或是「100,000 以上」這種開放級距 */
const isOpenTier = (tier: string): boolean => !/^[\d,]+$/.test(tier.trim());
/** 級距的數字部分，用來當開放級距的下限（抓不到就不設限） */
const tierFloor = (tier: string): number | undefined => {
  const m = tier.trim().match(/^([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : undefined;
};

const RelocationDonationForm: React.FC<{
  plans: RelocationPlan[];
  defaults?: RelocationDonorDefaults;
}> = ({ plans, defaults }) => {
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [gender, setGender]     = useState('');
  const [birthDate, setBirth]   = useState('');
  const [address, setAddress]   = useState('');
  /** 選到哪一級：`方案索引:級距索引`，沒選是空字串 */
  const [pick, setPick]         = useState('');
  const [openAmount, setOpen]   = useState('');
  const [email, setEmail]       = useState('');
  const [notes, setNotes]       = useState('');
  const [status, setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  /** 送出成功時的金額與方案，成功畫面要照著講 */
  const [done, setDone]         = useState<{ amount: number; label: string } | null>(null);
  /**
   * BirthDatePicker 的年月日是內部 state、只在掛載時讀一次 value，
   * 所以帶入會員生日時要換 key 強迫重新掛載（同四個表單的 `_bKey`）。
   */
  const [bKey, setBKey]         = useState(0);

  /**
   * 會員資料自動帶入：**只補空欄位**，使用者改過的一律不動（同四個表單的規則）。
   * 依賴只放 defaults 的各欄位值，不放整個物件——App 每次渲染都會給一個新物件。
   */
  useEffect(() => {
    if (!defaults) return;
    let gotBirth = false;
    setName(v => v || defaults.name || '');
    setGender(v => v || defaults.gender || '');
    setAddress(v => v || defaults.address || '');
    setPhone(v => v || defaults.phone || '');
    setBirth(v => { if (v || !defaults.birthDate) return v; gotBirth = true; return defaults.birthDate; });
    if (gotBirth) setBKey(k => k + 1);
  }, [defaults?.name, defaults?.gender, defaults?.address, defaults?.phone, defaults?.birthDate]);

  const visible = plans.filter(p => p.tiers.length > 0);
  const [pi, ti] = pick.split(':').map(Number);
  const plan = pick ? visible[pi] : undefined;
  const tier = plan ? plan.tiers[ti] : undefined;
  const open = tier ? isOpenTier(tier) : false;
  const floor = tier && open ? tierFloor(tier) : undefined;
  const amount = tier ? (open ? Number(openAmount || 0) : Number(tier.replace(/,/g, ''))) : 0;

  if (visible.length === 0) return null;   // 方案還沒建好就不顯示表單，不要給一張選不了的表

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !tier) return;
    if (amount <= 0) { alert('請填寫護持金額。'); return; }
    if (floor && amount < floor) { alert(`這一級的金額要 ${floor.toLocaleString()} 元以上。`); return; }
    setStatus('loading');
    try {
      const label = `${plan.title}　${withCurrency(tier)}`;
      const id = await submitDonation({
        name: name.trim(), phone: phone.trim(),
        gender: gender || undefined,
        birthDate: birthDate || undefined,
        address: address.trim() || undefined,
        amount,
        type: DonationType.RELOCATION,
        relocationPlan: plan.title,
        relocationTier: withCurrency(tier),
        notes: notes.trim() || undefined,
        email: email.trim() || undefined,
      });
      // 捐獻不等廟方確認，送出當下就寄感謝信（廟方 2026-10-13）。
      // 沒填信箱、電話也對不上會員帳號時後端會安靜跳過，這裡不必判斷。
      sendDonationThanks([id]);
      setDone({ amount, label });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success' && done) {
    return (
      <section className="mt-16 sr sr-up">
        <div className="rounded-2xl border-2 border-temple-gold bg-temple-gold/10 px-5 py-9 sm:px-10 sm:py-11 text-center">
          <div className="w-16 h-16 rounded-full bg-temple-gold/25 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-temple-red" aria-hidden="true" />
          </div>
          <h3 className="text-2xl font-bold text-temple-dark font-serif mb-2">已收到您的護持登記</h3>
          <p className="text-gray-700 mb-1">{done.label}</p>
          <p className="text-2xl font-bold text-temple-red font-serif mb-5">NT$ {done.amount.toLocaleString()}</p>
          {/* **這裡刻意不再放一次匯款帳號。** 登記只是告訴廟方「是誰、要哪一個方案」，
              錢還沒匯——所以金額一定要講；但帳號就在下一塊（RemittanceNotice），
              兩塊緊鄰著各印一次帳號與「請填後五碼」，同一件事講了兩遍。
              要講的是「錢還沒付、往下看」，不是把帳號複製一份。 */}
          <p className="text-gray-700">請依<span className="font-semibold text-temple-red">下方的遷址募資專屬帳號</span>完成匯款，金額如上。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-16 sr sr-up">
      <h3 className="balance-text text-2xl sm:text-3xl font-bold text-temple-dark font-serif text-center">
        我要護持遷址
      </h3>
      <div className="flex items-center justify-center gap-3 mt-3 mb-4" aria-hidden="true">
        <span className="w-12 h-px bg-temple-gold/70" />
        <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
        <span className="w-12 h-px bg-temple-gold/70" />
      </div>
      <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
        方案中的誦經祈福與遷址功德簿都要用到您的姓名與生辰，請一併填寫。
      </p>

      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-temple-gold/20 p-6 sm:p-10 space-y-5">
        {/* **方案選在最前面**（廟方 2026-10-24）。先決定「要哪一個方案」再填「我是誰」
            才是信眾腦中的順序；而且金額是跟著方案走的，填完一整頁姓名生辰才發現
            這一級不是自己要的，等於白填。同問事表單把場次移到人員卡片之前那一次
            （2026-10-12，見 CLAUDE.md）。
            **金額與小計要跟著方案一起搬**：金額只有「隨喜」「10 萬以上」那兩種級距
            才出現，小計也只由方案與級距算出來——它們與方案是同一件事，拆開就會
            變成「在畫面上方選方案、在下方某處才看得到自己選了多少錢」。
            這不牴觸祈福報名表那條「合計放到最後」：那一頁的合計由方案、隨喜、加購、
            供品四樣加總，所以得等全部選完；這裡的金額只由方案決定，底下的欄位
            一個都不會改變它。 */}
        <label className="block">
          <span className={labelCls}>護持方案 *</span>
          <select required value={pick} onChange={e => { setPick(e.target.value); setOpen(''); }}
            className={`${inputCls} bg-white`}>
            <option value="">請選擇方案與級距</option>
            {visible.map((p, i) => (
              <optgroup key={p.id} label={p.title}>
                {p.tiers.map((t, j) => (
                  <option key={`${i}:${j}`} value={`${i}:${j}`}>{withCurrency(t)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {/* 「隨喜」與「100,000 以上」本來就沒有固定數字，只有這兩種才開一格讓人填；
            其餘級距金額就是級距本身，不給改——自由輸入只會出現對不上任何一級的金額 */}
        {open && (
          <label className="block">
            <span className={labelCls}>護持金額（NTD）*</span>
            <input required type="number" min={floor ?? 1} value={openAmount}
              onChange={e => setOpen(e.target.value)}
              placeholder={floor ? `${floor.toLocaleString()} 元以上` : '金額隨喜'}
              className={inputCls} />
          </label>
        )}

        {tier && amount > 0 && (
          <div className="rounded-xl bg-temple-gold/15 border border-temple-gold/40 px-4 py-3 flex items-baseline justify-between gap-3">
            <span className="text-sm text-gray-700">{plan!.title}　{withCurrency(tier)}</span>
            <span className="text-lg font-bold text-temple-red font-serif whitespace-nowrap">NT$ {amount.toLocaleString()}</span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          <label className="block">
            <span className={labelCls}>姓名 *</span>
            <input required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            {/* 電話是必填不是順便加的：全站的報名紀錄都以電話為鍵（見 my_phone()），
                會員日後要在會員中心看到這一筆、廟方要回頭聯絡，都靠它 */}
            <span className={labelCls}>聯絡電話 *</span>
            <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="請留下方便聯繫的電話" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>性別 *</span>
            <select required value={gender} onChange={e => setGender(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">請選擇</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>現居地址 *</span>
            <input required value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
          </label>
        </div>

        {/* 生日走全站共用的那一支：預設國曆、旁邊一行「我只知道農曆」給長者。
            兩條路徑輸出同一種合併字串，資料庫裡只有一種格式（見 CLAUDE.md） */}
        <div>
          <span className={labelCls}>出生年月日 *</span>
          <BirthDatePicker key={bKey} birthDate={birthDate} onChange={setBirth} hideLabel />
        </div>

        {/* 電子信箱：**不加 required、不加格式以外的任何阻擋**——這是送出路徑，
            擋下來的那一刻就是一筆護持沒了，一個打錯的信箱遠比那輕微 */}
        <label className="block">
          <span className={labelCls}>電子信箱（選填）</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="example@gmail.com" className={inputCls} />
          <span className="block text-xs text-gray-400 mt-1">填了就會收到本壇的感謝信；不填也可以護持。</span>
        </label>

        <label className="block">
          <span className={labelCls}>備註 / 匯款帳號後五碼（選填）</span>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="已完成匯款請填寫帳號後五碼，以利核對" className={inputCls} />
        </label>

        {status === 'error' && (
          <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
            <span>送出失敗，請檢查網路或稍後再試。</span>
          </div>
        )}

        <button type="submit" disabled={status === 'loading'}
          className="w-full py-4 text-lg font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all bg-temple-red text-white hover:bg-[#5C1A04] hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
          <HeartHandshake className="w-5 h-5" aria-hidden="true" />
          {status === 'loading' ? '送出中...' : '送出護持登記'}
        </button>
      </form>
    </section>
  );
};

const RemittanceNotice: React.FC = () => (
  <section className="mt-16 sr sr-up">
    <div className="rounded-2xl border-2 border-temple-gold bg-temple-gold/10 px-5 py-9 sm:px-10 sm:py-11 text-center">
      {/* 帳號靠左、寬度收住：匯款資訊是要照著抄的，置中的長數字很難對 */}
      <div className="max-w-sm mx-auto text-left">
        <BankInfoBox account={BANK_RELOCATION} />
      </div>

      <div className="flex items-center justify-center gap-3 my-7" aria-hidden="true">
        <span className="w-12 h-px bg-temple-gold/70" />
        <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
        <span className="w-12 h-px bg-temple-gold/70" />
      </div>

      <div className="space-y-1">
        {THANKS_LINES.map(line => (
          <p key={line} className="font-serif text-base sm:text-lg text-gray-700 leading-relaxed [text-wrap:balance]">{line}</p>
        ))}
      </div>
    </div>
  </section>
);

const RelocationPage: React.FC<{
  onBack: () => void;
  /** 已登入會員填過的資料，用來自動帶入登記表（只補空欄位） */
  donorDefaults?: RelocationDonorDefaults;
}> = ({ onBack, donorDefaults }) => {
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
      {/* 順序是：看方案 → 填登記 → 匯款。
          登記表排在匯款資訊之前，因為要先知道選哪一級才知道要匯多少；
          成功畫面會把帳號與金額再講一次，不必往回捲。 */}
      <RelocationDonationForm plans={plans} defaults={donorDefaults} />
      <RemittanceNotice />
    </StoryPage>
  );
};

export default RelocationPage;
