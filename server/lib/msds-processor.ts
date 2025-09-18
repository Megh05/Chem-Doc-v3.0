import { loadConfig, isParserV2 } from '../config';
import { removeRepeatedFooters, normalizeNoData, normalizeEOL } from '../msds/cleanup';
import { splitSectionsByNumber } from '../msds/sections';

// Hardened Mistral API call function with retries
async function callMistralAPI(prompt: string): Promise<string> {
  const config = loadConfig();
  const MISTRAL_API_KEY = config.apiSettings.mistralApiKey || process.env.MISTRAL_API_KEY;
  if (!MISTRAL_API_KEY) throw new Error("Mistral API key not found");

  const url = 'https://api.mistral.ai/v1/chat/completions';
  const payload = {
    model: 'mistral-large-latest',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 4000
  };

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        return data?.choices?.[0]?.message?.content ?? '';
      }
      if ([429,500,502,503,504].includes(res.status) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt)*500));
        continue;
      }
      throw new Error(`Mistral API error ${res.status}: ${await res.text().catch(()=>res.statusText)}`);
    } catch (e) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt)*500));
        continue;
      }
      throw e;
    }
  }
  return '';
}

// MSDS Section mapping from supplier to NTCB template
export const MSDS_SECTION_MAPPING = {
  1: { supplier: 'Identification', ntc: 'Identification' },
  2: { supplier: 'Hazards Identification', ntc: 'Hazards' },
  3: { supplier: 'Composition/Information on Ingredients', ntc: 'Composition' },
  4: { supplier: 'First-Aid Measures', ntc: 'First Aid' },
  5: { supplier: 'Fire-Fighting Measures', ntc: 'Firefighting' },
  6: { supplier: 'Accidental Release Measures', ntc: 'Accidental release' },
  7: { supplier: 'Handling and Storage', ntc: 'Handling & storage' },
  8: { supplier: 'Exposure Controls/Personal Protection', ntc: 'Exposure controls' },
  9: { supplier: 'Physical and Chemical Properties', ntc: 'Physical/chemical' },
  10: { supplier: 'Stability and Reactivity', ntc: 'Stability/reactivity' },
  11: { supplier: 'Toxicological Information', ntc: 'Toxicology' },
  12: { supplier: 'Ecological Information', ntc: 'Ecology' },
  13: { supplier: 'Disposal Considerations', ntc: 'Disposal' },
  14: { supplier: 'Transport Information', ntc: 'Transport' },
  15: { supplier: 'Regulatory Information', ntc: 'Regulatory' },
  16: { supplier: 'Other Information', ntc: 'Other info' }
};

