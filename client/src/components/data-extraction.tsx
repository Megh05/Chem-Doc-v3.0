import { useState } from "react";
import { Edit3, RotateCcw, Download, Eye, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TemplatePreview from "./template-preview";
import type { ProcessingJob, Template } from "@shared/schema";

interface DataExtractionProps {
  job: ProcessingJob;
  template: Template | undefined;
}

// Filter extracted data to only show fields that correspond to template placeholders
const normalizeExtractedData = (rawData: Record<string, any>, template?: Template): Record<string, any> => {
  if (!rawData) {
    return {};
  }
  
  // Show placeholder count for debugging
  if (template?.html) {
    const placeholderCount = (template.html.match(/\{\}/g) || []).length;
    console.log(`Template has ${placeholderCount} placeholders, showing ${Object.keys(rawData).length} extracted fields`);
  } else if (template?.placeholders) {
    console.log(`Template defines ${template.placeholders.length} fields, showing ${Object.keys(rawData).length} extracted fields`);
  }
  
  // Return the LLM-filtered data (should only contain template-relevant fields)
  return rawData;
};

export default function DataExtraction({ job, template }: DataExtractionProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const rawExtractedData = job.extractedData as Record<string, any> || {};
  const normalizedData = normalizeExtractedData(rawExtractedData, template);
  const [editedData, setEditedData] = useState<Record<string, any>>(() => {
    // Initialize with LLM-extracted data as-is
    return { ...normalizedData };
  });
  const { toast } = useToast();

  const handleEdit = (field: string, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
    setEditingField(null);
    toast({
      title: "Field updated",
      description: `${formatFieldName(field)} has been updated successfully`,
    });
  };

  const formatFieldName = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const generateDocumentMutation = useMutation({
    mutationFn: async ({ format, jobId }: { format: 'pdf' | 'docx', jobId: string }) => {
      const response = await apiRequest('POST', `/api/generate-document/${jobId}`, { format, data: editedData });
      return response.blob();
    },
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `document.${variables.format === 'pdf' ? 'html' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Document downloaded",
        description: `Your ${variables.format.toUpperCase()} document has been downloaded successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download failed",
        description: error.message || "Failed to generate document",
        variant: "destructive",
      });
    }
  });

  const saveDocumentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/saved-documents', {
        name: `${template?.name || 'Document'} - ${new Date().toLocaleDateString()}`,
        templateId: job.templateId,
        originalDocumentId: job.documentId,
        finalData: editedData
      });
    },
    onSuccess: () => {
      toast({
        title: "Document saved",
        description: "Your document has been saved and is available in history",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save document",
        variant: "destructive",
      });
    }
  });

  const handleGenerateDocument = (format: 'pdf' | 'docx') => {
    generateDocumentMutation.mutate({ format, jobId: job.id });
  };

  const getFieldStatus = (field: string, value: any) => {
    if (value === null || value === undefined || value === '') {
      return 'missing';
    }
    return 'found';
  };

  const renderFieldValue = (field: string, value: any) => {
    if (editingField === field) {
      return (
        <Input
          defaultValue={value || ''}
          onBlur={(e) => handleEdit(field, e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleEdit(field, e.currentTarget.value);
            }
          }}
          autoFocus
          className="h-6 text-xs"
          data-testid={`input-edit-${field}`}
        />
      );
    }

    return (
      <p className={`text-xs mt-1 ${
        getFieldStatus(field, value) === 'missing' ? 'text-warning-600' : 'text-gray-600'
      }`}>
        {value || 'Not found in source document'}
      </p>
    );
  };

  const extractedFields = Object.entries(editedData);
  const placeholderCount = template?.html 
    ? (template.html.match(/\{\}/g) || []).length 
    : template?.placeholders?.length || 0;

  return (
    <Card className="mt-8 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Extracted Data & Review</h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" data-testid="button-edit-all">
            <Edit3 className="w-4 h-4 mr-1" />
            Edit All
          </Button>
          <Button variant="outline" size="sm" data-testid="button-reprocess">
            <RotateCcw className="w-4 h-4 mr-1" />
            Re-process
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Extracted Key-Value Pairs */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Extracted Information
            <span className="ml-2 text-xs text-gray-500">({placeholderCount} template fields)</span>
          </h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {extractedFields.map(([field, value]) => {
              const status = getFieldStatus(field, value);
              return (
                <div
                  key={field}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    status === 'missing' ? 'bg-warning-50 border border-warning-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {formatFieldName(field)}
                    </p>
                    {renderFieldValue(field, value)}
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'missing' ? 'bg-warning-500' : 'bg-success-500'
                    }`} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField(field)}
                      data-testid={`button-edit-${field}`}
                    >
                      {status === 'missing' ? (
                        <Plus className="w-3 h-3" />
                      ) : (
                        <Edit3 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Template Preview */}
        <div>
          {template ? (
            <TemplatePreview
              template={template}
              extractedData={editedData}
              onSave={() => saveDocumentMutation.mutate()}
              onExport={handleGenerateDocument}
              isSaving={saveDocumentMutation.isPending}
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-96 flex items-center justify-center">
              <p className="text-gray-500">Template not found</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
