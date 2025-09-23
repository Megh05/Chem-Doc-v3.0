# MSDS PDF Parser

A standalone TypeScript script that extracts verbatim 16-section content from MSDS PDFs using precise text extraction and section boundary detection.

## Features

- **Precise Text Extraction**: Uses `pdfjs-dist` to extract text page-by-page in reading order
- **Header/Footer Removal**: Intelligently removes repeated headers/footers across pages
- **Section Boundary Detection**: Uses regex patterns to find "Section N - Title" headings
- **Verbatim Content**: Preserves exact text content between sections (no normalization)
- **Template Mapping**: Maps to exact 16-section template keys
- **CLI Interface**: Easy-to-use command-line interface with options

## Installation

The required packages are already installed. If you need to reinstall:

```bash
npm install pdfjs-dist yargs @types/node ts-node typescript
```

## Usage

### Basic Usage

```bash
npx ts-node msds-parser.ts --pdf "path/to/MSDS.pdf" --out "path/to/output.json"
```

### With Options

```bash
npx ts-node msds-parser.ts \
  --pdf "path/to/MSDS.pdf" \
  --out "path/to/output.json" \
  --strict true \
  --stripHF true \
  --hfThreshold 0.6 \
  --hfEdgeLines 10
```

### Test the Parser

```bash
npx ts-node test-parser.ts
```

## Command Line Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--pdf`, `-p` | string | required | Input PDF file path |
| `--out`, `-o` | string | required | Output JSON file path |
| `--strict`, `-s` | boolean | true | Keep text verbatim (no normalization) |
| `--stripHF`, `-h` | boolean | true | Remove repeated headers/footers |
| `--hfThreshold`, `-t` | number | 0.6 | Threshold for header/footer removal (0.0-1.0) |
| `--hfEdgeLines`, `-e` | number | 10 | Number of edge lines to check for headers/footers |

## How It Works

### 1. Text Extraction
- Uses `pdfjs-dist` to extract text from each PDF page
- Groups text items into lines by Y coordinate (with tolerance)
- Sorts lines top-to-bottom, items left-to-right
- Preserves reading order and spacing

### 2. Header/Footer Removal (Optional)
- Analyzes top and bottom lines across all pages
- Identifies lines that appear on ≥60% of pages (configurable)
- Removes only repeated lines from page edges
- Preserves section content intact

### 3. Section Detection
- Uses regex: `^Section\s+(\d{1,2})\s*[-–:]\s*(.+?)$`
- Captures section number (1-16) and supplier's title
- Maps content between consecutive section headings

### 4. Template Mapping
- Maps to exact 16-section template keys:
  - `1. Identification of the material and supplier:`
  - `2. Hazards Identification:`
  - `3. Composition/ Information on Ingredients:`
  - ... (all 16 sections)

### 5. Output
- JSON with template keys as keys
- Verbatim content as values (no rewriting)
- Empty strings for missing sections

## Output Format

```json
{
  "1. Identification of the material and supplier:": "Product: Chemical Name\nManufacturer: Company Name\n...",
  "2. Hazards Identification:": "Signal word: Warning\nHazard statements: H315, H319\n...",
  "3. Composition/ Information on Ingredients:": "CAS No: 123-45-6\nConcentration: 95%\n...",
  ...
  "16. Other Information:": "Date of preparation: 2024-01-01\n..."
}
```

## Examples

### Extract with default settings
```bash
npx ts-node msds-parser.ts --pdf "MSDS.pdf" --out "output.json"
```

### Extract without header/footer removal
```bash
npx ts-node msds-parser.ts --pdf "MSDS.pdf" --out "output.json" --stripHF false
```

### Extract with normalization (not strict)
```bash
npx ts-node msds-parser.ts --pdf "MSDS.pdf" --out "output.json" --strict false
```

### Custom header/footer settings
```bash
npx ts-node msds-parser.ts \
  --pdf "MSDS.pdf" \
  --out "output.json" \
  --hfThreshold 0.8 \
  --hfEdgeLines 5
```

## Troubleshooting

### Scanned PDFs
For PDFs without embedded text (scanned images), you'll need OCR first:
```bash
# Use tesseract or similar OCR tool first
# Then run the parser on the OCR'd text
```

### Weird Section Headings
If suppliers use non-standard headings, you can modify the regex in `splitIntoSections()`:
```typescript
// Add fallback patterns
const sectionRegex = /^(?:Section\s+(\d{1,2})|(\d{1,2})\.)\s*[-–:]\s*(.+?)$/gim;
```

### Unicode Issues
The parser preserves all Unicode characters. If you need ASCII-only output, add a conversion step.

## Integration

You can import and use the parser functions in other TypeScript files:

```typescript
import { processMSDSPDF, extractTextFromPDF } from './msds-parser';

// Use in your application
await processMSDSPDF('input.pdf', 'output.json', {
  strict: true,
  stripHF: true,
  hfThreshold: 0.6,
  hfEdgeLines: 10
});
```

## Performance

- Processes ~1-2 pages per second
- Memory usage scales with PDF size
- Works best with PDFs that have embedded text
- Header/footer removal adds ~20% processing time

## License

Same as the main project.

