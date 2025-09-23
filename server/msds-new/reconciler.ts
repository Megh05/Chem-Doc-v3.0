import { MsdsSection } from "./msds-types";

function chooseBest(a: any, b: any) {
  if (!a && b) return b;
  if (a && !b) return a;
  if (!a && !b) return "";
  return String(b).length >= String(a).length ? b : a; // prefer richer
}

export function reconcileSections(det: MsdsSection, llm: MsdsSection): MsdsSection {
  const fields: Record<string, any> = {};
  const a = det.fields || {}, b = llm.fields || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) fields[k] = chooseBest(a[k], b[k]);

  const text = (det.text || "").trim() || (llm.text || "").trim();
  let confidence = 0.5;
  if (Object.keys(a).length) confidence += 0.15;
  if (Object.keys(b).length) confidence += 0.25;
  if ((det.text || "").length > 40) confidence += 0.05;
  if ((llm.text || "").length > 40) confidence += 0.05;
  confidence = Math.min(1, confidence);

  return { ...det, fields, text, confidence };
}
