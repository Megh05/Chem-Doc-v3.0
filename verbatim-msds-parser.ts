#!/usr/bin/env npx ts-node

/**
 * Verbatim MSDS Parser - Multi-format, verbatim content extraction
 * 
 * Key principles:
 * 1. STRICT VERBATIM: No normalization unless explicitly disabled
 * 2. MULTI-PATTERN: Handles various heading formats (numbered, bulleted, all-caps)
 * 3. SMART CLEANING: Only removes page-edge repeated content, preserves section content
 * 4. FUZZY MAPPING: Maps headings without numbers using title similarity
 * 5. TEMPLATE KEYS: Outputs exact template keys for application compatibility
 */

import * as fs from 'fs';
import * as path from 'path';

interface ParsedSection {
  number: number;
  title: string;
  content: string;
  start: number;
  end?: number;
}

interface MsdsResult {
  [key: string]: string;
}

interface ParserOptions {
  strictVerbatim: boolean;
  stripHeadersFooters: boolean;
  hfThreshold: number;
  hfEdgeLines: number;
}

/**
 * Dice coefficient for fuzzy string matching
 */
function diceCoefficient(str1: string, str2: string): number {
  const bigrams1 = new Set();
  const bigrams2 = new Set();
  
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.slice(i, i + 2).toLowerCase());
  }
  
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.add(str2.slice(i, i + 2).toLowerCase());
  }
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  const union = new Set([...bigrams1, ...bigrams2]);
  
  return intersection.size / union.size;
}

/**
 * Title synonyms for fuzzy section mapping
 */
const TITLE_SYNONYMS: Record<number, string[]> = {
  1: ["identification", "identification of the substance", "identification of product", "company/undertaking", "material and supplier"],
  2: ["hazard", "hazards identification", "hazard(s) identification", "ghs", "hmis", "nfpa", "classification"],
  3: ["composition", "information on ingredients", "composition/information on ingredients", "chemical composition"],
  4: ["first aid", "first-aid measures", "emergency measures"],
  5: ["firefighting", "fire-fighting", "fire fighting", "fire measures"],
  6: ["accidental release", "spill", "release measures", "leak"],
  7: ["handling and storage", "handling", "storage", "precautions"],
  8: ["exposure controls", "personal protection", "exposure controls/personal protection", "ppe", "protective equipment"],
  9: ["physical and chemical properties", "appearance", "ph", "flash point", "physchem", "properties"],
  10: ["stability and reactivity", "incompatible", "decomposition", "stability"],
  11: ["toxicological information", "acute toxicity", "irritation", "toxicity", "health effects"],
  12: ["ecological information", "aquatic", "bioaccumulative", "pbt", "vpvb", "environmental"],
  13: ["disposal considerations", "waste treatment", "disposal", "waste"],
  14: ["transport information", "un number", "adr", "iata", "imdg", "packing group", "shipping"],
  15: ["regulatory information", "reach", "tsca", "sara", "regulatory"],
  16: ["other information", "abbreviations", "revision", "date of preparation", "additional"]
};

/**
 * Resolve section number from title using fuzzy matching
 */
function resolveSectionNumberFromTitle(title: string): number | null {
  const cleanTitle = title.toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  let best = { n: null as number | null, score: 0 };
  
  for (const [numStr, synonyms] of Object.entries(TITLE_SYNONYMS)) {
    const n = parseInt(numStr, 10);
    for (const synonym of synonyms) {
      const score = diceCoefficient(cleanTitle, synonym);
      if (score > best.score) {
        best = { n, score };
      }
    }
  }
  
  return best.score >= 0.6 ? best.n : null;
}

/**
 * Multiple heading patterns for different MSDS formats
 */
