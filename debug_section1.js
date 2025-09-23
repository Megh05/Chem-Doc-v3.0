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
  
  // Test if content is longer than 20 characters
  console.log('Content length > 20?', content.length > 20);
  
  // Test the cleanSectionContent function (simplified version)
  function cleanSectionContent(content) {
    if (!content || content.trim().length === 0) {
      return '';
    }

    let cleaned = content;

    // Remove LaTeX formatting first
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

    // Remove section headers and repeated titles more aggressively
    cleaned = cleaned
      .replace(/^#+\s*Section\s+\d+[^#]*$/gmi, '') // Remove section headers like "## Section 1 - Title"
      .replace(/^#+\s*\d+\.\s*[^#]*$/gmi, '') // Remove numbered headers like "## 1. Title"
      .replace(/^#{1,6}\s*/gm, '') // Remove markdown header symbols
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
      .replace(/`([^`]+)`/g, '$1') // Remove code formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
      .trim();

    // Remove repeated section titles and headers more aggressively
    cleaned = cleaned
      .replace(/^Section\s+\d+[^a-zA-Z]*/gmi, '') // Remove section headers at start of line
      .replace(/^\d+\.\s*[^a-zA-Z]*/gmi, '') // Remove numbered section headers
      .replace(/^(Identification|Hazards|Composition|First aid|Firefighting|Accidental release|Handling|Exposure|Physical|Stability|Toxicological|Ecological|Disposal|Transport|Regulatory|Other)\s*[:\-]*\s*/gmi, '') // Remove common section titles
      .replace(/^(Identification of the material and supplier|Hazards identification|Composition.*Ingredients|First aid measures|Firefighting measures|Accidental release measures|Handling and storage|Exposure controls|Physical and Chemical Properties|Stability and reactivity|Toxicological information|Ecological Information|Disposal considerations|Transport Information|Regulatory Information|Other Information)\s*[:\-]*\s*/gmi, '') // Remove full section titles
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .trim();

    // Remove common supplier branding patterns
    const brandingPatterns = [
      /^.*?end\s+of\s+msds.*$/gmi,
      /^.*?page\s+\d+.*$/gmi,
      /^.*?confidential.*$/gmi,
      /^.*?proprietary.*$/gmi,
      /^.*?copyright.*$/gmi,
      /^.*?©.*$/gmi,
      /^.*?all\s+rights\s+reserved.*$/gmi,
      /^.*?supplier\s+address.*$/gmi,
      /^.*?company\s+logo.*$/gmi,
      /^.*?phone.*$/gmi,
      /^.*?fax.*$/gmi,
      /^.*?email.*$/gmi,
      /^.*?website.*$/gmi,
      /^.*?www\..*$/gmi,
      /^.*?http.*$/gmi,
      // Chinese company branding patterns
      /^.*?电话 Tel：.*$/gmi,
      /^.*?传真 Fax：.*$/gmi,
      /^.*?邮箱 Email：.*$/gmi,
      /^.*?地址：.*$/gmi,
      /^.*?Add:.*$/gmi,
      /^.*?网址 Web：.*$/gmi,
      /^.*?# 山东焦点福瑞达生物股份有限公司.*$/gmi,
      /^.*?Shandong Focusfreda Biotech Co., Ltd.*$/gmi
    ];

    brandingPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Remove lines that are too short or contain only special characters
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.length < 3) return false;
      
      // Remove lines that are mostly special characters
      const specialCharRatio = (trimmed.match(/[^a-zA-Z0-9\s\u4e00-\u9fff]/g) || []).length / trimmed.length;
      if (specialCharRatio > 0.8) return false;
      
      return true;
    });

    return filteredLines.join('\n').trim();
  }
  
  const cleanedContent = cleanSectionContent(content);
  console.log('Cleaned Section 1 content:');
  console.log('Length:', cleanedContent.length);
  console.log('Content:');
  console.log(cleanedContent);
  console.log('\n---\n');
  console.log('Cleaned content length > 20?', cleanedContent.length > 20);
}

