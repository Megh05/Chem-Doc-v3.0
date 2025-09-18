// src/msds/sections.ts
export type MsdsSection = { number: number; title: string; content: string };

const HEADER_RX = /^#{1,6}\s*(?:Section\s*)?(\d{1,2})\s*[-\.:)]\s*(.*)$/gmi;

export function splitSectionsByNumber(text: string): MsdsSection[] {
  if (!text) return [];
  const hits: Array<{num:number; title:string; start:number; end:number}> = [];
  let m: RegExpExecArray | null;

  while ((m = HEADER_RX.exec(text))) {
    const num = parseInt(m[1], 10);
    if (!Number.isNaN(num)) {
      hits.push({ num, title: (m[2] || '').trim(), start: m.index, end: HEADER_RX.lastIndex });
    }
  }
  if (!hits.length) return [];

  hits.sort((a, b) => a.start - b.start);
  const out: MsdsSection[] = [];
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const next = hits[i + 1];
    const raw = text.slice(h.end, next ? next.start : text.length).trim();
    if (raw) out.push({ number: h.num, title: h.title, content: raw });
  }
  const within16 = out.filter(s => s.number >= 1 && s.number <= 16);
  return within16.length ? within16 : out;
}
