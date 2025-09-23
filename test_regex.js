const text = '## Section 1 - Identification of the material and supplier';
const pattern = /##\s*Section\s*1\s*[-\.]\s*Identification\s+of\s+the\s+material\s+and\s+supplier/gi;
const match = pattern.exec(text);
console.log('Match found:', !!match);
if (match) console.log('Match:', match[0]);