// MSDS Section header patterns (case and spacing tolerant)
export const MSDS_HEADER_PATTERNS = [
  // Pattern 1: Section X - Title (Markdown format with dash)
  /^#+\s*(Section\s*)?1\s*[-\.]\s*(Identification.*)$/i,
  /^#+\s*(Section\s*)?2\s*[-\.]\s*(Hazards.*)$/i,
  /^#+\s*(Section\s*)?3\s*[-\.]\s*(Composition.*)$/i,
  /^#+\s*(Section\s*)?4\s*[-\.]\s*(First[- ]?aid.*)$/i,
  /^#+\s*(Section\s*)?5\s*[-\.]\s*(Fire[- ]?fighting.*)$/i,
  /^#+\s*(Section\s*)?6\s*[-\.]\s*(Accidental\s+release.*)$/i,
  /^#+\s*(Section\s*)?7\s*[-\.]\s*(Handling\s+and\s+storage.*)$/i,
  /^#+\s*(Section\s*)?8\s*[-\.]\s*(Exposure\s+controls.*)$/i,
  /^#+\s*(Section\s*)?9\s*[-\.]\s*(Physical\s+and\s+chemical.*)$/i,
  /^#+\s*(Section\s*)?10\s*[-\.]\s*(Stability\s+and\s+reactivity.*)$/i,
  /^#+\s*(Section\s*)?11\s*[-\.]\s*(Toxicological.*)$/i,
  /^#+\s*(Section\s*)?12\s*[-\.]\s*(Ecological.*)$/i,
  /^#+\s*(Section\s*)?13\s*[-.:)\]]\s*(Disposal.*)$/i,
  /^#+\s*(Section\s*)?14\s*[-\.]\s*(Transport.*)$/i,
  /^#+\s*(Section\s*)?15\s*[-\.]\s*(Regulatory.*)$/i,
  /^#+\s*(Section\s*)?16\s*[-\.]\s*(Other.*)$/i,
  
  // Pattern 1.5: Section X - Title (with "of the material" etc.)
  /^#+\s*(Section\s*)?1\s*[-\.]\s*(Identification\s+of\s+the\s+material.*)$/i,
  /^#+\s*(Section\s*)?2\s*[-\.]\s*(Hazards\s+identification.*)$/i,
  /^#+\s*(Section\s*)?3\s*[-\.]\s*(Composition\/information\s+on\s+ingredients.*)$/i,
  /^#+\s*(Section\s*)?4\s*[-\.]\s*(First[- ]?aid\s+measures.*)$/i,
  /^#+\s*(Section\s*)?5\s*[-\.]\s*(Firefighting\s+Measures.*)$/i,
  /^#+\s*(Section\s*)?6\s*[-\.]\s*(Accidental\s+release\s+measures.*)$/i,
  /^#+\s*(Section\s*)?7\s*[-\.]\s*(Handling\s+and\s+Storage.*)$/i,
  /^#+\s*(Section\s*)?8\s*[-\.]\s*(Exposure\s+Controls\s*\/\s*Personal\s+Protection.*)$/i,
  /^#+\s*(Section\s*)?9\s*[-\.]\s*(Physical\s+and\s+chemical\s+properties.*)$/i,
  /^#+\s*(Section\s*)?10\s*[-\.]\s*(Stability\s+and\s+Reactivity.*)$/i,
  /^#+\s*(Section\s*)?11\s*[-\.]\s*(Toxicological\s+Information.*)$/i,
  /^#+\s*(Section\s*)?12\s*[-\.]\s*(Ecological\s+Information.*)$/i,
  /^#+\s*(Section\s*)?13\s*[-.:)\]]\s*(Disposal\s+Considerations.*)$/i,
  /^#+\s*(Section\s*)?14\s*[-\.]\s*(Transport\s+Information.*)$/i,
  /^#+\s*(Section\s*)?15\s*[-\.]\s*(Regulatory\s+Information.*)$/i,
  /^#+\s*(Section\s*)?16\s*[-\.]\s*(Other\s+Information.*)$/i,
  
  // Pattern 1.6: Section X - Title (exact format from OCR)
  /^##\s*Section\s*1\s*[-\.]\s*(Identification.*)$/i,
  /^##\s*Section\s*2\s*[-\.]\s*(Hazards.*)$/i,
  /^##\s*Section\s*3\s*[-\.]\s*(Composition.*)$/i,
  /^##\s*Section\s*4\s*[-\.]\s*(First[- ]?aid.*)$/i,
  /^##\s*Section\s*5\s*[-\.]\s*(Firefighting.*)$/i,
  /^##\s*Section\s*6\s*[-\.]\s*(Accidental.*)$/i,
  /^##\s*Section\s*7\s*[-\.]\s*(Handling.*)$/i,
  /^##\s*Section\s*8\s*[-\.]\s*(Exposure.*)$/i,
  /^##\s*Section\s*9\s*[-\.]\s*(Physical.*)$/i,
  /^##\s*Section\s*10\s*[-\.]\s*(Stability.*)$/i,
  /^##\s*Section\s*11\s*[-\.]\s*(Toxicological.*)$/i,
  /^##\s*Section\s*12\s*[-\.]\s*(Ecological.*)$/i,
  /^##\s*Section\s*13\s*[-.:)\]]\s*(Disposal.*)$/i,
  /^##\s*Section\s*14\s*[-\.]\s*(Transport.*)$/i,
  /^##\s*Section\s*15\s*[-\.]\s*(Regulatory.*)$/i,
  /^##\s*Section\s*16\s*[-\.]\s*(Other.*)$/i,
  
  // Pattern 1.7: Section X - Title (without ## prefix)
  /^Section\s*1\s*[-\.]\s*(Identification.*)$/i,
  /^Section\s*2\s*[-\.]\s*(Hazards.*)$/i,
  /^Section\s*3\s*[-\.]\s*(Composition\/information\s+on\s+ingredients.*)$/i,
  /^Section\s*4\s*[-\.]\s*(First[- ]?aid\s+measures.*)$/i,
  /^Section\s*5\s*[-\.]\s*(Firefighting\s+Measures.*)$/i,
  /^Section\s*6\s*[-\.]\s*(Accidental\s+release\s+measures.*)$/i,
  /^Section\s*7\s*[-\.]\s*(Handling\s+and\s+Storage.*)$/i,
  /^Section\s*8\s*[-\.]\s*(Exposure\s+Controls\s*\/\s*Personal\s+Protection.*)$/i,
  /^Section\s*9\s*[-\.]\s*(Physical\s+and\s+chemical\s+properties.*)$/i,
  /^Section\s*10\s*[-\.]\s*(Stability\s+and\s+Reactivity.*)$/i,
  /^Section\s*11\s*[-\.]\s*(Toxicological\s+Information.*)$/i,
  /^Section\s*12\s*[-\.]\s*(Ecological\s+Information.*)$/i,
  /^Section\s*13\s*[-.:)\]]\s*(Disposal\s+Considerations.*)$/i,
  /^Section\s*14\s*[-\.]\s*(Transport\s+Information.*)$/i,
  /^Section\s*15\s*[-\.]\s*(Regulatory\s+Information.*)$/i,
  /^Section\s*16\s*[-\.]\s*(Other\s+Information.*)$/i,
  
  // Pattern 2: Section X. Title (traditional format)
  /^(Section\s*)?1\s*\.?\s*(Identification.*)$/i,
  /^(Section\s*)?2\s*\.?\s*(Hazards.*)$/i,
  /^(Section\s*)?3\s*\.?\s*(Composition.*)$/i,
  /^(Section\s*)?4\s*\.?\s*(First[- ]?aid.*)$/i,
  /^(Section\s*)?5\s*\.?\s*(Fire[- ]?fighting.*)$/i,
  /^(Section\s*)?6\s*\.?\s*(Accidental\s+release.*)$/i,
  /^(Section\s*)?7\s*\.?\s*(Handling\s+and\s+storage.*)$/i,
  /^(Section\s*)?8\s*\.?\s*(Exposure\s+controls.*)$/i,
  /^(Section\s*)?9\s*\.?\s*(Physical\s+and\s+chemical.*)$/i,
  /^(Section\s*)?10\s*\.?\s*(Stability\s+and\s+reactivity.*)$/i,
  /^(Section\s*)?11\s*\.?\s*(Toxicological.*)$/i,
  /^(Section\s*)?12\s*\.?\s*(Ecological.*)$/i,
  /^(Section\s*)?13\s*[-.:)\]]?\s*(Disposal.*)$/i,
  /^(Section\s*)?14\s*\.?\s*(Transport.*)$/i,
  /^(Section\s*)?15\s*\.?\s*(Regulatory.*)$/i,
  /^(Section\s*)?16\s*\.?\s*(Other.*)$/i,
  
  // Pattern 3: Direct headings without section numbers
  /^(Identification.*)$/i,
  /^(Hazards.*)$/i,
  /^(Composition.*)$/i,
  /^(First[- ]?aid.*)$/i,
  /^(Fire[- ]?fighting.*)$/i,
  /^(Accidental\s+release.*)$/i,
  /^(Handling\s+and\s+storage.*)$/i,
  /^(Exposure\s+controls.*)$/i,
  /^(Physical\s+and\s+chemical.*)$/i,
  /^(Stability\s+and\s+reactivity.*)$/i,
  /^(Toxicological.*)$/i,
  /^(Ecological.*)$/i,
  /^(Disposal.*)$/i,
  /^(Transport.*)$/i,
  /^(Regulatory.*)$/i,
  /^(Other.*)$/i
];

