/**
 * 公佈欄的公告卡片與內文排版（首頁 #bulletin 與 /bulletins 共用）
 *
 * 2026-10-11 從 App.tsx 抽出來。公佈欄拆成「首頁精選」與「完整清單」兩處之後，
 * 同一張卡要在兩邊長得一模一樣——**留在 App.tsx 再讓另一頁反向 import，
 * 會變成循環相依**（App 懶載入那一頁、那一頁又回頭要 App 的東西）。
 */
import React from 'react';
import { Pin, ChevronDown, ChevronUp } from 'lucide-react';
import { renderInline } from './StoryPage';
import { BulletinRecord } from '../types';
import { TAG_SOLID } from './tagStyles';

/** 置頂與分類標籤。配色取自全站那組，見 components/tagStyles.ts */
export const TAG_PINNED = TAG_SOLID;
export const TAG_CATEGORY = 'bg-temple-gold/15 text-temple-red border border-temple-gold/30';

/**
 * 公佈欄內文的排版。
 *
 * 廟方是照 LINE 貼文的習慣在寫：短句斷行、空行分段，並且自己用符號標出重點
 * （🔸 條列、🗓️💰 標籤、`1、2、3、` 編號）。原本整段丟給 `whitespace-pre-wrap`，
 * 那些結構完全沒被表現出來——一整片等寬等色的灰字，廟方回報「很僵化」。
 *
 * 這裡只做一件事：**把廟方已經寫在文字裡的結構認出來，換成站上的視覺語彙**。
 * 不自己加內容、不猜語意，認不出來的就照原樣當段落排（含他們刻意的斷行）。
 *
 * 順帶解決一個矛盾：全站不用 emoji 是廟方自己訂的慣例，但後台打的內文裡有
 * 🔸🗓️💰。與其要求他們改打字習慣，不如把行首的符號換成站上的金色菱形——
 * 他們照舊打，前台看到的是一致的樣式。
 *
 * 行內標記（**粗體**、[文字](網址)）沿用 StoryPage 那支 `renderInline`，
 * 不另立一套，也維持「永遠不碰 dangerouslySetInnerHTML」的原則。
 */

/** 行首的圖形符號：emoji、項目符號、注意符號。後面的變異選擇子（️）一起吃掉 */
const BULLETIN_MARKER = /^(?:[\p{Extended_Pictographic}•●○・‧※◆▪▸]️?)+\s*/u;
/** `1、` `2.` `3)` 這類編號 */
const BULLETIN_ORDERED = /^(\d{1,2})\s*[、.．)）]\s*/;
/** 短且以冒號結尾的行＝標籤，下一行起是它的值。限制長度才不會把一般句子誤判成標籤 */
const BULLETIN_LABEL = /^.{1,14}[：:]$/;

type BulletinBlock =
  | { kind: 'text'; lines: string[] }
  | { kind: 'items'; items: { label: string; body: string[] }[] }
  | { kind: 'ordered'; items: string[] };

const parseBulletinBody = (body: string): BulletinBlock[] => {
  const blocks: BulletinBlock[] = [];
  let text: string[] = [];
  let items: { label: string; body: string[] }[] = [];
  let ordered: string[] = [];

  const flushText = () => { if (text.length) { blocks.push({ kind: 'text', lines: text }); text = []; } };
  const flushItems = () => { if (items.length) { blocks.push({ kind: 'items', items }); items = []; } };
  const flushOrdered = () => { if (ordered.length) { blocks.push({ kind: 'ordered', items: ordered }); ordered = []; } };
  const flushAll = () => { flushText(); flushItems(); flushOrdered(); };

  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { flushAll(); continue; }           // 空行＝一段結束

    if (BULLETIN_MARKER.test(line)) {              // 符號開頭 → 項目
      flushText(); flushOrdered();
      items.push({ label: line.replace(BULLETIN_MARKER, ''), body: [] });
      continue;
    }
    const num = BULLETIN_ORDERED.exec(line);
    if (num) {                                     // 編號 → 有序清單
      flushText(); flushItems();
      ordered.push(line.slice(num[0].length));
      continue;
    }
    if (BULLETIN_LABEL.test(line)) {               // 短句＋冒號 → 也是項目
      flushText(); flushOrdered();
      items.push({ label: line, body: [] });
      continue;
    }
    // 純文字：若正接在一個「以冒號結尾的項目」下面，當成那一項的值
    const last = items[items.length - 1];
    if (last && /[：:]$/.test(last.label)) { last.body.push(line); continue; }
    flushItems(); flushOrdered();
    text.push(line);
  }
  flushAll();
  return blocks;
};

/** 金色菱形，與全站分隔飾同一個形狀（全站不用 emoji） */
const BulletDiamond: React.FC = () => (
  <span className="w-2 h-2 rotate-45 bg-temple-gold shrink-0 mt-[0.55rem]" aria-hidden="true" />
);

