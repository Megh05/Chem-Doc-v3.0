import { useState } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Upload, Trash2, Download, Plus, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Template } from "@shared/schema";

export default function Templates() {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: "",
    type: "CoA" as "CoA" | "TDS" | "MDMS"
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/templates"],
  });

  const templatesArray = Array.isArray(templates) ? templates : [];

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest('DELETE', `/api/templates/${templateId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Template deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/templates', formData);
      return response.json();
    },
    onSuccess: () => {
      setShowUpload(false);
      setUploadData({ name: "", type: "CoA" });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Template uploaded successfully",
        description: "Your template is now available for document processing",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload template",
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!uploadData.name.trim()) {
      toast({
        title: "Template name required",
        description: "Please enter a template name before uploading a file",
        variant: "destructive",
      });
      // Clear the file input
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', uploadData.name);
    formData.append('type', uploadData.type);
    formData.append('placeholders', JSON.stringify([]));

    uploadMutation.mutate(formData);
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
            <h1 className="text-xl font-semibold text-gray-900">Template Management</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Document Templates</h2>
          <Button 
            onClick={() => setShowUpload(true)}
            data-testid="button-new-template"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {showUpload && (
          <Card className="p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Template</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name
                  </label>
                  <Input
                    value={uploadData.name}
                    onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                    placeholder="e.g. Standard CoA Template v3.0"
                    data-testid="input-template-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type
                  </label>
                  <select
                    value={uploadData.type}
                    onChange={(e) => setUploadData({ ...uploadData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    data-testid="select-template-type"
                  >
                    <option value="CoA">Certificate of Analysis (CoA)</option>
                    <option value="TDS">Technical Data Sheet (TDS)</option>
                    <option value="MDMS">Material Data Management Sheet (MDMS)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template File
                </label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".docx,.doc"
                  className="hidden"
                  id="template-upload-input"
                  data-testid="input-template-file"
                />
                <Button
                  onClick={() => {
                    document.getElementById('template-upload-input')?.click();
                  }}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                  data-testid="button-upload-template"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadMutation.isPending ? "Uploading..." : "Upload Template"}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Word documents only (.docx, .doc) • Max 50MB
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowUpload(false)}
                  variant="outline"
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading templates...</p>
          </div>
        ) : templatesArray.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-6">Upload your first company template to get started</p>
            <Button onClick={() => setShowUpload(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Template
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templatesArray.map((template: Template) => (
              <Card key={template.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                    {template.type}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2" data-testid={`template-name-${template.id}`}>
                  {template.name}
                </h3>
                
                <p className="text-sm text-gray-600 mb-2">
                  {(template.fileSize / 1024).toFixed(1)} KB
                </p>
                
                <p className="text-xs text-gray-500 mb-4">
                  Updated {formatDate(template.updatedAt)}
                </p>
                
                <p className="text-sm text-primary-600 mb-4">
                  {(template.placeholders as string[]).length} placeholders
                </p>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" data-testid={`button-edit-${template.id}`}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const downloadUrl = `/api/templates/${template.id}/download`;
                      window.open(downloadUrl, '_blank');
                    }}
                    data-testid={`button-download-${template.id}`}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${template.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}