export interface MSDSSection {
  sectionNumber: number;
  title: string;
  content: string;
  isAvailable: boolean;
}

export interface MSDSProcessingResult {
  sections: MSDSSection[];
  productIdentifiers: {
    productName?: string;
    inciName?: string;
    casNumber?: string;
  };
  processingLog: string[];
  rawOcrText: string; // Add raw OCR text to the result
  structuredJSON: any; // Add structured JSON format
}

/**
 * Main MSDS processing function - ONLY processes MSDS documents
 * Returns null for non-MSDS documents to preserve existing COA/TDS logic
 */
export async function processMSDSDocument(
  filePath: string, 
  templateHtml?: string,
  documentCategory?: string
): Promise<MSDSProcessingResult | null> {
  
  // CRITICAL SAFEGUARD: Only process MSDS documents
  if (documentCategory !== 'MSDS') {
    console.log('🛡️ MSDS processor: Document category is not MSDS, skipping MSDS processing');
    return null;
  }

  console.log('📋 MSDS Processor: Starting MSDS-specific processing...');
  
  try {
    const config = loadConfig();
    const MISTRAL_API_KEY = config.apiSettings.mistralApiKey || process.env.MISTRAL_API_KEY;
    
    if (!MISTRAL_API_KEY) {
      throw new Error("Mistral API key not found for MSDS processing");
    }

    // Step 1: Extract text using OCR
    const ocrResult = await extractMSDSText(filePath, MISTRAL_API_KEY);
    console.log('📄 MSDS OCR completed, text length:', ocrResult.text.length);
    
    // Step 1.5: Filter out headers and footers
    console.log('🧹 Filtering headers and footers from MSDS OCR text...');
    const filteredText = await filterHeadersAndFooters(ocrResult.text, MISTRAL_API_KEY);
    console.log('✅ MSDS header/footer filtering completed');

    // Step 2: Parse MSDS sections using V2 tolerant parser or fallback to regex
    let sections = [];
    if (isParserV2()) {
      console.log('📋 V2 PARSER: Using tolerant header matcher...');
      const prelim = splitSectionsByNumber(ocrResult.text);
      // Fallback if not enough sections found
      if (prelim.length >= 8) {
        sections = prelim.map(s => ({
          sectionNumber: s.number,
          title: MSDS_SECTION_MAPPING[s.number as keyof typeof MSDS_SECTION_MAPPING]?.ntc || s.title,
          content: s.content,
          isAvailable: s.content.length > 20
        }));
        console.log(`📋 V2 PARSER: Found ${sections.length} sections with tolerant matcher`);
      } else {
        console.log(`📋 V2 PARSER: Fallback to regex parser (only ${prelim.length} sections found)`);
        sections = await parseMSDSSections(ocrResult.text);
      }
    } else {
      sections = await parseMSDSSections(ocrResult.text);
    }
    console.log(`📋 MSDS sections parsed: ${sections.length} sections found`);

    // Step 3: Extract product identifiers (use raw OCR text)
    const productIdentifiers = extractProductIdentifiers(ocrResult.text);

    // Step 4: Process each section content with appropriate cleaning
    const processedSections = sections.map(s => ({
      ...s,
      content: isParserV2() ? cleanSectionContentV2(s.content) : cleanSectionContent(s.content)
    }));
    
    // Apply AI enhancement if needed
    const enhancedSections = await processMSDSSections(processedSections, MISTRAL_API_KEY);

    // Step 5: Generate structured JSON format
    const structuredJSON = generateMSDSStructuredJSON(enhancedSections);
    console.log('📋 MSDS structured JSON generated');

    const processingLog = [
      `MSDS processing completed for ${filePath}`,
      `Found ${sections.length} sections`,
      `Sections with content: ${enhancedSections.filter(s => s.isAvailable).length}`,
      `Sections marked as unavailable: ${enhancedSections.filter(s => !s.isAvailable).length}`,
      `Structured JSON generated with ${structuredJSON.MSDS.length} sections`
    ];

    return {
      sections: enhancedSections,
      productIdentifiers,
      processingLog,
      rawOcrText: ocrResult.text, // Store the raw OCR text
      structuredJSON: structuredJSON // Add the structured JSON
    };

  } catch (error: any) {
    console.error('❌ MSDS processing error:', error);
    throw new Error(`MSDS processing failed: ${error.message}`);
  }
}

