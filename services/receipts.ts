/**
 * 收據（一式三聯）。資料表見 supabase/migrations/receipts.sql。
 *
 * ── 這一份與「財務憑證」的分工 ──
 * 憑證是廟方內部的帳（這筆錢何時、用什麼方式、由誰經手）。
 * 收據是**交到信眾手上的那張紙**——它是對外的、不可變的，而且有連號。
 * 兩者各自連號、不共用編號（廟方 2026-10-30 決定）。
 */
import { supabase } from './supabase';

export interface ReceiptItem {
  id?: string;
  seq?: number;
  /** 指向產生這筆錢的業務紀錄；沒有來源（例如現場隨喜）就留空 */
  sourceTable?: 'donations' | 'lamp_registrations' | 'blessing_registrations' | 'fahui_registrations';
  sourceId?: string;
  /** 項目名稱的**快照**。活動日後改名，已開出去的收據上仍是當時的名稱 */
  label: string;
  /** 金額的快照，理由同上 */
  amount: number;
}

export interface ReceiptRecord {
  id: string;
  receiptNo: string;
  issuedAt: string;
  title: string;
  phone?: string;
  address?: string;
  note?: string;
  status: 'issued' | 'void';
  voidReason?: string;
  voidedAt?: string;
  createdByName?: string;
  items: ReceiptItem[];
}

/** **合計一律由明細加總，不信任任何既有的總額欄位。**
 *  同 finance_vouchers 的 voucherTotal()：存下來的合計一旦與明細對不起來，
 *  沒有任何方法知道該信哪個。 */
export const receiptTotal = (items: ReceiptItem[]): number =>
  items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

// ── 國字大寫金額 ──────────────────────────────────────────────────────────

const DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
/** 萬以內的位數 */
const SMALL_UNITS = ['', '拾', '佰', '仟'];
/** 每四位一節 */
const BIG_UNITS = ['', '萬', '億', '兆'];

/** 四位數以內轉國字（內部用）。回傳不含節單位。 */
const chunkToChinese = (n: number): string => {
  let out = '';
  let zeroPending = false;
  const s = String(n).padStart(4, '0');
  for (let i = 0; i < 4; i++) {
    const d = Number(s[i]);
    const unit = SMALL_UNITS[3 - i];
    if (d === 0) {
      // 中間的零要留一個，連續的零只留一個，結尾的零不留
      if (out !== '') zeroPending = true;
    } else {
      if (zeroPending) { out += DIGITS[0]; zeroPending = false; }
      out += DIGITS[d] + unit;
    }
  }
  return out;
};

/**
 * 金額轉國字大寫，例如 1200 → `壹仟貳佰元整`。
 *
 * **收據上這一行是具法律意義的數字**，阿拉伯數字可以被改、國字大寫不行，
 * 這正是紙本收據同時印兩種的理由。所以這支函式的每一條規則都要能講出來：
 *
 *   - 連續的零只寫一個，結尾的零不寫：`1005` → `壹仟零伍元整`、`1200` → `壹仟貳佰元整`
 *   - 節與節之間該補零要補：`100000005` → `壹億零伍元整`
 *   - 整節為零時只補一個零，不會出現「零零」：`100000000` → `壹億元整`
 *   - 零元寫成 `零元整`，不是空字串——空白的金額欄在收據上是個洞
 *
 * 只處理非負整數；小數在這個專案不會出現（所有金額欄位都是 integer）。
 */
export const amountToChinese = (amount: number): string => {
  const n = Math.floor(Math.abs(Number(amount) || 0));
  if (n === 0) return '零元整';

  // 由低位往高位切成四位一節
  const chunks: number[] = [];
  let rest = n;
  while (rest > 0) { chunks.push(rest % 10000); rest = Math.floor(rest / 10000); }

  let out = '';
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    if (c === 0) {
      // 整節是零：只有在後面還有非零的節時才補一個零，而且不重複補
      if (out !== '' && !out.endsWith(DIGITS[0]) && chunks.slice(0, i).some(x => x > 0)) {
        out += DIGITS[0];
      }
      continue;
    }
    // 這一節不足四位、而且前面已經有內容時要補零（壹億「零」伍）
    if (out !== '' && c < 1000 && !out.endsWith(DIGITS[0])) out += DIGITS[0];
    out += chunkToChinese(c) + BIG_UNITS[i];
  }
  return out + '元整';
};

/** 民國年月日。**明寫 Asia/Taipei**：伺服器與瀏覽器時區都可能不是台灣 */
export const rocDateParts = (iso: string): { year: number; month: number; day: number; time: string } => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return {
    year: Number(p.year) - 1911,
    month: Number(p.month),
    day: Number(p.day),
    time: `${p.dayPeriod ?? ''}${p.hour}:${p.minute}:${p.second}`,
  };
};

// ── 資料存取 ──────────────────────────────────────────────────────────────

