import { SECTION_SLUGS, type SectionSlug } from "./msds-slug-map";
import { titleToSlug } from "./msds-title-normalizer";

/**
 * Creates a mapping from normalized section slugs to template placeholder names
 * This enables intelligent mapping between OCR-extracted data and template fields
 */
export function createSlugToPlaceholderMapping(
  templatePlaceholders: string[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Try to match each template placeholder to a normalized slug
  templatePlaceholders.forEach((placeholder) => {
    // Normalize the placeholder to a slug
    const slugFromPlaceholder = titleToSlug(placeholder);
    
    // Find the best matching SECTION_SLUG
    const matchedSlug = SECTION_SLUGS.find(slug => slug === slugFromPlaceholder);
    
    if (matchedSlug) {
      // Direct match found
      mapping[matchedSlug] = placeholder;
    } else {
      // Try fuzzy matching by checking if any slug is contained in the placeholder
      const fuzzyMatch = SECTION_SLUGS.find(slug => {
        const slugKeywords = slug.split('_').filter(k => k.length > 3);
        const placeholderLower = placeholder.toLowerCase();
        return slugKeywords.some(keyword => placeholderLower.includes(keyword));
      });
      
      if (fuzzyMatch) {
        mapping[fuzzyMatch] = placeholder;
      }
    }
  });
  
  console.log('📊 Created slug-to-placeholder mapping:', mapping);
  return mapping;
}

/**
 * Remaps data from normalized slugs to template placeholders
 */
export function remapDataUsingSlugMapping(
  normalizedData: Record<string, string>,
  slugMapping: Record<string, string>
): Record<string, string> {
  const remappedData: Record<string, string> = {};
  
  // Iterate through the normalized data and remap to template placeholders
  for (const [slug, value] of Object.entries(normalizedData)) {
    const templatePlaceholder = slugMapping[slug];
    if (templatePlaceholder) {
      remappedData[templatePlaceholder] = value;
      console.log(`  ✅ Mapped ${slug} → "${templatePlaceholder}"`);
    } else {
      // If no mapping found, keep the slug as fallback
      remappedData[slug] = value;
      console.log(`  ⚠️  No mapping for ${slug}, using slug as key`);
    }
  }
  
  return remappedData;
}

/**
 * Creates mapping from intelligent field names array (legacy format)
 * Converts position-based array to slug-to-placeholder dictionary
 */
export function createSlugMappingFromFieldArray(
  fieldMapping: string[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Map each SECTION_SLUG by position to corresponding field name
  SECTION_SLUGS.forEach((slug, index) => {
    if (index < fieldMapping.length) {
      mapping[slug] = fieldMapping[index];
    }
  });
  
  console.log('📊 Created slug mapping from field array:', mapping);
  return mapping;
}
