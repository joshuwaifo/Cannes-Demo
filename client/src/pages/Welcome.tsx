// // client/src/pages/Welcome.tsx
// import { TabType } from "@/lib/types";
// import { Upload, PlaySquare, Loader2, ShieldCheck } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import FileUpload from "@/components/script/FileUpload";
// import { Progress } from "@/components/ui/progress";
// import { useState, useEffect } from "react"; // Removed unused Film icon
// import { useMutation, useQueryClient } from "@tanstack/react-query";
// import { useToast } from "@/hooks/use-toast";
// // Script and Scene types are not directly used in Welcome anymore for data checking before redirect
// // but keeping them doesn't harm if other parts might rely on them indirectly via queryClient.

// interface WelcomeProps {
//   onTabChange?: (tab: TabType) => void;
// }

// export default function Welcome({ onTabChange }: WelcomeProps) {
//   const { toast } = useToast();
//   const queryClient = useQueryClient();

//   const [processingProgress, setProcessingProgress] = useState(0);
//   const [processingStatus, setProcessingStatus] = useState("");
//   const [projectNameInput, setProjectNameInput] = useState("");

//   const uploadScriptMutation = useMutation({
//     onMutate: async () => {
//       console.log(
//         "[Welcome] New upload initiated. Clearing ALL relevant client-side caches.",
//       );
//       setProcessingProgress(5); // Small initial progress
//       setProcessingStatus("Preparing for new script upload...");

//       // Clear all potentially relevant queries to ensure ScriptEditor gets fresh data
//       await queryClient.removeQueries(); // This is aggressive, consider more targeted if needed
//       // More targeted approach:
//       // await queryClient.removeQueries({ queryKey: ["/api/scripts/current"], exact: true });
//       // await queryClient.removeQueries({ queryKey: ["/api/scripts/scenes"], exact: true });
//       // await queryClient.removeQueries({ queryKey: ["/api/scripts/brandable-scenes"], exact: true });
//       // await queryClient.invalidateQueries({ queryKey: ["/api/scripts/scene-variations"] });
//       // await queryClient.invalidateQueries({ queryKey: ["/api/scripts/characters"] });
//       // await queryClient.invalidateQueries({ queryKey: ["/api/scenes/suggest-locations"] });
//       // await queryClient.invalidateQueries({ queryKey: ["/api/characters/suggest-actors"] });
//       console.log("[Welcome] Client-side caches reset for new script session.");
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
//       return await response.json(); // Expecting { script: { id, title }, scenesCount, brandableScenesCount }
//     },
//     onSuccess: async (data) => {
//       toast({
//         title: "Script Uploaded",
//         description: "Server processing initiated...",
//       });
//       setProcessingProgress(75); // Indicate server is doing its part
//       setProcessingStatus("Server processing script...");

//       // The backend /api/scripts/upload now does initial scene extraction & brandable analysis.
//       // We can directly navigate. ScriptEditor will fetch the details it needs.
//       console.log(
//         "[Welcome] Upload successful. Server has processed. Invalidating queries for ScriptEditor to pick up.",
//       );

//       // Invalidate current script and scenes so ScriptEditor fetches the new ones.
//       // No need to `refetch` here in Welcome, ScriptEditor will do it on mount.
//       await queryClient.invalidateQueries({
//         queryKey: ["/api/scripts/current"],
//         exact: true,
//       });
//       await queryClient.invalidateQueries({
//         queryKey: ["/api/scripts/scenes"],
//         exact: true,
//       });
//       await queryClient.invalidateQueries({
//         queryKey: ["/api/scripts/brandable-scenes"],
//         exact: true,
//       });

//       setProcessingProgress(100);
//       setProcessingStatus("Redirecting to Script Editor...");

//       if (onTabChange) {
//         // A short delay to allow the user to see the "Redirecting" message
//         setTimeout(() => {
//           onTabChange("script");
//           // Reset progress for the Welcome page if the user navigates back
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

//   // Simplified isProcessingScript, mainly reflects the mutation's pending state
//   const isProcessingScript =
//     uploadScriptMutation.isPending ||
//     (uploadScriptMutation.isSuccess &&
//       processingProgress < 100 &&
//       processingStatus.includes("Redirecting"));

//   const handleFileUpload = async (file: File) => {
//     await uploadScriptMutation.mutateAsync(file);
//   };

//   return (
//     <div className="flex-grow flex flex-col items-center justify-center py-8 md:py-10 px-4 bg-vadis-light-gray-bg">
//       <div className="text-center mb-8 md:mb-10 max-w-3xl w-full">
//         <div className="flex justify-center mb-4">
//           <img
//             src="/assets/vadis-media-logo-dark.png"
//             alt="Vadis Media Logo"
//             className="h-24" // Larger logo for Welcome page
//           />
//         </div>
//         {/* <h1 className="text-3xl font-bold mb-2 text-vadis-dark-text">Vadis Brand Marketplace</h1> */}{" "}
//         {/* Title from current app screenshot - can be kept or removed */}
//         <p className="text-lg md:text-xl text-gray-600 mb-6">
//           AI-powered script analysis for Optimizing Funding and Casting
//         </p>
//         <div className="space-y-8">
//           {isProcessingScript ? ( // Show progress if mutation is pending or in redirect phase
//             <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
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
//             <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
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

