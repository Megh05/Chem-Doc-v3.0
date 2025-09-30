const text = `# Material Safety Data Sheet 

## Section 1 - Identification of the material and supplier

### 1.1 Product identifier

Product name
CAS No.

Sodium Hyaluronate
$9067-32-7$
1.2 Details of the supplier of the safety data sheet

Manufacturer:
Address:

Telephone:
Fax:
E-Mail:
Shandong Focusfreda Biotech Co., Ltd
Add:New Economic Development Zone of High
Speed Rail,Qufu,Jining,Shandong,China
4000905566
+865373195599
sales@focusfreda.com
1.3 Emergency telephone number

Emergency response service: 4000905566

## Section 2 - Hazards identification`;

// Find Section 1 and Section 2 positions
const section1Pattern = /##\s*Section\s*1\s*[-\.]\s*Identification\s+of\s+the\s+material\s+and\s+supplier/gi;
const section2Pattern = /##\s*Section\s*2\s*[-\.]\s*Hazards\s+identification/gi;

const section1Match = section1Pattern.exec(text);
const section2Match = section2Pattern.exec(text);

if (section1Match && section2Match) {
  const startPos = section1Match.index + section1Match[0].length;
  const endPos = section2Match.index;
  
  let content = text.substring(startPos, endPos).trim();
  
  console.log('Raw Section 1 content:');
  console.log('Length:', content.length);
  console.log('Content:');
  console.log(content);
  console.log('\n---\n');
  
  // Test the updated cleanSectionContent function
  function cleanSectionContent(content) {
    if (!content || content.trim().length === 0) {
      return '';
    }

    let cleaned = content;

    // Special handling for Section 1 content - preserve important product and supplier information
    const isSection1Content = cleaned.includes('Product identifier') || 
                             cleaned.includes('Product name') || 
                             cleaned.includes('CAS No') ||
                             cleaned.includes('Manufacturer') ||
                             cleaned.includes('Emergency telephone');
    
    if (isSection1Content) {
      console.log('✅ Detected Section 1 content, using minimal cleaning');
      // For Section 1, only do minimal cleaning to preserve important information
      cleaned = cleaned
        .replace(/\\beta/g, 'β')
        .replace(/\\rightarrow/g, '→')
        .replace(/\\geqslant/g, '≥')
        .replace(/\\leqslant/g, '≤')
        .replace(/\\quad/g, ' ')
        .replace(/\\left\(/g, '(')
        .replace(/\\right\)/g, ')')
        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
        .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '') // Remove other LaTeX commands
        .replace(/\$([^$]+)\$/g, '$1') // Remove LaTeX math formatting like $9067-32-7$
        .replace(/\\[a-zA-Z]+/g, '') // Remove remaining LaTeX commands
        .replace(/\{([^}]+)\}/g, '$1') // Remove remaining braces
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .trim();
      
      // Remove only section headers, not the content
      cleaned = cleaned
        .replace(/^#+\s*Section\s+\d+[^#]*$/gmi, '') // Remove section headers like "## Section 1 - Title"
        .replace(/^#+\s*\d+\.\s*[^#]*$/gmi, '') // Remove numbered headers like "## 1. Title"
        .replace(/^#{1,6}\s*/gm, '') // Remove markdown header symbols
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .trim();
      
      return cleaned;
    }
    
    console.log('❌ Not detected as Section 1 content, using aggressive cleaning');
    return 'Not available.';
  }
  
  const cleanedContent = cleanSectionContent(content);
  console.log('Cleaned Section 1 content:');
  console.log('Length:', cleanedContent.length);
  console.log('Content:');
  console.log(cleanedContent);
  console.log('\n---\n');
  console.log('Cleaned content length > 20?', cleanedContent.length > 20);
}

