/**
 * 感謝狀（2026-11-27 廟方：感謝狀要能在後台預覽、列印紙本、也能發電子版給信眾，
 * 而且「感謝狀編號要填好才能發送」；法會、點燈、祈福、捐獻四種都要）。
 *
 * ── 一份版面三種用途 ──
 * 後台預覽（screen）、紙本列印（print，portal 到 body）、信眾打開的電子版（page）
 * 都是這一支畫的。三處各畫一份遲早長得不一樣，而信眾手上的電子版與廟方寄出的紙本
 * 不一樣是最難解釋的事。
 *
 * ── 版面 ──
 * A4 直式 210×297mm。古紙底、雙金框、左上龍右上鳳（站上全站的團紋），
 * 編號在右上角、金額同時印國字大寫與阿拉伯數字（同收據的理由：大寫改不了）。
 * 螢幕上依容器寬度等比縮放（`useFit`），版面本身永遠是 mm，列印才會準。
 *
 * ── 沒有印章 ──
 * 刻意不畫假的朱印：紙本由廟方親自用印；電子版畫一個假的印反而像偽造。
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { amountToChinese, rocDateParts } from '../services/receipts';

export interface ThanksCertData {
  /** 感謝狀編號（財務自填，例如 456） */
  no: string;
  /** 受謝人（報名人或捐款人姓名） */
  name: string;
  /** 護持項目，例如「太歲點燈・光明燈」「普渡法會」「遷址護持」 */
  item: string;
  /** 金額（新台幣，0 就不印金額那一行） */
  amount: number;
  /** 日期（ISO）。用收款或發送那一天 */
  date: string;
}

export interface ThanksCertTemple {
  /** 宮廟名稱 */
  name: string;
  /** 感謝詞（沿用收據設定的那一句） */
  thanksText: string;
}

/** 民國日期用國字：「中華民國一一五年十一月二十七日」，感謝狀上比阿拉伯數字莊重 */
const CN = '〇一二三四五六七八九';
const digitsCn = (n: number) => String(n).split('').map(d => CN[Number(d)]).join('');
const tensCn = (n: number) => {
  if (n < 10) return CN[n];
  const t = Math.floor(n / 10), u = n % 10;
  return `${t === 1 ? '' : CN[t]}十${u ? CN[u] : ''}`;
};
export const rocDateCn = (iso: string): string => {
  const d = rocDateParts(iso);
  return `中華民國${digitsCn(d.year)}年${tensCn(d.month)}月${tensCn(d.day)}日`;
};

/** 等比縮放：版面寫死 210mm 寬，螢幕上依容器寬度縮成剛好放得下 */
const useFit = (enabled: boolean) => {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!enabled || !box.current) return;
    const el = box.current;
    const MM = 96 / 25.4;                 // 1mm 在 CSS 是 3.78px
    const fit = () => setScale(Math.min(1, el.clientWidth / (210 * MM)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);
  return { box, scale };
};

const Sheet: React.FC<{ data: ThanksCertData; temple: ThanksCertTemple }> = ({ data, temple }) => (
  <div className="thx-sheet">
    <div className="thx-frame">
      <img className="thx-orn thx-orn-l" src="/pattern-dragon.png" alt="" aria-hidden="true" />
      <img className="thx-orn thx-orn-r" src="/pattern-phoenix.png" alt="" aria-hidden="true" />
      <div className="thx-no">第 <span>{data.no}</span> 號</div>

      <h1 className="thx-title">感　謝　狀</h1>
      <div className="thx-rule" aria-hidden="true"><span /><i /><span /></div>

      <div className="thx-body">
        <p className="thx-line">茲　承</p>
        <p className="thx-name"><span>{data.name}</span>大德</p>
        <p className="thx-line">發心護持本壇「{data.item}」</p>
        {data.amount > 0 && (
          <p className="thx-line thx-amount">
            淨資新臺幣 <b>{amountToChinese(data.amount)}</b>
            <small>（NT${data.amount.toLocaleString()}）</small>
          </p>
        )}
        <p className="thx-line">功德無量，特頒此狀，以表謝忱。</p>
        {temple.thanksText && <p className="thx-quote">{temple.thanksText}</p>}
      </div>

      <div className="thx-foot">
        <p className="thx-temple">{temple.name}　敬謝</p>
        <p className="thx-date">{rocDateCn(data.date)}</p>
      </div>
    </div>
  </div>
);

/** 螢幕上看（後台預覽、信眾的電子版）：依容器寬度縮放 */
export const ThanksCertificateView: React.FC<{ data: ThanksCertData; temple: ThanksCertTemple }> = ({ data, temple }) => {
  const { box, scale } = useFit(true);
  return (
    <div ref={box} className="thx-fit">
      {/* 縮放不改變版面所佔的高度，要自己把高度也乘上去，否則下面會空一大塊 */}
      <div style={{ height: `calc(297mm * ${scale})` }}>
        <div className="thx-root thx-screen" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <Sheet data={data} temple={temple} />
        </div>
      </div>
    </div>
  );
};

/** 列印並把 PDF 預設檔名改成「感謝狀 456 王美玲」（同收據的作法：檔名就是 document.title） */
export const printThanks = (label: string): void => {
  const prev = document.title;
  document.title = `感謝狀 ${label}`;
  const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
};

/**
 * 紙本列印：portal 到 body（同收據：#root 在列印時 display:none，留在裡面會印出一疊空白），
 * 畫完一次就開列印對話框，印完呼叫 onDone 讓呼叫端把它拿掉。
 */
export const ThanksCertificatePrint: React.FC<{
  data: ThanksCertData; temple: ThanksCertTemple; onDone?: () => void;
}> = ({ data, temple, onDone }) => {
  useEffect(() => {
    const t = setTimeout(() => { printThanks(`${data.no} ${data.name}`); onDone?.(); }, 120);
    return () => clearTimeout(t);
  }, [data.no, data.name, onDone]);
  return createPortal(
    <div className="thx-root thx-print"><Sheet data={data} temple={temple} /></div>,
    document.body,
  );
};

export default ThanksCertificateView;
