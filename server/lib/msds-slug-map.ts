// Canonical slugs for the 16 MSDS sections.
// Place these in your Word template as {{slug}} under each heading.
// Example: "1. Identification..." → use {{sec_01_identification}}

export const SECTION_SLUGS = [
  "sec_01_identification",
  "sec_02_hazards",
  "sec_03_composition",
  "sec_04_first_aid",
  "sec_05_fire_fighting",
  "sec_06_accidental_release",
  "sec_07_handling_storage",
  "sec_08_exposure_ppe",
  "sec_09_physical_chemical",
  "sec_10_stability_reactivity",
  "sec_11_toxicology",
  "sec_12_ecology",
  "sec_13_disposal",
  "sec_14_transport",
  "sec_15_regulatory",
  "sec_16_other",
] as const;

export type SectionSlug = typeof SECTION_SLUGS[number];

// Map many possible titles → slug (punctuation/case insensitive), used as a fallback.
// Keys here are simplified forms; see title normalizer.
export const TITLE_TO_SLUG: Record<string, SectionSlug> = {
  "1 identification": "sec_01_identification",
  "section 1 identification": "sec_01_identification",
  "identification": "sec_01_identification",

  "2 hazards": "sec_02_hazards",
  "hazards identification": "sec_02_hazards",
  "hazard identification": "sec_02_hazards",

  "3 composition": "sec_03_composition",
  "composition / information on ingredients": "sec_03_composition",
  "composition/information on ingredients": "sec_03_composition",
  "composition information on ingredients": "sec_03_composition",

  "4 first aid": "sec_04_first_aid",
  "first aid measures": "sec_04_first_aid",

  "5 fire fighting": "sec_05_fire_fighting",
  "fire fighting measures": "sec_05_fire_fighting",
  "fire-fighting measures": "sec_05_fire_fighting",

  "6 accidental release": "sec_06_accidental_release",
  "accidental release measures": "sec_06_accidental_release",

  "7 handling and storage": "sec_07_handling_storage",
  "handling & storage": "sec_07_handling_storage",

  "8 exposure controls": "sec_08_exposure_ppe",
  "exposure controls personal protection": "sec_08_exposure_ppe",
  "exposure controls/personal protection": "sec_08_exposure_ppe",
  "exposure controls appropriate engineering controls": "sec_08_exposure_ppe",

  "9 physical and chemical": "sec_09_physical_chemical",
  "physical and chemical properties": "sec_09_physical_chemical",

  "10 stability and reactivity": "sec_10_stability_reactivity",
  "stability and reactivity": "sec_10_stability_reactivity",

  "11 toxicological": "sec_11_toxicology",
  "toxicological information": "sec_11_toxicology",

  "12 ecological": "sec_12_ecology",
  "ecological information": "sec_12_ecology",

  "13 disposal": "sec_13_disposal",
  "disposal considerations": "sec_13_disposal",

  "14 transport": "sec_14_transport",
  "transport information": "sec_14_transport",

  "15 regulatory": "sec_15_regulatory",
  "regulatory information": "sec_15_regulatory",

  "16 other": "sec_16_other",
  "other information": "sec_16_other",
};



