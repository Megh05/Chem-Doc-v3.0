#!/usr/bin/env npx ts-node

/**
 * Simple MSDS PDF Parser
 * A simplified version that works with the current setup
 */

import * as fs from 'fs';
import * as path from 'path';

// For now, let's create a simple text-based parser that works with existing files
// This can be enhanced later with PDF.js when the import issues are resolved

interface MsdsResult {
  [key: string]: string;
}

/**
 * Simple text-based MSDS parser
 * This version works with text files and can be extended for PDFs later
 */
function parseMsdsText(text: string): MsdsResult {
  console.log(`📋 Parsing MSDS text (${text.length} characters)...`);
  
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
  
  // Try to find section boundaries using various patterns
  const sectionPatterns = [
    /^Section\s+(\d{1,2})\s*[-–:]\s*(.+?)$/gim,
    /^(\d{1,2})\.\s*(.+?)$/gim,
    /^(\d{1,2})\s+([A-Z][^:]*?):?$/gim
  ];
  
  const sections: Array<{number: number, title: string, start: number, end?: number}> = [];
  
  // Find all section headings
  for (const pattern of sectionPatterns) {
    pattern.lastIndex = 0; // Reset regex
    let match: RegExpExecArray | null;
    
    while ((match = pattern.exec(text)) !== null) {
      const sectionNumber = parseInt(match[1], 10);
      const sectionTitle = match[2].trim();
      
      if (sectionNumber >= 1 && sectionNumber <= 16) {
        sections.push({
          number: sectionNumber,
          title: sectionTitle,
          start: match.index
        });
      }
    }
  }
  
  // Sort sections by position in text
  sections.sort((a, b) => a.start - b.start);
  
  // Set end positions
  for (let i = 0; i < sections.length; i++) {
    if (i < sections.length - 1) {
      sections[i].end = sections[i + 1].start;
    } else {
      sections[i].end = text.length;
    }
  }
  
  // Extract content for each section
  for (const section of sections) {
    if (section.end) {
      const content = text.slice(section.start, section.end)
        .replace(/^Section\s+\d+\s*[-–:]\s*.+?\n/gim, '') // Remove the heading line
        .trim();
      
      const templateKey = templateKeys[section.number - 1];
      if (templateKey && content) {
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
async function processMSDS(inputPath: string, outputPath: string): Promise<void> {
  try {
    console.log(`🚀 Starting MSDS processing...`);
    console.log(`📄 Input: ${inputPath}`);
    console.log(`📄 Output: ${outputPath}`);
    
    // Read input file
    let text: string;
    if (inputPath.endsWith('.pdf')) {
      console.log('⚠️ PDF processing not yet implemented. Please convert to text first.');
      return;
    } else {
      text = fs.readFileSync(inputPath, 'utf8');
    }
    
    // Parse the text
    const result = parseMsdsText(text);
    
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
    console.log('Usage: npx ts-node simple-msds-parser.ts --input <file> --output <file>');
    console.log('Example: npx ts-node simple-msds-parser.ts --input "msds.txt" --output "output.json"');
    process.exit(1);
  }
  
  const inputPath = args[1];
  const outputPath = args[3];
  
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
  await processMSDS(inputPath, outputPath);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { processMSDS, parseMsdsText };

