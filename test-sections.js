// Test the tolerant header matcher with various formats
const { splitSectionsByNumber } = require('./server/msds/sections.ts');

const testText = `# Material Safety Data Sheet

## Section 1 - Identification of the material and supplier
Product name: Test Product
CAS No: 123-45-6

## Section 2: Hazards identification  
Hazard statements: None

### 3) Composition/information on ingredients
Main components: Water, Salt

#### 4. First-aid measures
If inhaled: Move to fresh air

## Section 5 - Fire-fighting measures
Use water spray

## Section 6: Accidental release measures
Avoid breathing vapors

### 7) Handling and storage
Store in cool, dry place

## Section 8 - Exposure controls/personal protection
Use appropriate PPE

## Section 9: Physical & Chemical properties
Appearance: White powder

### 10) Stability and reactivity
Stable under normal conditions

## Section 11 - Toxicological information
No acute toxicity

## Section 12: Ecological information
No ecological toxicity

## Section 13 - Disposal considerations
Dispose according to local regulations

## Section 14: Transport information
Not dangerous goods

## Section 15 - Regulatory information
Complies with regulations

## Section 16: Other information
Additional information here`;

console.log('Testing tolerant header matcher...');
const sections = splitSectionsByNumber(testText);
console.log(`Found ${sections.length} sections:`);
sections.forEach(s => {
  console.log(`  Section ${s.number}: ${s.title} (${s.content.length} chars)`);
});
