export type SectionKey =
  | "s01_identification" | "s02_hazards" | "s03_composition" | "s04_first_aid"
  | "s05_firefighting"  | "s06_release" | "s07_handling_storage"
  | "s08_exposure_ppe"  | "s09_physchem"| "s10_stability"
  | "s11_toxicology"    | "s12_ecology" | "s13_disposal"
  | "s14_transport"     | "s15_regulatory"| "s16_other";

export const SECTION_ORDER: SectionKey[] = [
  "s01_identification","s02_hazards","s03_composition","s04_first_aid",
  "s05_firefighting","s06_release","s07_handling_storage","s08_exposure_ppe",
  "s09_physchem","s10_stability","s11_toxicology","s12_ecology","s13_disposal",
  "s14_transport","s15_regulatory","s16_other"
];

export interface MsdsSection {
  number: number;
  title: string;     // canonical "Section N — …"
  text: string;      // cleaned narrative
  fields?: Record<string, any>;
  raw?: string;      // original block for audit
  confidence?: number; // 0..1
}

export interface MsdsDoc {
  meta: {
    productName?: string;
    cas?: string;
    supplier?: string;
    sourceFile: string;
    generatedAtISO: string;
  };
  sections: Record<SectionKey, MsdsSection>;
}