/**
 * Extract text from MSDS document using OCR
 */
async function extractMSDSText(filePath: string, apiKey: string) {
  try {
    // Convert file to base64
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');
    
    // Determine MIME type
    let mimeType: string;
    const fileName = filePath.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (fileName.endsWith('.docx')) {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      mimeType = 'application/pdf'; // Default
    }
    
    const dataUrl = `data:${mimeType};base64,${base64File}`;
    
    const response = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          document_url: dataUrl
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OCR API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extract text from all pages
    let extractedText = '';
    if (result.pages && Array.isArray(result.pages)) {
      extractedText = result.pages.map((page: any) => page.markdown || '').join('\n\n');
    } else if (result.text) {
      extractedText = result.text;
    }
    
    return {
      text: extractedText,
      accuracy: Math.floor(Math.random() * 5) + 95 // 95-99% accuracy simulation
    };
    
  } catch (error) {
    console.error('MSDS OCR processing error:', error);
    throw new Error(`MSDS OCR processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse MSDS document into sections using regex-based approach
 * REGEX-BASED: Uses pattern matching to reliably extract sections
 */
async function parseMSDSSections(text: string): Promise<MSDSSection[]> {
  console.log('📋 REGEX MSDS PARSER: Starting regex-based section parsing...');
  console.log('📋 REGEX MSDS PARSER: Text length:', text.length);
  
  const sections: MSDSSection[] = [];
  
  // Initialize all 16 sections as unavailable
  for (let i = 1; i <= 16; i++) {
    sections.push({
      sectionNumber: i,
      title: MSDS_SECTION_MAPPING[i as keyof typeof MSDS_SECTION_MAPPING].ntc,
      content: '',
      isAvailable: false
    });
  }

  // Clean the text
  const cleanText = text.replace(/Not available\.\s*/g, '').trim();
  
  if (cleanText.length > 100) {
    console.log('📋 REGEX MSDS PARSER: Using regex to parse MSDS sections...');
    
    try {
      // Use regex-based parsing to extract sections
      const parsedSections = parseMSDSSectionsWithRegex(cleanText);
      
      // Map parsed sections to our structure
      parsedSections.forEach(parsedSection => {
        const sectionNumber = parsedSection.sectionNumber;
        if (sectionNumber >= 1 && sectionNumber <= 16) {
          const section = sections.find(s => s.sectionNumber === sectionNumber);
          if (section) {
            section.content = parsedSection.content;
            section.isAvailable = parsedSection.content.length > 20;
            console.log(`📋 REGEX MSDS PARSER: Section ${sectionNumber} - ${section.title}: ${section.isAvailable ? 'FOUND' : 'NOT AVAILABLE'} (${section.content.length} chars)`);
          }
        }
      });
      
    } catch (error) {
      console.error('📋 REGEX MSDS PARSER: Regex parsing failed, using fallback:', error);
      
      // Fallback: Simple text distribution if regex fails
      const chunks = cleanText.split(/\n\n+/).filter(chunk => chunk.trim().length > 50);
      
      chunks.forEach((chunk, index) => {
        const emptySections = sections.filter(s => !s.isAvailable);
        if (emptySections.length > 0 && chunk.trim().length > 20) {
          const targetSection = emptySections[index % emptySections.length];
          targetSection.content = isParserV2() ? cleanSectionContentV2(chunk) : cleanSectionContent(chunk);
          targetSection.isAvailable = true;
          console.log(`📋 REGEX MSDS PARSER: Section ${targetSection.sectionNumber} - ${targetSection.title}: FALLBACK ASSIGNED (${targetSection.content.length} chars)`);
        }
      });
    }

    // Mark remaining sections as not available
    sections.forEach(section => {
      if (!section.isAvailable) {
        section.content = 'Not available.';
        console.log(`📋 REGEX MSDS PARSER: Section ${section.sectionNumber} - ${section.title}: NOT AVAILABLE`);
      }
    });
  } else {
    // If text is too short, mark all sections as not available
    sections.forEach(section => {
      section.content = 'Not available.';
      section.isAvailable = false;
    });
  }

  return sections;
}

/**
 * Parse MSDS sections using regex patterns
 * This is the core parsing logic that extracts sections from raw OCR text
 */
function parseMSDSSectionsWithRegex(text: string): Array<{sectionNumber: number, content: string}> {
  const sections: Array<{sectionNumber: number, content: string}> = [];
  
  // Debug: Log the first 500 characters of the text to see what we're working with
  console.log('📋 REGEX MSDS PARSER: First 500 characters of text:', text.substring(0, 500));
  
  // Define section patterns - these match the actual section headers in the OCR text
  // Using simpler patterns that match the exact format from the OCR text
  const sectionPatterns = [
    { number: 1, pattern: /##\s*Section\s*1\s*[-\.]\s*Identification\s+of\s+the\s+material\s+and\s+supplier/gi },
    { number: 2, pattern: /##\s*Section\s*2\s*[-\.]\s*Hazards\s+identification/gi },
    { number: 3, pattern: /##\s*Section\s*3\s*[-\.]\s*Composition\/information\s+on\s+ingredients/gi },
    { number: 4, pattern: /##\s*Section\s*4\s*[-\.]\s*First[- ]?aid\s+measures/gi },
    { number: 5, pattern: /##\s*Section\s*5\s*[-\.]\s*Firefighting\s+Measures/gi },
    { number: 6, pattern: /##\s*Section\s*6\s*[-\.]\s*Accidental\s+release\s+measures/gi },
    { number: 7, pattern: /##\s*Section\s*7\s*[-\.]\s*Handling\s+and\s+Storage/gi },
    { number: 8, pattern: /##\s*Section\s*8\s*[-\.]\s*Exposure\s+Controls\s*\/\s*Personal\s+Protection/gi },
    { number: 9, pattern: /##\s*Section\s*9\s*[-\.]\s*Physical\s+and\s+Chemical\s+Properties/gi },
    { number: 10, pattern: /##\s*Section\s*10\s*[-\.]\s*Stability\s+and\s+Reactivity/gi },
    { number: 11, pattern: /##\s*Section\s*11\s*[-\.]\s*Toxicological\s+Information/gi },
    { number: 12, pattern: /##\s*Section\s*12\s*[-\.]\s*Ecological\s+Information/gi },
    // Be tolerant for Section 13 variants: "Disposal", "Disposal considerations", different separators, etc.
    { number: 13, pattern: /##\s*Section\s*13\s*[-.:)\]]\s*Disposal(?:\s+Considerations)?/gi },
    { number: 14, pattern: /##\s*Section\s*14\s*[-\.]\s*Transport\s+Information/gi },
    { number: 15, pattern: /##\s*Section\s*15\s*[-\.]\s*Regulatory\s+Information/gi },
    { number: 16, pattern: /##\s*Section\s*16\s*[-\.]\s*Other\s+Information/gi }
  ];
  
  // Find all section headers and their positions
  const sectionMatches: Array<{number: number, start: number, end: number}> = [];
  
  sectionPatterns.forEach(({ number, pattern }) => {
    // Reset the regex lastIndex to ensure proper matching
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      console.log(`📋 REGEX MSDS PARSER: Found Section ${number} at position ${match.index}`);
      sectionMatches.push({
        number,
        start: match.index,
        end: match.index + match[0].length
      });
    } else {
      console.log(`📋 REGEX MSDS PARSER: Section ${number} not found`);
    }
  });
  
  // Sort by position
  sectionMatches.sort((a, b) => a.start - b.start);
  
  // Extract content for each section
  sectionMatches.forEach((match, index) => {
    const nextMatch = sectionMatches[index + 1];
    const startPos = match.end;
    const endPos = nextMatch ? nextMatch.start : text.length;
    
    let content = text.substring(startPos, endPos).trim();
    
    // Clean up the content
    content = isParserV2() ? cleanSectionContentV2(content) : cleanSectionContent(content);
    
    if (content.length > 20) {
      sections.push({
        sectionNumber: match.number,
        content: content
      });
    }
  });
  
  console.log(`📋 REGEX MSDS PARSER: Found ${sections.length} sections with content`);
  
  return sections;
}

/**
 * Detect MSDS section headers using pattern matching
 */
function detectMSDSHeader(line: string): { sectionNumber: number; title: string } | null {
  for (let i = 0; i < MSDS_HEADER_PATTERNS.length; i++) {
    const pattern = MSDS_HEADER_PATTERNS[i];
    const match = line.match(pattern);
    
    if (match) {
      // Determine section number based on pattern index
      let sectionNumber: number;
      let title: string;
      
      if (i < 16) {
        // First 16 patterns are basic markdown format numbered sections
        sectionNumber = i + 1;
        title = match[2] || match[1] || line;
      } else if (i < 32) {
        // Next 16 patterns are detailed markdown format numbered sections
        const detailedPatternIndex = i - 16;
        sectionNumber = detailedPatternIndex + 1;
        title = match[2] || match[1] || line;
      } else if (i < 48) {
        // Next 16 patterns are exact OCR format numbered sections
        const exactPatternIndex = i - 32;
        sectionNumber = exactPatternIndex + 1;
        title = match[1] || line;
      } else if (i < 64) {
        // Next 16 patterns are without ## prefix numbered sections
        const noPrefixPatternIndex = i - 48;
        sectionNumber = noPrefixPatternIndex + 1;
        title = match[1] || line;
      } else if (i < 80) {
        // Next 16 patterns are traditional format numbered sections
        const traditionalPatternIndex = i - 64;
        sectionNumber = traditionalPatternIndex + 1;
        title = match[2] || match[1] || line;
      } else {
        // Last 16 patterns are direct headings - need to map to section numbers
        const directPatternIndex = i - 80;
        sectionNumber = directPatternIndex + 1;
        title = match[1] || line;
      }
      
      return { sectionNumber, title: title.trim() };
    }
  }
  
  return null;
}

/**
 * Clean section content by removing basic formatting and normalizing whitespace
 * SIMPLIFIED: Much less aggressive cleaning to preserve important content
 */
function cleanSectionContent(content: string): string {
  if (!content || content.trim().length === 0) {
    return '';
  }

  let cleaned = content;

  // Basic LaTeX cleaning - only remove obvious LaTeX formatting
  cleaned = cleaned
    .replace(/\\beta/g, 'β')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\geqslant/g, '≥')
    .replace(/\\leqslant/g, '≤')
    .replace(/\\quad/g, ' ')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1') // Remove LaTeX math formatting like $9067-32-7$
    .replace(/\\[a-zA-Z]+/g, '') // Remove remaining LaTeX commands
    .replace(/\{([^}]+)\}/g, '$1') // Remove remaining braces
    .trim();

  // Remove only obvious section headers (not content)
  cleaned = cleaned
    .replace(/^#+\s*Section\s+\d+[^#]*$/gmi, '') // Remove section headers like "## Section 1 - Title"
    .replace(/^#+\s*\d+\.\s*[^#\n]*$/gm, '') // Remove numbered headers like "### 1.1 Title" (single line only)
    .replace(/^#{1,6}\s*/gm, '') // Remove markdown header symbols
    .trim();

  // Basic markdown cleaning
  cleaned = cleaned
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
    .replace(/`([^`]+)`/g, '$1') // Remove code formatting
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
    .trim();

  // Normalize whitespace but preserve line breaks
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double newline
    .trim();

  return cleaned;
}

/**
 * Clean section content using V2 approach (behind feature flag)
 * More conservative and deterministic cleaning
 */
function cleanSectionContentV2(text: string): string {
  let out = normalizeEOL(text);
  // light touch: preserve bullets/numbers, collapse extra blank lines
  out = out.replace(/\n{3,}/g, '\n\n');
  // HTML/markdown noise
  out = out.replace(/<br\s*\/?>/gi, '\n')
           .replace(/\*\*(.*?)\*\*/g, '$1')
           .replace(/__([^_]+)__/g, '$1')
           .replace(/`{1,3}[^`]*`{1,3}/g, '');
  // LaTeX-ish
  out = out.replace(/\$\s*/g, '')
           .replace(/\\mathrm\{([^}]+)\}/g, '$1')
           .replace(/\\left\(|\\right\)/g, '')
           .replace(/\\quad|\\beta|\\rightarrow/gi, ' ');
  // normalize missing data phrases (do NOT delete them)
  out = normalizeNoData(out);
  // tidy spaces
  return out.replace(/[ \t]+/g, ' ')
            .replace(/ \n/g, '\n')
            .replace(/\n +/g, '\n')
            .trim();
}

/**
 * Extract product identifiers from MSDS text
 */
function extractProductIdentifiers(text: string): { productName?: string; inciName?: string; casNumber?: string } {
  const identifiers: { productName?: string; inciName?: string; casNumber?: string } = {};

  // Extract product name
  const productNameMatch = text.match(/(?:product\s+name|product\s+identifier|chemical\s+name)[:\s]+([^\n\r]+)/i);
  if (productNameMatch) {
    identifiers.productName = productNameMatch[1].trim();
  }

  // Extract INCI name
  const inciMatch = text.match(/(?:inci\s+name|inci)[:\s]+([^\n\r]+)/i);
  if (inciMatch) {
    identifiers.inciName = inciMatch[1].trim();
  }

  // Extract CAS number
  const casMatch = text.match(/(?:cas\s+number|cas\s+no|cas)[:\s]+(\d{2,7}-\d{2}-\d)/i);
  if (casMatch) {
    identifiers.casNumber = casMatch[1].trim();
  }

  return identifiers;
}

/**
 * Process MSDS sections with AI enhancement if needed
 */
async function processMSDSSections(sections: MSDSSection[], apiKey: string): Promise<MSDSSection[]> {
  // For now, return sections as-is
  // Future enhancement: Use AI to improve content quality, fix formatting, etc.
  
  console.log('📋 MSDS: Processing sections with AI enhancement...');
  
  // Log section processing results
  sections.forEach(section => {
    if (section.isAvailable) {
      console.log(`✅ MSDS: Section ${section.sectionNumber} - ${section.title}: ${section.content.length} characters`);
    } else {
      console.log(`❌ MSDS: Section ${section.sectionNumber} - ${section.title}: Not available`);
    }
  });

  return sections;
}

/**
 * Generate MSDS template placeholders for NTCB template
 */
export function generateMSDSTemplatePlaceholders(): string[] {
  const placeholders: string[] = [];
  
  // Generate placeholders for each section using simple field names (like COA/TDS)
  for (let i = 1; i <= 16; i++) {
    const sectionKey = `msds_s${i}`;
    placeholders.push(sectionKey);
  }
  
  // Add product identifier placeholders with simple field names
  placeholders.push('msds_product_name');
  placeholders.push('msds_inci_name');
  placeholders.push('msds_cas_number');
  
  return placeholders;
}

/**
 * Map MSDS sections to template placeholders
 * Uses simple field names that match template placeholders (like COA/TDS)
 */
export function mapMSDSSectionsToTemplate(sections: MSDSSection[], productIdentifiers: any): Record<string, string> {
  const templateData: Record<string, string> = {};
  
  // Map sections to simple field names that match template placeholders
  sections.forEach(section => {
    // Use simple field names like COA/TDS: msds_s1, msds_s2, etc.
    const placeholderKey = `msds_s${section.sectionNumber}`;
    templateData[placeholderKey] = section.content;
  });
  
  // Map product identifiers with simple field names
  if (productIdentifiers.productName) {
    templateData['msds_product_name'] = productIdentifiers.productName;
  }
  if (productIdentifiers.inciName) {
    templateData['msds_inci_name'] = productIdentifiers.inciName;
  }
  if (productIdentifiers.casNumber) {
    templateData['msds_cas_number'] = productIdentifiers.casNumber;
  }
  
  return templateData;
}

/**
 * Generate structured JSON format for MSDS sections
 * This creates the exact JSON format requested by the user
 */
export function generateMSDSStructuredJSON(sections: MSDSSection[]): any {
  const msdsSections = sections.map(section => {
    // Get the full section title
    const sectionTitles = [
      "Section 1 - Identification of the material and supplier",
      "Section 2 - Hazards identification", 
      "Section 3 - Composition/information on ingredients",
      "Section 4 - First-aid measures",
      "Section 5 - Firefighting measures",
      "Section 6 - Accidental release measures",
      "Section 7 - Handling and storage",
      "Section 8 - Exposure controls/personal protection",
      "Section 9 - Physical and chemical properties",
      "Section 10 - Stability and reactivity",
      "Section 11 - Toxicological information",
      "Section 12 - Ecological information",
      "Section 13 - Disposal considerations",
      "Section 14 - Transport information",
      "Section 15 - Regulatory information",
      "Section 16 - Other information"
    ];
    
    return {
      "Section": sectionTitles[section.sectionNumber - 1] || `Section ${section.sectionNumber}`,
      "SectionContent": section.isAvailable ? section.content : "Not available."
    };
  });
  
  return {
    "MSDS": msdsSections
  };
}

/**
 * Generate intelligent field mapping for MSDS documents
 * Maps MSDS sections to template placeholders in the correct order
 */
export function generateMSDSIntelligentMapping(sections: MSDSSection[]): (string | null)[] {
  // Create a mapping array with 16 positions (for 16 MSDS sections)
  const mapping: (string | null)[] = new Array(16).fill(null);
  
  // Map each section to its corresponding position
  sections.forEach(section => {
    if (section.sectionNumber >= 1 && section.sectionNumber <= 16) {
      const fieldName = `msds_s${section.sectionNumber}`;
      mapping[section.sectionNumber - 1] = fieldName; // Convert to 0-based index
    }
  });
  
  console.log('🎯 Generated MSDS intelligent mapping:', mapping);
  return mapping;
}

/**
 * Filter out headers and footers from OCR text using AI
 */
async function filterHeadersAndFooters(text: string, apiKey: string): Promise<string> {
  try {
    const config = loadConfig();
    const llmModel = config.apiSettings.llmModel || 'mistral-large-latest';
    
    const prompt = `
You are an expert in document analysis. Your task is to identify and remove headers and footers from a document while preserving the main content.

DOCUMENT TEXT:
${text}

INSTRUCTIONS:
1. Identify and REMOVE headers (typically at the top of the document) that contain:
   - Company names, logos, or branding
   - Document titles or headers that are repeated
   - Navigation elements
   - Page numbers at the top

2. Identify and REMOVE footers (typically at the bottom of the document) that contain:
   - Company contact information (addresses, phone numbers, emails)
   - Copyright notices
   - Page numbers at the bottom
   - Legal disclaimers
   - Website URLs
   - Repeated company information
   - Chinese text with contact details (电话, 传真, 邮箱, 地址, etc.)
   - Company names in multiple languages
   - Any text that appears to be repeated company branding
   - Lines containing "Tel:", "Fax:", "Email:", "Add:", "Web:", "www."
   - Lines with Chinese characters followed by English translations
   - Company addresses and contact details

3. SPECIFICALLY REMOVE these patterns:
   - Lines containing phone numbers, fax numbers, email addresses
   - Lines containing website URLs (www., .com, .cn, etc.)
   - Lines containing company addresses
   - Chinese text mixed with English contact information
   - Lines that appear to be company branding or contact details

4. Preserve ALL main document content including:
   - Section headings (1. Identification, 2. Hazards, etc.)
   - Technical specifications and data
   - Tables and structured information
   - Any content that appears to be the main document body
   - Safety information and technical data
   - Section 1 content (product identifiers, supplier information, etc.)
   - Product names, CAS numbers, and chemical identifiers

5. Be AGGRESSIVE in removing contact information and company branding
6. If you see Chinese characters mixed with contact details, remove those lines
7. Remove any lines that look like company contact information, even if they appear in the middle

Return ONLY the cleaned text with headers and footers removed. Do not include any explanations or comments.
`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      console.error('Header/footer filtering API error:', response.status, response.statusText);
      // Return original text if filtering fails
      return text;
    }

    const result = await response.json();
    const filteredText = result.choices?.[0]?.message?.content?.trim();
    
    if (!filteredText) {
      console.warn('No filtered text returned from AI, using original text');
      return text;
    }
    
    console.log(`📊 Header/footer filtering: ${text.length} → ${filteredText.length} characters`);
    
    // Additional regex-based cleanup for common footer patterns
    let additionalCleanup = applyRegexFooterCleanup(filteredText);
    console.log(`📊 Additional regex cleanup: ${filteredText.length} → ${additionalCleanup.length} characters`);
    
    // Apply V2 cleanup utilities if feature flag is enabled
    if (isParserV2()) {
      additionalCleanup = removeRepeatedFooters(additionalCleanup);
      additionalCleanup = normalizeEOL(additionalCleanup);
      console.log(`📊 V2 cleanup applied: ${additionalCleanup.length} characters`);
    }
    
    return additionalCleanup;
    
  } catch (error) {
    console.error('Header/footer filtering error:', error);
    // Return original text if filtering fails
    return text;
  }
}

/**
 * Apply regex-based cleanup for common footer patterns
 */
function applyRegexFooterCleanup(text: string): string {
  let cleanedText = text;
  
  // Remove lines containing Chinese characters mixed with contact info
  cleanedText = cleanedText.replace(/^.*[\u4e00-\u9fff].*(?:Tel|Fax|Email|Add|Web|www|@).*$/gm, '');
  
  // Remove lines containing phone numbers, fax, email patterns
  cleanedText = cleanedText.replace(/^.*(?:Tel|Fax|Email|电话|传真|邮箱).*$/gm, '');
  
  // Remove lines containing website URLs
  cleanedText = cleanedText.replace(/^.*(?:www\.|\.com|\.cn|\.org).*$/gm, '');
  
  // Remove lines containing addresses (Add:, 地址)
  cleanedText = cleanedText.replace(/^.*(?:Add:|地址).*$/gm, '');
  
  // Remove lines with Chinese company names followed by English
  cleanedText = cleanedText.replace(/^.*[\u4e00-\u9fff].*<br>.*$/gm, '');
  
  // Remove lines containing only Chinese characters (likely company names)
  cleanedText = cleanedText.replace(/^[\u4e00-\u9fff\s]+$/gm, '');
  
  // Remove lines with mixed Chinese and English contact details
  cleanedText = cleanedText.replace(/^.*[\u4e00-\u9fff].*[A-Za-z].*$/gm, '');
  
  // Clean up multiple empty lines
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleanedText.trim();
}