const HEADING_PATTERNS: RegExp[] = [
  // "Section 4: First-aid measures" or "Section 4 - First-aid measures"
  /^section\s+(\d{1,2})\s*[-–:.)]\s*(.+)$/gmi,
  
  // "* 1 Identification" or "• 1 Identification" (bulleted)
  /^[*•]\s*(\d{1,2})\s+([A-Z].+)$/gmi,
  
  // "9. Physical and chemical properties" or "9) Physical and chemical properties"
  /^(\d{1,2})[.)]?\s+(.+)$/gmi,
  
  // "1 Identification" (no delimiter)
  /^(\d{1,2})\s+([A-Z][^0-9\n]{3,})$/gmi,
  
  // All-caps headings without numbers (fallback)
  /^([A-Z][A-Z\s\-/]{6,})$/gmi
];

/**
 * Extract all potential section headings from text
 */
function extractHeadings(text: string): Array<{start: number, end: number, num: number | null, title: string}> {
  const matches: Array<{start: number, end: number, num: number | null, title: string}> = [];
  
  for (const pattern of HEADING_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex
    let match: RegExpExecArray | null;
    
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      
      let num: number | null = null;
      let title = '';
      
      if (match[1] && match[2]) {
        // Pattern has both number and title
        num = parseInt(match[1], 10);
        title = match[2].trim();
      } else if (match[1]) {
        // Only number (shouldn't happen with current patterns, but safety)
        num = parseInt(match[1], 10);
        title = '';
      } else if (match[0]) {
        // All-caps heading without number
        title = match[0].trim();
        num = resolveSectionNumberFromTitle(title);
      }
      
      if (num !== null && num >= 1 && num <= 16) {
        matches.push({ start, end, num, title });
      }
    }
  }
  
  // Remove duplicates (same position)
  const unique = matches.filter((match, index, arr) => 
    arr.findIndex(m => m.start === match.start) === index
  );
  
  // Sort by position
  return unique.sort((a, b) => a.start - b.start);
}

/**
 * Minimal text cleaning - only safe operations in strict verbatim mode
 */
function preCleanParsingArtifacts(text: string, strictVerbatim: boolean): string {
  // Always safe: normalize line endings
  let out = text.replace(/\r\n?/g, '\n');
  
  if (!strictVerbatim) {
    // Only apply these transformations if not in strict mode
    out = out
      .replace(/[：﹕︰]/g, ':')
      .replace(/[‐–—―]/g, '-')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }
  
  return out;
}

/**
 * Remove repeated headers and footers from page edges
 */
function removeRepeatedHeadersFooters(pageTexts: string[], options: ParserOptions): string[] {
  if (!options.stripHeadersFooters || pageTexts.length < 2) {
    return pageTexts;
  }
  
  console.log(`🧹 Removing repeated headers/footers (threshold: ${options.hfThreshold}, edge lines: ${options.hfEdgeLines})`);
  
  // Collect top and bottom lines from each page
  const topLines = new Map<string, number>();
  const bottomLines = new Map<string, number>();
  
  for (const pageText of pageTexts) {
    const lines = pageText.split('\n');
    
    // Count top lines
    for (let i = 0; i < Math.min(options.hfEdgeLines, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 10) { // Only consider substantial lines
        topLines.set(line, (topLines.get(line) || 0) + 1);
      }
    }
    
    // Count bottom lines
    for (let i = Math.max(0, lines.length - options.hfEdgeLines); i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 10) { // Only consider substantial lines
        bottomLines.set(line, (bottomLines.get(line) || 0) + 1);
      }
    }
  }
  
  // Find lines that appear on more than threshold percentage of pages
  const minOccurrences = Math.ceil(pageTexts.length * options.hfThreshold);
  const repeatedTopLines = new Set(
    Array.from(topLines.entries())
      .filter(([, count]) => count >= minOccurrences)
      .map(([line]) => line)
  );
  
  const repeatedBottomLines = new Set(
    Array.from(bottomLines.entries())
      .filter(([, count]) => count >= minOccurrences)
      .map(([line]) => line)
  );
  
  console.log(`🔍 Found ${repeatedTopLines.size} repeated top lines, ${repeatedBottomLines.size} repeated bottom lines`);
  
  // Remove repeated lines from each page
  return pageTexts.map((pageText, pageIndex) => {
    const lines = pageText.split('\n');
    const filteredLines = lines.filter((line, lineIndex) => {
      const trimmedLine = line.trim();
      
      // Check if this is a top edge line that should be removed
      if (lineIndex < options.hfEdgeLines && repeatedTopLines.has(trimmedLine)) {
        return false;
      }
      
      // Check if this is a bottom edge line that should be removed
      if (lineIndex >= lines.length - options.hfEdgeLines && repeatedBottomLines.has(trimmedLine)) {
        return false;
      }
      
      return true;
    });
    
    const filteredText = filteredLines.join('\n');
    const removedCount = lines.length - filteredLines.length;
    if (removedCount > 0) {
      console.log(`🧹 Page ${pageIndex + 1}: Removed ${removedCount} repeated lines`);
    }
    
    return filteredText;
  });
}

