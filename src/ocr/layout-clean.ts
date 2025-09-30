// src/ocr/layout-clean.ts

export type BBox = { x0: number; y0: number; x1: number; y1: number };
export type OCRWord = { page: number; text: string; bbox: BBox; pageWidth: number; pageHeight: number };
export type OCRLine = { page: number; text: string; bbox: BBox; pageWidth: number; pageHeight: number };

export const HeaderFooterConfig = {
  topBandRatio: 0.12,          // top 12% of page
  bottomBandRatio: 0.12,       // bottom 12% of page
  minRepeatPagesRatio: 0.6,    // repeated on >=60% of pages
  minFingerprintLen: 18,       // ignore tiny fragments
  yMergeToleranceRatio: 0.01,  // 1% of page height for line grouping
  maxBlankCollapse: 3          // collapse >3 newlines -> 2
};

// --- Normalization helpers ---
export function normalizeUnicodeAndPunct(s: string): string {
  let out = s.normalize('NFKC')
    .replace(/[：﹕︰]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[‐-‒–—―]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  return out.replace(/[ \t]+/g, ' ').replace(/[ \t]+\n/g, '\n');
}

export function looksLikeMaterialFact(line: string): boolean {
  return (
    /\bCAS\s*No?\.?\s*\d{2,7}-\d{2}-\d\b/i.test(line) ||
    /\bUN\s*\d{3,5}\b/i.test(line) ||
    /\bpH\b\s*[:=]?\s*\d/i.test(line) ||
    /\d+\s*°\s*C\b/i.test(line) ||
    /\bEINECS\b|\bEC\b\s*\d+/i.test(line)
  );
}

export function fingerprint(text: string): string {
  return text.toLowerCase()
    .replace(/\bhttps?:\/\/\S+/g, '')
    .replace(/\b\S+@\S+\.\w+\b/g, '')
    .replace(/\d+/g, '')               // drop digits (phones, page nos.)
    .replace(/[^\p{L}\p{N} ]+/gu, ' ') // keep letters/numbers/spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Build lines from words (bbox mode) ---
export function clusterWordsToLines(words: OCRWord[]): OCRLine[] {
  const byPage = new Map<number, OCRWord[]>();
  for (const w of words) {
    if (!byPage.has(w.page)) byPage.set(w.page, []);
    byPage.get(w.page)!.push(w);
  }
  const lines: OCRLine[] = [];
  for (const [page, pageWords] of byPage) {
    if (!pageWords.length) continue;
    const h = pageWords[0].pageHeight, w = pageWords[0].pageWidth;
    const yTol = h * HeaderFooterConfig.yMergeToleranceRatio;

    // sort by y then x
    pageWords.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));

    const buckets: OCRWord[][] = [];
    for (const word of pageWords) {
      const last = buckets[buckets.length - 1];
      if (!last) { buckets.push([word]); continue; }
      const lastY = (last[0].bbox.y0 + last[0].bbox.y1) / 2;
      const curY  = (word.bbox.y0 + word.bbox.y1) / 2;
      if (Math.abs(curY - lastY) <= yTol) last.push(word);
      else buckets.push([word]);
    }

    for (const bucket of buckets) {
      bucket.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const text = normalizeUnicodeAndPunct(bucket.map(b => b.text).join(' ').replace(/\s+/g, ' ').trim());
      const x0 = Math.min(...bucket.map(b => b.bbox.x0));
      const y0 = Math.min(...bucket.map(b => b.bbox.y0));
      const x1 = Math.max(...bucket.map(b => b.bbox.x1));
      const y1 = Math.max(...bucket.map(b => b.bbox.y1));
      lines.push({ page, text, bbox: { x0, y0, x1, y1 }, pageWidth: w, pageHeight: h });
    }
  }
  return lines;
}

export function lineCenterY(line: OCRLine): number {
  return (line.bbox.y0 + line.bbox.y1) / 2;
}

export function bandsFor(line: OCRLine) {
  const { pageHeight } = line;
  const topBand = { y0: 0, y1: pageHeight * HeaderFooterConfig.topBandRatio };
  const bottomBand = { y0: pageHeight * (1 - HeaderFooterConfig.bottomBandRatio), y1: pageHeight };
  return { topBand, bottomBand };
}

export function isInBand(line: OCRLine, band: { y0: number; y1: number }): boolean {
  const y = lineCenterY(line);
  return y >= band.y0 && y <= band.y1;
}

