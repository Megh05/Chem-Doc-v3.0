import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ProgressSteps from "@/components/progress-steps";
import DocumentUpload from "@/components/document-upload";
import TemplateSelection from "@/components/template-selection";
import ProcessingStatus from "@/components/processing-status";
import DataExtraction from "@/components/data-extraction";
import ProcessingHistory from "@/components/processing-history";

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["/api/templates"],
  });

  const templatesArray = Array.isArray(templates) ? templates : [];

  const { data: processingJobs, refetch: refetchJobs } = useQuery({
    queryKey: ["/api/processing-jobs"],
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
  });

  const jobsArray = Array.isArray(processingJobs) ? processingJobs : [];

  const currentJob = jobsArray?.find((job: any) => job.id === processingJobId);

  const handleDocumentUploaded = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setCurrentStep(2);
  };

  const handleTemplateSelected = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setCurrentStep(3);
  };

  const handleProcessingStarted = (jobId: string) => {
    setProcessingJobId(jobId);
    setCurrentStep(4);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                    <FlaskConical className="text-white w-5 h-5" />
                  </div>
                  <h1 className="ml-3 text-xl font-semibold text-gray-900">ChemDocFlow</h1>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/templates">
                <Button variant="ghost" size="sm" data-testid="button-templates">
                  Templates
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="ghost" size="sm" data-testid="button-history">
                  History
                </Button>
              </Link>
              <Link href="/settings">
                <Button size="sm" data-testid="button-settings">
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Document Processing Workflow</h2>
            <div className="text-sm text-gray-500">
              Powered by <strong>Mistral AI OCR</strong> & <strong>LLM</strong>
            </div>
          </div>
          
          <ProgressSteps 
            currentStep={currentStep} 
            onStepClick={setCurrentStep}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <DocumentUpload 
            onDocumentUploaded={handleDocumentUploaded}
            isActive={currentStep === 1}
            isCompleted={currentStep > 1}
          />
          
          <TemplateSelection
            templates={templatesArray}
            selectedTemplateId={selectedTemplateId}
            onTemplateSelected={handleTemplateSelected}
            isActive={currentStep === 2}
            isCompleted={currentStep > 2}
          />
        </div>

        {currentStep >= 3 && (
          <ProcessingStatus
            documentId={selectedDocumentId}
            templateId={selectedTemplateId}
            onProcessingStarted={handleProcessingStarted}
            currentJob={currentJob}
            isActive={currentStep === 3}
          />
        )}

        {currentStep >= 4 && currentJob?.status === 'completed' && (
          <DataExtraction
            job={currentJob}
            template={templatesArray?.find((t: any) => t.id === selectedTemplateId)}
          />
        )}

        <ProcessingHistory jobs={jobsArray} onRefresh={refetchJobs} />
      </main>
    </div>
  );
}
