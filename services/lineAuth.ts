/**
 * 用 LINE 帳號登入
 *
 * ── 為什麼值得做 ──
 * 本站信眾以長者居多，記 email 與密碼是真實的門檻。LINE 登入在手機上會跳進
 * LINE App、按一下「允許」就回來，不必打字、不必收驗證信（廟方 2026-10-12 決定做）。
 *
 * ── 走 Supabase 的「自訂 OAuth 供應商」，型別要選 OAuth2 不要選 OIDC ──
 * Supabase **沒有內建 LINE**：社群那個 PR（supabase/supabase#46920）2026-09-23
 * 被關掉了，沒有合併。所以只能用 2026-02 開放的自訂供應商。
 * **型別一定要選 OAuth2**：LINE 網頁登入的 ID token 是 HS256 簽的，而自訂 OIDC
 * 是拿 JWKS 驗章，驗不過；OAuth2 型別完全不碰 ID token，改打 LINE 的 userinfo
 * 端點拿資料，直接繞開這件事。
 *
 * ── LINE 回給我們的只有 userId／暱稱／頭像 ──
 * **沒有 email，更沒有電話。** email 要另外向 LINE 申請權限、而且放在 ID token 裡
 * （我們剛好不用 ID token）。而本站的報名紀錄是拿 `profile.phone` 去對
 * bookings／lamp_registrations／blessing_registrations 的，跟 email 無關——
 * 所以 LINE 登入之後一定要引導補手機，否則人登進去看到的是空的，
 * 會以為紀錄不見了（處理在 MemberPortal 的「還差一步」提示）。
 *
 * ── 設定步驟（在兩個後台，不是程式） ──
 * 1. LINE Developers 建 Provider →「LINE Login」channel（**不是** Messaging API
 *    channel，官方帳號那個不能共用），拿 Channel ID 與 Channel Secret。
 * 2. 該 channel 的 Callback URL 填 `https://<專案ref>.supabase.co/auth/v1/callback`。
 * 3. Supabase → Authentication → Sign In / Providers → Custom Providers → New Provider：
 *      Provider Identifier  `line`（**前面的 `custom:` 是固定前綴**，所以 SDK 要寫 `custom:line`）
 *      Configuration Method **Manual configuration**——**不要用 Auto-discovery**：
 *        那會讓 Supabase 當成 OIDC、拿 JWKS 驗 ID token 的簽章，而 LINE 的
 *        網頁登入（Web app 類型）發的 ID token 是 HS256 簽的，驗不過。
 *      Authorization  https://access.line.me/oauth2/v2.1/authorize
 *      Token          https://api.line.me/oauth2/v2.1/token
 *      User Info      https://api.line.me/oauth2/v2.1/userinfo
 *        （**不要用 /v2/profile**：那支回 LINE 自己的 userId／displayName，
 *          Supabase 要的是標準的 sub／name／picture）
 *      Scopes         openid, profile
 *      Allow users without email  **打開**（LINE 不給 email）
 * 4. 設定完成後把下面的 ENABLE_LINE_LOGIN 改成 true 再部署。
 */
import { supabase } from './supabase';
import { ENTRY_URL } from './attribution';

/**
 * 2026-10-13 開啟：Supabase 的自訂供應商 `custom:line` 已建好並實測轉得到 LINE 登入頁。
 *
 * **這個旗標是唯一的防線，不是保險**（2026-10-13 實測）：供應商還沒建好時，
 * `signInWithOAuth` **不會回傳錯誤**——它直接把瀏覽器轉去 Supabase，由 Supabase 回一頁
 * 生 JSON（`{"code":400,...,"msg":"Unsupported provider: Provider line could not be found"}`）。
 * 下面那段錯誤處理在這個情況完全不會執行，信眾會整個離開網站落在一頁英文 JSON 上。
 * 所以 Supabase 那邊確認可以登入之前，這裡一定要維持 false。
 */
export const ENABLE_LINE_LOGIN = true;

/**
 * 要與 Supabase 後台的 Provider Identifier 一字不差，不一致會回 Unsupported provider。
 * **`custom:` 是 Supabase 自己加的固定前綴**：後台那欄只填 `line`，
 * SDK 這邊要寫完整的 `custom:line`（建立表單上的說明就是這樣寫的）。
 */
export const LINE_PROVIDER = 'custom:line';

/**
 * 同意畫面上順便問要不要加官方帳號好友（LINE 的 bot_prompt）。
 * 信眾按一次「允許」，廟方同時拿到一個會員與一個 LINE 好友。
 *
 * 要先在 LINE Developers 把官方帳號連到這個 Login channel，沒連的話 LINE 會直接忽略。
 * **2026-10-13 實測確認傳得過去**：產生的網址是
 * `…/auth/v1/authorize?provider=line&redirect_to=…&bot_prompt=normal`，Supabase 原樣帶上。
 */
const ASK_ADD_FRIEND = true;

/**
 * 回來之後要落在哪。
 * 帶 `member=1` 讓會員中心自己打開——不帶的話信眾繞一圈回到首頁，
 * 會以為什麼都沒發生。**原本的 query 要保留**：`?share=` 這類功能性參數
 * 掉了，繞一趟登入回來那張揪團表就找不到了。
 */
const redirectTarget = (): string => {
  const params = new URLSearchParams(window.location.search);
  params.set('member', '1');
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
};

