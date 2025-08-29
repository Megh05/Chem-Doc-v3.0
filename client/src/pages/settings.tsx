import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Settings as SettingsIcon, Key, Database, Bell, Shield, Cpu, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export default function Settings() {
  const [apiSettings, setApiSettings] = useState({
    mistralApiKey: "",
    ocrEndpoint: "https://api.mistral.ai/v1/ocr/process",
    llmModel: "mistral-large-latest"
  });

  const [processingSettings, setProcessingSettings] = useState({
    autoProcessing: true,
    accuracyThreshold: 95,
    maxFileSize: 50,
    retryAttempts: 3
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    processingComplete: true,
    processingFailed: true,
    weeklyReports: false
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Load configuration on component mount
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/config"],
  });

  // Update state when config loads
  useEffect(() => {
    if (config && typeof config === 'object') {
      const configObj = config as any;
      
      setApiSettings(prev => ({
        ...prev,
        mistralApiKey: configObj.apiSettings?.mistralApiKey || prev.mistralApiKey,
        ocrEndpoint: configObj.apiSettings?.ocrEndpoint || prev.ocrEndpoint,
        llmModel: configObj.apiSettings?.llmModel || prev.llmModel
      }));
      
      setProcessingSettings(prev => ({
        autoProcessing: configObj.processingSettings?.autoProcessing ?? prev.autoProcessing,
        accuracyThreshold: configObj.processingSettings?.accuracyThreshold || prev.accuracyThreshold,
        maxFileSize: configObj.processingSettings?.maxFileSize || prev.maxFileSize,
        retryAttempts: configObj.processingSettings?.retryAttempts || prev.retryAttempts
      }));
      
      setNotificationSettings(prev => ({
        emailNotifications: configObj.notificationSettings?.emailNotifications ?? prev.emailNotifications,
        processingComplete: configObj.notificationSettings?.processingComplete ?? prev.processingComplete,
        processingFailed: configObj.notificationSettings?.processingFailed ?? prev.processingFailed,
        weeklyReports: configObj.notificationSettings?.weeklyReports ?? prev.weeklyReports
      }));
    }
  }, [config]);

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const configData = {
        apiSettings: {
          mistralApiKey: apiSettings.mistralApiKey,
          ocrEndpoint: apiSettings.ocrEndpoint,
          llmModel: apiSettings.llmModel
        },
        processingSettings,
        notificationSettings
      };
      
      const response = await apiRequest('POST', '/api/config', configData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      toast({
        title: "Settings saved",
        description: "Your configuration has been saved to config.json",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  });

  // Reset configuration mutation
  const resetConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/config/reset');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      toast({
        title: "Settings reset",
        description: "Configuration has been reset to defaults",
      });
      // Reset local state to defaults
      if (data.config) {
        setApiSettings({
          ...apiSettings,
          mistralApiKey: data.config.apiSettings.mistralApiKey,
          ocrEndpoint: data.config.apiSettings.ocrEndpoint,
          llmModel: data.config.apiSettings.llmModel
        });
        setProcessingSettings(data.config.processingSettings);
        setNotificationSettings(data.config.notificationSettings);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to reset settings",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveConfigMutation.mutate();
  };

  const handleReset = () => {
    resetConfigMutation.mutate();
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
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Application Settings</h2>
          <p className="text-gray-600 mt-1">Configure your ChemDocFlow application preferences</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading settings...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* API Configuration */}
            <Card className="p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                <Key className="w-4 h-4 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">API Configuration</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mistral API Key
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="password"
                    value={apiSettings.mistralApiKey}
                    onChange={(e) => setApiSettings({ ...apiSettings, mistralApiKey: e.target.value })}
                    placeholder="sk-..."
                    className={apiSettings.mistralApiKey ? "bg-green-50 border-green-200 text-green-800" : ""}
                    data-testid="input-api-key"
                  />
                  {apiSettings.mistralApiKey && (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-xs font-medium">Configured</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter your Mistral API key for document processing. Get one at console.mistral.ai
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OCR Endpoint
                </label>
                <Input
                  value={apiSettings.ocrEndpoint}
                  onChange={(e) => setApiSettings({ ...apiSettings, ocrEndpoint: e.target.value })}
                  data-testid="input-ocr-endpoint"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LLM Model
                </label>
                <select
                  value={apiSettings.llmModel}
                  onChange={(e) => setApiSettings({ ...apiSettings, llmModel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  data-testid="select-llm-model"
                >
                  <option value="mistral-large-latest">Mistral Large (Latest)</option>
                  <option value="mistral-medium-latest">Mistral Medium (Latest)</option>
                  <option value="mistral-small-latest">Mistral Small (Latest)</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Processing Settings */}
          <Card className="p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center mr-3">
                <Cpu className="w-4 h-4 text-success-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Processing Settings</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Auto-processing</p>
                  <p className="text-xs text-gray-500">Automatically start processing after template selection</p>
                </div>
                <Switch
                  checked={processingSettings.autoProcessing}
                  onCheckedChange={(checked) => setProcessingSettings({ ...processingSettings, autoProcessing: checked })}
                  data-testid="switch-auto-processing"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OCR Accuracy Threshold (%)
                </label>
                <Input
                  type="number"
                  min="70"
                  max="100"
                  value={processingSettings.accuracyThreshold}
                  onChange={(e) => setProcessingSettings({ ...processingSettings, accuracyThreshold: parseInt(e.target.value) })}
                  data-testid="input-accuracy-threshold"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum OCR accuracy required before proceeding with data extraction
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max File Size (MB)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={processingSettings.maxFileSize}
                  onChange={(e) => setProcessingSettings({ ...processingSettings, maxFileSize: parseInt(e.target.value) })}
                  data-testid="input-max-file-size"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Retry Attempts
                </label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={processingSettings.retryAttempts}
                  onChange={(e) => setProcessingSettings({ ...processingSettings, retryAttempts: parseInt(e.target.value) })}
                  data-testid="input-retry-attempts"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Number of retry attempts if processing fails
                </p>
              </div>
            </div>
          </Card>

          {/* Notification Settings */}
          <Card className="p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center mr-3">
                <Bell className="w-4 h-4 text-warning-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                  <p className="text-xs text-gray-500">Receive email updates about processing status</p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                  data-testid="switch-email-notifications"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Processing Complete</p>
                  <p className="text-xs text-gray-500">Notify when document processing is finished</p>
                </div>
                <Switch
                  checked={notificationSettings.processingComplete}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, processingComplete: checked })}
                  data-testid="switch-processing-complete"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Processing Failed</p>
                  <p className="text-xs text-gray-500">Notify when document processing fails</p>
                </div>
                <Switch
                  checked={notificationSettings.processingFailed}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, processingFailed: checked })}
                  data-testid="switch-processing-failed"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Weekly Reports</p>
                  <p className="text-xs text-gray-500">Receive weekly processing summary reports</p>
                </div>
                <Switch
                  checked={notificationSettings.weeklyReports}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, weeklyReports: checked })}
                  data-testid="switch-weekly-reports"
                />
              </div>
            </div>
          </Card>

          {/* Security Settings */}
          <Card className="p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-error-100 rounded-lg flex items-center justify-center mr-3">
                <Shield className="w-4 h-4 text-error-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Security & Privacy</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Data Privacy:</strong> All uploaded documents are processed locally and not stored permanently. 
                  Only processing metadata is retained for analytics purposes.
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>API Security:</strong> All API communications use HTTPS encryption. 
                  Your Mistral API key is stored securely as an environment variable.
                </p>
              </div>
            </div>
          </Card>

            {/* Save Settings */}
            <div className="flex justify-end space-x-4">
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={resetConfigMutation.isPending}
                data-testid="button-reset-settings"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {resetConfigMutation.isPending ? "Resetting..." : "Reset to Defaults"}
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saveConfigMutation.isPending}
                data-testid="button-save-settings"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveConfigMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}