#!/usr/bin/env npx ts-node

/**
 * Test script for MSDS Parser
 * Tests the parser with a sample PDF file
 */

import { processMSDSPDF } from './msds-parser.js';
import * as path from 'path';
import * as fs from 'fs';

async function testParser() {
  console.log('🧪 Testing MSDS Parser...');
  
  // Test with one of the existing PDF files
  const testFiles = [
    'test_document.pdf',
    'test_download.pdf',
    'test_download2.pdf',
    'test_download3.pdf',
    'test_download4.pdf',
    'test_download5.pdf',
    'test_download6.pdf',
    'test_download7.pdf'
  ];
  
  let testFile = '';
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      testFile = file;
      break;
    }
  }
  
  if (!testFile) {
    console.log('❌ No test PDF files found in current directory');
    console.log('📁 Available files:', fs.readdirSync('.').filter(f => f.endsWith('.pdf')));
    return;
  }
  
  const outputPath = `test-output-${Date.now()}.json`;
  
  try {
    await processMSDSPDF(testFile, outputPath, {
      strict: true,
      stripHF: true,
      hfThreshold: 0.6,
      hfEdgeLines: 10
    });
    
    console.log('✅ Test completed successfully!');
    console.log(`📄 Output file: ${outputPath}`);
    
    // Show a preview of the output
    const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const sectionsWithContent = Object.entries(result).filter(([, content]) => content.trim().length > 0);
    
    console.log(`📊 Found content in ${sectionsWithContent.length}/16 sections:`);
    sectionsWithContent.forEach(([key, content]) => {
      console.log(`  ${key}: ${(content as string).substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testParser();
