// keep vendor-agnostic; remove recurring headers/footers; normalize unicode/units

export function normalizeForMsds(s: string): string {
  if (!s) return s;
  let out = s.normalize('NFKC')
    .replace(/[：﹕︰]/g, ':').replace(/[，]/g, ',')
    .replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/[‐–—―]/g, '-').replace(/\u00A0/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ')
    .replace(/℃/g, '°C').replace(/[~～〜﹏]/g, '–')
    .replace(/\^\{\s*\}/g, '').replace(/\$+\s*([^$]+?)\s*\$+/g, '$1')
    .replace(/([A-Za-z])_+\{?(\d+)\}?/g, '$1$2')
    .replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

function _fp(line: string) {
  return line.toLowerCase()
    .replace(/\bhttps?:\/\/\S+/g,'').replace(/\b\S+@\S+\.\w+\b/g,'')
    .replace(/\d+/g,'').replace(/[^\w\s]+/g,' ')
    .replace(/\s+/g,' ').trim();
}

function _isFact(line: string) {
  return /\bCAS\s*No?\.?\s*\d{2,7}-\d{2}-\d\b/i.test(line)
      || /\bpH\b\s*[:=]?\s*\d/i.test(line)
      || /\d+\s*°\s*C\b/i.test(line)
      || /\bUN\s*\d{3,5}\b/i.test(line)
      || /\bEINECS\b|\bEC\b\s*\d+/i.test(line);
}

export function removeRecurringHeadersFooters(raw: string, topN=5, bottomN=5): string {
  const norm = normalizeForMsds(raw);
  const chunks = norm.includes('\f') ? norm.split('\f') : norm.split(/\n{4,}/g);
  const pages = chunks.map((c,i)=> c.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));

  const minRepeat = Math.max(2, Math.ceil(pages.length * 0.6));
  const minFpLen = 18;

  const topCounts = new Map<string, number>();
  const botCounts = new Map<string, number>();
  const topFPs: string[][] = [];
  const botFPs: string[][] = [];

  for (const lines of pages) {
    const top = lines.slice(0, Math.min(topN, lines.length)).map(_fp);
    const bot = lines.slice(Math.max(0, lines.length - bottomN)).map(_fp);
    topFPs.push(top); botFPs.push(bot);
    for (const f of top) topCounts.set(f, (topCounts.get(f)||0)+1);
    for (const f of bot) botCounts.set(f, (botCounts.get(f)||0)+1);
  }
  const dropTop = new Set([...topCounts].filter(([f,c])=>f && f.length>=minFpLen && c>=minRepeat).map(([f])=>f));
  const dropBot = new Set([...botCounts].filter(([f,c])=>f && f.length>=minFpLen && c>=minRepeat).map(([f])=>f));

  const firstSeen = new Set<string>();
  const cleanedPages = pages.map((lines, pi) => {
    const L = lines.length, keep: string[] = [];
    const topSet = new Set(topFPs[pi]), botSet = new Set(botFPs[pi]);
    for (let i=0;i<L;i++){
      const line = lines[i], fp = _fp(line);
      const topCand = i < Math.min(5, L) && topSet.has(fp);
      const botCand = i >= Math.max(0, L-5) && botSet.has(fp);
      let drop = false;
      if ((topCand && dropTop.has(fp)) || (botCand && dropBot.has(fp))) {
        if (!_isFact(line)) { if (!firstSeen.has(fp)) firstSeen.add(fp); else drop = true; }
      }
      if (!drop) keep.push(line);
    }
    return keep.join('\n').trim();
  });

  return cleanedPages.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
}
