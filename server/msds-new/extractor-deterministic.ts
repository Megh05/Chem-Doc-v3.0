import { MsdsSection, SectionKey } from "./msds-types";
import hints from "./section_hints.json";
import { normalizeForMsds } from "./preclean";

function pick(line: string, rx: RegExp) { const m = line.match(rx); return m ? (m[1] || line.replace(rx,'').trim()) : ""; }

export function extractDeterministic(secKey: SectionKey, sec: MsdsSection): Partial<MsdsSection> {
  const text = normalizeForMsds(sec.raw || sec.text || "");
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const fields: Record<string, any> = {};

  switch (secKey) {
    case "s01_identification": {
      for (const L of lines) {
        if (/^(manufacturer|supplier|company)\s*[:：]/i.test(L)) fields.manufacturer = pick(L,/^[^:：]+[:：]\s*/i);
        if (/^(address|add)\s*[:：]/i.test(L)) fields.address = pick(L,/^[^:：]+[:：]\s*/i);
        if (/^(telephone|tel|phone)\s*[:：]/i.test(L)) fields.tel = pick(L,/^[^:：]+[:：]\s*/i);
        if (/^fax\s*[:：]/i.test(L)) fields.fax = pick(L,/^[^:：]+[:：]\s*/i);
        if (/^(e-?mail|email)\s*[:：]/i.test(L)) fields.email = pick(L,/^[^:：]+[:：]\s*/i);
        if (/^emergency.*(phone|tel|number)\s*[:：]/i.test(L)) fields.emergency = pick(L,/^[^:：]+[:：]\s*/i);
      }
      break;
    }
    case "s03_composition": {
      const cas = text.match(/\b\d{2,7}-\d{2}-\d\b/);
      if (cas) fields.cas = cas[0];
      const einecs = text.match(/\b(EC|EINECS)\s*[:：]?\s*(\d{3}-\d{3}-\d)/i);
      if (einecs) fields.einecs = einecs[2] || einecs[0];
      const purity = text.match(/\b(\d{1,3}(?:\.\d+)?\s*%)\b/);
      if (purity) fields.purity = purity[1] || purity[0];
      break;
    }
    case "s09_physchem": {
      const ph = text.match(/\bpH\b\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?\s*[–-]\s*[0-9]+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i);
      if (ph) fields.ph = ph[1].replace('-', '–');
      const app = text.match(/appearance\s*[:：]\s*([^\n]+)/i);
      if (app) fields.appearance = app[1].trim();
      if (/very\s+hygroscopic/i.test(text)) fields.hygroscopicity = "very hygroscopic";
      const sol = text.match(/solubility[^:：]*[:：]\s*([^\n]+)/i) || (/soluble in water/i.test(text) ? ["","soluble in water"] : null);
      if (sol) fields.solubility = sol[1] || "soluble in water";
      break;
    }
    case "s14_transport": {
      fields.notDangerousGoods = /not\s+dangerous\s+goods/i.test(text);
      const un = text.match(/\bUN\s?(\d{3,5})\b/i);
      if (un) fields.un = un[1];
      break;
    }
    default: break;
  }

  const narrative = normalizeForMsds(sec.text || "");
  return { fields, text: narrative };
}
