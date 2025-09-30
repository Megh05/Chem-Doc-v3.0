import fs from "fs/promises";
import createReport from "docx-templates";
import { SECTION_SLUGS, type SectionSlug } from "./msds-slug-map";

const PLACEHOLDER_REGEX = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export async function extractTemplatePlaceholders(templatePath: string): Promise<Set<string>> {
  const buf = await fs.readFile(templatePath);
  // Note: This is a best-effort scan of the docx binary for placeholders.
  // docx-templates does real XML parsing when generating the report.
  const text = buf.toString("binary");
  const matches = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_REGEX.exec(text))) matches.add(m[1]);
  return matches;
}

export type MergeOptions = {
  failOnMissingRequired?: boolean; // default: true
  requiredSlugs?: SectionSlug[];   // default: all 16
};

export async function generateDocx(
  templatePath: string,
  outPath: string,
  data: Record<SectionSlug, string>,
  opts: MergeOptions = {}
) {
  const { failOnMissingRequired = true, requiredSlugs = [...SECTION_SLUGS] } = opts;

  const placeholders = await extractTemplatePlaceholders(templatePath);
  const dataSlugs = new Set(Object.keys(data));

  const missingInTemplate = requiredSlugs.filter((s) => !placeholders.has(s));
  const missingInData = requiredSlugs.filter((s) => !dataSlugs.has(s) || !data[s]?.trim());
  const extraInTemplate = [...placeholders].filter(
    (p) => !(SECTION_SLUGS as readonly string[]).includes(p)
  );

  // Structured, high-signal logs for operators
  console.table([
    { check: "missingInTemplate", count: missingInTemplate.length, items: missingInTemplate.join(", ") || "-" },
    { check: "missingInData", count: missingInData.length, items: missingInData.join(", ") || "-" },
    { check: "extraInTemplate", count: extraInTemplate.length, items: extraInTemplate.join(", ") || "-" },
  ]);

  if (failOnMissingRequired && (missingInTemplate.length || missingInData.length)) {
    throw new Error("Template/data mismatch. See table above.");
  }

  const template = await fs.readFile(templatePath);
  const report = await createReport({
    template,
    data,
    cmdDelimiter: ["{{", "}}"],
  });
  await fs.writeFile(outPath, report);
}

/**
 * Authoring guidance for template designers (kept close to the code):
 * - Place placeholders like {{sec_01_identification}} beneath each heading.
 * - Keep placeholders in the main document body (not headers/footers) unless extended.
 * - You may style the paragraph normally; the library replaces the run contents.
 */



