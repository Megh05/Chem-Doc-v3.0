import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Download, Eye, Trash2, FileText as TextFile, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProcessingJob } from "@shared/schema";

interface ProcessingHistoryProps {
  jobs: ProcessingJob[];
  onRefresh?: () => void;
}

export default function ProcessingHistory({ jobs, onRefresh }: ProcessingHistoryProps) {
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest('DELETE', `/api/processing-jobs/${jobId}`);
      // The apiRequest function already handles errors, so if we get here, it's successful
      try {
        return await response.json();
      } catch {
        // If JSON parsing fails, return a default success message
        return { message: "Processing job deleted successfully" };
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Processing job deleted successfully",
      });
      // Force refresh the processing jobs list
      console.log('🔄 Invalidating processing jobs query...');
      queryClient.invalidateQueries({ queryKey: ['/api/processing-jobs'] });
      
      // Also try to refetch immediately
      setTimeout(() => {
        console.log('🔄 Forcing refetch of processing jobs...');
        queryClient.refetchQueries({ queryKey: ['/api/processing-jobs'] });
      }, 100);
      
      // Call the parent's refresh function if available
      if (onRefresh) {
        console.log('🔄 Calling parent refresh function...');
        setTimeout(() => {
          onRefresh();
        }, 200);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete processing job",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingJobId(null);
    }
  });

  const handleDeleteJob = (jobId: string) => {
    if (window.confirm('Are you sure you want to delete this processing job? This action cannot be undone.')) {
      setDeletingJobId(jobId);
      deleteJobMutation.mutate(jobId);
    }
  };

  const handleDownloadOCRText = async (jobId: string) => {
    try {
      const response = await fetch(`/api/processing-jobs/${jobId}/ocr-text`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download OCR text');
      }
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `job_${jobId}_ocr_text.txt`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "OCR text downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download OCR text",
        variant: "destructive",
      });
    }
  };

  const handleDownloadJSON = async (jobId: string) => {
    try {
      const response = await fetch(`/api/processing-jobs/${jobId}/json`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download JSON data');
      }
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `job_${jobId}_structured_data.json`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "JSON data downloaded successfully",
      });
    } catch (error: any) {
      console.error('Error downloading JSON data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to download JSON data",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-success-100 text-success-800`;
      case 'processing':
        return `${baseClasses} bg-warning-100 text-warning-800`;
      case 'failed':
        return `${baseClasses} bg-error-100 text-error-800`;
      case 'pending':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  if (jobs.length === 0) {
    return (
      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Processing History</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No processing jobs yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-8 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Processing History</h3>
        <Button variant="ghost" size="sm" data-testid="button-view-all-history">
          View All
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Template
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Processing Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.slice(0, 5).map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900" data-testid={`job-document-${job.id}`}>
                        Document {job.documentId.slice(-8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(job.createdAt)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900" data-testid={`job-template-${job.id}`}>
                    Template {job.templateId.slice(-8)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getStatusBadge(job.status)} data-testid={`job-status-${job.id}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid={`job-time-${job.id}`}>
                  {job.processingTime ? `${job.processingTime}s` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={job.status !== 'completed'}
                      data-testid={`button-download-${job.id}`}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadOCRText(job.id)}
                      disabled={job.status !== 'completed' || (!job.rawOcrText && !job.ocrText)}
                      title="Download raw OCR text"
                      data-testid={`button-download-ocr-${job.id}`}
                    >
                      <TextFile className="w-4 h-4 mr-1" />
                      OCR Text
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadJSON(job.id)}
                      disabled={job.status !== 'completed' || !job.structuredJSON}
                      title="Download structured JSON data"
                      data-testid={`button-download-json-${job.id}`}
                    >
                      <FileJson className="w-4 h-4 mr-1" />
                      JSON
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-view-${job.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={deletingJobId === job.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`button-delete-${job.id}`}
                    >
                      {deletingJobId === job.id ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