/**
 * Fallback keywords for missing sections
 */
const FALLBACK_KEYWORDS: Record<number, RegExp[]> = {
  1: [/product name/i, /manufacturer/i, /supplier/i, /address/i, /tel/i, /fax/i, /email/i],
  2: [/signal word/i, /pictogram/i, /hazard statement/i, /classification/i],
  3: [/cas/i, /einecs/i, /composition/i, /ingredient/i, /%/, /concentration/i],
  4: [/first aid/i, /emergency/i, /inhalation/i, /skin contact/i, /eye contact/i],
  5: [/firefighting/i, /extinguishing/i, /fire/i, /combustion/i],
  6: [/accidental release/i, /spill/i, /leak/i, /cleanup/i],
  7: [/handling/i, /storage/i, /precautions/i, /incompatible/i],
  8: [/exposure/i, /ppe/i, /protective/i, /respiratory/i, /gloves/i],
  9: [/appearance/i, /\bpH\b/i, /flash point/i, /boiling/i, /melting/i, /density/i],
  10: [/stability/i, /reactivity/i, /incompatible/i, /decomposition/i],
  11: [/toxicological/i, /toxicity/i, /acute/i, /irritation/i, /carcinogenic/i],
  12: [/ecological/i, /aquatic/i, /bioaccumulative/i, /environmental/i],
  13: [/disposal/i, /waste/i, /treatment/i],
  14: [/\bUN\b/i, /\bADR\b/i, /\bIATA\b/i, /\bIMDG\b/i, /transport/i, /shipping/i],
  15: [/regulatory/i, /reach/i, /tsca/i, /sara/i],
  16: [/other information/i, /abbreviations/i, /revision/i, /preparation/i]
};

/**
 * Try to find missing sections using keyword fallback
 */
function findMissingSectionsWithKeywords(text: string, foundSections: Set<number>): ParsedSection[] {
  const missing = [];
  
  for (let n = 1; n <= 16; n++) {
    if (foundSections.has(n)) continue;
    
    const keywords = FALLBACK_KEYWORDS[n];
    if (!keywords) continue;
    
    let bestMatch = { index: -1, score: 0 };
    
    for (const keyword of keywords) {
      keyword.lastIndex = 0;
      let match: RegExpExecArray | null;
      
      while ((match = keyword.exec(text)) !== null) {
        // Score based on keyword position and context
        const score = 1.0 - (match.index / text.length);
        if (score > bestMatch.score) {
          bestMatch = { index: match.index, score };
        }
      }
    }
    
    if (bestMatch.index >= 0 && bestMatch.score > 0.3) {
      // Extract a reasonable window around the keyword
      const windowStart = Math.max(0, bestMatch.index - 200);
      const windowEnd = Math.min(text.length, bestMatch.index + 1000);
      const content = text.slice(windowStart, windowEnd).trim();
      
      if (content.length > 50) {
        missing.push({
          number: n,
          title: `Section ${n} (found by keyword)`,
          content,
          start: windowStart,
          end: windowEnd
        });
        console.log(`🔍 Found Section ${n} using keyword fallback`);
      }
    }
  }
  
  return missing;
}

