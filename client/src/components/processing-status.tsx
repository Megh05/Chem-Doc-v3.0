import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProcessingJob } from "@shared/schema";

interface ProcessingStatusProps {
  documentId: string | null;
  templateId: string | null;
  onProcessingStarted: (jobId: string) => void;
  currentJob: ProcessingJob | undefined;
  isActive: boolean;
}

export default function ProcessingStatus({
  documentId,
  templateId,
  onProcessingStarted,
  currentJob,
  isActive
}: ProcessingStatusProps) {
  const [processingSteps, setProcessingSteps] = useState([
    { id: 'ocr', name: 'Document Text Extraction', description: 'Mistral OCR processing...', status: 'pending', progress: 0 },
    { id: 'extraction', name: 'Data Extraction & Mapping', description: 'Mistral LLM analyzing chemical data patterns...', status: 'pending', progress: 0 },
    { id: 'population', name: 'Template Population', description: 'Filling template with extracted data...', status: 'pending', progress: 0 },
    { id: 'generation', name: 'Document Generation', description: 'Creating final document...', status: 'pending', progress: 0 },
  ]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startProcessingMutation = useMutation({
    mutationFn: async () => {
      if (!documentId || !templateId) {
        throw new Error("Document and template must be selected");
      }
      
      const response = await apiRequest('POST', '/api/process-document', {
        documentId,
        templateId
      });
      return response.json();
    },
    onSuccess: (job) => {
      onProcessingStarted(job.id);
      queryClient.invalidateQueries({ queryKey: ['/api/processing-jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Processing failed to start",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update processing steps based on current job status
  useEffect(() => {
    if (!currentJob) return;

    let updatedSteps = [...processingSteps];

    switch (currentJob.status) {
      case 'processing':
        updatedSteps[0] = { ...updatedSteps[0], status: 'completed', progress: 100 };
        updatedSteps[1] = { ...updatedSteps[1], status: 'processing', progress: 72 };
        break;
      case 'completed':
        updatedSteps = updatedSteps.map(step => ({ ...step, status: 'completed', progress: 100 }));
        break;
      case 'failed':
        updatedSteps = updatedSteps.map((step, index) => 
          index === 0 ? { ...step, status: 'completed', progress: 100 } : 
          index === 1 ? { ...step, status: 'failed', progress: 0 } :
          { ...step, status: 'pending', progress: 0 }
        );
        break;
    }

    setProcessingSteps(updatedSteps);
  }, [currentJob?.status]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-white" />;
      case 'processing':
        return <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-white" />;
      default:
        return <Clock className="w-4 h-4 text-white" />;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-500';
      case 'processing':
        return 'bg-warning-500';
      case 'failed':
        return 'bg-error-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStepBgColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-50';
      case 'processing':
        return 'bg-warning-50';
      case 'failed':
        return 'bg-error-50';
      default:
        return 'bg-gray-50';
    }
  };

  const getStepTextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success-800';
      case 'processing':
        return 'text-warning-800';
      case 'failed':
        return 'text-error-800';
      default:
        return 'text-gray-600';
    }
  };

  const getStepSubtextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success-600';
      case 'processing':
        return 'text-warning-600';
      case 'failed':
        return 'text-error-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Card className="mt-8 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Step 3: AI Processing & Data Extraction</h3>
        <div className="flex items-center text-sm">
          {currentJob?.status === 'processing' && (
            <div className="flex items-center text-warning-600">
              <div className="animate-spin-slow w-4 h-4 border-2 border-warning-600 border-t-transparent rounded-full mr-2"></div>
              Processing...
            </div>
          )}
          {currentJob?.status === 'completed' && (
            <div className="flex items-center text-success-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              Processing Complete
            </div>
          )}
          {currentJob?.status === 'failed' && (
            <div className="flex items-center text-error-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Processing Failed
            </div>
          )}
        </div>
      </div>

      {!currentJob ? (
        <div className="text-center py-8">
          <Button
            onClick={() => startProcessingMutation.mutate()}
            disabled={!documentId || !templateId || startProcessingMutation.isPending}
            size="lg"
            data-testid="button-start-processing"
          >
            {startProcessingMutation.isPending ? "Starting..." : "Start AI Processing"}
          </Button>
          {(!documentId || !templateId) && (
            <p className="text-sm text-gray-500 mt-2">
              Please complete steps 1 and 2 first
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {processingSteps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center justify-between p-4 rounded-lg ${getStepBgColor(step.status)}`}
              >
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepColor(step.status)}`}>
                    {getStepIcon(step.status)}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${getStepTextColor(step.status)}`}>
                      {step.name}
                    </p>
                    <p className={`text-xs ${getStepSubtextColor(step.status)}`}>
                      {step.description}
                    </p>
                  </div>
                </div>
                <div className={`text-xs font-mono ${getStepSubtextColor(step.status)}`}>
                  {step.progress}%
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-semibold text-gray-900" data-testid="stat-tokens">
                {currentJob.tokensExtracted || 0}
              </p>
              <p className="text-xs text-gray-600">Tokens Extracted</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-semibold text-gray-900" data-testid="stat-accuracy">
                {currentJob.accuracy || 0}%
              </p>
              <p className="text-xs text-gray-600">OCR Accuracy</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-semibold text-gray-900" data-testid="stat-fields">
                {currentJob.extractedData ? Object.keys(currentJob.extractedData as Record<string, any>).filter(k => (currentJob.extractedData as Record<string, any>)![k] !== null).length : 0}/
                {currentJob.extractedData ? Object.keys(currentJob.extractedData as Record<string, any>).length : 0}
              </p>
              <p className="text-xs text-gray-600">Fields Matched</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-semibold text-gray-900" data-testid="stat-time">
                {currentJob.processingTime || 0}s
              </p>
              <p className="text-xs text-gray-600">Processing Time</p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