//           <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
//             <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
//               <PlaySquare className="mr-2 h-6 w-6 text-primary" />
//               How It Works
//             </h2>
//             <ol className="list-decimal list-inside space-y-3 text-gray-600 text-left">
//               <li>Upload your script PDF file</li>
//               <li>
//                 Vadis AI will extract scenes from the script and analyze brand
//                 sponsorship opportunities
//               </li>
//               <li>
//                 Select the brand sponsors you'd like to feature in the scenes
//                 from your script
//               </li>
//               <li>
//                 Review AI-generated stills and videos featuring the Brand
//                 Sponsors you've selected for each scene
//               </li>
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
import { Upload, PlaySquare, Loader2, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [projectNameInput, setProjectNameInput] = useState("");

  const uploadScriptMutation = useMutation({
    onMutate: async () => {
      console.log(
        "[Welcome] New upload initiated. Clearing ALL relevant client-side caches.",
      );
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
      return await response.json(); // Expecting { script: { id, title }, scenesCount, brandableScenesCount }
    },
    onSuccess: async (data) => {
      toast({
        title: "Script Uploaded",
        description: "Server processing initiated...",
      });
      setProcessingProgress(75); // Indicate server is doing its part
      setProcessingStatus("Server processing script...");

      // The backend /api/scripts/upload now does initial scene extraction & brandable analysis.
      // We can directly navigate. ScriptEditor will fetch the details it needs.
      console.log(
        "[Welcome] Upload successful. Server has processed. Invalidating queries for ScriptEditor to pick up.",
      );

      // Invalidate current script and scenes so ScriptEditor fetches the new ones.
      // No need to `refetch` here in Welcome, ScriptEditor will do it on mount.
      await queryClient.invalidateQueries({
        queryKey: ["/api/scripts/current"],
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/scripts/scenes"],
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/scripts/brandable-scenes"],
        exact: true,
      });

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
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
      setProcessingProgress(0);
      setProcessingStatus("Upload failed. Please try again.");
    },
  });

  // Simplified isProcessingScript, mainly reflects the mutation's pending state
  const isProcessingScript =
    uploadScriptMutation.isPending ||
    (uploadScriptMutation.isSuccess &&
      processingProgress < 100 &&
      processingStatus.includes("Redirecting"));

  const handleFileUpload = async (file: File) => {
    await uploadScriptMutation.mutateAsync(file);
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-10 md:py-14 px-4 bg-vadis-light-gray-bg">
      {" "}
      {/* Adjusted vertical padding */}
      <div className="text-center mb-10 md:mb-14 max-w-4xl w-full">
        {" "}
        {/* Wider main container for tagline and logo */}
        <div className="flex justify-center mb-8 md:mb-10">
          {" "}
          {/* Spacing for logo */}
          <img
            src="/assets/vadis-media-logo-dark.png"
            alt="Vadis Media Logo"
            className="w-full h-auto max-w-[280px] sm:max-w-[320px] md:max-w-[380px]"
          />
        </div>
        {/* <h1 className="text-3xl font-bold mb-2 text-vadis-dark-text">Vadis Brand Marketplace</h1> */}{" "}
        {/* Tagline styling */}
        <p className="text-lg md:text-xl text-gray-700 mb-10 md:mb-14">
          {" "}
          {/* Spacing and color for tagline */}
          AI-powered script analysis for Optimizing Funding and Casting
        </p>
        <div className="space-y-10 md:space-y-12">
          {" "}
          {/* Spacing between the two cards */}
          {isProcessingScript ? (
            <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
              {" "}
              {/* Card styling: rounded-xl, shadow-xl, padding, max-width, centered */}
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
            </div>
          ) : (
            <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
              {" "}
              {/* Card styling: rounded-xl, shadow-xl, padding, max-width, centered */}
              <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
                <Upload className="mr-2 h-6 w-6 text-primary" />
                Get Started
              </h2>
              <p className="text-gray-600 mb-6">
                Upload your script PDF file to begin the analysis process. Vadis
                AI will identify Brand Sponsorship Opportunities by scene from
                your script, Filming Locations and Casting Suggestions.
              </p>
              <div className="mb-4 max-w-md mx-auto">
                <label
                  htmlFor="projectName"
                  className="block text-sm font-medium text-gray-700 mb-1 text-left"
                >
                  Project Name (Optional)
                </label>
                <Input
                  id="projectName"
                  type="text"
                  placeholder="e.g., Sideways, My Awesome Film"
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="text-xs text-muted-foreground mb-4 flex items-center justify-center space-x-1">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span>
                  Your script is processed securely and will not be shared
                  externally or with other users.
                </span>
              </div>
              <FileUpload
                onFileUpload={handleFileUpload}
                isLoading={uploadScriptMutation.isPending}
              />
            </div>
          )}
          <div className="bg-card rounded-xl shadow-xl p-6 sm:p-8 md:p-10 max-w-3xl mx-auto">
            {" "}
            {/* Card styling */}
            <h2 className="text-2xl font-semibold mb-4 flex items-center text-vadis-dark-text">
              <PlaySquare className="mr-2 h-6 w-6 text-primary" />
              How It Works
            </h2>
            <ul className="space-y-4 text-gray-700 text-left">
              {" "}
              {/* Enhanced list styling */}
              {[
                "Upload your script PDF file.",
                "Vadis AI will extract scenes from the script and analyze brand sponsorship opportunities.",
                "              Select the brand sponsors you'd like to feature in the scenes from your script.",
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
