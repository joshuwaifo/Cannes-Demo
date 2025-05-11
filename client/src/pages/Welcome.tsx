// // client/src/pages/Welcome.tsx
// import { TabType } from "@/lib/types";
// import { Film, Upload, PlaySquare, Loader2 } from "lucide-react"; // Keep Film icon for now or choose another
// import FileUpload from "@/components/script/FileUpload"; // Assuming FileUpload exists and is styled
// import { Progress } from "@/components/ui/progress"; // Assuming Progress component exists
// import { useState, useEffect } from "react"; // Add useState, useEffect if not already there
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { useToast } from "@/hooks/use-toast";
// import { Script, Scene } from "@shared/schema";


// interface WelcomeProps {
//   onTabChange?: (tab: TabType) => void;
// }

// export default function Welcome({ onTabChange }: WelcomeProps) {
//   const { toast } = useToast();
//   const queryClient = useQueryClient();

//   const [processingProgress, setProcessingProgress] = useState(0);
//   const [processingStatus, setProcessingStatus] = useState("");
//   const [checkCount, setCheckCount] = useState(0);

//   const {
//     data: script,
//     refetch: refetchScript,
//     isSuccess: isScriptAvailable,
//   } = useQuery<Script | null>({
//     queryKey: ["/api/scripts/current"],
//     refetchOnWindowFocus: false,
//     enabled: false,
//     staleTime: 0,
//     cacheTime: 0,
//   });

//   const {
//     data: scenes = [],
//     refetch: refetchScenes,
//     isSuccess: areScenesAvailable,
//   } = useQuery<Scene[]>({
//     queryKey: ["/api/scripts/scenes"],
//     refetchOnWindowFocus: false,
//     enabled: false,
//     staleTime: 0,
//     cacheTime: 0,
//   });

//   const uploadScriptMutation = useMutation({
//     mutationFn: async (file: File) => {
//       console.log("[Welcome] New upload. Clearing caches.");
//       await queryClient.removeQueries({ queryKey: ["/api/scripts/current"], exact: true });
//       await queryClient.removeQueries({ queryKey: ["/api/scripts/scenes"], exact: true });
//       // ... (other cache removals from previous step) ...
//       setCheckCount(0);
//       setProcessingProgress(10);
//       setProcessingStatus("Uploading script file...");
//       const formData = new FormData();
//       formData.append("script", file);
//       const response = await fetch("/api/scripts/upload", { method: "POST", body: formData, credentials: "include" });
//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(errorText || "Failed to upload script");
//       }
//       return await response.json();
//     },
//     onSuccess: async (data) => {
//       toast({ title: "Script uploaded successfully", description: "Your script is being processed." });
//       setProcessingProgress(30);
//       setProcessingStatus("Extracting script content...");
//       await refetchScript();
//       await refetchScenes();
//       setCheckCount(1);
//     },
//     onError: (error: Error) => {
//       toast({ variant: "destructive", title: "Upload failed", description: error.message });
//       setProcessingProgress(0);
//       setProcessingStatus("Upload failed. Please try again.");
//       setCheckCount(0);
//     },
//   });

//   useEffect(() => {
//     let pollingInterval: NodeJS.Timeout | null = null;
//     if (uploadScriptMutation.isSuccess && checkCount > 0 && checkCount <= 15) {
//       pollingInterval = setInterval(async () => {
//         if (checkCount >= 1 && checkCount <= 3) { setProcessingProgress(50); setProcessingStatus("Analyzing screenplay scenes..."); }
//         else if (checkCount > 3 && checkCount <= 7) { setProcessingProgress(65); setProcessingStatus("Identifying brandable scenes..."); }
//         else if (checkCount > 7 && checkCount <= 12) { setProcessingProgress(80); setProcessingStatus("Generating placement opportunities..."); }
//         else if (checkCount > 12) { setProcessingProgress(90); setProcessingStatus("Finalizing script analysis..."); }
//         await refetchScript(); await refetchScenes(); setCheckCount((prev) => prev + 1);
//       }, 1500);
//     } else if (uploadScriptMutation.isSuccess && checkCount > 15) {
//       console.warn("[Welcome] Polling timed out.");
//       setProcessingStatus("Processing is taking longer than expected...");
//     }
//     return () => { if (pollingInterval) clearInterval(pollingInterval); };
//   }, [uploadScriptMutation.isSuccess, checkCount, refetchScript, refetchScenes]);

//   useEffect(() => {
//     if (uploadScriptMutation.isSuccess && isScriptAvailable && areScenesAvailable && script && scenes.length > 0) {
//       setProcessingProgress(100);
//       setProcessingStatus("Analysis complete! Redirecting...");
//       const redirectTimer = setTimeout(() => {
//         if (onTabChange) onTabChange("script");
//         setCheckCount(0);
//       }, 1000);
//       return () => clearTimeout(redirectTimer);
//     }
//   }, [uploadScriptMutation.isSuccess, isScriptAvailable, areScenesAvailable, script, scenes, onTabChange]);

