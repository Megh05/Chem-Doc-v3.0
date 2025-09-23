// src/msds/sections.ts
export type MsdsSection = { number: number; title: string; content: string };

const HEADER_RX = /^#{1,6}\s*(?:Section\s*)?(\d{1,2})\s*[-\.:)]\s*(.*)$/gmi;

/**
 * Flexible section mapping using pattern matching
 * Maps detected titles to canonical section names using regex patterns
 */
const sectionMappings: Record<string, RegExp[]> = {
  "Identification of the material and supplier": [
    /identification/i, 
    /product identification/i,
    /material identification/i,
    /supplier/i
  ],
  "Hazards identification": [
    /hazards?/i, 
    /hazard identification/i,
    /classification/i,
    /danger/i,
    /warning/i
  ],
  "Composition/information on ingredients": [
    /composition/i,
    /ingredients/i,
    /constituents/i,
    /substances/i,
    /chemical composition/i
  ],
  "First-aid measures": [
    /first[- ]?aid/i, 
    /emergency/i,
    /medical/i,
    /treatment/i
  ],
  "Firefighting measures": [
    /fire[- ]?fighting/i,
    /fire[- ]?fighting/i,
    /extinguishing/i,
    /fire safety/i,
    /combustion/i
  ],
  "Accidental release measures": [
    /accidental release/i,
    /spill/i,
    /leak/i,
    /emergency procedures/i,
    /containment/i
  ],
  "Handling and storage": [
    /handling/i, 
    /storage/i,
    /precautions/i,
    /safe handling/i
  ],
  "Exposure controls/personal protection": [
    /exposure controls/i,
    /personal protection/i,
    /ppe/i,
    /respiratory protection/i,
    /protective equipment/i
  ],
  "Physical and chemical properties": [
    /physical/i,
    /chemical properties/i,
    /appearance/i,
    /odor/i,
    /melting point/i,
    /boiling point/i
  ],
  "Stability and reactivity": [
    /stability/i,
    /reactivity/i,
    /incompatible/i,
    /reactive/i,
    /hazardous reactions/i
  ],
  "Toxicological information": [
    /toxicological/i,
    /toxicity/i,
    /health effects/i,
    /acute effects/i,
    /chronic effects/i
  ],
  "Ecological information": [
    /ecological/i,
    /environmental/i,
    /ecotoxicity/i,
    /bioaccumulation/i,
    /persistence/i
  ],
  "Disposal considerations": [
    /disposal/i,
    /waste/i,
    /recycling/i,
    /treatment/i
  ],
  "Transport information": [
    /transport/i,
    /shipping/i,
    /un number/i,
    /dangerous goods/i,
    /hazard class/i
  ],
  "Regulatory information": [
    /regulatory/i,
    /regulations/i,
    /legislation/i,
    /compliance/i,
    /standards/i
  ],
  "Other information": [
    /other/i,
    /additional/i,
    /miscellaneous/i,
    /notes/i
  ]
};

/**
 * Normalize section title using flexible pattern matching
 */
export function normalizeSectionTitle(title: string): string {
  const cleanTitle = title.trim();
  
  for (const [canonical, patterns] of Object.entries(sectionMappings)) {
    if (patterns.some(p => p.test(cleanTitle))) {
      return canonical;
    }
  }
  
  return cleanTitle; // fallback if no match
}

/**
 * Normalize section to canonical form using flexible matching
 */
export function normalizeSection(s: MsdsSection): MsdsSection {
  const normTitle = normalizeSectionTitle(s.title);
  return { ...s, title: normTitle };
}

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
  const result = within16.length ? within16 : out;
  
  // Normalize all section titles to canonical form
  return result.map(normalizeSection);
}
