// src/msds/cleanup.ts

/**
 * Heal OCR breaks caused by hyphenation and line splitting
 * Merges lines where the previous line doesn't end in sentence punctuation
 * and the next line starts with a lowercase letter
 */
export function healOCRBreaks(text: string): string {
  // Merge lines like "Add: New Economic Development Zone of High" + "Speed Rail, Qufu…" 
  // when the previous line doesn't end in sentence punctuation.
  return text.replace(/([^\.\!\?:;,])\n(?!\n)([a-z])/g, '$1 $2');
}

export function removeRepeatedFooters(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);

  const keywordRxs = [
    // Contact information patterns
    /(电话|Tel)[：: ]/i,
    /(传真|Fax)[：: ]/i,
    /(邮箱|Email)[：: ]/i,
    /(地址|Add(?:ress)?)[：: ]/i,
    /(网址|Web)[：: ]/i,
    
    // Company domains
    /focusfreda\.com/i,
    /focuschem\.com/i,
    
    // Company name variations
    /Shandong\s+Focusfreda\s+Biotech\s+Co\.\s*Ltd/i,
    /Shandong\s+Focusfreda/i,
    /Focusfreda\s+Biotech/i,
    
    // Document headers/footers
    /SUPPLIER\s+MSDS/i,
    /MSDS\s+SUPPLIER/i,
    /document-\d+/i,
    /Document\s+No\.?\s*\d+/i,
    
    // Chinese company blocks
    /山东福瑞达生物科技有限公司/i,
    /福瑞达生物科技/i,
    
    // Common footer patterns
    /Page\s+\d+\s+of\s+\d+/i,
    /第\s*\d+\s*页/i,
    /共\s*\d+\s*页/i
  ];

  const counts = keywordRxs.map(rx => lines.filter(l => rx.test(l)).length);
  const removalRxs = keywordRxs.filter((rx, idx) => counts[idx] >= 2);

  return lines.filter(l => !removalRxs.some(rx => rx.test(l))).join('\n');
}

export function normalizeNoData(text: string): string {
  return text.replace(/\b(?:not\s+available|no\s+data\s+available)\b\.?/gi, 'No data available');
}

export function normalizeEOL(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '');
}

/**
 * Advanced repetitive content removal system
 * Removes repetitive patterns, headers, footers, and other noise from text
 */
export function advancedRepetitiveContentRemoval(text: string): string {
  if (!text) return text;
  
  console.log('🧹 Starting advanced repetitive content removal...');
  console.log('📏 Original text length:', text.length);
  
  let cleanedText = text;
  
  // Step 1: Remove repeated headers and footers
  cleanedText = removeRepeatedFooters(cleanedText);
  
  // Step 2: Heal OCR breaks
  cleanedText = healOCRBreaks(cleanedText);
  
  // Step 3: Normalize no data entries
  cleanedText = normalizeNoData(cleanedText);
  
  // Step 4: Normalize end of line characters
  cleanedText = normalizeEOL(cleanedText);
  
  // Step 5: Remove excessive whitespace
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleanedText = cleanedText.replace(/[ \t]+/g, ' ');
  
  // Step 6: Remove lines that are mostly special characters
  // BUT preserve table data and technical specifications
  const lines = cleanedText.split('\n');
  const filteredLines = lines.filter(line => {
    const cleanLine = line.trim();
    if (cleanLine.length === 0) return false;
    
    // Preserve lines that contain table markers or data patterns
    if (cleanLine.includes('|') || cleanLine.includes('---')) return true;
    
    // Preserve lines with technical symbols common in specifications
    const hasTechnicalSymbols = /[≥≤±%~×]|ppm|CFU|pH|Da/i.test(cleanLine);
    if (hasTechnicalSymbols) return true;
    
    // Preserve lines with number-heavy content (likely specifications)
    const numberRatio = (cleanLine.match(/[0-9]/g) || []).length / cleanLine.length;
    if (numberRatio > 0.2) return true;
    
    // Only remove lines that are VERY special character heavy (>90%) and long
    const specialCharRatio = (cleanLine.match(/[^a-zA-Z0-9\s\u4e00-\u9fff]/g) || []).length / cleanLine.length;
    if (specialCharRatio > 0.9 && cleanLine.length > 30) {
      return false;
    }
    
    return true;
  });
  
  cleanedText = filteredLines.join('\n');
  
  console.log('📏 Cleaned text length:', cleanedText.length);
  console.log('✅ Advanced repetitive content removal completed');
  
  return cleanedText;
}

