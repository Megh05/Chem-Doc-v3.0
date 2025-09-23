import { type User, type InsertUser, type Template, type InsertTemplate, type Document, type InsertDocument, type ProcessingJob, type InsertProcessingJob, type SavedDocument, type InsertSavedDocument } from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Template methods
  getTemplate(id: string): Promise<Template | undefined>;
  getTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<boolean>;
  
  // Document methods
  getDocument(id: string): Promise<Document | undefined>;
  getDocuments(): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<boolean>;
  
  // Processing job methods
  getProcessingJob(id: string): Promise<ProcessingJob | undefined>;
  getProcessingJobs(): Promise<ProcessingJob[]>;
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  updateProcessingJob(id: string, job: Partial<InsertProcessingJob>): Promise<ProcessingJob | undefined>;
  deleteProcessingJob(id: string): Promise<boolean>;
  
  // Saved document methods
  getSavedDocument(id: string): Promise<SavedDocument | undefined>;
  getSavedDocuments(): Promise<SavedDocument[]>;
  createSavedDocument(document: InsertSavedDocument): Promise<SavedDocument>;
  deleteSavedDocument(id: string): Promise<boolean>;
}

class FileStorage implements IStorage {
  private usersFile = path.join(DATA_DIR, 'users.json');
  private templatesFile = path.join(DATA_DIR, 'templates.json');
  private documentsFile = path.join(DATA_DIR, 'documents.json');
  private processingJobsFile = path.join(DATA_DIR, 'processing-jobs.json');
  private savedDocumentsFile = path.join(DATA_DIR, 'saved-documents.json');

  constructor() {
    this.initializeFiles();
  }

  private initializeFiles() {
    // Initialize users file
    if (!fs.existsSync(this.usersFile)) {
      this.writeJsonFile(this.usersFile, []);
    }

    // Initialize templates file with sample data
    if (!fs.existsSync(this.templatesFile)) {
      const sampleTemplates: Template[] = [
        {
          id: randomUUID(),
          name: "Standard CoA Template v2.1",
          type: "CoA",
          fileName: "standard_coa_template_v2.1.docx",
          fileSize: 45000,
          placeholders: [
            "product_name", "batch_number", "manufacturing_date", "expiration_date",
            "purity", "test_results", "supplier_name", "lot_number", "cas_number",
            "molecular_formula", "molecular_weight", "appearance", "ph_value",
            "moisture_content", "heavy_metals", "residual_solvents", "microbiological_tests",
            "storage_conditions", "shelf_life", "quality_manager", "release_date"
          ],
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        },
        {
          id: randomUUID(),
          name: "TDS Template v1.8",
          type: "TDS",
          fileName: "tds_template_v1.8.docx",
          fileSize: 38000,
          placeholders: [
            "product_name", "chemical_name", "cas_number", "molecular_formula",
            "molecular_weight", "appearance", "melting_point", "boiling_point",
            "density", "solubility", "flash_point", "vapor_pressure", "stability",
            "hazard_classification", "safety_precautions", "storage_requirements",
            "handling_instructions", "first_aid_measures"
          ],
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          id: randomUUID(),
          name: "MSDS Template v1.5",
          type: "MSDS",
          fileName: "mdms_template_v1.5.docx",
          fileSize: 42000,
          placeholders: [
            "product_name", "supplier_name", "material_code", "revision_number",
            "issue_date", "chemical_composition", "physical_properties",
            "mechanical_properties", "thermal_properties", "electrical_properties",
            "environmental_data", "processing_guidelines", "quality_standards",
            "regulatory_compliance", "certifications"
          ],
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        }
      ];
      this.writeJsonFile(this.templatesFile, sampleTemplates);
    }

    // Initialize documents file
    if (!fs.existsSync(this.documentsFile)) {
      this.writeJsonFile(this.documentsFile, []);
    }

    // Initialize processing jobs file
    if (!fs.existsSync(this.processingJobsFile)) {
      this.writeJsonFile(this.processingJobsFile, []);
    }

    // Initialize saved documents file
    if (!fs.existsSync(this.savedDocumentsFile)) {
      this.writeJsonFile(this.savedDocumentsFile, []);
    }
  }

  private readJsonFile<T>(filePath: string): T[] {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      // Convert date strings back to Date objects
      return this.reviveDates(parsed);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
  }