export const BulletinBody: React.FC<{ content: string }> = ({ content }) => {
  const blocks = React.useMemo(() => parseBulletinBody(content), [content]);
  let textSeen = 0;

  return (
    <div className="space-y-5">
      {blocks.map((block, bi) => {
        if (block.kind === 'items') {
          // overflow-hidden 讓清單自成一個 BFC：碰到浮動的圖時會讓開而不是疊上去，
          // 否則金色左框會停在欄位最左邊、文字卻被圖推到右邊
          return (
            <ul key={bi} className="overflow-hidden space-y-2.5 border-l-2 border-temple-gold/30 pl-5 py-0.5">
              {block.items.map((it, i) => (
                <li key={i} className="flex gap-3">
                  <BulletDiamond />
                  <div className="min-w-0">
                    <span className="text-temple-red font-medium">{renderInline(it.label)}</span>
                    {it.body.map((line, j) => (
                      <p key={j} className="text-gray-700 leading-relaxed">{renderInline(line)}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'ordered') {
          return (
            <ol key={bi} className="overflow-hidden space-y-2 pl-1">
              {block.items.map((it, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-serif font-bold text-temple-gold shrink-0 w-5 text-right leading-relaxed">{i + 1}</span>
                  <span className="text-gray-700 leading-relaxed">{renderInline(it)}</span>
                </li>
              ))}
            </ol>
          );
        }
        // 第一段當作前言：字大一點、色深一點，讓整篇有個開頭而不是一片平的灰字
        const lead = textSeen++ === 0;
        return (
          <p
            key={bi}
            className={lead
              ? 'text-temple-dark text-lg leading-loose whitespace-pre-line'
              : 'text-gray-700 leading-loose whitespace-pre-line'}
          >
            {renderInline(block.lines.join('\n'))}
          </p>
        );
      })}
    </div>
  );
};


/**
 * 一張公告卡（收合／展開的手風琴）。首頁精選與 /bulletins 完整清單共用。
 *
 * ── 照片一律依自己的比例顯示，不要塞進固定的框 ──
 * 廟方的海報是直式的，`object-cover` 會從中間裁掉上下（遷址募資那張實測只剩 36%，
 * 標題與 QR code 全不見）。只給上限、長寬交給圖自己：橫式受 max-w 限制、
 * 直式受 max-h 限制。縮圖同理，不要框也不要底色。
 *
 * ── 不做文繞圖，圖在上、文字在下 ──
 * 桌機原本是 `sm:float-right sm:max-w-[40%]`，海報縮在右上角一小塊、文字繞著它排。
 * 廟方 2026-10-11 要求改掉：「直接就把圖在欄位內大大的展開，下面再接文字即可，
 * 這樣比較大氣」。海報本身就是公告的主角（上面印著日期、費用、祈願文），
 * 縮成 40% 等於把主角擠到配角的位置。
 * **這推翻了 2026-09-26 那次「浮右不浮左」的決定**——那一輪比的是「浮左 vs 浮右」，
 * 沒有比過「不浮動」。不要再改回去。
 *
 * **只給上限，不要寫死寬度。** `w-full` ＋ `max-h` 會把直式海報壓扁：寬度被釘成
 * 欄寬、高度又被上限夾住，比例就沒了（實測 854×1280 的遷址海報變成 780×576）。
 * 正解是 `max-w-full max-h-[36rem]` 搭 `w-auto h-auto`——寬高都是 auto 時瀏覽器
 * 才會自己維持長寬比：橫式海報受寬度上限、填滿整欄（這就是「大大的展開」），
 * 直式受高度上限、寬度依比例縮並置中。這與公佈欄、神明管理那幾處是同一條規則。
 */
export const BulletinCard: React.FC<{
  bulletin: BulletinRecord;
  open: boolean;
  onToggle: () => void;
  /** 「前往○○登記」要去哪。首頁是捲到區塊、獨立頁是換頁，所以交給呼叫端決定 */
  onService: (service: NonNullable<BulletinRecord['linkedService']>) => void;
}> = ({ bulletin, open, onToggle, onService }) => (
  <div
    className={`bg-temple-bg rounded-xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 ${
      bulletin.isPinned ? 'border-temple-gold' : 'border-temple-red/30'
    }`}
  >
    <button
      type="button"
      aria-expanded={open}
      aria-controls={`bulletin-${bulletin.id}`}
      className="w-full flex items-start justify-between text-left cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {bulletin.isPinned && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${TAG_PINNED}`}>
              <Pin className="w-3 h-3" aria-hidden="true" /> 置頂
            </span>
          )}
          <span className={`px-3 py-0.5 rounded-full text-xs font-medium ${TAG_CATEGORY}`}>
            {bulletin.category}
          </span>
          <span className="text-gray-400 text-sm">
            {new Date(bulletin.createdAt).toLocaleDateString('zh-TW')}
          </span>
        </div>
        <h4 className="text-lg font-bold text-temple-dark font-serif">{bulletin.title}</h4>
      </div>
      {/* 收合時右側放小縮圖，讓有照片的活動一眼看得出來；沒照片就只有箭頭 */}
      <div className="ml-4 flex items-center gap-3 flex-shrink-0">
        {bulletin.imageUrl && !open && (
          <img src={bulletin.imageUrl} alt="" loading="lazy" className="max-h-12 max-w-16 w-auto h-auto rounded-lg" />
        )}
        <div className="text-gray-400">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>
    </button>

    {open && (
      <div id={`bulletin-${bulletin.id}`} className="mt-4 pt-4 border-t border-gray-200">
        {bulletin.imageUrl && (
          <img
            src={bulletin.imageUrl}
            alt={bulletin.title}
            // 展開的大圖不要 lazy：它只在使用者點開那一則時才渲染，
            // 那一刻它必然要被看到，延後載入只是讓人盯著一塊空白等
            className="block mx-auto mb-5 w-auto h-auto max-w-full max-h-[36rem] rounded-xl border border-temple-gold/20"
          />
        )}
        <BulletinBody content={bulletin.content} />
        {bulletin.linkedService && (
          <button
            onClick={e => { e.stopPropagation(); onService(bulletin.linkedService!); }}
            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-temple-red text-white rounded-lg font-medium hover:bg-[#5C1A04] transition-colors shadow-sm"
          >
            前往{SERVICE_LABEL[bulletin.linkedService] ?? ''}登記 →
          </button>
        )}
      </div>
    )}
  </div>
);

const SERVICE_LABEL: Record<string, string> = {
  lamp: '點燈', blessing: '祈福', booking: '問事', donation: '捐獻',
};