//   const isProcessingScript = uploadScriptMutation.isPending || (uploadScriptMutation.isSuccess && (!isScriptAvailable || !areScenesAvailable || !script || scenes.length === 0));
//   const handleFileUpload = async (file: File) => { await uploadScriptMutation.mutateAsync(file); };

//   return (
//     <div className="flex-grow flex flex-col items-center justify-center py-8 md:py-10 px-4 bg-vadis-light-gray-bg"> {/* Use the light gray page background */}
//       <div className="text-center mb-8 md:mb-10 max-w-3xl w-full">
//         <div className="flex justify-center mb-4">
//           {/* Use the VADIS AI logo style from the target screenshot */}
//           <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-vadis-blue-ai">
//             VADIS<span className="text-primary">AI</span>
//           </h1>
//         </div>
//         {/* <h1 className="text-3xl font-bold mb-2 text-vadis-dark-text">Vadis Brand Marketplace</h1> */} {/* Title from current app screenshot - can be kept or removed */}
//         <p className="text-lg md:text-xl text-gray-600 mb-6">
//           AI-powered script analysis for Brand Sponsorship Opportunities
//         </p>

//         {/* Main Content Sections in Cards */}
//         <div className="space-y-8">
//           {isProcessingScript ? (
//             <div className="bg-card rounded-lg shadow-lg p-6 md:p-8"> {/* White card */}
//               <div className="flex flex-col items-center">
//                 <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
//                 <h2 className="text-xl font-semibold mb-4 text-vadis-dark-text">Processing Your Script</h2>
//                 <p className="text-gray-600 mb-6 text-center">
//                   Please wait while we extract and analyze your screenplay. 
//                   You'll be automatically redirected to the Script Editor once it's ready.
//                 </p>
//                 <div className="w-full max-w-md">
//                   <Progress value={processingProgress} className="h-2 mb-2 bg-muted [&>div]:bg-primary" /> {/* Ensure progress bar uses primary color */}
//                   <p className="text-sm text-gray-500 text-center">{processingStatus}</p>
//                 </div>
//               </div>
//             </div>
//           ) : (
//             <div className="bg-card rounded-lg shadow-lg p-6 md:p-8"> {/* White card */}
//               <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
//                 <Upload className="mr-2 h-6 w-6 text-primary" /> {/* Primary color for icon */}
//                 Get Started
//               </h2>
//               <p className="text-gray-600 mb-6">
//                 Upload your script PDF file to begin the analysis process. Vadis AI will identify Brand Sponsorship Opportunities by scene from your script.
//               </p>
//               <FileUpload 
//                 onFileUpload={handleFileUpload} 
//                 isLoading={uploadScriptMutation.isPending} 
//               />
//             </div>
//           )}

//           <div className="bg-card rounded-lg shadow-lg p-6 md:p-8"> {/* White card */}
//             <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
//               <PlaySquare className="mr-2 h-6 w-6 text-primary" /> {/* Primary color for icon */}
//               How It Works
//             </h2>
//             <ol className="list-decimal list-inside space-y-3 text-gray-600 text-left"> {/* Align text left for readability */}
//               <li>Upload your script PDF file</li>
//               <li>Vadis AI will extract scenes from the script and analyze brand sponsorship opportunities</li>
//               <li>Select the brand sponsors you'd like to feature in the scenes from your script</li>
//               <li>Review AI-generated stills and videos featuring the Brand Sponsors you've selected for each scene</li>
//               <li>Export for production</li>
//             </ol>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// client/src/pages/Welcome.tsx
import { TabType } from "@/lib/types";
import { Upload, PlaySquare, Loader2 } from "lucide-react";
import FileUpload from "@/components/script/FileUpload";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react"; // Removed unused Film icon
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
// Script and Scene types are not directly used in Welcome anymore for data checking before redirect
// but keeping them doesn't harm if other parts might rely on them indirectly via queryClient.

interface WelcomeProps {
  onTabChange?: (tab: TabType) => void;
}

