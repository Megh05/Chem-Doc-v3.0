import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import officegen from "officegen";
import mammoth from "mammoth";
import JSZip from "jszip";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import { storage } from "./storage";
import { loadConfig, saveConfig, resetConfig } from "./config";
import { insertTemplateSchema, insertDocumentSchema, insertProcessingJobSchema, insertSavedDocumentSchema } from "@shared/schema";
import { processDocumentWithMistral, extractPlaceholdersFromTemplate, mapExtractedDataToTemplate } from "./lib/mistral";

// XML escaping function to prevent corruption
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Field name normalization function
function normalizeFieldName(corruptedName: string): string {
  // Map corrupted field names to clean template field names
  const cleanName = corruptedName
    .toLowerCase()
    .replace(/^_+|_+$/g, '')  // Remove leading/trailing underscores
    .replace(/_+/g, '_')      // Replace multiple underscores with single
    .replace(/[^a-z0-9_]/g, '') // Remove non-alphanumeric except underscores
    .trim();
  
  // Field name mapping table
  const fieldMappings: Record<string, string> = {
    'appearance_white_solid_powder': 'appearance',
    'sodium_hyaluronate_content_95': 'sodium_hyaluronate_content', 
    'protein_01': 'protein',
    'loss_on_drying_10': 'loss_on_drying',
    'ph_5085': 'ph',
    'staphylococcus_aureus_negative': 'staphylococcus_aureus',
    'pseudomonas_aeruginosa_negative': 'pseudomonas_aeruginosa',
    'heavy_metal_20_ppm': 'heavy_metal',
    'total_bacteria_100_cfug': 'total_bacteria',
    'yeast_and_molds_50_cfug': 'yeast_and_molds'
  };
  
  return fieldMappings[cleanName] || cleanName;
}

// Normalize extracted data to clean field names
function normalizeExtractedData(rawData: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(rawData)) {
    const cleanKey = normalizeFieldName(key);
    normalized[cleanKey] = value;
  }
  
  return normalized;
}

