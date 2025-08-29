export interface ProcessingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
}

export interface ExtractedDataField {
  key: string;
  value: string | null;
  confidence: number;
  isRequired: boolean;
  status: 'found' | 'missing' | 'manual';
}

export interface ProcessingStats {
  tokensExtracted: number;
  accuracy: number;
  fieldsMatched: number;
  totalFields: number;
  processingTime: number;
}
