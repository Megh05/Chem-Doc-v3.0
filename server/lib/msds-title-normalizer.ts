import { TITLE_TO_SLUG, type SectionSlug } from "./msds-slug-map";

const simplify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s*section\s*/g, " ")
    .replace(/[^a-z0-9/ &-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function titleToSlug(rawTitle: string): SectionSlug | null {
  const key = simplify(rawTitle);
  console.log(`[titleToSlug] Raw: "${rawTitle}" → Simplified: "${key}"`);
  
  if (TITLE_TO_SLUG[key]) {
    console.log(`[titleToSlug] Found in map: ${TITLE_TO_SLUG[key]}`);
    return TITLE_TO_SLUG[key];
  }

  const m = key.match(/^(\d{1,2})\s+(.+)$/);
  if (m) {
    console.log(`[titleToSlug] Pattern matched: number="${m[1]}", rest="${m[2]}"`);
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
        console.log(`[titleToSlug] No case match for number: ${m[1]}`);
        return null;
    }
  }
  console.log(`[titleToSlug] No match found for: "${rawTitle}"`);
  return null;
}