  private writeJsonFile<T>(filePath: string, data: T[]): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  private reviveDates(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.reviveDates(item));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.includes('At') || key.includes('Date')) {
          result[key] = value ? new Date(value as string) : value;
        } else {
          result[key] = this.reviveDates(value);
        }
      }
      return result;
    }
    return obj;
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const users = this.readJsonFile<User>(this.usersFile);
    return users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = this.readJsonFile<User>(this.usersFile);
    return users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const users = this.readJsonFile<User>(this.usersFile);
    const user: User = { ...insertUser, id: randomUUID() };
    users.push(user);
    this.writeJsonFile(this.usersFile, users);
    return user;
  }

  // Template methods
  async getTemplate(id: string): Promise<Template | undefined> {
    const templates = this.readJsonFile<Template>(this.templatesFile);
    return templates.find(template => template.id === id);
  }

  async getTemplates(): Promise<Template[]> {
    return this.readJsonFile<Template>(this.templatesFile);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const templates = this.readJsonFile<Template>(this.templatesFile);
    const now = new Date();
    const template: Template = { 
      ...insertTemplate, 
      id: randomUUID(), 
      createdAt: now, 
      updatedAt: now 
    };
    templates.push(template);
    this.writeJsonFile(this.templatesFile, templates);
    return template;
  }

  async updateTemplate(id: string, updateData: Partial<InsertTemplate>): Promise<Template | undefined> {
    const templates = this.readJsonFile<Template>(this.templatesFile);
    const index = templates.findIndex(template => template.id === id);
    if (index === -1) return undefined;

    const updated: Template = { 
      ...templates[index], 
      ...updateData, 
      updatedAt: new Date() 
    };
    templates[index] = updated;
    this.writeJsonFile(this.templatesFile, templates);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const templates = this.readJsonFile<Template>(this.templatesFile);
    const index = templates.findIndex(template => template.id === id);
    if (index === -1) return false;

    templates.splice(index, 1);
    this.writeJsonFile(this.templatesFile, templates);
    return true;
  }

  // Document methods
  async getDocument(id: string): Promise<Document | undefined> {
    const documents = this.readJsonFile<Document>(this.documentsFile);
    return documents.find(document => document.id === id);
  }

  async getDocuments(): Promise<Document[]> {
    return this.readJsonFile<Document>(this.documentsFile);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const documents = this.readJsonFile<Document>(this.documentsFile);
    const document: Document = { 
      ...insertDocument, 
      id: randomUUID(), 
      createdAt: new Date() 
    };
    documents.push(document);
    this.writeJsonFile(this.documentsFile, documents);
    return document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const documents = this.readJsonFile<Document>(this.documentsFile);
    const index = documents.findIndex(document => document.id === id);
    if (index === -1) return false;

    documents.splice(index, 1);
    this.writeJsonFile(this.documentsFile, documents);
    return true;
  }

  // Processing job methods
  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    const jobs = this.readJsonFile<ProcessingJob>(this.processingJobsFile);
    return jobs.find(job => job.id === id);
  }

  async getProcessingJobs(): Promise<ProcessingJob[]> {
    const jobs = this.readJsonFile<ProcessingJob>(this.processingJobsFile);
    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createProcessingJob(insertJob: InsertProcessingJob): Promise<ProcessingJob> {
    const jobs = this.readJsonFile<ProcessingJob>(this.processingJobsFile);
    const job: ProcessingJob = { 
      ...insertJob, 
      id: randomUUID(),
      status: insertJob.status || 'pending',
      ocrText: insertJob.ocrText || null,
      extractedData: insertJob.extractedData || null,
      accuracy: insertJob.accuracy || null,
      tokensExtracted: insertJob.tokensExtracted || null,
      processingTime: insertJob.processingTime || null,
      errorMessage: insertJob.errorMessage || null,
      createdAt: new Date(), 
      completedAt: null 
    };
    jobs.push(job);
    this.writeJsonFile(this.processingJobsFile, jobs);
    return job;
  }

  async updateProcessingJob(id: string, updateData: Partial<InsertProcessingJob>): Promise<ProcessingJob | undefined> {
    const jobs = this.readJsonFile<ProcessingJob>(this.processingJobsFile);
    const index = jobs.findIndex(job => job.id === id);
    if (index === -1) return undefined;

    const updated: ProcessingJob = { 
      ...jobs[index], 
      ...updateData,
      completedAt: updateData.status === 'completed' || updateData.status === 'failed' 
        ? new Date() 
        : jobs[index].completedAt
    };
    jobs[index] = updated;
    this.writeJsonFile(this.processingJobsFile, jobs);
    return updated;
  }

  async deleteProcessingJob(id: string): Promise<boolean> {
    const jobs = this.readJsonFile<ProcessingJob>(this.processingJobsFile);
    const index = jobs.findIndex(job => job.id === id);
    if (index === -1) return false;

    jobs.splice(index, 1);
    this.writeJsonFile(this.processingJobsFile, jobs);
    return true;
  }

  // Saved document methods
  async getSavedDocument(id: string): Promise<SavedDocument | undefined> {
    const savedDocuments = this.readJsonFile<SavedDocument>(this.savedDocumentsFile);
    return savedDocuments.find(doc => doc.id === id);
  }

  async getSavedDocuments(): Promise<SavedDocument[]> {
    return this.readJsonFile<SavedDocument>(this.savedDocumentsFile);
  }

  async createSavedDocument(document: InsertSavedDocument): Promise<SavedDocument> {
    const savedDocuments = this.readJsonFile<SavedDocument>(this.savedDocumentsFile);
    const newSavedDocument: SavedDocument = {
      id: randomUUID(),
      ...document,
      createdAt: new Date(),
    };
    savedDocuments.push(newSavedDocument);
    this.writeJsonFile(this.savedDocumentsFile, savedDocuments);
    return newSavedDocument;
  }

  async deleteSavedDocument(id: string): Promise<boolean> {
    const savedDocuments = this.readJsonFile<SavedDocument>(this.savedDocumentsFile);
    const index = savedDocuments.findIndex(doc => doc.id === id);
    if (index === -1) {
      return false;
    }
    savedDocuments.splice(index, 1);
    this.writeJsonFile(this.savedDocumentsFile, savedDocuments);
    return true;
  }
}

export const storage = new FileStorage();