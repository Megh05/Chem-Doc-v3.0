import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, FileText, Download, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SavedDocument } from "@shared/schema";

export default function History() {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: savedDocuments, isLoading, error } = useQuery({
    queryKey: ['/api/saved-documents'],
    queryFn: () => apiRequest('GET', '/api/saved-documents') as Promise<SavedDocument[]>
  });

  // Ensure savedDocuments is always an array
  const documentsArray = Array.isArray(savedDocuments) ? savedDocuments : [];

  const downloadMutation = useMutation({
    mutationFn: async ({ id, format }: { id: string, format: 'pdf' | 'docx' }) => {
      setDownloadingId(id);
      const response = await apiRequest('POST', `/api/saved-documents/${id}/download`, { format });
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
      setDownloadingId(null);
      toast({
        title: "Document downloaded",
        description: `Your document has been downloaded successfully`,
      });
    },
    onError: (error: any) => {
      setDownloadingId(null);
      toast({
        title: "Download failed",
        description: error.message || "Failed to download document",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/saved-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-documents'] });
      toast({
        title: "Document deleted",
        description: "The document has been removed from your history",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    }
  });

  const handleDownload = (id: string, format: 'pdf' | 'docx') => {
    downloadMutation.mutate({ id, format });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(id);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back-home">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Workflow
                </Button>
              </Link>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Document History</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Saved Documents</h2>
            <p className="text-gray-600 mt-1">Download your processed documents in PDF or Word format</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading saved documents...</p>
          </div>
        ) : documentsArray.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No saved documents</h3>
            <p className="text-gray-500 mb-6">Process and save your first document to see it here</p>
            <Link href="/">
              <Button>
                Start Processing
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-6">
            {documentsArray.map((document) => (
              <Card key={document.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-900" data-testid={`document-${document.id}`}>
                          {document.name}
                        </h3>
                        <div className="flex items-center text-gray-500 text-sm">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>Saved on {new Date(document.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Preview of some key data */}
                    <div className="text-sm text-gray-600 mb-4">
                      <p><strong>Data Preview:</strong></p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {Object.entries(document.finalData).slice(0, 6).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="ml-1 text-primary-600">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Button
                      onClick={() => handleDownload(document.id, 'docx')}
                      disabled={downloadingId === document.id}
                      size="sm"
                      data-testid={`download-docx-${document.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloadingId === document.id ? 'Downloading...' : 'Download Word'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(document.id, 'pdf')}
                      disabled={downloadingId === document.id}
                      size="sm"
                      data-testid={`download-pdf-${document.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(document.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                      data-testid={`delete-${document.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}