/**
 * 信眾打開的電子感謝狀：https://heshengtan.tw/thanks/<id>（2026-11-27）。
 *
 * - 內容走 RPC `get_thanks_certificate`，只拿得到這一張、只有感謝狀上印的字
 *   （thanks_certificates.sql）。id 是後台存快照時產生的 UUID，猜不到。
 * - **不給搜尋引擎收錄**（上面有姓名與金額）：頁面加 noindex，robots.txt 也擋 /thanks/。
 * - 「列印／存成 PDF」用瀏覽器的列印，跟後台印紙本是同一份版面。
 * - 不掛整個網站的導覽與頁尾：這是一張狀，不是網站的一頁；底下留一個回官網的連結就夠了。
 */
import React, { useEffect, useState } from 'react';
import { getPublicThanksCertificate, type ThanksCertificateRecord } from '../services/supabase';
import { ThanksCertificateView, ThanksCertificatePrint } from './ThanksCertificate';

const ThanksPublicPage: React.FC<{ id: string }> = ({ id }) => {
  const [cert, setCert] = useState<ThanksCertificateRecord | null | undefined>(undefined);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.title = '感謝狀｜和聖壇';
    getPublicThanksCertificate(id).then(c => {
      setCert(c);
      if (c) document.title = `感謝狀 第 ${c.no} 號｜和聖壇`;
    });
    return () => { meta.remove(); };
  }, [id]);

  const data = cert ? { no: cert.no, name: cert.name, item: cert.item, amount: cert.amount, date: cert.date } : null;
  const temple = cert ? { name: cert.templeName, thanksText: cert.thanksText } : null;

  return (
    <main className="min-h-screen bg-[#EFE4C9] px-3 py-6 sm:py-10">
      <div className="mx-auto max-w-[820px]">
        {cert === undefined && <p className="text-center text-[#8A6634] py-24">感謝狀載入中…</p>}
        {cert === null && (
          <div className="text-center text-[#5C4310] py-24 space-y-3">
            <p className="text-lg font-semibold">找不到這張感謝狀</p>
            <p className="text-sm">連結可能不完整，或已經失效。如有疑問請聯絡和聖壇。</p>
          </div>
        )}
        {data && temple && (
          <>
            <ThanksCertificateView data={data} temple={temple} />
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => setPrinting(true)}
                className="px-5 py-2.5 rounded-lg bg-[#7A2E1E] text-[#F6E3B0] text-sm font-medium hover:bg-[#63150E]">
                列印／存成 PDF
              </button>
            </div>
            {printing && <ThanksCertificatePrint data={data} temple={temple} onDone={() => setPrinting(false)} />}
          </>
        )}
        <p className="mt-8 text-center text-sm">
          <a href="/" className="text-[#8A6634] underline underline-offset-4 hover:text-[#5C4310]">和聖壇官網</a>
        </p>
      </div>
    </main>
  );
};

export default ThanksPublicPage;
