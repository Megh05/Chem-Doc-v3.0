const content = `### 1.1 Product identifier

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

Emergency response service: 4000905566`;

console.log('Original content:');
console.log(content);
console.log('Length:', content.length);
console.log('\n---\n');

let cleaned = content;

// Step 1: LaTeX cleaning
console.log('Step 1: LaTeX cleaning');
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

console.log('After LaTeX cleaning:');
console.log(cleaned);
console.log('Length:', cleaned.length);
console.log('\n---\n');

// Step 2: Remove section headers
console.log('Step 2: Remove section headers');
cleaned = cleaned.replace(/^#+\s*Section\s+\d+[^#]*$/gmi, '');
console.log('After removing section headers:');
console.log(cleaned);
console.log('Length:', cleaned.length);
console.log('\n---\n');

// Step 3: Remove numbered headers
console.log('Step 3: Remove numbered headers');
cleaned = cleaned.replace(/^#+\s*\d+\.\s*[^#\n]*$/gm, '');
console.log('After removing numbered headers:');
console.log(cleaned);
console.log('Length:', cleaned.length);
console.log('\n---\n');

// Step 4: Remove markdown symbols
console.log('Step 4: Remove markdown symbols');
cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');
console.log('After removing markdown symbols:');
console.log(cleaned);
console.log('Length:', cleaned.length);
console.log('\n---\n');

// Step 5: Normalize whitespace
console.log('Step 5: Normalize whitespace');
cleaned = cleaned.replace(/\s+/g, ' ').trim();
console.log('After normalizing whitespace:');
console.log(cleaned);
console.log('Length:', cleaned.length);
console.log('\n---\n');

console.log('Final result length > 20?', cleaned.length > 20);

