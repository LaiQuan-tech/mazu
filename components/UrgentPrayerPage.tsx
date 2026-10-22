/**
 * 緊急祈願燈 /urgent（廟方 2026-10-17）
 *
 * 世間有急難時替人向神明稟告、代為點燈。**不收取任何費用**——那是廟方寫在
 * 文案裡的承諾，所以這一頁沒有費用、沒有方案、沒有匯款，整頁一個金額都不出現。
 *
 * ── 三種情況，三組欄位 ──
 * 手術住院／升學考試／冥福接引要問的東西不一樣，但它們是同一件事的三種情況。
 * 先選情況再出欄位，不要把十幾格一次攤開——會來填這張表的人多半正在醫院走廊上，
 * 看到一整面欄位的第一個反應是放棄。
 *
 * ── 「信士／信女」那一格，三種的意思不一樣 ──
 * 住院與考試填的是當事人（通常就是登記的人自己），冥福接引填的是**先人**。
 * 所以那一格的標題跟著情況換，而聯絡電話永遠是**登記人**的。
 * 不換標題的話，冥福接引會收到一堆填成自己名字的資料。
 *
 * ── 生日用全站同一支 BirthDatePicker ──
 * 文案寫「農曆生日」，而那支的輸出字串（民國72年6月20日（農曆五月初十））本來
 * 就含農曆。另外做一個「只收農曆」的輸入框，等於再長出第二種生日格式——
 * 會員中心當初就是這樣長出兩種的（見 CLAUDE.md）。
 * 農曆卒日也用同一支：它的工作是「選一個日子，輸出國曆＋農曆」，與生死無關。
 *
 * ── 這一頁不做揪團、不做會員限定 ──
 * 急事不該先叫人去註冊。登記完以同一支電話註冊，紀錄會自己接起來（my_phone()）。
 */
import React, { useEffect, useState } from 'react';
import { HeartHandshake, Hospital, GraduationCap, Flame, Check, AlertCircle, Phone } from 'lucide-react';
import BirthDatePicker from './BirthDatePicker';
import PatternMedallion from './PatternMedallion';
import { submitUrgentPrayer, urgentPrayersReady } from '../services/supabase';
import { UrgentPrayerData, UrgentPrayerKind, ZodiacSign } from '../types';

/**
 * 版型外殼。三種畫面（表單／送出成功／資料表還沒建好）共用，**團紋才不會漏掉**
 * ——這一頁一開始就漏了（廟方 2026-10-17 指出「底圖沒有龍紋或鳳紋」）。
 *
 * 用鳳紋、靠右：服務頁（/lamps、/blessing）都是這一組，龍紋留給首頁、公佈欄與
 * 預約問事那一區。團紋是絕對定位並往外推四成，所以外層一定要 relative
 * overflow-hidden、內容要 relative z-10，否則會撐出水平捲軸或被紋樣蓋住
 * （見 PatternMedallion 的檔頭）。
 */
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  /* **pt-20 讓出固定導覽列的高度，py-16 sm:py-20 才是這一頁自己的上下留白**——
     兩件事不能合成一個 py-20。原本只有 py-20，等於完全沒有替導覽列讓位，
     標題就黏在導覽列底下：實測 h1 離頁頂 116px，而 /booking、/lamps、
     /relocation 全是 196px（廟方 2026-10-22 回報「版型跟其他頁不同」）。
     數字要對得起來的是這個，不是字級——字級本來三頁就都是 48px。
     團紋是絕對定位並往外推四成，所以外層要 relative overflow-hidden、
     內容要 relative z-10（見 PatternMedallion 的檔頭）。 */
  <section className="pt-20 bg-temple-bg relative overflow-hidden">
    <PatternMedallion motif="phoenix" side="r" />
    <div className="relative z-10 py-16 sm:py-20">{children}</div>
  </section>
);

const KINDS: { id: UrgentPrayerKind; label: string; hint: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'hospital', label: '手術或住院', hint: '病苦關卡、開刀、住院療養', Icon: Hospital },
  { id: 'exam',     label: '升學考試',   hint: '升學考試、考證照',         Icon: GraduationCap },
  { id: 'memorial', label: '冥福接引',   hint: '為先人祈請冥福接引',       Icon: Flame },
];

