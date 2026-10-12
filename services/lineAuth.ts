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
 * 3. Supabase → Authentication → 自訂供應商，型別 OAuth2，slug 填 `line`
 *    （要與下面的 LINE_PROVIDER 一致），端點：
 *      authorize https://access.line.me/oauth2/v2.1/authorize
 *      token     https://api.line.me/oauth2/v2.1/token
 *      userinfo  https://api.line.me/oauth2/v2.1/userinfo
 *    並允許「沒有 email 的使用者」。
 * 4. 設定完成後把下面的 ENABLE_LINE_LOGIN 改成 true 再部署。
 */
import { supabase } from './supabase';

/**
 * 設定完成前先關著。
 *
 * **這個旗標是唯一的防線，不是保險**（2026-10-13 實測）：供應商還沒建好時，
 * `signInWithOAuth` **不會回傳錯誤**——它直接把瀏覽器轉去 Supabase，由 Supabase 回一頁
 * 生 JSON（`{"code":400,...,"msg":"Unsupported provider: Provider line could not be found"}`）。
 * 下面那段錯誤處理在這個情況完全不會執行，信眾會整個離開網站落在一頁英文 JSON 上。
 * 所以 Supabase 那邊確認可以登入之前，這裡一定要維持 false。
 */
export const ENABLE_LINE_LOGIN = false;

/** 要與 Supabase 後台自訂供應商的 slug 一字不差，不一致會回 Unsupported provider */
export const LINE_PROVIDER = 'line';

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
