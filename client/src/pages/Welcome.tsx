import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/script/FileUpload";
import { Film, Upload, PlaySquare, Loader2 } from "lucide-react";
import { Script, Scene } from "@shared/schema";
import { TabType } from "@/lib/types";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface WelcomeProps {
  onTabChange?: (tab: TabType) => void;
}

export default function Welcome({ onTabChange }: WelcomeProps) {
  const { toast } = useToast();
  // Processing status and progress tracking
  const [processingProgress, setProcessingProgress] = useState(10);
  const [processingStatus, setProcessingStatus] = useState("Uploading script file...");
  const [checkCount, setCheckCount] = useState(0);

  // Query to check if script data is available
  const { 
    data: script,
    refetch: refetchScript,
    isSuccess: isScriptAvailable
  } = useQuery<Script | null>({
    queryKey: ['/api/scripts/current'],
    refetchOnWindowFocus: false,
    enabled: false, // Initially disabled
  });

  // Query to check if scenes have been processed
  const {
    data: scenes = [],
    refetch: refetchScenes,
    isSuccess: areScenesAvailable
  } = useQuery<Scene[]>({
    queryKey: ['/api/scripts/scenes'],
    refetchOnWindowFocus: false,
    enabled: false, // Initially disabled
  });

  // Upload script mutation
  const uploadScriptMutation = useMutation({
    mutationFn: async (file: File) => {
      setProcessingProgress(10);
      setProcessingStatus("Uploading script file...");
      
      const formData = new FormData();
      formData.append('script', file);
      
      const response = await fetch('/api/scripts/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to upload script');
      }
      
      return await response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Script uploaded successfully",
        description: "Your script has been processed and analyzed.",
      });
      
      setProcessingProgress(30);
      setProcessingStatus("Extracting script content...");
      
      // Start checking if script data is available
      await refetchScript();
      
      setProcessingProgress(50);
      setProcessingStatus("Analyzing screenplay scenes...");
      
      await refetchScenes();
      setCheckCount(1); // Start the checking process
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "There was an error uploading your script.",
      });
    },
  });

  // Effect for polling the scene and script data
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;
    
    if (uploadScriptMutation.isSuccess && checkCount > 0) {
      pollingInterval = setInterval(async () => {
        // Update progress based on the check count
        if (checkCount > 1 && checkCount <= 5) {
          setProcessingProgress(60);
          setProcessingStatus("Identifying brandable scenes...");
        } else if (checkCount > 5 && checkCount <= 10) {
          setProcessingProgress(75);
          setProcessingStatus("Generating placement opportunities...");
        } else if (checkCount > 10) {
          setProcessingProgress(90);
          setProcessingStatus("Finalizing script analysis...");
        }
        
        // Refetch data
        await refetchScript();
        await refetchScenes();
        setCheckCount(prev => prev + 1);
      }, 1500);
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [uploadScriptMutation.isSuccess, checkCount, refetchScript, refetchScenes]);

  // Effect to monitor when both script and scenes are available
  useEffect(() => {
    if (isScriptAvailable && areScenesAvailable && script && scenes.length > 0) {
      // Update progress to 100%
      setProcessingProgress(100);
      setProcessingStatus("Analysis complete! Redirecting to Script Editor...");
      
      // Short delay before redirecting to ensure user sees the 100% progress
      const redirectTimer = setTimeout(() => {
        // Data is available, navigate to Script Editor
        if (onTabChange) {
          onTabChange("script");
        }
      }, 1000);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [isScriptAvailable, areScenesAvailable, script, scenes, onTabChange]);

  // Loading state while processing script data
  const isProcessingScript = uploadScriptMutation.isSuccess && (!isScriptAvailable || !areScenesAvailable || !script || scenes.length === 0);

  const handleFileUpload = async (file: File) => {
    await uploadScriptMutation.mutateAsync(file);
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <Film className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Welcome to VadisMedia</h1>
        <p className="text-xl text-gray-600 mb-6">
          AI-powered script analysis for strategic product placement
        </p>
        <div className="max-w-2xl mx-auto">
          {isProcessingScript ? (
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <h2 className="text-xl font-semibold mb-4">Processing Your Script</h2>
                <p className="text-gray-600 mb-6 text-center">
                  Please wait while we extract and analyze your screenplay. 
                  You'll be automatically redirected to the Script Editor once it's ready.
                </p>
                <div className="w-full max-w-md">
                  <Progress value={processingProgress} className="h-2 mb-2" />
                  <p className="text-sm text-gray-500 text-center">{processingStatus}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <Upload className="mr-2 h-6 w-6 text-primary" />
                Get Started
              </h2>
              <p className="text-gray-600 mb-6">
                Upload your screenplay PDF file to begin the analysis process. Our AI will identify
                the best opportunities for product placement.
              </p>
              <FileUpload 
                onFileUpload={handleFileUpload} 
                isLoading={uploadScriptMutation.isPending} 
              />
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4 flex items-center">
              <PlaySquare className="mr-2 h-6 w-6 text-primary" />
              How It Works
            </h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-600">
              <li>Upload your screenplay PDF file</li>
              <li>Our AI analyzes the script and identifies brandable scenes</li>
              <li>Manage your product database with branded items</li>
              <li>Generate AI-powered product placement visuals for each scene</li>
              <li>Select your preferred placements and export for production</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}