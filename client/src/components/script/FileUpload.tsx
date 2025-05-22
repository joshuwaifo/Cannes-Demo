// client/src/components/script/FileUpload.tsx
import { validatePdfFile } from "@/lib/utils"; // formatFileSize might also be useful for display
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, AlertCircle } from "lucide-react"; // Changed icon to UploadCloud for distinction
import { useState } from "react";

// Updated Props: onFileUpload changed to onFileSelected
export interface FileUploadProps {
  onFileSelected: (file: File | null) => void;
  isLoading: boolean; // To disable the component while parent is processing
}

export default function FileUpload({ onFileSelected, isLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (isLoading) return;
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
      // Reset file input to allow selecting the same file again if needed after an error
      e.target.value = ""; 
    }
  };

  const handleFile = (file: File) => {
    if (!validatePdfFile(file)) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a PDF or image file (jpg/png) under 10MB.",
      });
      onFileSelected(null); // Report null for invalid file
      return;
    }
    onFileSelected(file); // Pass the valid file up to the parent
  };

  return (
    <div className="flex items-center justify-center w-full">
      <label 
        htmlFor="script-file-selector" // Unique ID for the input
        className={`flex flex-col items-center justify-center w-full h-48 sm:h-56 border-2 ${
          isLoading ? "border-gray-200 bg-gray-50 cursor-not-allowed" :
          dragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:border-gray-400"
        } border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50 transition-colors`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <>
              <Loader2 className="animate-spin rounded-full h-8 w-8 text-primary mb-3" />
              <p className="mb-2 text-sm text-gray-500">Processing...</p>
            </>
          ) : (
            <>
              <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF or image file (MAX. 10MB)</p>
            </>
          )}
        </div>
        <input 
          id="script-file-selector" 
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