/**
 * Clean extracted data to remove repetitive content
 */
export function cleanExtractedData(data: Record<string, any>): Record<string, any> {
  if (!data || typeof data !== 'object') return data;
  
  console.log('🧹 Cleaning extracted data...');
  
  const cleanedData: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }
    
    // Clean string values
    if (typeof value === 'string') {
      let cleanedValue = value.trim();
      
      // Preserve technical symbols and only remove truly problematic characters
      // Keep: letters, numbers, spaces, Chinese, common punctuation, technical symbols (≥≤±~×/)
      cleanedValue = cleanedValue.replace(/[^\w\s\u4e00-\u9fff.,%()\-+x10^≥≤±~×/:<>&;]/g, '');
      
      // Normalize whitespace
      cleanedValue = cleanedValue.replace(/\s+/g, ' ');
      
      if (cleanedValue.length > 0) {
        cleanedData[key] = cleanedValue;
      }
    } else {
      cleanedData[key] = value;
    }
  }
  
  console.log(`✅ Cleaned ${Object.keys(cleanedData).length} data fields`);
  return cleanedData;
}

/**
 * Normalize Unicode characters and punctuation
 */
export function normalizeUnicodeAndPunct(text: string): string {
  if (!text) return text;
  
  console.log('🔤 Normalizing Unicode and punctuation...');
  
  let normalizedText = text;
  
  // Normalize Unicode characters
  normalizedText = normalizedText.normalize('NFC');
  
  // Fix common punctuation issues
  normalizedText = normalizedText
    .replace(/[""]/g, '"')  // Smart quotes to regular quotes
    .replace(/['']/g, "'")  // Smart apostrophes to regular apostrophes
    .replace(/…/g, '...')   // Ellipsis to three dots
    .replace(/–/g, '-')     // En dash to hyphen
    .replace(/—/g, '-')     // Em dash to hyphen
    .replace(/°/g, '°')     // Degree symbol normalization
    .replace(/×/g, 'x')     // Multiplication symbol to x
    .replace(/±/g, '±')     // Plus-minus symbol normalization
    .replace(/≤/g, '<=')    // Less than or equal to
    .replace(/≥/g, '>=')    // Greater than or equal to
    .replace(/μ/g, 'μ')     // Micro symbol normalization
    .replace(/α/g, 'α')     // Alpha normalization
    .replace(/β/g, 'β')     // Beta normalization
    .replace(/γ/g, 'γ')     // Gamma normalization
    .replace(/δ/g, 'δ')     // Delta normalization
    .replace(/ε/g, 'ε')     // Epsilon normalization
    .replace(/ζ/g, 'ζ')     // Zeta normalization
    .replace(/η/g, 'η')     // Eta normalization
    .replace(/θ/g, 'θ')     // Theta normalization
    .replace(/ι/g, 'ι')     // Iota normalization
    .replace(/κ/g, 'κ')     // Kappa normalization
    .replace(/λ/g, 'λ')     // Lambda normalization
    .replace(/μ/g, 'μ')     // Mu normalization
    .replace(/ν/g, 'ν')     // Nu normalization
    .replace(/ξ/g, 'ξ')     // Xi normalization
    .replace(/ο/g, 'ο')     // Omicron normalization
    .replace(/π/g, 'π')     // Pi normalization
    .replace(/ρ/g, 'ρ')     // Rho normalization
    .replace(/σ/g, 'σ')     // Sigma normalization
    .replace(/τ/g, 'τ')     // Tau normalization
    .replace(/υ/g, 'υ')     // Upsilon normalization
    .replace(/φ/g, 'φ')     // Phi normalization
    .replace(/χ/g, 'χ')     // Chi normalization
    .replace(/ψ/g, 'ψ')     // Psi normalization
    .replace(/ω/g, 'ω');    // Omega normalization
  
  console.log('✅ Unicode and punctuation normalization completed');
  return normalizedText;
}

/**
 * Filter out headers and footers from text using LLM
 * This is a placeholder function that can be enhanced with AI-based filtering
 */
export async function filterHeadersAndFooters(text: string, apiKey?: string): Promise<string> {
  // For now, use the existing removeRepeatedFooters function
  // In the future, this could be enhanced to use AI for more sophisticated filtering
  return removeRepeatedFooters(text);
}
