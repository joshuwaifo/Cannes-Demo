// // client/src/pages/Welcome.tsx
// import { TabType } from "@/lib/types";
// import { Upload, PlaySquare, Loader2, ShieldCheck } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import FileUpload from "@/components/script/FileUpload";
// import { Progress } from "@/components/ui/progress";
// import { useState, useEffect } from "react";
// import { useMutation, useQueryClient } from "@tanstack/react-query";
// import { useToast } from "@/hooks/use-toast";

// interface WelcomeProps {
//   onTabChange?: (tab: TabType) => void;
// }

// export default function Welcome({ onTabChange }: WelcomeProps) {
//   const { toast } = useToast();
//   const queryClient = useQueryClient();

//   const [processingProgress, setProcessingProgress] = useState(0);
//   const [processingStatus, setProcessingStatus] = useState("");
//   const [projectNameInput, setProjectNameInput] = useState("");

//   // useEffect to clear Script Editor related caches when Welcome page mounts
//   useEffect(() => {
//     console.log("[Welcome] Page mounted. Clearing Script Analysis and related caches immediately.");

//     // React Query cache clearing for Script Analysis data
//     // removeQueries will clear any query whose key starts with the provided array.
//     queryClient.removeQueries({ queryKey: ["/api/scripts/current"] });
//     queryClient.removeQueries({ queryKey: ["/api/scripts/scenes"] });
//     queryClient.removeQueries({ queryKey: ["/api/scripts/brandable-scenes"] });
//     queryClient.removeQueries({ queryKey: ["/api/scripts/scene-variations"] });
//     queryClient.removeQueries({ queryKey: ["/api/scripts/characters"] }); // Used by CharacterCasting
//     queryClient.removeQueries({ queryKey: ["/api/scripts/extracted-characters"] }); // Also potentially used by CharacterCasting variants
//     queryClient.removeQueries({ queryKey: ["/api/scripts/suggest-locations"] }); // Current key for script-wide location suggestions
//     queryClient.removeQueries({ queryKey: ["/api/scenes/suggest-locations"] }); // Older key for scene-specific location suggestions, clear for safety
//     queryClient.removeQueries({ queryKey: ["/api/characters/suggest-actors"] }); // For actor suggestions

//     // Clear any localStorage/sessionStorage if they were used (currently not indicated for script data)
//     // localStorage.removeItem('someScriptAnalysisKey');
//     // sessionStorage.removeItem('someScriptWriterDraftKey');

//     console.log("[Welcome] Relevant React Query caches cleared.");
//   }, [queryClient]); // queryClient is stable, so this runs once on mount

//   const uploadScriptMutation = useMutation({
//     onMutate: async () => {
//       console.log(
//         "[Welcome] New upload initiated. Clearing ALL client-side React Query caches (onMutate).",
//       );
//       setProcessingProgress(5);
//       setProcessingStatus("Preparing for new script upload...");
//       // This existing call clears all queries, which is appropriate for a new upload.
//       await queryClient.removeQueries(); 
//       console.log("[Welcome] All client-side React Query caches reset for new script session (onMutate).");
//     },
//     mutationFn: async (file: File) => {
//       setProcessingProgress(10);
//       setProcessingStatus("Uploading script file...");
//       const formData = new FormData();
//       formData.append("script", file);
//       if (projectNameInput.trim() !== "") {
//         formData.append("projectName", projectNameInput.trim());
//       }
//       const response = await fetch("/api/scripts/upload", {
//         method: "POST",
//         body: formData,
//         credentials: "include",
//       });
//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(errorText || "Failed to upload script");
//       }
//       return await response.json();
//     },
//     onSuccess: async (data) => {
//       toast({
//         title: "Script Uploaded",
//         description: "Server processing initiated...",
//       });
//       setProcessingProgress(75); 
//       setProcessingStatus("Server processing script...");

//       console.log(
//         "[Welcome] Upload successful. Server has processed. ScriptEditor will fetch fresh data.",
//       );

//       // No need to explicitly invalidate here as removeQueries in onMutate (and useEffect for general Welcome load)
//       // already ensures a clean slate for the next load of ScriptEditor.

//       setProcessingProgress(100);
//       setProcessingStatus("Redirecting to Script Editor...");

//       if (onTabChange) {
//         setTimeout(() => {
//           onTabChange("script");
//           setProcessingProgress(0);
//           setProcessingStatus("");
//         }, 500);
//       }
//     },
//     onError: (error: Error) => {
//       toast({
//         variant: "destructive",
//         title: "Upload failed",
//         description: error.message,
//       });
//       setProcessingProgress(0);
//       setProcessingStatus("Upload failed. Please try again.");
//     },
//   });