/**
 * 導向 LINE 登入。成功時這支不會回傳——瀏覽器已經離開這一頁了。
 * 回傳的字串是給畫面顯示的錯誤訊息，沒有錯誤就是空字串。
 */
export const signInWithLine = async (): Promise<string> => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      // 自訂供應商不在 supabase-js 的 Provider 列舉裡，型別要繞過
      provider: LINE_PROVIDER as never,
      options: {
        redirectTo: redirectTarget(),
        ...(ASK_ADD_FRIEND ? { queryParams: { bot_prompt: 'normal' } } : {}),
      },
    });
    if (!error) return '';
    // 最常見的就是「還沒在 Supabase 建好供應商」，講白話而不是把英文原文丟給長輩
    return /provider|unsupported/i.test(error.message)
      ? 'LINE 登入尚未開放，請改用信箱登入，或與廟方聯繫。'
      : 'LINE 登入失敗，請稍後再試。';
  } catch {
    return 'LINE 登入失敗，請檢查網路後再試。';
  }
};

/**
 * 把 LINE 綁到「目前已登入的帳號」上。
 *
 * ── 為什麼合併帳號只能這樣做 ──
 * 廟方要的是「同一個人用 LINE 登入之後，以前的紀錄還在」。直覺的作法是「登入後比對
 * 手機號碼，相同就把兩個帳號併起來」——**這條路不能走**：手機號碼是會員自己在個人資料
 * 打的，**沒有任何驗證**，任何人填別人的號碼就能把對方的帳號併過來，連同通訊錄裡
 * 家人的姓名、生日、地址與揪團名單。
 * （`member_profiles`／`member_contacts`／`shared_sessions` 現在都是 `user_id = auth.uid()`
 * 嚴格隔離的，自動合併等於親手打開這個洞。報名紀錄本來就是以電話為鍵
 * ——`my_phone()`——那是既有的弱點，但不該再擴大。）
 *
 * 正解是 Supabase 的 identity linking：**先證明你是這個帳號的人（用原本的信箱密碼登入），
 * 再把 LINE 接上去。** 接上之後用 LINE 登入就是同一個 user id，揪團表、通訊錄、
 * 個人資料全部原封不動。
 *
 * **要先在 Supabase 後台開「Allow manual linking」**（Authentication → Sign In / Up，
 * 預設是關的），否則這支會失敗。
 *
 * 失敗的情況：那個 LINE 帳號已經綁在別人身上。錯誤是在轉回來的網址上
 * （`?error_description=…`），不是這支的回傳值——由 MemberPortal 在載入時讀出來顯示。
 */
export const linkLineAccount = async (): Promise<string> => {
  try {
    const { error } = await supabase.auth.linkIdentity({
      provider: LINE_PROVIDER as never,
      options: { redirectTo: redirectTarget() },
    });
    if (!error) return '';
    return /manual linking/i.test(error.message)
      ? 'LINE 綁定功能尚未開放，請與廟方聯繫。'
      : '綁定失敗，請稍後再試。';
  } catch {
    return '綁定失敗，請檢查網路後再試。';
  }
};

/** 這個帳號綁了 LINE 沒有。讀不到就當作沒綁——這只影響要顯示哪一段文字，不影響安全 */
export const hasLineIdentity = async (): Promise<boolean> => {
  try {
    const { data } = await supabase.auth.getUserIdentities();
    return (data?.identities ?? []).some(i => i.provider === LINE_PROVIDER);
  } catch { return false; }
};

/**
 * 快照取自 `attribution.ts` 的 `ENTRY_URL`，**不要改成在這裡抓**：
 * 這個模組是被懶載入的會員中心帶進來的，那時 supabase-js 早就把 OAuth 的
 * 回呼參數（含 `error_description`）從網址上清掉了。第一版就是栽在這裡。
 */
let authErrorTaken = false;

/**
 * 轉回來的網址上帶的錯誤訊息，只回傳一次。
 * 讀的是上面那份快照，不是當下的網址（理由見 ENTRY_URL）。
 * 若參數還在當下的網址上就順手清掉——留著重新整理會一直跳同一個錯。
 */
export const takeAuthErrorFromUrl = (): string => {
  if (typeof window === 'undefined' || authErrorTaken) return '';
  authErrorTaken = true;
  let raw = '';
  try {
    const u = new URL(ENTRY_URL);
    const q = u.searchParams;
    const h = new URLSearchParams(u.hash.replace(/^#/, ''));
    raw = q.get('error_description') || h.get('error_description') || '';
  } catch { return ''; }
  if (!raw) return '';

  // 參數若還在（supabase-js 還沒清或沒接手）就自己清掉
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (q.has('error_description') || h.has('error_description')) {
    for (const k of ['error', 'error_code', 'error_description']) { q.delete(k); h.delete(k); }
    const qs = q.toString();
    const hs = h.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + (hs ? `#${hs}` : ''));
  }

  // Supabase 回的是英文，長輩看不懂；最常見的那一種翻成白話，其餘照原文（至少工作人員查得出來）
  return /already.*linked|identity.*exist/i.test(raw)
    ? '這個 LINE 帳號已經綁在另一個會員上了，請改用那個帳號登入，或與廟方聯繫。'
    : `綁定未完成：${raw.slice(0, 120)}`;
};
