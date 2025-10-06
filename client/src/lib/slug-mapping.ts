// Client-side slug mapping for MSDS sections
// Converts section titles to slugs for template placeholder matching

const simplify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s*section\s*/g, " ")
    .replace(/[^a-z0-9/ &-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TITLE_TO_SLUG: Record<string, string> = {
  "1 identification": "sec_01_identification",
  "section 1 identification": "sec_01_identification",
  "identification": "sec_01_identification",
  "identification of the material and supplier": "sec_01_identification",

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
  "firefighting measures": "sec_05_fire_fighting",

  "6 accidental release": "sec_06_accidental_release",
  "accidental release measures": "sec_06_accidental_release",

  "7 handling and storage": "sec_07_handling_storage",
  "handling & storage": "sec_07_handling_storage",
  "handling and storage": "sec_07_handling_storage",

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

export function titleToSlug(rawTitle: string): string | null {
  const key = simplify(rawTitle);
  if (TITLE_TO_SLUG[key]) return TITLE_TO_SLUG[key];

  const m = key.match(/^(\d{1,2})\s+(.+)$/);
  if (m) {
    switch (m[1]) {
      case "1":
        return "sec_01_identification";
      case "2":
        return "sec_02_hazards";
      case "3":
        return "sec_03_composition";
      case "4":
        return "sec_04_first_aid";
      case "5":
        return "sec_05_fire_fighting";
      case "6":
        return "sec_06_accidental_release";
      case "7":
        return "sec_07_handling_storage";
      case "8":
        return "sec_08_exposure_ppe";
      case "9":
        return "sec_09_physical_chemical";
      case "10":
        return "sec_10_stability_reactivity";
      case "11":
        return "sec_11_toxicology";
      case "12":
        return "sec_12_ecology";
      case "13":
        return "sec_13_disposal";
      case "14":
        return "sec_14_transport";
      case "15":
        return "sec_15_regulatory";
      case "16":
        return "sec_16_other";
      default:
        return null;
    }
  }
  return null;
}

export function convertExtractedDataToSlugs(extractedData: Record<string, any>): Record<string, any> {
  const sluggedData: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(extractedData)) {
    const slug = titleToSlug(key);
    if (slug) {
      sluggedData[slug] = value;
    }
    sluggedData[key] = value;
  }
  
  return sluggedData;
}