export function detectRecurringHeaderFooter(lines: OCRLine[]) {
  const byPage = new Map<number, OCRLine[]>();
  lines.forEach(l => {
    if (!byPage.has(l.page)) byPage.set(l.page, []);
    byPage.get(l.page)!.push(l);
  });

  const pageCount = byPage.size || 1;
  const minRepeat = Math.max(2, Math.ceil(pageCount * HeaderFooterConfig.minRepeatPagesRatio));

  const fpMap = new Map<string, { count: number; pages: Set<number> }>();

  for (const [page, arr] of byPage) {
    for (const l of arr) {
      const { topBand, bottomBand } = bandsFor(l);
      if (!isInBand(l, topBand) && !isInBand(l, bottomBand)) continue;
      const fp = fingerprint(l.text);
      if (fp.length < HeaderFooterConfig.minFingerprintLen) continue;
      if (!fpMap.has(fp)) fpMap.set(fp, { count: 0, pages: new Set() });
      const rec = fpMap.get(fp)!;
      if (!rec.pages.has(page)) { rec.pages.add(page); rec.count++; }
    }
  }

  const recurring = new Set<string>();
  for (const [fp, rec] of fpMap) {
    if (rec.count >= minRepeat) recurring.add(fp);
  }
  return recurring;
}

export function stripRecurringHeaderFooter(lines: OCRLine[]): OCRLine[] {
  const recurring = detectRecurringHeaderFooter(lines);
  if (!recurring.size) return lines;

  return lines.filter(l => {
    const { topBand, bottomBand } = bandsFor(l);
    const inBand = isInBand(l, topBand) || isInBand(l, bottomBand);
    if (!inBand) return true;
    if (looksLikeMaterialFact(l.text)) return true;
    const fp = fingerprint(l.text);
    return !recurring.has(fp);
  });
}

export function linesToText(lines: OCRLine[]): string {
  const byPage = new Map<number, OCRLine[]>();
  for (const l of lines) {
    if (!byPage.has(l.page)) byPage.set(l.page, []);
    byPage.get(l.page)!.push(l);
  }
  const pages = Array.from(byPage.keys()).sort((a, b) => a - b);
  const out: string[] = [];
  for (const p of pages) {
    const arr = byPage.get(p)!.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));
    out.push(arr.map(l => l.text).join('\n'));
  }
  return out.join('\n\n').replace(new RegExp(`\\n{${HeaderFooterConfig.maxBlankCollapse},}`, 'g'), '\n\n').trim();
}

// --- Fallback (no bboxes): strip recurring top/bottom lines by page ---
export function stripRecurringTopBottomByPage(pageTexts: string[], topN = 5, bottomN = 5): string[] {
  const fpCountsTop = new Map<string, number>();
  const fpCountsBottom = new Map<string, number>();
  const pageCount = pageTexts.length || 1;
  const minRepeat = Math.max(2, Math.ceil(pageCount * HeaderFooterConfig.minRepeatPagesRatio));

  const topFPsByPage: string[][] = [];
  const bottomFPsByPage: string[][] = [];

  // collect fingerprints
  for (const pageText of pageTexts) {
    const lines = normalizeUnicodeAndPunct(pageText).split(/\r?\n/).filter(Boolean);
    const top = lines.slice(0, Math.min(topN, lines.length));
    const bottom = lines.slice(Math.max(0, lines.length - bottomN));

    const topFPs = top.map(fingerprint);
    const bottomFPs = bottom.map(fingerprint);
    topFPsByPage.push(topFPs);
    bottomFPsByPage.push(bottomFPs);

    for (const fp of topFPs) fpCountsTop.set(fp, (fpCountsTop.get(fp) || 0) + 1);
    for (const fp of bottomFPs) fpCountsBottom.set(fp, (fpCountsBottom.get(fp) || 0) + 1);
  }

  const dropTop = new Set(Array.from(fpCountsTop.entries()).filter(([fp, c]) => fp && fp.length >= HeaderFooterConfig.minFingerprintLen && c >= minRepeat).map(([fp]) => fp));
  const dropBottom = new Set(Array.from(fpCountsBottom.entries()).filter(([fp, c]) => fp && fp.length >= HeaderFooterConfig.minFingerprintLen && c >= minRepeat).map(([fp]) => fp));

  // rebuild page text without recurring top/bottom lines
  return pageTexts.map((pageText, idx) => {
    const lines = normalizeUnicodeAndPunct(pageText).split(/\r?\n/);
    const keep: string[] = [];
    const topFPs = new Set(topFPsByPage[idx]);
    const bottomFPs = new Set(bottomFPsByPage[idx]);

    lines.forEach((line, i) => {
      const fp = fingerprint(line);
      const isTopCand = i < Math.min(topN, lines.length) && topFPs.has(fp);
      const isBottomCand = i >= Math.max(0, lines.length - bottomN) && bottomFPs.has(fp);
      const recurringTop = isTopCand && dropTop.has(fp);
      const recurringBottom = isBottomCand && dropBottom.has(fp);
      const shouldDrop = (recurringTop || recurringBottom) && !looksLikeMaterialFact(line);
      if (!shouldDrop) keep.push(line);
    });
    return keep.join('\n').replace(new RegExp(`\\n{${HeaderFooterConfig.maxBlankCollapse},}`, 'g'), '\n\n').trim();
  });
}





