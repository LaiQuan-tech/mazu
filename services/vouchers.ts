/**
 * 財務憑證（支出／收入）的資料存取。
 *
 * 獨立一支而不是塞進 services/supabase.ts：那支已經超過 1800 行，而憑證是
 * 自成一格的子系統（四張表＋一個私有 bucket），混進去只會讓兩邊都更難找。
 *
 * ── 三件與其他 service 不同、不能照抄的事 ──
 *
 * 1. **附件在私有 bucket，一律用簽名網址。**
 *    全站其他上傳都是 `getPublicUrl`（site-images 是公開的），但發票與收據上有
 *    金額、統一編號、可能有個資。這裡的 bucket `public = false`，取檔案要
 *    `createSignedUrl` 換一個短效網址，而且那個網址不要存進資料庫——存的是
 *    storage_path，每次要看再換。
 *
 * 2. **不壓縮、不轉檔。**
 *    site-images 的上傳會走 shrinkImage 把長邊壓到 1600px，那對照片沒問題，
 *    對發票是災難：統編與金額那幾行字會糊掉。財務附件一律原檔上傳，只擋大小。
 *
 * 3. **合計永遠用算的。**
 *    資料庫沒有 total 欄位，這裡也不提供「讀回合計」的函式。要合計就用
 *    types.ts 的 `voucherTotal(items)`。
 */
import { supabase } from './supabase';
import {
  AccountingAccount, AccountingAccountData,
  VoucherRecord, VoucherData, VoucherItem, VoucherItemData,
  VoucherAttachment, AttachmentKind, VoucherDirection,
} from '../types';

const BUCKET = 'finance-docs';

/** 單一附件上限。發票拍照通常 2-5MB，PDF 更小；超過多半是誤傳整本相簿 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// ─── 會計科目 ────────────────────────────────────────────────────────────

const mapAccount = (r: any): AccountingAccount => ({
  id: r.id,
  code: String(r.code ?? ''),
  name: String(r.name ?? ''),
  direction: r.direction,
  sortOrder: Number(r.sort_order ?? 0),
  isActive: r.is_active !== false,
  note: String(r.note ?? ''),
});

export const getAccountingAccounts = async (includeInactive = false): Promise<AccountingAccount[]> => {
  let q = supabase.from('accounting_accounts').select('*').order('direction').order('sort_order').order('code');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) { console.error('讀取會計科目失敗:', error); throw error; }
  return (data ?? []).map(mapAccount);
};

export const createAccountingAccount = async (d: AccountingAccountData): Promise<string> => {
  const { data, error } = await supabase.from('accounting_accounts').insert({
    code: d.code.trim(), name: d.name.trim(), direction: d.direction,
    sort_order: d.sortOrder, is_active: d.isActive, note: d.note.trim() || null,
  }).select('id').single();
  if (error) { console.error('新增會計科目失敗:', error); throw error; }
  return data.id as string;
};

export const updateAccountingAccount = async (id: string, d: AccountingAccountData): Promise<void> => {
  const { error } = await supabase.from('accounting_accounts').update({
    code: d.code.trim(), name: d.name.trim(), direction: d.direction,
    sort_order: d.sortOrder, is_active: d.isActive, note: d.note.trim() || null,
  }).eq('id', id);
  if (error) { console.error('更新會計科目失敗:', error); throw error; }
};

/**
 * 刪除科目。用過的科目會被資料庫的 ON DELETE RESTRICT 擋下來——那是刻意的，
 * 舊憑證不能指向不存在的科目，否則報表會出現空白分類。呼叫端要把這個錯誤
 * 翻成「這個科目已經被憑證用過，請改用停用」。
 */
export const deleteAccountingAccount = async (id: string): Promise<void> => {
  const { error } = await supabase.from('accounting_accounts').delete().eq('id', id);
  if (error) { console.error('刪除會計科目失敗:', error); throw error; }
};

