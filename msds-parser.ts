#!/usr/bin/env npx ts-node

/**
 * MSDS PDF Parser - Extracts verbatim 16-section content from MSDS PDFs
 * 
 * This script:
 * 1. Extracts text page-by-page in reading order using pdfjs-dist
 * 2. Optionally removes repeated headers/footers across pages
 * 3. Splits content by section headings using regex patterns
 * 4. Maps to exact 16-section template keys
 * 5. Outputs verbatim JSON content (no normalization unless disabled)
 */

import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Import pdfjs-dist for PDF text extraction
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure pdfjs-dist for Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

interface TextItem {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

interface ParsedSection {
  number: number;
  title: string;
  content: string;
}

interface MsdsResult {
  [key: string]: string;
}

/**
 * Extract text from PDF page by page in reading order
 */
async function extractTextFromPDF(pdfPath: string): Promise<string[]> {
  console.log(`📄 Loading PDF: ${pdfPath}`);
  
  const data = fs.readFileSync(pdfPath);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  
  console.log(`📋 PDF loaded: ${pdf.numPages} pages`);
  
  const pageTexts: string[] = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items into lines by Y coordinate (with tolerance)
    const lines = new Map<number, TextItem[]>();
    const tolerance = 2; // Y coordinate tolerance for grouping into lines
    
    for (const item of textContent.items as TextItem[]) {
      const y = Math.round(item.transform[5] / tolerance) * tolerance;
      
      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push(item);
    }
    
    // Sort lines by Y coordinate (top to bottom) and items by X coordinate (left to right)
    const sortedLines = Array.from(lines.entries())
      .sort(([a], [b]) => b - a) // Sort Y descending (top to bottom)
      .map(([, items]) => 
        items.sort((a, b) => a.transform[4] - b.transform[4]) // Sort X ascending (left to right)
      );
    
    // Join items into lines, preserving spacing
    const pageText = sortedLines
      .map(line => line.map(item => item.str).join(''))
      .join('\n');
    
    pageTexts.push(pageText);
    console.log(`📄 Page ${pageNum}: ${pageText.length} characters`);
  }
  
  return pageTexts;
}

/**
 * Remove repeated headers and footers across pages
 */
