import { SECTION_SLUGS, type SectionSlug } from "./msds-slug-map";
import { titleToSlug } from "./msds-title-normalizer";

export type MsdsSlugMap = Record<SectionSlug, string>;

/**
 * Normalize a 16-key MSDS object with verbose titles → slug → content.
 * Unknown titles are ignored with a console warning.
 * Ensures all 16 slugs exist (missing become empty strings).
 */
export function normalizeMsdsSections(structured: Record<string, string>): MsdsSlugMap {
  const out: Partial<MsdsSlugMap> = {};
  for (const [title, content] of Object.entries(structured || {})) {
    const slug = titleToSlug(title);
    if (!slug) {
      console.warn(`[MSDS] Unmapped section title: ${JSON.stringify(title)}`);
      continue;
    }
    out[slug] = (out[slug] || "") + (content || "");
  }
  for (const s of SECTION_SLUGS) {
    if (out[s] === undefined) out[s] = "";
  }
  return out as MsdsSlugMap;
}



