/**
 * 隱私權政策的內文。
 *
 * **只有這一份。** 它同時給兩個地方用：首頁頁尾點開的彈出視窗，
 * 以及獨立網址 `/privacy`。
 * 會需要獨立網址是因為 LINE Developers 要把 Login channel 從 Developing
 * 切成 Published 時，必須填一個隱私權政策的網址——彈出視窗沒有網址可填
 * （廟方 2026-10-13）。順帶也讓搜尋引擎與其他平台指得到。
 *
 * 地址電話開放時間一律由呼叫端傳進來（來自 site_settings，後台可改），
 * 不要在這裡再寫死一份——那三項曾經散在六處各寫一份，改一次要記得六個都動。
 */
import React from 'react';
import { SiteInfo } from '../types';

const PrivacyContent: React.FC<{ siteInfo: SiteInfo }> = ({ siteInfo }) => (
  <>
            <p className="text-gray-500 text-xs">最後更新：{new Date().getFullYear()} 年</p>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">一、</span>總則</h3>
              <p>台北古亭和聖壇（以下簡稱「本宮」）重視您的個人資料保護。本政策說明本宮在您使用本網站各項服務（包括點燈登記、祈福報名、捐獻護持、問事預約等）時，如何收集、使用及保護您的個人資料，適用範圍以本網站為限。</p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">二、</span>收集的個人資料</h3>
              <p className="mb-2">本宮僅在您主動填寫表單時收集以下資料：</p>
              <ul className="space-y-1 pl-4">
                {['姓名', '出生年月日及生肖', '現居地址', '聯絡電話', '電子郵件（會員帳號）', '捐款金額及護持類別', '問事希望日期與時段', '備註（含匯款帳號後五碼）'].map(item => (
                  <li key={item} className="flex items-start gap-2"><span className="text-temple-gold mt-1">•</span>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">三、</span>資料使用目的</h3>
              <p className="mb-2">所蒐集之個人資料，僅用於以下目的：</p>
              <ul className="space-y-1 pl-4">
                {[
                  '辦理點燈、祈福、捐獻、問事等服務之登記與確認',
                  '廟方人員與您聯繫服務細節（電話或其他方式）',
                  '核對匯款紀錄',
                  '寄送活動通知（需您同意）',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2"><span className="text-temple-gold mt-1">•</span>{item}</li>
                ))}
              </ul>
              <p className="mt-2 text-gray-500">本宮不會將您的個人資料出售、出租或以任何形式提供予第三方，法律要求除外。</p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">四、</span>資料保存與安全</h3>
              <p>個人資料儲存於受存取控制保護的雲端資料庫，本宮採取合理的技術措施防止未授權存取、洩漏或竄改。資料保存期限以服務完成後一年為原則，或依法令規定辦理。</p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">五、</span>您的權利</h3>
              <p>依據個人資料保護法，您得向本宮提出以下請求：查詢、閱覽、製給複製本、補充或更正、停止蒐集/處理/利用、刪除。如需行使上述權利，請透過下方聯絡資訊與本宮聯繫。</p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">六、</span>Cookie 使用</h3>
              <p>本網站使用瀏覽器本機儲存（localStorage）保存會員登入狀態，不使用追蹤型 Cookie，不與第三方廣告平台共享資料。</p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">七、</span>政策修訂</h3>
              <p>本政策如有修訂，將公告於本網站，修訂後繼續使用本網站即視為同意修訂後的內容。</p>
            </div>

            <div className="bg-temple-bg rounded-xl p-4">
              <h3 className="font-bold text-gray-800 mb-2">聯絡資訊</h3>
              <p>台北古亭和聖壇　｜　{siteInfo.address}</p>
              <p>電話：{siteInfo.phone}　｜　開放時間：每日 {siteInfo.hoursOpen} – {siteInfo.hoursClose}</p>
            </div>
  </>
);

export default PrivacyContent;