/**
 * Merge duplicate sections by concatenating content
 */
function mergeDuplicateSections(sections: ParsedSection[]): ParsedSection[] {
  const map = new Map<number, ParsedSection>();
  
  for (const section of sections) {
    const existing = map.get(section.number);
    if (!existing) {
      map.set(section.number, { ...section });
    } else {
      // Concatenate content with separator
      existing.content = (existing.content + '\n\n' + section.content.trim()).trim();
    }
  }
  
  return Array.from(map.values()).sort((a, b) => a.number - b.number);
}

/**
 * Extract text from PDF (placeholder for now - would use pdfjs-dist)
 */
async function extractTextFromPDF(pdfPath: string): Promise<string[]> {
  // For now, return empty array - this would be implemented with pdfjs-dist
  console.log(`⚠️ PDF extraction not yet implemented. Please provide text file instead.`);
  return [];
}

/**
 * Main parsing function
 */
function parseMsdsText(text: string, options: ParserOptions): MsdsResult {
  console.log(`📋 Parsing MSDS text (${text.length} characters, strict verbatim: ${options.strictVerbatim})`);
  
  // Step 1: Minimal cleaning (only safe operations)
  const cleanedText = preCleanParsingArtifacts(text, options.strictVerbatim);
  
  // Step 2: Extract all potential headings
  const headingMatches = extractHeadings(cleanedText);
  console.log(`🔍 Found ${headingMatches.length} potential section headings`);
  
  // Step 3: Build sections from headings
  const sections: ParsedSection[] = [];
  const foundSections = new Set<number>();
  
  for (let i = 0; i < headingMatches.length; i++) {
    const current = headingMatches[i];
    const next = headingMatches[i + 1];
    
    const start = current.end;
    const end = next ? next.start : cleanedText.length;
    const content = cleanedText.slice(start, end).trim();
    
    if (content.length > 0) {
      sections.push({
        number: current.num!,
        title: current.title || `Section ${current.num}`,
        content,
        start,
        end
      });
      foundSections.add(current.num!);
      console.log(`📝 Section ${current.num}: ${content.length} characters`);
    }
  }
  
  // Step 4: Try keyword fallback for missing sections
  if (foundSections.size < 16) {
    const missingSections = findMissingSectionsWithKeywords(cleanedText, foundSections);
    sections.push(...missingSections);
  }
  
  // Step 5: Merge duplicates and sort
  const mergedSections = mergeDuplicateSections(sections);
  
  // Step 6: Map to template keys
  return mapToTemplateKeys(mergedSections);
}

/**
 * Map sections to exact template keys
 */
function mapToTemplateKeys(sections: ParsedSection[]): MsdsResult {
  console.log(`🗺️ Mapping to template keys...`);
  
  // Exact template section titles as keys
  const templateKeys: Record<number, string> = {
    1: '1. Identification of the material and supplier:',
    2: '2. Hazards Identification:',
    3: '3. Composition/ Information on Ingredients:',
    4: '4. First aid measures',
    5: '5. Firefighting measures:',
    6: '6. Accidental release measures:',
    7: '7. Handling and storage:',
    8: '8. Exposure controls Appropriate Engineering Controls:',
    9: '9. Physical and Chemical Properties:',
    10: '10. Stability and reactivity',
    11: '11. Toxicological information',
    12: '12. ECOLOGICAL INFORMATION:',
    13: '13. Disposal considerations',
    14: '14. Transport Information:',
    15: '15. Regulatory Information:',
    16: '16. Other Information:'
  };
  
  const result: MsdsResult = {};
  
  // Initialize all template keys with empty strings
  for (let i = 1; i <= 16; i++) {
    result[templateKeys[i]] = '';
  }
  
  // Map sections to template keys
  for (const section of sections) {
    if (section.number >= 1 && section.number <= 16) {
      const templateKey = templateKeys[section.number];
      if (templateKey) {
        // Concatenate if multiple sections have same number
        const existing = result[templateKey];
        result[templateKey] = existing ? existing + '\n\n' + section.content.trim() : section.content.trim();
      }
    }
  }
  
  return result;
}