// Simple fallback mapping function
function getFallbackMappingSimple(fieldNames: string[]): string[] {
  // Return fields in a logical order for CoA templates
  const priorityOrder = [
    'batch_number', 'manufacturing_date', 'expiry_date', 'appearance',
    'molecular_weight', 'sodium_hyaluronate_content', 'protein', 'loss_on_drying',
    'ph', 'staphylococcus_aureus', 'pseudomonas_aeruginosa', 'heavy_metal',
    'total_bacteria', 'yeast_and_molds', 'issued_date', 'test_result'
  ];
  
  // Filter to only include fields that exist in the data
  return priorityOrder.filter(field => fieldNames.includes(field))
    .concat(fieldNames.filter(field => !priorityOrder.includes(field)));
}

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ 
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Templates routes
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Extract placeholders from template automatically
      let placeholders: string[] = [];
      try {
        placeholders = await extractPlaceholdersFromTemplate(req.file.path);
        console.log(`Extracted ${placeholders.length} placeholders from template:`, placeholders);
      } catch (error) {
        console.error('Failed to extract placeholders from template:', error);
        // Use fallback placeholders if extraction fails
        placeholders = req.body.placeholders ? JSON.parse(req.body.placeholders) : [];
      }

      const templateData = {
        name: req.body.name,
        type: req.body.type,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        placeholders
      };

      const validatedData = insertTemplateSchema.parse(templateData);
      const template = await storage.createTemplate(validatedData);
      
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to create template", error: error.message });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    try {
      const updatedTemplate = await storage.updateTemplate(req.params.id, req.body);
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(updatedTemplate);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update template", error: error.message });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete template", error: error.message });
    }
  });

  app.get("/api/templates/:id/download", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // For the uploaded templates, look for the file by scanning the uploads directory
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      // First try to find by exact filename
      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        // For uploaded files, find by scanning directory and matching size
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (!targetFile) {
        return res.status(404).json({ message: "Template file not found" });
      }

      const filePath = path.join(uploadDir, targetFile);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${template.fileName}"`);
      res.sendFile(path.resolve(filePath));
    } catch (error: any) {
      res.status(500).json({ message: "Failed to download template", error: error.message });
    }
  });

  // New endpoint to get template preview HTML
  app.get("/api/templates/:id/preview", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Find template file
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (!targetFile) {
        return res.status(404).json({ message: "Template file not found" });
      }

      const templatePath = path.join(uploadDir, targetFile);
      const structure = await parseTemplateStructure(templatePath);
      
      res.json({
        html: structure.html,
        placeholders: template.placeholders
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to parse template", error: error.message });
    }
  });

  // Documents routes
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const documentData = {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path
      };

      const validatedData = insertDocumentSchema.parse(documentData);
      const document = await storage.createDocument(validatedData);
      
      res.status(201).json(document);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to upload document", error: error.message });
    }
  });

  // Processing jobs routes
  app.get("/api/processing-jobs", async (req, res) => {
    try {
      const jobs = await storage.getProcessingJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch processing jobs" });
    }
  });

  app.get("/api/processing-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getProcessingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Processing job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch processing job" });
    }
  });

  app.post("/api/processing-jobs", async (req, res) => {
    try {
      const jobData = insertProcessingJobSchema.parse(req.body);
      const job = await storage.createProcessingJob(jobData);
      
      // Start processing in background
      processDocumentInBackground(job.id);
      
      res.status(201).json(job);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to create processing job", error: error.message });
    }
  });

  app.patch("/api/processing-jobs/:id", async (req, res) => {
    try {
      const updatedJob = await storage.updateProcessingJob(req.params.id, req.body);
      if (!updatedJob) {
        return res.status(404).json({ message: "Processing job not found" });
      }
      res.json(updatedJob);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update processing job", error: error.message });
    }
  });

  // Configuration endpoints
  app.get("/api/config", async (req, res) => {
    try {
      const config = loadConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load configuration", error: error.message });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      saveConfig(req.body);
      res.json({ message: "Configuration saved successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to save configuration", error: error.message });
    }
  });

  app.post("/api/config/reset", async (req, res) => {
    try {
      const defaultConfig = resetConfig();
      res.json({ message: "Configuration reset to defaults", config: defaultConfig });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to reset configuration", error: error.message });
    }
  });

  // Process document endpoint
  app.post("/api/process-document", async (req, res) => {
    try {
      const { documentId, templateId } = req.body;
      
      const document = await storage.getDocument(documentId);
      const template = await storage.getTemplate(templateId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Create processing job
      const job = await storage.createProcessingJob({
        documentId,
        templateId,
        status: 'pending'
      });

      // Start processing
      processDocumentInBackground(job.id);
      
      res.status(201).json(job);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to start document processing", error: error.message });
    }
  });

  // Intelligent mapping endpoint
  app.post("/api/intelligent-mapping", async (req, res) => {
    try {
      const { extractedData, templateHtml, templateId } = req.body;
      
      console.log('🔍 Intelligent mapping request received:');
      console.log('  - templateId:', templateId);
      console.log('  - has extractedData:', !!extractedData);
      console.log('  - has templateHtml:', !!templateHtml);
      
      if (!extractedData || !templateHtml) {
        return res.status(400).json({ message: "Missing extractedData or templateHtml" });
      }

      const config = loadConfig();
      const MISTRAL_API_KEY = config.apiSettings.mistralApiKey || process.env.MISTRAL_API_KEY;
      
      if (!MISTRAL_API_KEY) {
        return res.status(500).json({ message: "Mistral API key not configured" });
      }

      const mappingOrder = await mapExtractedDataToTemplate(
        extractedData,
        templateHtml,
        MISTRAL_API_KEY
      );
      
      console.log('🎯 Generated intelligent mapping:', mappingOrder);
      
      // Store the intelligent mapping in the template for future use
      if (templateId && mappingOrder.length > 0) {
        try {
          console.log('💾 Attempting to store mapping in template:', templateId);
          await storage.updateTemplate(templateId, { fieldMapping: mappingOrder });
          console.log('✅ Successfully stored intelligent field mapping in template:', templateId);
        } catch (storageError) {
          console.error('❌ Failed to store field mapping:', storageError);
        }
      } else {
        console.warn('⚠️ No templateId provided or empty mapping, cannot store');
      }
      
      res.json(mappingOrder);
    } catch (error: any) {
      console.error('Intelligent mapping error:', error);
      res.status(500).json({ message: "Failed to generate intelligent mapping", error: error.message });
    }
  });

  // Document generation endpoint
  app.post("/api/generate-document/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { format, data } = req.body;
      
      // Find job by either id or documentId to support both cases
      const jobs = await storage.getProcessingJobs();
      const job = jobs.find(j => j.id === jobId || j.documentId === jobId);
      if (!job) {
        return res.status(404).json({ message: "Processing job not found" });
      }

      const template = await storage.getTemplate(job.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Find template file
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (!targetFile) {
        return res.status(404).json({ message: "Template file not found" });
      }

      const templatePath = path.join(uploadDir, targetFile);
      const rawDocumentData = data || job.extractedData || {};
      
      // Normalize extracted data to clean field names
      const documentData = normalizeExtractedData(rawDocumentData);
      console.log('🧹 Normalized document data:', documentData);
      
      // Get template structure for intelligent mapping
      const structure = await parseTemplateStructure(templatePath);
      let intelligentMapping: string[] | null = null;
      
      console.log('🔍 Template analysis for document generation:');
      console.log('  - Template ID:', template.id);
      console.log('  - Template has fieldMapping:', !!(template as any).fieldMapping);
      console.log('  - Template fieldMapping length:', (template as any).fieldMapping?.length || 0);
      console.log('  - Template fieldMapping:', (template as any).fieldMapping);
      
      // Use the stored intelligent mapping from the template if available
      if ((template as any).fieldMapping && (template as any).fieldMapping.length > 0) {
        intelligentMapping = (template as any).fieldMapping;
        console.log('🎯 Using stored intelligent field mapping:', intelligentMapping);
      } else {
        // Fallback to generating new intelligent mapping
        try {
          const config = loadConfig();
          intelligentMapping = await mapExtractedDataToTemplate(
            documentData,
            structure.html,
            config.apiSettings.mistralApiKey || process.env.MISTRAL_API_KEY || ''
          );
          console.log('🎯 Generated new intelligent field mapping:', intelligentMapping);
          
          // Store the new mapping for future use
          if (intelligentMapping.length > 0) {
            await storage.updateTemplate(template.id, { fieldMapping: intelligentMapping });
            console.log('💾 Stored new field mapping in template');
          }
        } catch (mappingError) {
          console.warn('⚠️ Failed to generate intelligent mapping, using fallback:', mappingError);
          intelligentMapping = getFallbackMappingSimple(Object.keys(documentData));
        }
      }
      

      if (format === 'pdf') {
        // Generate PDF using pdf-lib for better ES module compatibility
        const { PDFDocument, rgb } = await import('pdf-lib');
        let htmlContent = structure.html;
        
        // Replace {} placeholders in sequence using intelligent mapping
        if (intelligentMapping) {
          console.log('🔧 Replacing placeholders with intelligent mapping...');
          
          // First, replace named placeholders for better accuracy
          Object.keys(documentData).forEach(key => {
            const value = documentData[key] || '';
            const namedPlaceholder = `{${key}}`;
            if (htmlContent.includes(namedPlaceholder)) {
              htmlContent = htmlContent.replace(new RegExp(namedPlaceholder, 'g'), value.toString());
              console.log(`  ✅ Replaced {${key}} with: ${value}`);
            }
          });
          
          // Then handle any remaining {} placeholders with intelligent mapping
          let placeholderIndex = 0;
          htmlContent = htmlContent.replace(/\{\}/g, () => {
            if (placeholderIndex < intelligentMapping!.length) {
              const fieldName = intelligentMapping![placeholderIndex];
              const value = documentData[fieldName] || '';
              placeholderIndex++;
              console.log(`  🔄 Replaced placeholder ${placeholderIndex} with ${fieldName}: ${value}`);
              return value.toString();
            }
            console.log(`  ⚠️ No more mapping for placeholder ${placeholderIndex + 1}`);
            return '';
          });
        } else {
          // Fallback: replace {} placeholders with data in field order
          const fieldNames = Object.keys(documentData);
          let placeholderIndex = 0;
          htmlContent = htmlContent.replace(/\{\}/g, () => {
            if (placeholderIndex < fieldNames.length) {
              const fieldName = fieldNames[placeholderIndex];
              const value = documentData[fieldName] || '';
              placeholderIndex++;
              return value.toString();
            }
            return '';
          });
        }
        
        // Also replace any named placeholders
        Object.keys(documentData).forEach(key => {
          const value = documentData[key] || '';
          const placeholderPatterns = [
            new RegExp(`\\{${key}\\}`, 'g'),
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
            new RegExp(`___${key}___`, 'g'),
            new RegExp(`\\[${key}\\]`, 'g')
          ];
          
          placeholderPatterns.forEach(pattern => {
            htmlContent = htmlContent.replace(pattern, value);
          });
        });
        
        // Create a simple PDF with text content (until we get proper HTML-to-PDF working)
        // This is a temporary solution to test data replacement
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4 size
        const { width, height } = page.getSize();
        
        // Extract text content from HTML (simple approach)
        const textContent = htmlContent
          .replace(/<[^>]*>/g, '\n') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        const lines = textContent.split('\n').filter(line => line.trim());
        let yPosition = height - 50;
        
        for (const line of lines.slice(0, 40)) { // Limit to fit on page
          if (yPosition < 50) break;
          
          page.drawText(line.trim().substring(0, 80), { // Limit line length
            x: 50,
            y: yPosition,
            size: 10,
            color: rgb(0, 0, 0),
          });
          yPosition -= 15;
        }
        
        const pdfBytes = await pdfDoc.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name}_filled.pdf"`);
        res.send(Buffer.from(pdfBytes));
        
      } else if (format === 'docx') {
        // Generate DOCX using the template-based approach with intelligent mapping
        const filledDocxBuffer = await fillTemplateWithData(templatePath, documentData, intelligentMapping);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name}_filled.docx"`);
        res.send(filledDocxBuffer);
        
      } else {
        return res.status(400).json({ message: "Invalid format. Use 'pdf' or 'docx'" });
      }
      
    } catch (error: any) {
      console.error('Document generation error:', error);
      res.status(500).json({ message: "Failed to generate document", error: error.message });
    }
  });

  // Saved documents endpoints
  app.get("/api/saved-documents", async (req, res) => {
    try {
      const savedDocuments = await storage.getSavedDocuments();
      res.json(savedDocuments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved documents" });
    }
  });

  app.post("/api/saved-documents", async (req, res) => {
    try {
      const validatedData = insertSavedDocumentSchema.parse(req.body);
      const savedDocument = await storage.createSavedDocument(validatedData);
      res.status(201).json(savedDocument);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to save document", error: error.message });
    }
  });

  app.post("/api/saved-documents/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const { format } = req.body;
      
      const savedDocument = await storage.getSavedDocument(id);
      if (!savedDocument) {
        return res.status(404).json({ message: "Saved document not found" });
      }

      const template = await storage.getTemplate(savedDocument.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (format === 'pdf') {
        // Generate proper PDF using the same approach as the main endpoint
        const { PDFDocument, rgb } = await import('pdf-lib');
        
        // Generate HTML content with filled data
        const htmlContent = generateHTMLContent(template, savedDocument.finalData);
        
        // Create a PDF document
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4 size
        const { width, height } = page.getSize();
        
        // Extract text content from HTML (simple approach)
        const textContent = htmlContent
          .replace(/<[^>]*>/g, '\n') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        const lines = textContent.split('\n').filter(line => line.trim());
        let yPosition = height - 50;
        
        // Add document title
        if (template.name) {
          page.drawText(template.name, {
            x: 50,
            y: yPosition,
            size: 16,
            color: rgb(0, 0, 0),
          });
          yPosition -= 30;
        }
        
        // Add content lines
        for (const line of lines.slice(0, 35)) { // Limit to fit on page
          if (yPosition < 50) break;
          
          page.drawText(line.trim().substring(0, 80), { // Limit line length
            x: 50,
            y: yPosition,
            size: 10,
            color: rgb(0, 0, 0),
          });
          yPosition -= 15;
        }
        
        const pdfBytes = await pdfDoc.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${savedDocument.name}.pdf"`);
        res.send(Buffer.from(pdfBytes));
        
      } else if (format === 'docx') {
        const docx = officegen('docx');
        
        // Add dynamic title based on template type
        const documentTitle = template.type === 'TDS' ? 'TECHNICAL DATA SHEET' : 
                             template.type === 'MDMS' ? 'MATERIAL DATA MANAGEMENT SHEET' : 
                             'CERTIFICATE OF ANALYSIS';
        const title = docx.createP();
        title.addText(documentTitle, { font_face: 'Arial', font_size: 16, bold: true });
        title.options.align = 'center';
        
        // Add content
        const content = generateDocxContent(template, savedDocument.finalData);
        content.forEach(line => {
          const p = docx.createP();
          p.addText(line.text, line.options || { font_face: 'Arial', font_size: 11 });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${savedDocument.name}.docx"`);
        
        docx.generate(res);
        
      } else {
        return res.status(400).json({ message: "Invalid format. Use 'pdf' or 'docx'" });
      }
      
    } catch (error: any) {
      console.error('Document download error:', error);
      res.status(500).json({ message: "Failed to download document", error: error.message });
    }
  });

  app.delete("/api/saved-documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSavedDocument(id);
      if (!deleted) {
        return res.status(404).json({ message: "Saved document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete document", error: error.message });
    }
  });

  // Processing jobs delete endpoint
  app.delete("/api/processing-jobs/:id", async (req, res) => {
    const { id } = req.params;
    try {
      console.log(`🗑️ Attempting to delete processing job: ${id}`);
      
      // Get the current jobs before deletion for debugging
      const jobsBefore = await storage.getProcessingJobs();
      console.log(`📊 Jobs before deletion: ${jobsBefore.length}`);
      
      const deleted = await storage.deleteProcessingJob(id);
      if (!deleted) {
        console.log(`❌ Processing job not found: ${id}`);
        return res.status(404).json({ message: "Processing job not found" });
      }
      
      // Get the current jobs after deletion for debugging
      const jobsAfter = await storage.getProcessingJobs();
      console.log(`📊 Jobs after deletion: ${jobsAfter.length}`);
      console.log(`✅ Successfully deleted processing job: ${id}`);
      
      res.status(200).json({ message: "Processing job deleted successfully" });
    } catch (error: any) {
      console.error(`❌ Failed to delete processing job ${id}:`, error);
      res.status(500).json({ message: "Failed to delete processing job", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer
}

// Helper function to parse DOCX template structure
async function parseTemplateStructure(templatePath: string) {
  try {
    const data = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(data);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    
    if (!documentXml) {
      throw new Error("Could not extract document.xml from DOCX");
    }

    // Extract the raw structure for template preview
    const result = await mammoth.convertToHtml({ path: templatePath });
    const htmlContent = result.value;
    
    return {
      html: htmlContent,
      xml: documentXml,
      messages: result.messages
    };
  } catch (error) {
    console.error('Template parsing error:', error);
    throw error;
  }
}

// Helper function to fill template with extracted data
async function fillTemplateWithData(templatePath: string, extractedData: Record<string, any>, intelligentMapping?: string[] | null) {
  try {
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);
    
    // Get document.xml content
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      throw new Error("Could not extract document.xml from DOCX");
    }

    // Replace placeholders in the XML
    let modifiedXml = documentXml;
    
    console.log('🔧 DOCX: Replacing placeholders with intelligent mapping...');
    
    // First, replace named placeholders for better accuracy
    Object.keys(extractedData).forEach(key => {
      const value = escapeXml(extractedData[key]?.toString() || '');
      const namedPlaceholder = `{${key}}`;
      if (modifiedXml.includes(namedPlaceholder)) {
        modifiedXml = modifiedXml.replace(new RegExp(namedPlaceholder, 'g'), value);
        console.log(`  ✅ DOCX: Replaced {${key}} with: ${value}`);
      }
    });
    
    // Then handle any remaining {} placeholders with intelligent mapping
    if (intelligentMapping) {
      let placeholderIndex = 0;
      modifiedXml = modifiedXml.replace(/\{\}/g, () => {
        if (placeholderIndex < intelligentMapping!.length) {
          const fieldName = intelligentMapping![placeholderIndex];
          const value = extractedData[fieldName] || '';
          placeholderIndex++;
          console.log(`  🔄 DOCX: Replaced placeholder ${placeholderIndex} with ${fieldName}: ${value}`);
          return escapeXml(value.toString());
        }
        console.log(`  ⚠️ DOCX: No more mapping for placeholder ${placeholderIndex + 1}`);
        return '';
      });
    } else {
      // Fallback: replace {} placeholders with data in field order
      const fieldNames = Object.keys(extractedData);
      let placeholderIndex = 0;
      modifiedXml = modifiedXml.replace(/\{\}/g, () => {
        if (placeholderIndex < fieldNames.length) {
          const fieldName = fieldNames[placeholderIndex];
          const value = extractedData[fieldName] || '';
          placeholderIndex++;
          console.log(`  🔄 DOCX: Fallback placeholder ${placeholderIndex} with ${fieldName}: ${value}`);
          return escapeXml(value.toString());
        }
        return '';
      });
    }
    
    // Also replace any other placeholder formats that might exist
    Object.keys(extractedData).forEach(key => {
      const value = escapeXml(extractedData[key]?.toString() || '');
      // Replace various placeholder formats
      const placeholderPatterns = [
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        new RegExp(`___${key}___`, 'g'),
        new RegExp(`\\[${key}\\]`, 'g')
      ];
      
      placeholderPatterns.forEach(pattern => {
        if (modifiedXml.match(pattern)) {
          modifiedXml = modifiedXml.replace(pattern, value);
          console.log(`  ✅ DOCX: Replaced alternative placeholder for ${key}`);
        }
      });
    });

    // Update the document.xml in the zip
    zip.file("word/document.xml", modifiedXml);
    
    // Generate the modified DOCX
    const modifiedBuffer = await zip.generateAsync({ type: "nodebuffer" });
    return modifiedBuffer;
    
  } catch (error) {
    console.error('Template filling error:', error);
    throw error;
  }
}

function generateHTMLContent(template: any, data: Record<string, any>): string {
  // Generate dynamic HTML based on extracted data without hardcoded templates
  const documentTitle = 'AI-Generated Document';
  
  // Generate dynamic field rows from all extracted data
  const fieldRows = Object.entries(data)
    .filter(([key, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      return `
        <div class="field-row">
          <span class="label">${label}:</span>
          <span class="value">${value}</span>
        </div>
      `;
    }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${documentTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .field-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: bold; }
        .value { color: #2563eb; }
        .footer { text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${documentTitle}</div>
      </div>
      
      ${fieldRows}
      
      <div class="footer">
        <strong>Document Generated by AI</strong>
      </div>
    </body>
    </html>
  `;
}

function generateDocxContent(template: any, data: Record<string, any>) {
  // Generate dynamic content from extracted data without template dependencies
  const documentTitle = 'AI-Generated Document';
  
  const content = [
    { text: documentTitle, options: { font_size: 16, bold: true } },
    { text: '\n' }
  ];
  
  // Add all fields from extracted data
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      content.push({ text: `${label}: ${value}` });
    }
  });
  
  content.push(
    { text: '\n' },
    { text: 'Document Generated by AI', options: { font_size: 12, bold: true } }
  );
  
  return content;
}

async function processDocumentInBackground(jobId: string) {
  try {
    const job = await storage.getProcessingJob(jobId);
    if (!job) return;

    // Update status to processing
    await storage.updateProcessingJob(jobId, { status: 'processing' });

    const document = await storage.getDocument(job.documentId);
    const template = await storage.getTemplate(job.templateId);
    
    if (!document || !template) {
      await storage.updateProcessingJob(jobId, { 
        status: 'failed', 
        errorMessage: 'Document or template not found' 
      });
      return;
    }

    const startTime = Date.now();
    
    // Get template HTML structure for extraction
    let templateHtml = template.html;
    if (!templateHtml) {
      // Parse template file to get HTML structure
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (targetFile) {
        const templatePath = path.join(uploadDir, targetFile);
        const structure = await parseTemplateStructure(templatePath);
        templateHtml = structure.html;
        
        // Update template with HTML for future use
        await storage.updateTemplate(template.id, { html: templateHtml });
      }
    }
    
    console.log('📋 Using template HTML for extraction:', templateHtml?.substring(0, 200) + '...');
    
    // Process with Mistral AI using template-guided extraction 
    const result = await processDocumentWithMistral(document.filePath, templateHtml || '');
    
    const processingTime = Math.floor((Date.now() - startTime) / 1000);
    
    // Update job with results
    await storage.updateProcessingJob(jobId, {
      status: 'completed',
      ocrText: result.extractedText,
      extractedData: result.keyValuePairs,
      accuracy: result.accuracy,
      tokensExtracted: result.tokensExtracted,
      processingTime
    });
    
  } catch (error: any) {
    console.error('Processing error:', error);
    await storage.updateProcessingJob(jobId, {
      status: 'failed',
      errorMessage: error.message
    });
  }
}
