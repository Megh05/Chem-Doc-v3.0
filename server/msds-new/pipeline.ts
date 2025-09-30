import { MsdsDoc, MsdsSection, SectionKey, SECTION_ORDER } from "./msds-types";
import { removeRecurringHeadersFooters, normalizeForMsds } from "./preclean";
import { splitSectionsByNumberV2 } from "./section-splitter";
import { extractDeterministic } from "./extractor-deterministic";
import { extractLLM } from "./extractor-llm";
import { reconcileSections } from "./reconciler";

function keyFromNumber(n: number): SectionKey {
  return SECTION_ORDER[n-1]!;
}

export async function processMsds(sourceFile: string, rawOcrText: string): Promise<MsdsDoc> {
  console.log('🧹 Starting MSDS pipeline processing...');
  
  // 1) Pre-clean first
  console.log('📄 Pre-cleaning text (page-aware header/footer removal)...');
  const pre = removeRecurringHeadersFooters(rawOcrText);
  const base = normalizeForMsds(pre);
  console.log(`📏 Pre-cleaned text length: ${base.length}`);

  // 2) Section blocks
  console.log('📋 Splitting into sections...');
  const parsed = splitSectionsByNumberV2(base);
  console.log(`📋 Found ${parsed.length} sections`);

  // 3) Build MsdsSection array with raw blocks + cleaned text
  const sectionsArr: MsdsSection[] = parsed.map(p => ({
    number: p.number,
    title: p.title,
    raw: p.content,              // keep original block for audit
    text: normalizeForMsds(p.content)
  }));

  // 4) Run extractors A + B per section, then reconcile
  console.log('🔍 Running deterministic and LLM extractors...');
  const result: Record<SectionKey, MsdsSection> = {} as any;

  await Promise.all(sectionsArr.map(async (s) => {
    const k = keyFromNumber(s.number);
    const det = extractDeterministic(k, s);
    const llm = await extractLLM(k, s);   // per-section; can be batched
    const merged = reconcileSections({ ...s, ...det }, { ...s, ...llm });
    result[k] = merged;
  }));

  // 5) Meta (best-effort from s01 & s03)
  const meta = {
    productName: result.s01_identification?.fields?.manufacturer || "",
    cas: result.s03_composition?.fields?.cas || "",
    supplier: result.s01_identification?.fields?.manufacturer || "",
    sourceFile,
    generatedAtISO: new Date().toISOString()
  };

  // 6) QA Gates
  console.log('🔍 Running QA checks...');
  const sectionsWithContent = Object.values(result).filter(s => s.text.length > 30);
  const sectionsWithFields = Object.values(result).filter(s => s.fields && Object.keys(s.fields).length > 0);
  
  if (sectionsWithContent.length < 6 && sectionsWithFields.length < 6) {
    console.warn('⚠️ LOW COVERAGE: Less than 6 sections have substantial content and fields');
  }
  
  if (!result.s01_identification?.text || result.s01_identification.text.length < 30) {
    console.warn('⚠️ KEY SECTIONS MISSING: Section 1 (Identification) is empty or too short');
  }
  
  if (!result.s03_composition?.text || result.s03_composition.text.length < 30) {
    console.warn('⚠️ KEY SECTIONS MISSING: Section 3 (Composition) is empty or too short');
  }

  console.log(`✅ MSDS pipeline completed: ${sectionsWithContent.length} sections with content, ${sectionsWithFields.length} sections with extracted fields`);
  
  return { meta, sections: result };
}