/**
 * Main processing function
 */
async function processMSDS(inputPath: string, outputPath: string, options: ParserOptions): Promise<void> {
  try {
    console.log(`🚀 Starting verbatim MSDS processing...`);
    console.log(`📄 Input: ${inputPath}`);
    console.log(`📄 Output: ${outputPath}`);
    console.log(`⚙️ Options:`, options);
    
    // Read input file
    let text: string;
    let pageTexts: string[] = [];
    
    if (inputPath.endsWith('.pdf')) {
      pageTexts = await extractTextFromPDF(inputPath);
      if (pageTexts.length === 0) {
        console.log('⚠️ PDF processing not yet implemented. Please convert to text first.');
        return;
      }
    } else {
      text = fs.readFileSync(inputPath, 'utf8');
      pageTexts = [text]; // Single page for text files
    }
    
    // Remove repeated headers/footers if requested
    const cleanedPageTexts = removeRepeatedHeadersFooters(pageTexts, options);
    
    // Combine all pages
    const combinedText = cleanedPageTexts.join('\n\n');
    console.log(`📏 Combined text length: ${combinedText.length} characters`);
    
    // Parse the text
    const result = parseMsdsText(combinedText, options);
    
    // Write output JSON
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    
    console.log(`✅ Processing complete!`);
    console.log(`📄 Output written to: ${outputPath}`);
    
    // Summary
    const sectionsWithContent = Object.values(result).filter(content => content.trim().length > 0).length;
    console.log(`📊 Summary: ${sectionsWithContent}/16 sections have content`);
    
  } catch (error) {
    console.error(`❌ Error processing file:`, error);
    process.exit(1);
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 4 || args[0] !== '--input' || args[2] !== '--output') {
    console.log('Usage: npx ts-node verbatim-msds-parser.ts --input <file> --output <file> [options]');
    console.log('Options:');
    console.log('  --strict-verbatim    Keep text completely verbatim (default: true)');
    console.log('  --strip-hf          Remove repeated headers/footers (default: true)');
    console.log('  --hf-threshold <n>  Header/footer removal threshold 0.0-1.0 (default: 0.6)');
    console.log('  --hf-edge-lines <n> Number of edge lines to check (default: 10)');
    console.log('Examples:');
    console.log('  npx ts-node verbatim-msds-parser.ts --input "msds.txt" --output "output.json"');
    console.log('  npx ts-node verbatim-msds-parser.ts --input "msds.txt" --output "output.json" --strict-verbatim false');
    process.exit(1);
  }
  
  const inputPath = args[1];
  const outputPath = args[3];
  
  // Parse options
  const options: ParserOptions = {
    strictVerbatim: !args.includes('--strict-verbatim') || args[args.indexOf('--strict-verbatim') + 1] !== 'false',
    stripHeadersFooters: !args.includes('--strip-hf') || args[args.indexOf('--strip-hf') + 1] !== 'false',
    hfThreshold: parseFloat(args[args.indexOf('--hf-threshold') + 1]) || 0.6,
    hfEdgeLines: parseInt(args[args.indexOf('--hf-edge-lines') + 1]) || 10
  };
  
  // Validate input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Process the file
  await processMSDS(inputPath, outputPath, options);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { processMSDS, parseMsdsText, extractHeadings, resolveSectionNumberFromTitle };