// ─── 憑證 ────────────────────────────────────────────────────────────────

const mapItem = (r: any): VoucherItem => ({
  id: r.id,
  seq: Number(r.seq ?? 1),
  accountId: r.account_id ?? null,
  summary: String(r.summary ?? ''),
  amount: Number(r.amount ?? 0),
  applicant: String(r.applicant ?? ''),
  sourceTable: r.source_table ?? null,
  sourceId: r.source_id ?? null,
});

const mapAttachment = (r: any): VoucherAttachment => ({
  id: r.id,
  itemId: r.item_id ?? null,
  kind: (r.kind ?? '其他') as AttachmentKind,
  storagePath: String(r.storage_path ?? ''),
  fileName: String(r.file_name ?? ''),
  mime: r.mime ?? null,
  sizeBytes: r.size_bytes ?? null,
  uploadedAt: r.uploaded_at,
});

const mapVoucher = (r: any): VoucherRecord => ({
  id: r.id,
  direction: r.direction,
  voucherNo: String(r.voucher_no ?? ''),
  voucherDate: String(r.voucher_date ?? ''),
  summary: String(r.summary ?? ''),
  status: r.status,
  note: String(r.note ?? ''),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  items: (r.voucher_items ?? []).map(mapItem).sort((a: VoucherItem, b: VoucherItem) => a.seq - b.seq),
  attachments: (r.voucher_attachments ?? []).map(mapAttachment),
});

/** 一次把單頭、明細、附件都撈回來（巢狀 select 走外鍵關聯） */
const SELECT_FULL = '*, voucher_items(*), voucher_attachments(*)';

