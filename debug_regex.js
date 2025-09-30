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

console.log('Testing regex patterns...');

const sectionPatterns = [
  { number: 1, pattern: /##\s*Section\s*1\s*[-\.]\s*Identification\s+of\s+the\s+material\s+and\s+supplier/gi },
  { number: 2, pattern: /##\s*Section\s*2\s*[-\.]\s*Hazards\s+identification/gi }
];

sectionPatterns.forEach(({ number, pattern }) => {
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  if (match) {
    console.log(`✅ Section ${number} found at position ${match.index}`);
    console.log(`   Match: "${match[0]}"`);
  } else {
    console.log(`❌ Section ${number} not found`);
  }
});

// Test the exact text we're looking for
const section1Text = "## Section 1 - Identification of the material and supplier";
console.log(`\nTesting exact text: "${section1Text}"`);
const exactPattern = /##\s*Section\s*1\s*[-\.]\s*Identification\s+of\s+the\s+material\s+and\s+supplier/gi;
const exactMatch = exactPattern.exec(section1Text);
if (exactMatch) {
  console.log(`✅ Exact text matches`);
} else {
  console.log(`❌ Exact text does not match`);
}