//   const isProcessingScript =
//     uploadScriptMutation.isPending ||
//     (uploadScriptMutation.isSuccess &&
//       processingProgress < 100 &&
//       processingStatus.includes("Redirecting"));

//   const handleFileUpload = async (file: File) => {
//     await uploadScriptMutation.mutateAsync(file);
//   };

//   return (
//     <div className="flex-grow flex flex-col items-center justify-center py-10 md:py-14 px-4 bg-vadis-light-gray-bg">
//       <div className="text-center mb-10 md:mb-14 max-w-4xl w-full">
//         <div className="flex justify-center mb-8 md:mb-10">
//           <img
//             src="/assets/vadis-media-logo-dark.png"
//             alt="Vadis Media Logo"
//             className="w-full h-auto max-w-[280px] sm:max-w-[320px] md:max-w-[380px]"
//           />
//         </div>
//         <p className="text-lg md:text-xl text-gray-700 mb-10 md:mb-14">
//           AI-powered script analysis for Optimizing Funding and Casting
//         </p>
//         <div className="space-y-10 md:space-y-12">
//           {isProcessingScript ? (
//             <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
//               <div className="flex flex-col items-center">
//                 <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
//                 <h2 className="text-xl font-semibold mb-4 text-vadis-dark-text">
//                   Processing Your Script
//                 </h2>
//                 <p className="text-gray-600 mb-6 text-center">
//                   {processingStatus.includes("Redirecting")
//                     ? processingStatus
//                     : "Please wait while we upload and analyze your screenplay."}
//                 </p>
//                 <div className="w-full max-w-md">
//                   <Progress
//                     value={processingProgress}
//                     className="h-2 mb-2 bg-muted [&>div]:bg-primary"
//                   />
//                   {!processingStatus.includes("Redirecting") && (
//                     <p className="text-sm text-gray-500 text-center">
//                       {processingStatus}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </div>
//           ) : (
//             <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
//               <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
//                 <Upload className="mr-2 h-6 w-6 text-primary" />
//                 Get Started
//               </h2>
//               <p className="text-gray-600 mb-6">
//                 Upload your script PDF file to begin the analysis process. Vadis
//                 AI will identify Brand Sponsorship Opportunities by scene from
//                 your script, Filming Locations and Casting Suggestions.
//               </p>
//               <div className="mb-4 max-w-md mx-auto">
//                 <label
//                   htmlFor="projectName"
//                   className="block text-sm font-medium text-gray-700 mb-1 text-left"
//                 >
//                   Project Name (Optional)
//                 </label>
//                 <Input
//                   id="projectName"
//                   type="text"
//                   placeholder="e.g., Sideways, My Awesome Film"
//                   value={projectNameInput}
//                   onChange={(e) => setProjectNameInput(e.target.value)}
//                   className="bg-white"
//                 />
//               </div>
//               <div className="text-xs text-muted-foreground mb-4 flex items-center justify-center space-x-1">
//                 <ShieldCheck className="h-4 w-4 text-green-600" />
//                 <span>
//                   Your script is processed securely and will not be shared
//                   externally or with other users.
//                 </span>
//               </div>
//               <FileUpload
//                 onFileUpload={handleFileUpload}
//                 isLoading={uploadScriptMutation.isPending}
//               />
//             </div>
//           )}
//           <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
//             <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
//               <PlaySquare className="mr-2 h-6 w-6 text-primary" />
//               How It Works
//             </h2>
//             <ul className="space-y-4 text-gray-700 text-left">
//               {[
//                 "Upload your script PDF file.",
//                 "Vadis AI will extract scenes from the script and analyze brand sponsorship opportunities.",
//                 "              Select the brand sponsors you'd like to feature in the scenes from your script.",
//                 "Review AI-generated stills and videos featuring the Brand Sponsors you've selected for each scene.",
//                 "Export for production.",
//               ].map((step, index) => (
//                 <li key={index} className="flex items-start text-gray-600">
//                   <span className="flex-shrink-0 bg-primary text-primary-foreground h-6 w-6 flex items-center justify-center rounded-full text-sm font-semibold mr-4 mt-0.5">
//                     {index + 1}
//                   </span>
//                   <span>{step}</span>
//                 </li>
//               ))}
//             </ul>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// client/src/pages/Welcome.tsx
import { TabType } from "@/lib/types";
import { 
  Pencil, 
  Search, // For "Begin Analysis"
  Upload as UploadBoxIcon, // For the "Get Started" box title
  Loader2, 
  ShieldCheck, 
  PlaySquare 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import FileUpload from "@/components/script/FileUpload";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter"; // For navigation
import { formatFileSize } from "@/lib/utils";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface WelcomeProps {
  onTabChange?: (tab: TabType) => void;
}

export default function Welcome({ onTabChange }: WelcomeProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_wLocation, setLocation] = useLocation(); // Wouter's navigation

  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [projectNameInput, setProjectNameInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    // Clear caches on Welcome page mount (existing logic)
    queryClient.removeQueries({ queryKey: ["/api/scripts/current"] });
    queryClient.removeQueries({ queryKey: ["/api/scripts/scenes"] });
    queryClient.removeQueries({ queryKey: ["/api/scripts/brandable-scenes"] });
    queryClient.removeQueries({ queryKey: ["/api/scripts/scene-variations"] });
    queryClient.removeQueries({ queryKey: ["/api/scripts/characters"] });
    queryClient.removeQueries({ queryKey: ["/api/scripts/extracted-characters"] });
    queryClient.removeQueries({ queryKey: ["/api/scripts/suggest-locations"] });
    queryClient.removeQueries({ queryKey: ["/api/scenes/suggest-locations"] });
    queryClient.removeQueries({ queryKey: ["/api/characters/suggest-actors"] });
    console.log("[Welcome] Relevant React Query caches cleared on mount.");
  }, [queryClient]);

  const uploadScriptMutation = useMutation({
    onMutate: async () => {
      setProcessingProgress(5);
      setProcessingStatus("Preparing for new script upload...");
      await queryClient.removeQueries(); // Clear all caches for a new session
      console.log("[Welcome] All client-side React Query caches reset for new script session.");
    },
    mutationFn: async (fileToUpload: File) => { // Renamed 'file' to 'fileToUpload' for clarity
      setProcessingProgress(10);
      setProcessingStatus("Uploading script file...");
      const formData = new FormData();
      formData.append("script", fileToUpload);
      if (projectNameInput.trim() !== "") {
        formData.append("projectName", projectNameInput.trim());
      }
      const response = await fetch("/api/scripts/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to upload script");
      }
      return await response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Script Uploaded & Processed",
        description: "Server processing initiated and completed.",
      });
      setProcessingProgress(75); 
      setProcessingStatus("Server has processed the script...");

      console.log("[Welcome] Upload successful. ScriptEditor will fetch fresh data.");

      setProcessingProgress(100);
      setProcessingStatus("Redirecting to Script Analysis...");

      if (onTabChange) {
        setTimeout(() => {
          onTabChange("script"); // Navigate to script editor tab
          setProcessingProgress(0);
          setProcessingStatus("");
          setSelectedFile(null); // Clear selected file after successful upload and redirect
          // setProjectNameInput(""); // Optionally clear project name
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
      setProcessingProgress(0);
      setProcessingStatus("Upload failed. Please try again.");
      // Keep selectedFile so user doesn't have to re-select if it was a transient error.
      // If the error is due to the file itself, FileUpload should handle it.
    },
  });

  const isProcessingScript =
    uploadScriptMutation.isPending ||
    (uploadScriptMutation.isSuccess &&
      processingProgress < 100 &&
      processingStatus.includes("Redirecting"));

  // This function is now called by the "Begin Analysis" button
  const handleInitiateUploadForAnalysis = async (file: File) => {
    await uploadScriptMutation.mutateAsync(file);
  };

  const handleFileSelection = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      toast({
        title: "File Selected",
        description: `${file.name} is ready. Click "Begin Analysis" when ready.`,
      });
    } else if (selectedFile) {
      toast({
        variant: "destructive",
        title: "File Cleared",
        description: "Previous file selection was removed or invalid.",
      });
    }
  };

  const handleStartWriting = () => {
    if (!projectNameInput.trim() || isProcessingScript || !!selectedFile) return;
    const projectName = projectNameInput.trim();
    setLocation(`/script-writer?projectName=${encodeURIComponent(projectName)}`);
    if (onTabChange) {
      onTabChange("script-writer");
    }
  };

  const handleBeginAnalysisClick = () => {
    if (selectedFile && projectNameInput.trim() && !isProcessingScript) {
      handleInitiateUploadForAnalysis(selectedFile);
    }
  };

  const canStartWriting = projectNameInput.trim() && !selectedFile && !isProcessingScript;
  const canBeginAnalysis = projectNameInput.trim() && !!selectedFile && !isProcessingScript;

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-10 md:py-14 px-4 bg-vadis-light-gray-bg">
      <div className="text-center mb-10 md:mb-14 max-w-4xl w-full">
        <div className="flex justify-center mb-8 md:mb-10">
          <img
            src="/assets/vadis-media-logo-dark.png"
            alt="Vadis Media Logo"
            className="w-full h-auto max-w-[280px] sm:max-w-[320px] md:max-w-[380px]"
          />
        </div>
        <p className="text-lg md:text-xl text-gray-700 mb-10 md:mb-14">
          AI-powered script analysis for Optimizing Funding and Casting
        </p>

        <div className="space-y-10 md:space-y-12">
          {/* Get Started Box - Content changes based on isProcessingScript */}
          <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
            {isProcessingScript ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <h2 className="text-xl font-semibold mb-4 text-vadis-dark-text">
                  Processing Your Script
                </h2>
                <p className="text-gray-600 mb-6 text-center">
                  {processingStatus.includes("Redirecting")
                    ? processingStatus
                    : "Please wait while we upload and analyze your screenplay."}
                </p>
                <div className="w-full max-w-md">
                  <Progress
                    value={processingProgress}
                    className="h-2 mb-2 bg-muted [&>div]:bg-primary"
                  />
                  {!processingStatus.includes("Redirecting") && (
                    <p className="text-sm text-gray-500 text-center">
                      {processingStatus}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
                  <UploadBoxIcon className="mr-2 h-6 w-6 text-primary" />
                  Get Started
                </h2>
                <p className="text-gray-600 mb-6">
                  Enter your project name, then either start writing a new script or upload an existing one for analysis.
                </p>

                <div className="mb-6 max-w-md mx-auto">
                  <label
                    htmlFor="projectName"
                    className="block text-sm font-medium text-gray-700 mb-1 text-left"
                  >
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="projectName"
                    type="text"
                    placeholder="e.g., The Adventures of Captain Code"
                    value={projectNameInput}
                    onChange={(e) => setProjectNameInput(e.target.value)}
                    className="bg-white"
                    disabled={isProcessingScript}
                  />
                  {!projectNameInput.trim() && (
                    <p className="text-xs text-red-500 mt-1 text-left">Project name is required.</p>
                  )}
                </div>

                <div className="mb-8">
                  <FileUpload
                    onFileSelected={handleFileSelection}
                    isLoading={isProcessingScript}
                  />
                  {selectedFile && (
                    <p className="text-sm text-green-600 mt-2">
                      Selected for analysis: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>

                <TooltipProvider delayDuration={100}>
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Button is wrapped by span for Tooltip to work when button is disabled */}
                        <span> 
                          <Button
                            onClick={handleStartWriting}
                            disabled={!canStartWriting}
                            className="w-full sm:w-auto"
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Start Writing
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!projectNameInput.trim() ? <p>Enter project name to enable.</p> :
                         selectedFile ? <p>A file is selected for analysis. Clear it or complete analysis first.</p> :
                         isProcessingScript ? <p>Cannot start writing while another process is active.</p> :
                         <p>Create a new script from scratch using the project name.</p>}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            onClick={handleBeginAnalysisClick}
                            disabled={!canBeginAnalysis}
                            className="w-full sm:w-auto"
                          >
                            <Search className="mr-2 h-4 w-4" /> Begin Analysis
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!projectNameInput.trim() ? <p>Enter project name to enable.</p> :
                         !selectedFile ? <p>Upload a script file above to enable analysis.</p> :
                         isProcessingScript ? <p>Processing another task.</p> :
                         <p>Analyze the selected script: {selectedFile?.name || ""}</p>}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>

                <div className="text-xs text-muted-foreground mt-6 flex items-center justify-center space-x-1">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span>Your script is processed securely and will not be shared.</span>
                </div>
              </>
            )}
          </div>

          {/* How It Works Section (remains unchanged) */}
          <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
              <PlaySquare className="mr-2 h-6 w-6 text-primary" />
              How It Works
            </h2>
            <ul className="space-y-4 text-gray-700 text-left">
              {[
                "Upload your script PDF file.",
                "Vadis AI will extract scenes from the script and analyze brand sponsorship opportunities.",
                "Select the brand sponsors you'd like to feature in the scenes from your script.",
                "Review AI-generated stills and videos featuring the Brand Sponsors you've selected for each scene.",
                "Export for production.",
              ].map((step, index) => (
                <li key={index} className="flex items-start text-gray-600">
                  <span className="flex-shrink-0 bg-primary text-primary-foreground h-6 w-6 flex items-center justify-center rounded-full text-sm font-semibold mr-4 mt-0.5">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}