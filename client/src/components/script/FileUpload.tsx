import { FileUploadProps } from "@/lib/types";
import { formatFileSize, validatePdfFile } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertCircle } from "lucide-react";
import { useState } from "react";

export default function FileUpload({ onFileUpload, isLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!validatePdfFile(file)) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a PDF or image file (jpg/png) under 10MB in size.",
      });
      return;
    }

    onFileUpload(file).catch(error => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload the script file.",
      });
    });
  };

  return (
    <div className="flex items-center justify-center w-full">
      <label 
        htmlFor="script-upload"
        className={`flex flex-col items-center justify-center w-full h-64 border-2 ${
          dragActive ? "border-primary" : "border-gray-300"
        } border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50 transition-colors`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
              <p className="mb-2 text-sm text-gray-500">Processing your script...</p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF or image file (MAX. 10MB)</p>
            </>
          )}
        </div>
        <input 
          id="script-upload" 
          type="file" 
          className="hidden" 
          accept=".pdf,.jpg,.jpeg,.png" 
          onChange={handleChange}
          disabled={isLoading}
        />
      </label>
    </div>
  );
}