/** 這一格在三種情況下代表不同的人，標題一定要跟著換（見檔頭） */
const NAME_LABEL: Record<UrgentPrayerKind, string> = {
  hospital: '信士／信女姓名',
  exam:     '信士／信女姓名',
  memorial: '先人姓名',
};

const inputClass =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none';

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({
  label, required, hint, children,
}) => (
  // 標題包住欄位：可及名稱靠它，不要另外再加 aria-label 蓋掉看得見的標題（CLAUDE.md）
  <label className="block">
    <span className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required && <span className="text-temple-red"> *</span>}
    </span>
    {children}
    {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
  </label>
);

const emptyForm: UrgentPrayerData = {
  kind: 'hospital', name: '', birthDate: '', phone: '',
};

interface Props {
  /** 已登入會員的預設值（姓名／地址／電話），只補空欄位 */
  defaults?: { name?: string; address?: string; phone?: string; email?: string };
  /** 本壇電話。資料表還沒建好時，這一頁退回「請直接致電」 */
  templePhone?: string;
}

const UrgentPrayerPage: React.FC<Props> = ({ defaults, templePhone }) => {
  const [form, setForm] = useState<UrgentPrayerData>({
    ...emptyForm,
    name: defaults?.name ?? '',
    address: defaults?.address ?? '',
    phone: defaults?.phone ?? '',
    email: defaults?.email ?? '',
  });
  // BirthDatePicker 的年月日是內部 state，只在掛載時從 value 初始化一次；
  // 換情況時要讓它重新掛載，否則上一種填的日期會留在畫面上（CLAUDE.md 的 _bKey）
  const [bKey, setBKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [doneKind, setDoneKind] = useState<UrgentPrayerKind | null>(null);
  // null＝還在確認。表還沒建時不要先畫表單（理由見 urgentPrayersReady）
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => { urgentPrayersReady().then(setReady).catch(() => setReady(false)); }, []);

  const set = <K extends keyof UrgentPrayerData>(k: K, v: UrgentPrayerData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const pickKind = (kind: UrgentPrayerKind) => {
    // 換情況時把只屬於上一種的欄位清掉：留著會跟著送出去，
    // 廟方收到一筆「考試」卻帶著病房號，不知道該信哪一個
    setForm(prev => ({
      kind,
      name: prev.name, birthDate: prev.birthDate, zodiac: prev.zodiac,
      address: prev.address, phone: prev.phone, email: prev.email,
    }));
    setBKey(k => k + 1);
    setError('');
  };

  const missing = (): string => {
    if (!form.name.trim()) return `請填寫${NAME_LABEL[form.kind]}`;
    if (!form.birthDate) return '請選擇農曆生日';
    if (!form.phone.trim()) return '請留下聯絡電話，廟方才回得了電';
    if (form.kind === 'memorial') {
      if (!form.deathDate) return '請選擇農曆卒日';
      if (!form.kinConfirmed) return '冥福接引限三等親內親屬，請勾選確認';
    } else {
      if (!form.placeName?.trim()) return form.kind === 'hospital' ? '請填寫醫院名稱' : '請填寫學校或考場名稱';
    }
    return '';
  };

  const submit = async () => {
    const why = missing();
    if (why) { setError(why); return; }
    setSending(true);
    setError('');
    try {
      await submitUrgentPrayer(form);
      setDoneKind(form.kind);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch (err) {
      console.error(err);
      setError('送出失敗，可能是網路不穩。請再按一次，或直接致電本壇。');
    } finally {
      setSending(false);
    }
  };

  if (doneKind) {
    return (
      <Shell>
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-9 h-9 text-green-600" aria-hidden="true" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-temple-dark font-serif mb-3">祈願已登記</h1>
          <p className="text-gray-600 leading-relaxed">
            本壇已收到您的《緊急祈願燈》登記，將於神前代為稟告、祈福點燈。<br />
            若有需要補充，歡迎直接致電本壇。
          </p>
          {/* 不收費這件事在送出後要再講一次：這一刻最容易冒出「那要付多少」的疑問 */}
          <p className="mt-4 text-sm text-temple-red font-medium">本服務不收取任何費用。</p>
          <button
            type="button"
            onClick={() => { setDoneKind(null); setForm({ ...emptyForm, phone: form.phone, email: form.email }); setBKey(k => k + 1); }}
            className="mt-8 px-6 py-3 rounded-xl border border-temple-gold/50 text-temple-dark hover:bg-temple-gold/10 transition-colors"
          >
            再登記一位
          </button>
        </div>
      </Shell>
    );
  }

  // 資料表還沒建好：不要畫表單。讓急難中的人填完十幾格才發現送不出去，比什麼都不顯示糟
  if (ready === false) {
    return (
      <Shell>
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-temple-dark mb-4 font-serif">緊急祈願燈</h1>
          <p className="text-gray-600 leading-loose">
            急難之時，本壇可代為向神明稟告、祈福點燈，<strong className="text-temple-red">不收取任何費用</strong>。<br />
            線上登記即將開放，目前請直接與本壇聯繫。
          </p>
          {templePhone && (
            <a href={`tel:${templePhone}`}
              className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-xl bg-temple-red text-white text-lg font-bold hover:bg-[#5C4310] transition-colors">
              <Phone className="w-5 h-5" aria-hidden="true" />{templePhone}
            </a>
          )}
        </div>
      </Shell>
    );
  }

  const isMemorial = form.kind === 'memorial';

  return (
    <Shell>
      {/* **max-w-4xl 要跟 /booking、/blessing 一致**（廟方 2026-10-22：「等寬」）。
          那兩頁也是服務表單，本來就都是 4xl；這一頁原本 3xl，窄了 128px。
          /lamps 的 7xl 不在此列——那是燈種的卡片牆，不是表單。 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
            <span className="w-8 h-1 bg-temple-gold" />
            集氣祈福
            <span className="w-8 h-1 bg-temple-gold" />
          </h2>
          <h1 className="text-4xl sm:text-5xl font-bold text-temple-dark mb-2 font-serif">緊急祈願燈</h1>
          <div className="flex items-center justify-center gap-3 mt-3 mb-4">
            <span className="w-12 h-px bg-temple-gold/70" />
            <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
            <span className="w-12 h-px bg-temple-gold/70" />
          </div>
          <p className="text-gray-600 leading-loose max-w-xl mx-auto">
            世間若有急難之時，一念祈願，亦可化作守護的力量。<br />
            本壇秉持濟世初心，在神明慈悲護佑之下，特設《緊急祈願燈》，
            為有急難之人代為稟告、祈福點燈。
          </p>
        </div>

        {/* 「不收費」給它自己一塊，不要混在說明段落裡——這是信眾看到「點燈」
            兩個字之後第一個想問的，答案要擋在問題前面 */}
        <div className="flex items-start gap-3 rounded-2xl bg-temple-gold/10 border border-temple-gold/40 px-5 py-4 mb-10">
          <HeartHandshake className="w-5 h-5 text-temple-red shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[#5C4310] leading-relaxed">
            <strong>本服務不收取任何費用。</strong>
            只願以一念誠心，上達神明；願一盞燈火，為祈願者帶來光明與轉機。
          </p>
        </div>

        <h2 className="font-serif text-xl font-bold text-temple-dark mb-3">請選擇祈願情況</h2>
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          {KINDS.map(({ id, label, hint, Icon }) => {
            const on = form.kind === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pickKind(id)}
                aria-pressed={on}
                className={`text-left px-4 py-4 rounded-2xl border-2 transition-colors ${
                  on
                    ? 'border-temple-red bg-temple-red/5'
                    : 'border-gray-200 bg-white hover:border-temple-gold'
                }`}
              >
                <Icon className={`w-6 h-6 mb-2 ${on ? 'text-temple-red' : 'text-temple-gold'}`} aria-hidden="true" />
                <span className="block font-bold text-temple-dark">{label}</span>
                <span className="block text-xs text-gray-500 mt-1 leading-relaxed">{hint}</span>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-temple-gold/20 p-5 sm:p-7 space-y-5">
          <Field label={NAME_LABEL[form.kind]} required>
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} />
          </Field>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">
              農曆生日<span className="text-temple-red"> *</span>
            </span>
            <BirthDatePicker
              key={`b-${bKey}`}
              birthDate={form.birthDate}
              zodiac={form.zodiac}
              hideLabel
              onChange={(birthDate, zodiac) => setForm(prev => ({ ...prev, birthDate, zodiac: zodiac as ZodiacSign | undefined }))}
            />
          </div>

          {isMemorial ? (
            <>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">
                  農曆卒日<span className="text-temple-red"> *</span>
                </span>
                <BirthDatePicker
                  key={`d-${bKey}`}
                  birthDate={form.deathDate ?? ''}
                  hideLabel
                  onChange={deathDate => set('deathDate', deathDate)}
                />
              </div>
              <Field label="安奉位置（牌位）">
                <input value={form.tabletPlace ?? ''} onChange={e => set('tabletPlace', e.target.value)}
                  className={inputClass} placeholder="例：家中祖先牌位、○○寺納骨塔" />
              </Field>
              {/* 三等親這條是廟方訂的規則，做成必勾的確認而不是一行小字：
                  小字讀不讀得到沒人知道，勾選代表他真的看到了 */}
              <label className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={!!form.kinConfirmed}
                  onChange={e => set('kinConfirmed', e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#7C5C1E]" />
                <span className="text-sm text-amber-900 leading-relaxed">
                  我確認<strong>先人為本人三等親內親屬</strong>。
                </span>
              </label>
            </>
          ) : (
            <>
              <Field label="地址">
                <input value={form.address ?? ''} onChange={e => set('address', e.target.value)} className={inputClass} />
              </Field>
              <Field label={form.kind === 'hospital' ? '醫院名稱' : '學校／考場名稱'} required>
                <input value={form.placeName ?? ''} onChange={e => set('placeName', e.target.value)} className={inputClass} />
              </Field>
              <Field label={form.kind === 'hospital' ? '醫院地址' : '學校／考場地址'}>
                <input value={form.placeAddress ?? ''} onChange={e => set('placeAddress', e.target.value)} className={inputClass} />
              </Field>
              {form.kind === 'hospital' ? (
                <>
                  <Field label="病房號">
                    <input value={form.roomNo ?? ''} onChange={e => set('roomNo', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="詳細現況" hint="手術日期、病況、目前的關卡，寫您想讓神明知道的">
                    <textarea value={form.condition ?? ''} onChange={e => set('condition', e.target.value)}
                      rows={4} className={inputClass} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="考試日期">
                    <input value={form.eventDate ?? ''} onChange={e => set('eventDate', e.target.value)}
                      className={inputClass} placeholder="例：115 年 1 月 20 日" />
                  </Field>
                  <Field label="准考證號碼">
                    <input value={form.examNo ?? ''} onChange={e => set('examNo', e.target.value)} className={inputClass} />
                  </Field>
                </>
              )}
            </>
          )}

          {/* 聯絡方式永遠是「登記的人」的，不是被祈願的那一位——
              冥福接引更明顯：先人沒有電話 */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-bold text-temple-dark mb-3">
              登記人聯絡方式
              {isMemorial && <span className="font-normal text-gray-500">（不是先人的）</span>}
            </p>
            <div className="space-y-5">
              <Field label="聯絡電話" required hint="廟方若需確認細節會以此聯絡；日後以同一支電話註冊會員，就看得到這筆紀錄">
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  type="tel" inputMode="tel" className={inputClass} />
              </Field>
              <Field label="電子信箱（選填）" hint="留了的話，廟方完成祈福後會寄一封通知給您">
                <input value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                  type="email" className={inputClass} />
              </Field>
            </div>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="w-full px-6 py-4 rounded-xl bg-temple-red text-white text-lg font-bold hover:bg-[#5C4310] transition-colors disabled:opacity-50"
          >
            {sending ? '送出中…' : '送出祈願登記'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            送出後本壇會於神前代為稟告、祈福點燈，不收取任何費用。
          </p>
        </div>
      </div>
    </Shell>
  );
};

export default UrgentPrayerPage;