const mapRow = (r: any): ReceiptRecord => ({
  id: r.id,
  receiptNo: r.receipt_no,
  issuedAt: r.issued_at,
  title: r.title,
  phone: r.phone || undefined,
  address: r.address || undefined,
  note: r.note || undefined,
  status: r.status,
  voidReason: r.void_reason || undefined,
  voidedAt: r.voided_at || undefined,
  createdByName: r.created_by_name || undefined,
  items: (r.receipt_items ?? [])
    .slice()
    .sort((a: any, b: any) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((i: any) => ({
      id: i.id, seq: i.seq,
      sourceTable: i.source_table || undefined,
      sourceId: i.source_id || undefined,
      label: i.label,
      amount: i.amount,
    })),
});

export const getReceipts = async (): Promise<ReceiptRecord[]> => {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, receipt_items(*)')
    .order('issued_at', { ascending: false });
  if (error) { console.error('讀取收據失敗:', error); return []; }
  return (data ?? []).map(mapRow);
};

/**
 * 開立收據。**配號與寫入在同一個交易裡**（RPC 內部），所以寫入失敗不會燒掉號碼、
 * 連號不會出現補不回來的缺口。理由見 receipts.sql 的檔頭第 4 條。
 */
export const createReceipt = async (input: {
  title: string; items: ReceiptItem[];
  phone?: string; address?: string; note?: string; byName?: string;
}): Promise<ReceiptRecord | null> => {
  const { data, error } = await supabase.rpc('create_receipt', {
    p_title: input.title,
    p_items: input.items.map(i => ({
      source_table: i.sourceTable ?? '',
      source_id: i.sourceId ?? '',
      label: i.label,
      amount: i.amount,
    })),
    p_phone: input.phone ?? null,
    p_address: input.address ?? null,
    p_note: input.note ?? null,
    p_by_name: input.byName ?? null,
  });
  if (error) { console.error('開立收據失敗:', error); throw error; }
  // RPC 只回單頭，明細照送進去的內容組回來（同一個交易寫入的，必然一致）
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { ...mapRow(row), items: input.items } : null;
};

/** 作廢。**不刪除**——連號一旦缺號，外觀上與「有人抽走一張」分不出來。 */
export const voidReceipt = async (id: string, reason: string): Promise<void> => {
  const { error } = await supabase.rpc('void_receipt', { p_id: id, p_reason: reason });
  if (error) { console.error('作廢收據失敗:', error); throw error; }
};

/** 這筆報名開過收據沒（作廢的不算）。用來在財務頁提醒重複開立。 */
export const receiptsBySource = (list: ReceiptRecord[]): Map<string, ReceiptRecord> => {
  const m = new Map<string, ReceiptRecord>();
  list.forEach(r => {
    if (r.status === 'void') return;
    r.items.forEach(i => {
      if (i.sourceTable && i.sourceId) m.set(`${i.sourceTable}:${i.sourceId}`, r);
    });
  });
  return m;
};

// ── 收據專用的廟方設定 ────────────────────────────────────────────────────
// **不塞進 SiteInfo**：那一份是給 schema.org、頁尾與地圖用的，
// 多塞幾個只有收據會用到的欄位，等於讓每一個讀 SiteInfo 的地方都要繞過它們。
// 沿用 site_settings 這張 key-value 表，所以不需要 migration。

export interface ReceiptSettings {
  /** 印在附註第一行的感謝詞 */
  thanksText: string;
  /** 寺廟登記證字號 */
  certNo: string;
  taxId: string;
  /** 底部兩個簽章欄的頭銜 */
  signTitle1: string;
  signTitle2: string;
}

const RECEIPT_KEYS: { field: keyof ReceiptSettings; dbKey: string; fallback: string }[] = [
  { field: 'thanksText', dbKey: 'receipt_thanks_text', fallback: '以仁為道，以和為貴，誠摯感謝。' },
  { field: 'certNo',     dbKey: 'receipt_cert_no',     fallback: '' },
  { field: 'taxId',      dbKey: 'receipt_tax_id',      fallback: '' },
  { field: 'signTitle1', dbKey: 'receipt_sign_1',      fallback: '壇　主' },
  { field: 'signTitle2', dbKey: 'receipt_sign_2',      fallback: '主任委員' },
];

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = RECEIPT_KEYS.reduce(
  (acc, k) => ({ ...acc, [k.field]: k.fallback }), {} as ReceiptSettings,
);

export const getReceiptSettings = async (): Promise<ReceiptSettings> => {
  try {
    const { data, error } = await supabase.from('site_settings')
      .select('key,value').in('key', RECEIPT_KEYS.map(k => k.dbKey));
    if (error) throw error;
    const map = new Map((data ?? []).map(r => [r.key as string, ((r.value ?? '') as string).trim()]));
    return RECEIPT_KEYS.reduce((acc, k) => ({
      // **空字串要留成空字串，不要退回 fallback**：登記證與統編沒填就是沒填，
      // 收據上留白比印一個假號碼好
      ...acc, [k.field]: map.has(k.dbKey) ? map.get(k.dbKey)! : k.fallback,
    }), {} as ReceiptSettings);
  } catch (e) {
    console.warn('讀取收據設定失敗，改用保底值:', e);
    return DEFAULT_RECEIPT_SETTINGS;
  }
};

export const saveReceiptSettings = async (v: ReceiptSettings): Promise<void> => {
  const rows = RECEIPT_KEYS.map(k => ({ key: k.dbKey, value: v[k.field] ?? '' }));
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) { console.error('儲存收據設定失敗:', error); throw error; }
};