function removeRepeatedHeadersFooters(pageTexts: string[], threshold: number = 0.6, edgeLines: number = 10): string[] {
  console.log(`🧹 Removing repeated headers/footers (threshold: ${threshold}, edge lines: ${edgeLines})`);
  
  if (pageTexts.length < 2) {
    return pageTexts;
  }
  
  // Collect top and bottom lines from each page
  const topLines = new Map<string, number>();
  const bottomLines = new Map<string, number>();
  
  for (const pageText of pageTexts) {
    const lines = pageText.split('\n');
    
    // Count top lines
    for (let i = 0; i < Math.min(edgeLines, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 10) { // Only consider substantial lines
        topLines.set(line, (topLines.get(line) || 0) + 1);
      }
    }
    
    // Count bottom lines
    for (let i = Math.max(0, lines.length - edgeLines); i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 10) { // Only consider substantial lines
        bottomLines.set(line, (bottomLines.get(line) || 0) + 1);
      }
    }
  }
  
  // Find lines that appear on more than threshold percentage of pages
  const minOccurrences = Math.ceil(pageTexts.length * threshold);
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
      if (lineIndex < edgeLines && repeatedTopLines.has(trimmedLine)) {
        return false;
      }
      
      // Check if this is a bottom edge line that should be removed
      if (lineIndex >= lines.length - edgeLines && repeatedBottomLines.has(trimmedLine)) {
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
 * Split text into sections based on section headings
 */
function splitIntoSections(combinedText: string): ParsedSection[] {
  console.log(`📋 Splitting into sections...`);
  
  // Regex to match section headings: "Section N - Title" or "Section N: Title"
  const sectionRegex = /^Section\s+(\d{1,2})\s*[-–:]\s*(.+?)$/gim;
  
  const sections: ParsedSection[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex lastIndex
  sectionRegex.lastIndex = 0;
  
  while ((match = sectionRegex.exec(combinedText)) !== null) {
    const sectionNumber = parseInt(match[1], 10);
    const sectionTitle = match[2].trim();
    
    // Get content from end of previous section to start of current section
    const contentStart = lastIndex;
    const contentEnd = match.index;
    
    if (contentStart < contentEnd) {
      const content = combinedText.slice(contentStart, contentEnd).trim();
      if (content) {
        sections.push({
          number: sections.length + 1,
          title: sections.length > 0 ? sections[sections.length - 1].title : 'Introduction',
          content: content
        });
      }
    }
    
    sections.push({
      number: sectionNumber,
      title: sectionTitle,
      content: ''
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add content for the last section
  if (lastIndex < combinedText.length) {
    const lastContent = combinedText.slice(lastIndex).trim();
    if (lastContent && sections.length > 0) {
      sections[sections.length - 1].content = lastContent;
    }
  }
  
  console.log(`📋 Found ${sections.length} sections`);
  return sections;
}

/**
 * Map sections to template keys and create final JSON
 */
function mapToTemplateKeys(sections: ParsedSection[], strict: boolean = true): MsdsResult {
  console.log(`🗺️ Mapping to template keys (strict: ${strict})...`);
  
  // Exact template section titles as keys
  const templateKeys = [
    '1. Identification of the material and supplier:',
    '2. Hazards Identification:',
    '3. Composition/ Information on Ingredients:',
    '4. First aid measures',
    '5. Firefighting measures:',
    '6. Accidental release measures:',
    '7. Handling and storage:',
    '8. Exposure controls Appropriate Engineering Controls:',
    '9. Physical and Chemical Properties:',
    '10. Stability and reactivity',
    '11. Toxicological information',
    '12. ECOLOGICAL INFORMATION:',
    '13. Disposal considerations',
    '14. Transport Information:',
    '15. Regulatory Information:',
    '16. Other Information:'
  ];
  
  const result: MsdsResult = {};
  
  // Initialize all template keys with empty strings
  for (const key of templateKeys) {
    result[key] = '';
  }
  
  // Map sections to template keys
  for (const section of sections) {
    if (section.number >= 1 && section.number <= 16) {
      const templateKey = templateKeys[section.number - 1];
      if (templateKey) {
        let content = section.content;
        
        if (!strict) {
          // Apply minimal normalization if not in strict mode
          content = content
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
            .trim();
        }
        
        result[templateKey] = content;
        console.log(`📝 Section ${section.number}: ${content.length} characters`);
      }
    }
  }
  
  return result;
}

/**
 * Main processing function
 */
async function processMSDSPDF(
  pdfPath: string,
  outputPath: string,
  options: {
    strict: boolean;
    stripHF: boolean;
    hfThreshold: number;
    hfEdgeLines: number;
  }
): Promise<void> {
  try {
    console.log(`🚀 Starting MSDS PDF processing...`);
    console.log(`📄 Input: ${pdfPath}`);
    console.log(`📄 Output: ${outputPath}`);
    console.log(`⚙️ Options:`, options);
    
    // Step 1: Extract text from PDF
    const pageTexts = await extractTextFromPDF(pdfPath);
    
    // Step 2: Optionally remove repeated headers/footers
    const cleanedPageTexts = options.stripHF 
      ? removeRepeatedHeadersFooters(pageTexts, options.hfThreshold, options.hfEdgeLines)
      : pageTexts;
    
    // Step 3: Combine all pages
    const combinedText = cleanedPageTexts.join('\n\n');
    console.log(`📏 Combined text length: ${combinedText.length} characters`);
    
    // Step 4: Split into sections
    const sections = splitIntoSections(combinedText);
    
    // Step 5: Map to template keys
    const result = mapToTemplateKeys(sections, options.strict);
    
    // Step 6: Write output JSON
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    
    console.log(`✅ Processing complete!`);
    console.log(`📄 Output written to: ${outputPath}`);
    
    // Summary
    const sectionsWithContent = Object.values(result).filter(content => content.trim().length > 0).length;
    console.log(`📊 Summary: ${sectionsWithContent}/16 sections have content`);
    
  } catch (error) {
    console.error(`❌ Error processing PDF:`, error);
    process.exit(1);
  }
}

/**
 * CLI argument parsing and main execution
 */
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('pdf', {
      type: 'string',
      demandOption: true,
      describe: 'Input PDF file path',
      alias: 'p'
    })
    .option('out', {
      type: 'string',
      demandOption: true,
      describe: 'Output JSON file path',
      alias: 'o'
    })
    .option('strict', {
      type: 'boolean',
      default: true,
      describe: 'Keep text verbatim (no normalization)',
      alias: 's'
    })
    .option('stripHF', {
      type: 'boolean',
      default: true,
      describe: 'Remove repeated headers/footers',
      alias: 'h'
    })
    .option('hfThreshold', {
      type: 'number',
      default: 0.6,
      describe: 'Threshold for header/footer removal (0.0-1.0)',
      alias: 't'
    })
    .option('hfEdgeLines', {
      type: 'number',
      default: 10,
      describe: 'Number of edge lines to check for headers/footers',
      alias: 'e'
    })
    .help()
    .alias('help', 'h')
    .version('1.0.0')
    .alias('version', 'v')
    .example('$0 --pdf "MSDS.pdf" --out "output.json"', 'Basic usage')
    .example('$0 --pdf "MSDS.pdf" --out "output.json" --strict false', 'With normalization')
    .example('$0 --pdf "MSDS.pdf" --out "output.json" --stripHF false', 'Keep all headers/footers')
    .epilogue('MSDS PDF Parser - Extracts verbatim 16-section content from MSDS PDFs')
    .argv;
  
  // Validate input file exists
  if (!fs.existsSync(argv.pdf)) {
    console.error(`❌ Input PDF file not found: ${argv.pdf}`);
    process.exit(1);
  }
  
  // Validate threshold
  if (argv.hfThreshold < 0 || argv.hfThreshold > 1) {
    console.error(`❌ Header/footer threshold must be between 0.0 and 1.0`);
    process.exit(1);
  }
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(argv.out);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Process the PDF
  await processMSDSPDF(argv.pdf, argv.out, {
    strict: argv.strict,
    stripHF: argv.stripHF,
    hfThreshold: argv.hfThreshold,
    hfEdgeLines: argv.hfEdgeLines
  });
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { processMSDSPDF, extractTextFromPDF, removeRepeatedHeadersFooters, splitIntoSections, mapToTemplateKeys };
