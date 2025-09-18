// src/msds/cleanup.ts
export function removeRepeatedFooters(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);

  const keywordRxs = [
    /(电话|Tel)[：: ]/i,
    /(传真|Fax)[：: ]/i,
    /(邮箱|Email)[：: ]/i,
    /(地址|Add(?:ress)?)[：: ]/i,
    /(网址|Web)[：: ]/i,
    /focusfreda\.com/i,
    /Shandong\s+Focusfreda\s+Biotech\s+Co\.\s*Ltd/i
  ];

  const counts = keywordRxs.map(rx => lines.filter(l => rx.test(l)).length);
  const removalRxs = keywordRxs.filter((rx, idx) => counts[idx] >= 2);

  return lines.filter(l => !removalRxs.some(rx => rx.test(l))).join('\n');
}

export function normalizeNoData(text: string): string {
  return text.replace(/\b(?:not\s+available|no\s+data\s+available)\b\.?/gi, 'No data available');
}

export function normalizeEOL(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '');
}
