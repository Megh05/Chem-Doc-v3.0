import { FileText, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProcessingJob } from "@shared/schema";

interface ProcessingHistoryProps {
  jobs: ProcessingJob[];
}

export default function ProcessingHistory({ jobs }: ProcessingHistoryProps) {
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
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-view-${job.id}`}
                    >
                      View
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
