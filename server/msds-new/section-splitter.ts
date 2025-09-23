import { normalizeForMsds } from "./preclean";

export type ParsedSection = { number: number; title: string; content: string };

const CANON = [
  'Identification of the material and supplier',
  'Hazards Identification',
  'Composition / Information on Ingredients',
  'First Aid Measures',
  'Firefighting Measures',
  'Accidental Release Measures',
  'Handling and Storage',
  'Exposure Controls / Personal Protection',
  'Physical and Chemical Properties',
  'Stability and Reactivity',
  'Toxicological Information',
  'Ecological Information',
  'Disposal Considerations',
  'Transport Information',
  'Regulatory Information',
  'Other Information',
];

export function canonicalTitle(num: number) {
  return `Section ${num} — ${CANON[num-1] || `Section ${num}`}`;
}

const HEADER_RX = new RegExp(
  String.raw`^` +
  String.raw`\s*(?:SECTION\s*)?` + // optional "SECTION"
  String.raw`(?<num>\d{1,2})` +
  String.raw`(?:\s*[\-–—:.)]\s*|\s+)` + // delimiter or spaces
  String.raw`(?<title>[^\n]{0,120})?` +
  String.raw`$`, 'gim'
);

export function splitSectionsByNumberV2(raw: string): ParsedSection[] {
  const text = normalizeForMsds(raw)
    .replace(/^\s*(Contd\.?\s*(on|from)\s*page.*|Date of issue.*|Page \d+.*|End of.*SDS.*)$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const matches: Array<{start:number; end:number; num:number;}> = [];
  let m: RegExpExecArray | null;
  while ((m = HEADER_RX.exec(text)) !== null) {
    const num = parseInt(m.groups?.num || '0', 10);
    if (num >= 1 && num <= 16) matches.push({ start: m.index, end: m.index + m[0].length, num });
  }
  if (!matches.length) {
    return [{ number: 1, title: canonicalTitle(1), content: text || "Not available." }];
  }
  matches.sort((a,b)=>a.start-b.start);

  const out: ParsedSection[] = [];
  for (let i=0;i<matches.length;i++){
    const cur = matches[i], next = matches[i+1];
    const block = text.slice(cur.end, next ? next.start : text.length).replace(/^\s+|\s+$/g,'').replace(/\n{3,}/g,'\n\n');
    out.push({ number: cur.num, title: canonicalTitle(cur.num), content: block || "Not available." });
  }
  const have = new Set(out.map(s => s.number));
  for (let n=1;n<=16;n++){ if(!have.has(n)) out.push({ number:n, title: canonicalTitle(n), content:"Not available." }); }
  return out.sort((a,b)=>a.number-b.number);
}