export default function Welcome({ onTabChange }: WelcomeProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");

  const uploadScriptMutation = useMutation({
    onMutate: async () => {
      console.log("[Welcome] New upload initiated. Clearing ALL relevant client-side caches.");
      setProcessingProgress(5); // Small initial progress
      setProcessingStatus("Preparing for new script upload...");

      // Clear all potentially relevant queries to ensure ScriptEditor gets fresh data
      await queryClient.removeQueries(); // This is aggressive, consider more targeted if needed
      // More targeted approach:
      // await queryClient.removeQueries({ queryKey: ["/api/scripts/current"], exact: true });
      // await queryClient.removeQueries({ queryKey: ["/api/scripts/scenes"], exact: true });
      // await queryClient.removeQueries({ queryKey: ["/api/scripts/brandable-scenes"], exact: true });
      // await queryClient.invalidateQueries({ queryKey: ["/api/scripts/scene-variations"] });
      // await queryClient.invalidateQueries({ queryKey: ["/api/scripts/characters"] });
      // await queryClient.invalidateQueries({ queryKey: ["/api/scenes/suggest-locations"] });
      // await queryClient.invalidateQueries({ queryKey: ["/api/characters/suggest-actors"] });
      console.log("[Welcome] Client-side caches reset for new script session.");
    },
    mutationFn: async (file: File) => {
      setProcessingProgress(10);
      setProcessingStatus("Uploading script file...");
      const formData = new FormData();
      formData.append("script", file);
      const response = await fetch("/api/scripts/upload", { method: "POST", body: formData, credentials: "include" });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to upload script");
      }
      return await response.json(); // Expecting { script: { id, title }, scenesCount, brandableScenesCount }
    },
    onSuccess: async (data) => {
      toast({ title: "Script Uploaded", description: "Server processing initiated..." });
      setProcessingProgress(75); // Indicate server is doing its part
      setProcessingStatus("Server processing script...");

      // The backend /api/scripts/upload now does initial scene extraction & brandable analysis.
      // We can directly navigate. ScriptEditor will fetch the details it needs.
      console.log("[Welcome] Upload successful. Server has processed. Invalidating queries for ScriptEditor to pick up.");

      // Invalidate current script and scenes so ScriptEditor fetches the new ones.
      // No need to `refetch` here in Welcome, ScriptEditor will do it on mount.
      await queryClient.invalidateQueries({ queryKey: ["/api/scripts/current"], exact: true });
      await queryClient.invalidateQueries({ queryKey: ["/api/scripts/scenes"], exact: true });
      await queryClient.invalidateQueries({ queryKey: ["/api/scripts/brandable-scenes"], exact: true});


      setProcessingProgress(100);
      setProcessingStatus("Redirecting to Script Editor...");

      if (onTabChange) {
        // A short delay to allow the user to see the "Redirecting" message
        setTimeout(() => {
          onTabChange("script");
          // Reset progress for the Welcome page if the user navigates back
          setProcessingProgress(0);
          setProcessingStatus("");
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
      setProcessingProgress(0);
      setProcessingStatus("Upload failed. Please try again.");
    },
  });

  // Simplified isProcessingScript, mainly reflects the mutation's pending state
  const isProcessingScript = uploadScriptMutation.isPending || 
                             (uploadScriptMutation.isSuccess && processingProgress < 100 && processingStatus.includes("Redirecting"));


  const handleFileUpload = async (file: File) => {
    await uploadScriptMutation.mutateAsync(file);
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-8 md:py-10 px-4 bg-vadis-light-gray-bg">
      <div className="text-center mb-8 md:mb-10 max-w-3xl w-full">
        <div className="flex justify-center mb-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-vadis-blue-ai">
            VADIS<span className="text-primary">AI</span>
          </h1>
        </div>
        <p className="text-lg md:text-xl text-gray-600 mb-6">
          AI-powered script analysis for Brand Sponsorship Opportunities
        </p>
        <div className="space-y-8">
          {isProcessingScript ? ( // Show progress if mutation is pending or in redirect phase
            <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <h2 className="text-xl font-semibold mb-4 text-vadis-dark-text">Processing Your Script</h2>
                <p className="text-gray-600 mb-6 text-center">
                  {processingStatus.includes("Redirecting") 
                    ? processingStatus 
                    : "Please wait while we upload and analyze your screenplay."}
                </p>
                <div className="w-full max-w-md">
                  <Progress value={processingProgress} className="h-2 mb-2 bg-muted [&>div]:bg-primary" />
                  {!processingStatus.includes("Redirecting") && 
                    <p className="text-sm text-gray-500 text-center">{processingStatus}</p>
                  }
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
                <Upload className="mr-2 h-6 w-6 text-primary" />
                Get Started
              </h2>
              <p className="text-gray-600 mb-6">
                Upload your script PDF file to begin the analysis process. Vadis AI will identify Brand Sponsorship Opportunities by scene from your script.
              </p>
              <FileUpload 
                onFileUpload={handleFileUpload} 
                isLoading={uploadScriptMutation.isPending} 
              />
            </div>
          )}

          <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
            <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
              <PlaySquare className="mr-2 h-6 w-6 text-primary" />
              How It Works
            </h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-600 text-left">
              <li>Upload your script PDF file</li>
              <li>Vadis AI will extract scenes from the script and analyze brand sponsorship opportunities</li>
              <li>Select the brand sponsors you'd like to feature in the scenes from your script</li>
              <li>Review AI-generated stills and videos featuring the Brand Sponsors you've selected for each scene</li>
              <li>Export for production</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}