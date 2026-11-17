import React, { useState } from 'react';
import { Flame, ChevronDown, ChevronUp, ArrowDown } from 'lucide-react';
import PosterImage, { POSTER_LIST_MAX_H } from './PosterImage';
import type { LampServiceConfig } from '../types';

/**
 * 太歲點燈頁的燈種卡片（2026-11-17 廟方：「因為每個燈說明長度不同，幫我設計好看一點」）。
 *
 * ── 問題在哪 ──
 * 廟方在後台打的說明是一整篇（85～201 字），**而且是有結構的**：
 * 第一行是一句對仗的標語（「一燈照破前途暗，心定路明步步穩」），
 * 空行分段，段落裡照 LINE 貼文的習慣一行一句。
 * 原本整篇不換行、置中地塞進一張 220px 寬的卡片，四張卡的高度差到兩倍，
 * 而且結構全沒了，讀起來是一團字。
 *
 * ── 怎麼排 ──
 * 1. **標語抽出來**，放在燈名底下用襯線金褐色——它本來就是這盞燈的一句話介紹。
 * 2. **內文照原本的換行與分段排**、靠左（中文長段落置中很難讀）；
 *    只有一行的段落（「一燈聚財氣，一念納福緣。」）是廟方寫的對句，給它跟標語同一個語氣。
 * 3. **內文收合成同一個高度**（`COLLAPSED`），四張卡因此一樣高、價錢與按鈕對齊在同一條線上；
 *    「看完整說明」就地展開。**收起來的字仍整段在 DOM 裡**，只用 max-height 遮住——
 *    那是給 Google 與 AI 檢索器讀的內容（同經文頁註解收合的原則），不可以改成條件式渲染。
 * 4. **每張卡底部一顆「選這盞燈登記」**：把下面表單第一位燈主的燈別預先選好、捲到表單。
 *    看完說明就要往下找表單、再從下拉裡把同一盞燈挑一次，是多出來的兩步。
 *
 * 不自己加內容、不猜語意：認不出結構的說明（只有一行、沒有空行）就照原樣當一段排。
 */

/** 收合時內文的高度。約 6 行 14px 字，四張卡裡最短的那篇（光明燈）展開也差不多這麼長 */
const COLLAPSED = 'max-h-[9.5rem]';

/** 標語＝第一個段落只有一行而且夠短。太長就不是標語，是內文第一句 */
const splitDescription = (text: string): { tagline: string; paras: string[] } => {
  const paras = (text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const first = (text || '').trim().split('\n')[0]?.trim() ?? '';
  if (first && first.length <= 24) {
    // 標語可能跟第一段黏在一起（太歲燈那篇標語下面沒有空行），只拿掉那一行
    const rest = paras[0].split('\n').slice(1).join('\n').trim();
    return { tagline: first, paras: rest ? [rest, ...paras.slice(1)] : paras.slice(1) };
  }
  return { tagline: '', paras };
};

interface Props {
  cfg: LampServiceConfig;
  onPoster: (url: string) => void;
  onPick: (serviceId: string) => void;
}

const LampCard: React.FC<Props> = ({ cfg, onPoster, onPick }) => {
  const [open, setOpen] = useState(false);
  const { tagline, paras } = splitDescription(cfg.description);
  const bodyLen = paras.join('').length;
  const lineCount = paras.reduce((n, p) => n + p.split('\n').length, 0) + paras.length - 1;
  // 短到收起來也放得下的就不給開關，免得按下去什麼都沒變
  const collapsible = bodyLen > 70 || lineCount > 5;
  const bodyId = `lamp-desc-${cfg.id}`;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl transition-shadow duration-300">
      {cfg.imageUrl && (
        /* 點開看原圖：圖上的小字在卡片尺寸讀不到（同祈福活動） */
        <button
          type="button"
          onClick={() => onPoster(cfg.imageUrl!)}
          aria-label={`看 ${cfg.name} 的圖片大圖`}
          className="tap block w-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-temple-red/40"
        >
          <PosterImage src={cfg.imageUrl} maxH={POSTER_LIST_MAX_H} className="hover:opacity-95 transition-opacity" />
        </button>
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* 燈名與標語：置中，這兩行是「招牌」。底下的內文才靠左 */}
        <div className="text-center">
          {!cfg.imageUrl && (
            <div className="w-12 h-12 bg-temple-red/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Flame className="w-6 h-6 text-temple-red" aria-hidden="true" />
            </div>
          )}
          <h4 className="text-xl font-bold text-temple-dark font-serif">{cfg.name}</h4>
          {tagline && (
            /* 標語是對仗的兩句，**只在逗號處換行**：自然折行會切成「心定路明／步步穩」，
               對句就斷在半句上。每一句 nowrap，寬度夠時兩句自然排在同一行 */
            <p className="mt-1.5 text-sm font-serif font-semibold text-temple-red leading-relaxed">
              {tagline.split(/(?<=[，,、；])/).map((part, i) => (
                <span key={i} className="inline-block whitespace-nowrap">{part}</span>
              ))}
            </p>
          )}
          <div className="flex items-center justify-center gap-2 my-3" aria-hidden="true">
            <span className="w-8 h-px bg-temple-gold/70" />
            <span className="w-1.5 h-1.5 rotate-45 bg-temple-gold inline-block" />
            <span className="w-8 h-px bg-temple-gold/70" />
          </div>
        </div>

        {paras.length > 0 && (
          <div className="flex-1">
            <div className="relative">
              <div
                id={bodyId}
                className={`space-y-2.5 text-sm text-gray-600 leading-relaxed overflow-hidden transition-[max-height] duration-300 ${
                  collapsible && !open ? COLLAPSED : 'max-h-[200rem]'}`}
              >
                {paras.map((p, i) => {
                  const lines = p.split('\n');
                  // 單獨一行的短段落是廟方寫的對句，跟標語同一個語氣
                  const couplet = lines.length === 1 && p.length <= 16;
                  return (
                    <p key={i} className={couplet ? 'font-serif text-temple-red text-center' : ''}>
                      {lines.map((l, j) => (
                        <React.Fragment key={j}>{j > 0 && <br />}{l}</React.Fragment>
                      ))}
                    </p>
                  );
                })}
              </div>
              {/* 收起來時底部淡出，看得出「下面還有」，不是被硬切一刀 */}
              {collapsible && !open && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
              )}
            </div>
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-controls={bodyId}
                className="mt-2 inline-flex items-center gap-1 py-1 text-sm font-medium text-temple-red hover:underline"
              >
                {open ? <>收起說明<ChevronUp className="w-4 h-4" aria-hidden="true" /></> : <>看完整說明<ChevronDown className="w-4 h-4" aria-hidden="true" /></>}
              </button>
            )}
          </div>
        )}

        {/* 價錢與登記鈕釘在卡片底部：同一排的卡一樣高，這一條就對齊在同一條線上 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-center">
            <span className="text-2xl font-bold text-temple-red">NT$ {cfg.fee.toLocaleString()}</span>
            <span className="text-gray-400 text-sm ml-1">/ 年</span>
          </p>
          <button
            type="button"
            onClick={() => onPick(cfg.id)}
            className="tap mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-temple-red text-white text-sm font-semibold hover:bg-[#5C4310] transition-colors"
          >
            選這盞燈登記
            <ArrowDown className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LampCard;
