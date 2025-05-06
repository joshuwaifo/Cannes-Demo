import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/script/FileUpload";
import { Film, Upload, PlaySquare } from "lucide-react";

export default function Welcome() {
  const { toast } = useToast();

  // Upload script mutation
  const uploadScriptMutation = useMutation({
    mutationFn: async (file: File) => {
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
    onSuccess: () => {
      toast({
        title: "Script uploaded successfully",
        description: "Your script has been processed and analyzed.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "There was an error uploading your script.",
      });
    },
  });

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