export const getVouchers = async (): Promise<VoucherRecord[]> => {
  const { data, error } = await supabase
    .from('vouchers').select(SELECT_FULL)
    .order('voucher_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { console.error('讀取憑證失敗:', error); throw error; }
  return (data ?? []).map(mapVoucher);
};

export const createVoucher = async (d: VoucherData): Promise<string> => {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('vouchers').insert({
    direction: d.direction,
    voucher_no: d.voucherNo.trim(),
    voucher_date: d.voucherDate,
    summary: d.summary.trim() || null,
    status: d.status,
    note: d.note.trim() || null,
    created_by: auth?.user?.id ?? null,
  }).select('id').single();
  if (error) { console.error('新增憑證失敗:', error); throw error; }
  return data.id as string;
};

export const updateVoucher = async (id: string, d: VoucherData): Promise<void> => {
  const { error } = await supabase.from('vouchers').update({
    direction: d.direction,
    voucher_no: d.voucherNo.trim(),
    voucher_date: d.voucherDate,
    summary: d.summary.trim() || null,
    status: d.status,
    note: d.note.trim() || null,
  }).eq('id', id);
  if (error) { console.error('更新憑證失敗:', error); throw error; }
};

/**
 * 明細一律「整批換掉」而不是逐筆 diff。
 * 一張傳票的明細很少（通常個位數），整批換的程式簡單很多、也不會有
 * 「漏刪一筆」這種只在特定操作順序下才出現的 bug。
 *
 * 注意順序：**先刪後插**。反過來的話同一個 seq 會短暫重複。
 */
export const replaceVoucherItems = async (voucherId: string, items: VoucherItemData[]): Promise<void> => {
  const { error: delErr } = await supabase.from('voucher_items').delete().eq('voucher_id', voucherId);
  if (delErr) { console.error('清除舊明細失敗:', delErr); throw delErr; }
  if (!items.length) return;
  const rows = items.map((it, i) => ({
    voucher_id: voucherId,
    seq: i + 1,
    account_id: it.accountId || null,
    summary: it.summary.trim() || null,
    amount: Math.max(0, Math.round(Number(it.amount) || 0)),
    applicant: it.applicant.trim() || null,
    source_table: it.sourceTable || null,
    source_id: it.sourceId || null,
  }));
  const { error } = await supabase.from('voucher_items').insert(rows);
  if (error) { console.error('寫入明細失敗:', error); throw error; }
};

/** 作廢而不是刪除——財務資料不刪，與「有紀錄的捐款類別禁止刪除」同一個原則 */
export const voidVoucher = async (id: string): Promise<void> => {
  const { error } = await supabase.from('vouchers').update({ status: 'void' }).eq('id', id);
  if (error) { console.error('作廢憑證失敗:', error); throw error; }
};

/** 只有還沒確認過的草稿才適合真的刪掉（例如按錯新增了一張空白單） */
export const deleteVoucher = async (id: string): Promise<void> => {
  const { error } = await supabase.from('vouchers').delete().eq('id', id);
  if (error) { console.error('刪除憑證失敗:', error); throw error; }
};

/**
 * 建議單號，例如 `E20260927-01`。
 *
 * **只是建議，使用者可以改**——既有的「感謝狀編號」就是財務自己填的，
 * 看得出廟方偏好自己掌握號碼。資料庫的 UNIQUE 是擋重號，不是強迫格式。
 *
 * 日期用本地時區組字串，不要 toISOString()：台灣早上 8 點前會差一天。
 */
export const suggestVoucherNo = async (direction: VoucherDirection, date: string): Promise<string> => {
  const prefix = `${direction === 'expense' ? 'E' : 'I'}${date.replace(/-/g, '')}-`;
  const { data, error } = await supabase
    .from('vouchers').select('voucher_no').like('voucher_no', `${prefix}%`);
  if (error) { console.error('查詢單號失敗:', error); return `${prefix}01`; }
  const used = (data ?? [])
    .map(r => Number(String(r.voucher_no).slice(prefix.length)))
    .filter(n => Number.isFinite(n));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
};

/** 今天（本地時區）的 YYYY-MM-DD */
export const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── 附件（私有 bucket）──────────────────────────────────────────────────

/** 檔名只留安全字元：storage 的路徑不吃某些字元，中文檔名也容易在下載時亂碼 */
const safeName = (name: string): string =>
  name.replace(/[^\w.\-]+/g, '_').replace(/_{2,}/g, '_').slice(-80) || 'file';

export const uploadVoucherAttachment = async (
  voucherId: string, itemId: string | null, kind: AttachmentKind, file: File,
): Promise<VoucherAttachment> => {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`檔案超過 ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB 上限`);
  }
  // 原檔上傳不壓縮：發票上的統編與金額壓過就糊了
  const path = `vouchers/${voucherId}/${Date.now()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) { console.error('上傳附件失敗:', upErr); throw upErr; }

  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('voucher_attachments').insert({
    voucher_id: voucherId, item_id: itemId, kind,
    storage_path: path, file_name: file.name,
    mime: file.type || null, size_bytes: file.size,
    uploaded_by: auth?.user?.id ?? null,
  }).select('*').single();
  if (error) {
    // 資料列沒建起來就把檔案收回去，否則 bucket 裡會留下沒人指向的孤兒檔
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    console.error('寫入附件紀錄失敗:', error);
    throw error;
  }
  return mapAttachment(data);
};

/**
 * 取一個短效的簽名網址來看／下載附件。
 * **不要把回傳值存進資料庫或快取太久**——它會過期，而且那串網址本身就是通行證。
 */
export const getAttachmentUrl = async (storagePath: string, seconds = 300): Promise<string> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, seconds);
  if (error || !data?.signedUrl) { console.error('取得附件網址失敗:', error); throw error ?? new Error('no url'); }
  return data.signedUrl;
};

export const deleteVoucherAttachment = async (id: string, storagePath: string): Promise<void> => {
  const { error } = await supabase.from('voucher_attachments').delete().eq('id', id);
  if (error) { console.error('刪除附件紀錄失敗:', error); throw error; }
  // 檔案刪失敗不擋流程：紀錄已經沒了，殘檔頂多佔空間，不會被任何人看到
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
};
