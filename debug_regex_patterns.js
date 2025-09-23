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

console.log('Testing regex patterns:');

// Test the problematic pattern
const pattern1 = /^#+\s*\d+\.\s*[^#\n]*$/gm;
const matches1 = content.match(pattern1);
console.log('Pattern 1 matches:', matches1);

// Test a simpler pattern
const pattern2 = /^#+\s*\d+\.\s*[^\n]*$/gm;
const matches2 = content.match(pattern2);
console.log('Pattern 2 matches:', matches2);

// Test line by line
const lines = content.split('\n');
console.log('\nLine by line analysis:');
lines.forEach((line, index) => {
  const match1 = pattern1.test(line);
  const match2 = pattern2.test(line);
  if (match1 || match2) {
    console.log(`Line ${index}: "${line}" - matches pattern1: ${match1}, pattern2: ${match2}`);
  }
});

// Test the exact line that should match
const testLine = '### 1.1 Product identifier';
console.log(`\nTesting specific line: "${testLine}"`);
console.log('Pattern 1 match:', pattern1.test(testLine));
console.log('Pattern 2 match:', pattern2.test(testLine));

