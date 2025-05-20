// // client/src/pages/ScriptWriter.tsx
// import { useState, useEffect } from "react";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
// import { Progress } from "@/components/ui/progress";
// import { Loader2, FileText, Download, AlertCircle } from "lucide-react";
// import { useMutation } from "@tanstack/react-query";
// import { useToast } from "@/hooks/use-toast";
// import { apiRequest } from "@/lib/queryClient";
// import { ScriptGenerationFormData } from "@/lib/types";
// import { scriptGenerationFormSchema, FilmRatingEnum, FilmRatingType } from "@shared/schema";
// import { ScrollArea } from "@/components/ui/scroll-area";
// // No need to import useLocation from wouter if we use window.location directly for this one-time read

// export default function ScriptWriter() {
//   const { toast } = useToast();
//   const [generatedScript, setGeneratedScript] = useState<string | null>(null);
//   const [isGenerating, setIsGenerating] = useState(false);
//   const [generationProgress, setGenerationProgress] = useState(0);
//   const [generationError, setGenerationError] = useState<string | null>(null);

//   const form = useForm<ScriptGenerationFormData>({
//     resolver: zodResolver(scriptGenerationFormSchema),
//     defaultValues: {
//       projectTitle: "", // Initialize empty; will be set by useEffect
//       logline: "",
//       description: "",
//       genre: "",
//       concept: "",
//       targetedRating: "PG_13" as FilmRatingType,
//       storyLocation: "",
//       specialRequest: "",
//     },
//   });

//   // This useEffect hook runs once when the component mounts.
//   // It's the most reliable place to read initial URL parameters.
//   useEffect(() => {
//     // Directly use window.location.search to get the query string
//     const searchParams = new URLSearchParams(window.location.search);
//     const projectNameFromURL = searchParams.get("projectName");

//     // console.log("[ScriptWriter] Mounted. projectName from URL:", projectNameFromURL); // For debugging

//     if (projectNameFromURL) {
//       // Decode the project name as it was URI encoded
//       const decodedProjectName = decodeURIComponent(projectNameFromURL);
//       // Use setValue to update the form field after initialization
//       form.setValue("projectTitle", decodedProjectName, {
//         shouldValidate: true, // Optional: validate after setting
//         shouldDirty: true,    // Optional: mark the field as dirty as if user typed it
//       });
//       // console.log(`[ScriptWriter] Set projectTitle to: ${decodedProjectName}`); // For debugging
//     }
//     // The empty dependency array [] ensures this effect runs only once on mount.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []); // IMPORTANT: Empty dependency array

//   const generateScriptMutation = useMutation({
//     mutationFn: async (data: ScriptGenerationFormData) => {
//       setIsGenerating(true);
//       setGenerationProgress(10);
//       setGeneratedScript(null);
//       setGenerationError(null);

//       const progressInterval = setInterval(() => {
//         setGenerationProgress((prev) => {
//           if (prev >= 90) {
//             clearInterval(progressInterval);
//             return 90;
//           }
//           return prev + Math.floor(Math.random() * 5) + 5;
//         });
//       }, 2000);

//       try {
//         const controller = new AbortController();
//         const timeoutId = setTimeout(() => controller.abort(), 120000);

//         const response = await apiRequest(
//           "POST", 
//           "/api/scripts/generate-from-prompt", 
//           data,
//           { signal: controller.signal }
//         );

//         clearTimeout(timeoutId);

//         if (!response.ok) {
//           const errorData = await response.json().catch(() => ({ 
//             message: "Failed to generate script. Server error." 
//           }));
//           let errorMessage = errorData.message || `Error ${response.status}`;
//           if (response.status === 500) errorMessage = "Our script generator is currently experiencing issues. Please try again later.";
//           else if (response.status === 400) errorMessage = "Please check your script details and try again.";
//           else if (response.status === 429) errorMessage = "You've made too many requests. Please wait a moment and try again.";
//           throw new Error(errorMessage);
//         }

//         const result = await response.json();
//         clearInterval(progressInterval);
//         setGenerationProgress(100);
//         return result.script;
//       } catch (error: any) {
//         clearInterval(progressInterval);
//         setGenerationProgress(0);
//         if (error.name === 'AbortError') throw new Error("Script generation timed out. Please try again with a simpler concept.");
//         if (error.message?.includes("fetch failed")) throw new Error("Network error. Please check your connection and try again.");
//         throw error;
//       }
//     },
//     onSuccess: (scriptText: string) => {
//       setGeneratedScript(scriptText);
//       toast({
//         title: "Script Generated",
//         description: "Your script has been successfully generated.",
//       });
//       setIsGenerating(false);
//     },
//     onError: (error: Error) => {
//       const errorMsg = error.message || "Failed to generate script. Please try again.";
//       setGenerationError(errorMsg);
//       if (!errorMsg.includes("Network error")) {
//         toast({
//           variant: "destructive",
//           title: "Generation Failed",
//           description: errorMsg,
//         });
//       }
//       setIsGenerating(false);
//       setGenerationProgress(0);
//     },
//   });

//   const exportPdfMutation = useMutation({
//     mutationFn: async (scriptText: string) => {
//       const response = await fetch("/api/scripts/export-pdf", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ scriptContent: scriptText, title: form.getValues("projectTitle") || "GeneratedScript" }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({ message: "Failed to initiate PDF download." }));
//         throw new Error(errorData.message || "PDF generation failed.");
//       }
//       return response.blob();
//     },
//     onSuccess: (blob) => {
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = url;
//       a.download = `${(form.getValues("projectTitle") || "GeneratedScript").replace(/[^a-z0-9]/gi, '_')}.pdf`;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(url);
//       a.remove();
//       toast({
//         title: "PDF Exported",
//         description: "Your script has been downloaded as a PDF.",
//       });
//     },
//     onError: (error: Error) => {
//       toast({
//         variant: "destructive",
//         title: "PDF Export Failed",
//         description: error.message,
//       });
//     },
//   });

//   const onSubmit = (data: ScriptGenerationFormData) => {
//     generateScriptMutation.mutate(data);
//   };

//   const handleExportPdf = () => {
//     if (generatedScript) {
//       exportPdfMutation.mutate(generatedScript);
//     } else {
//       toast({
//         variant: "destructive",
//         title: "No Script to Export",
//         description: "Please generate a script first.",
//       });
//     }
//   };

//   return (
//     <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4">
//       <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Vadis Script Writer</h1>
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
//         <Card className="shadow-lg">
//           <CardHeader className="pb-4 sm:pb-6">
//             <CardTitle className="text-xl sm:text-2xl">Script Details</CardTitle>
//             <CardDescription>Provide the details for your new script.</CardDescription>
//           </CardHeader>
//           <CardContent>
//             <Form {...form}>
//               <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
//                 <FormField control={form.control} name="projectTitle" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Project Title</FormLabel>
//                     <FormControl><Input placeholder="e.g., The Last Starfighter" {...field} /></FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                 <FormField control={form.control} name="logline" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Logline (1-2 sentences)</FormLabel>
//                     <FormControl><Input placeholder="A brief summary of your story" {...field} /></FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                  <FormField control={form.control} name="description" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Description / Synopsis</FormLabel>
//                     <FormControl><Textarea placeholder="Overview of the plot and themes" {...field} rows={3} /></FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                 <FormField control={form.control} name="genre" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Genre</FormLabel>
//                     <FormControl><Input placeholder="e.g., Sci-Fi, Drama, Comedy" {...field} /></FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                  <FormField control={form.control} name="concept" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Core Concept / Idea</FormLabel>
//                     <FormControl><Textarea placeholder="Central idea of your story" {...field} rows={3} /></FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                 <FormField control={form.control} name="targetedRating" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Targeted Rating</FormLabel>
//                     <Select onValueChange={field.onChange} defaultValue={field.value}>
//                       <FormControl><SelectTrigger><SelectValue placeholder="Select a rating" /></SelectTrigger></FormControl>
//                       <SelectContent>
//                         {Object.entries(FilmRatingEnum).map(([key, value]) => (
//                           <SelectItem key={key} value={key as FilmRatingType}>
//                             {value}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                 <FormField control={form.control} name="storyLocation" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Primary Story Location</FormLabel>
//                     <FormControl><Input placeholder="e.g., Mars Colony, Paris, Forest" {...field} /></FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                 <FormField control={form.control} name="specialRequest" render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Special Requests (Optional)</FormLabel>
//                     <FormControl><Textarea placeholder="Any specific elements to include?" {...field} rows={2} /></FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )} />
//                 <Button type="submit" className="w-full" disabled={isGenerating}>
//                   {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Generate Script"}
//                 </Button>
//               </form>
//             </Form>
//           </CardContent>
//         </Card>

//         <Card className="shadow-lg">
//           <CardHeader className="pb-4 sm:pb-6">
//             <CardTitle className="text-xl sm:text-2xl">Generated Script Preview</CardTitle>
//             <CardDescription>Your script will appear here.</CardDescription>
//           </CardHeader>
//           <CardContent className="h-[400px] sm:h-[500px] md:h-[600px] flex flex-col">
//             {isGenerating && (
//               <div className="flex flex-col items-center justify-center h-full p-4">
//                 <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary animate-spin mb-4" />
//                 <p className="text-base sm:text-lg font-medium mb-2 text-center">Generating Script...</p>
//                 <p className="text-xs sm:text-sm text-muted-foreground mb-4 text-center">This may take a few minutes. Please wait.</p>
//                 <Progress value={generationProgress} className="w-full max-w-xs sm:max-w-md" />
//                 <p className="text-xs text-muted-foreground mt-2">{generationProgress}%</p>
//               </div>
//             )}
//             {generationError && !isGenerating && (
//                 <div className="flex flex-col items-center justify-center h-full text-destructive p-4">
//                     <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mb-4" />
//                     <p className="text-base sm:text-lg font-medium mb-2 text-center">Generation Failed</p>
//                     <p className="text-xs sm:text-sm text-center px-2">
//                         {generationError === "An error occurred during AI script generation." 
//                             ? "We couldn't generate your script. This could be due to server load or content restrictions. Please try again with different details."
//                             : generationError}
//                     </p>
//                     <Button 
//                         variant="outline" 
//                         size="sm" 
//                         className="mt-4" 
//                         onClick={() => setGenerationError(null)}
//                     >
//                         Dismiss
//                     </Button>
//                 </div>
//             )}
//             {!isGenerating && generatedScript && (
//               <ScrollArea className="flex-grow border rounded-md p-2 sm:p-4 bg-gray-50 whitespace-pre-wrap font-mono text-xs sm:text-sm">
//                 {generatedScript}
//               </ScrollArea>
//             )}
//             {!isGenerating && !generatedScript && !generationError && (
//               <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
//                 <FileText className="h-12 w-12 sm:h-16 sm:w-16 mb-4" />
//                 <p className="text-center text-sm sm:text-base">Fill out the form and click "Generate Script" to create your screenplay.</p>
//               </div>
//             )}
//           </CardContent>
//           {generatedScript && !isGenerating && (
//             <CardFooter>
//               <Button 
//                 onClick={handleExportPdf} 
//                 className="w-full"
//                 disabled={exportPdfMutation.isPending}
//               >
//                 {exportPdfMutation.isPending ? (
//                   <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
//                 ) : (
//                   <><Download className="mr-2 h-4 w-4" /> Download PDF</>
//                 )}
//               </Button>
//             </CardFooter>
//           )}
//         </Card>
//       </div>
//     </div>
//   );
// }

// client/src/pages/ScriptWriter.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Download, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ScriptGenerationFormData } from "@/lib/types";
import { scriptGenerationFormSchema, FilmRatingEnum, FilmRatingType } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

// Increase client-side timeout to 10 minutes (1,000,000 ms) to allow server ample time for 10 agents
const SCRIPT_GENERATION_CLIENT_TIMEOUT_MS = 1000000; 

export default function ScriptWriter() {
  const { toast } = useToast();
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const form = useForm<ScriptGenerationFormData>({
    resolver: zodResolver(scriptGenerationFormSchema),
    defaultValues: {
      projectTitle: "", 
      logline: "",
      description: "",
      genre: "",
      concept: "",
      targetedRating: "PG_13" as FilmRatingType,
      storyLocation: "",
      specialRequest: "",
    },
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const projectNameFromURL = searchParams.get("projectName");
    if (projectNameFromURL) {
      const decodedProjectName = decodeURIComponent(projectNameFromURL);
      form.setValue("projectTitle", decodedProjectName, {
        shouldValidate: true, 
        shouldDirty: true,    
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const generateScriptMutation = useMutation({
    mutationFn: async (data: ScriptGenerationFormData) => {
      setIsGenerating(true);
      setGenerationProgress(10);
      setGeneratedScript(null);
      setGenerationError(null);

      // Client-side progress simulation (remains unchanged)
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.floor(Math.random() * 5) + 5;
        });
      }, 2000); // This interval is for UI progress, not related to API timeout

      try {
        const controller = new AbortController();
        // Use the increased client-side timeout
        const timeoutId = setTimeout(() => {
          console.warn(`[Client] Script generation request timed out after ${SCRIPT_GENERATION_CLIENT_TIMEOUT_MS / 1000}s.`);
          controller.abort();
        }, SCRIPT_GENERATION_CLIENT_TIMEOUT_MS); 

        const response = await apiRequest(
          "POST", 
          "/api/scripts/generate-from-prompt", 
          data,
          { signal: controller.signal } // Pass the signal for this specific API request
        );

        clearTimeout(timeoutId); // Clear the client-side timeout if request completes

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            message: "Failed to generate script. Server error or unexpected response." 
          }));
          let errorMessage = errorData.message || `Error ${response.status}`;
          if (response.status === 500) errorMessage = "Our script generator is currently experiencing issues. Please try again later.";
          else if (response.status === 400) errorMessage = "Please check your script details and try again.";
          else if (response.status === 429) errorMessage = "You've made too many requests. Please wait a moment and try again.";
          throw new Error(errorMessage);
        }

        const result = await response.json();
        clearInterval(progressInterval); // Clear client-side progress simulation interval
        setGenerationProgress(100);
        return result.script;
      } catch (error: any) {
        clearInterval(progressInterval); // Also clear on error
        setGenerationProgress(0);
        if (error.name === 'AbortError') { // This error is thrown by fetch when controller.abort() is called
          throw new Error(`Script generation timed out on client after ${SCRIPT_GENERATION_CLIENT_TIMEOUT_MS / 1000 / 60} minutes. The server might still be processing or encountered an issue. Try a simpler concept or check server logs.`);
        }
        if (error.message?.includes("fetch failed")) { // Network error
          throw new Error("Network error. Please check your connection and try again.");
        }
        throw error; // Re-throw other errors (e.g., server errors parsed above)
      }
    },
    onSuccess: (scriptText: string) => {
      setGeneratedScript(scriptText);
      toast({
        title: "Script Generated",
        description: "Your script has been successfully generated.",
      });
      setIsGenerating(false);
    },
    onError: (error: Error) => {
      const errorMsg = error.message || "Failed to generate script. Please try again.";
      setGenerationError(errorMsg);
      // Only show toast for actual generation errors, not client-side timeouts if already handled by error message
      if (!errorMsg.toLowerCase().includes("timed out on client")) {
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: errorMsg,
        });
      }
      setIsGenerating(false);
      setGenerationProgress(0);
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async (scriptText: string) => {
      const response = await fetch("/api/scripts/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptContent: scriptText, title: form.getValues("projectTitle") || "GeneratedScript" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to initiate PDF download." }));
        throw new Error(errorData.message || "PDF generation failed.");
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(form.getValues("projectTitle") || "GeneratedScript").replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast({
        title: "PDF Exported",
        description: "Your script has been downloaded as a PDF.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "PDF Export Failed",
        description: error.message,
      });
    },
  });

  const onSubmit = (data: ScriptGenerationFormData) => {
    generateScriptMutation.mutate(data);
  };

  const handleExportPdf = () => {
    if (generatedScript) {
      exportPdfMutation.mutate(generatedScript);
    } else {
      toast({
        variant: "destructive",
        title: "No Script to Export",
        description: "Please generate a script first.",
      });
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Vadis Script Writer</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <Card className="shadow-lg">
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-xl sm:text-2xl">Script Details</CardTitle>
            <CardDescription>Provide the details for your new script.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                <FormField control={form.control} name="projectTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Title</FormLabel>
                    <FormControl><Input placeholder="e.g., The Last Starfighter" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="logline" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logline (1-2 sentences)</FormLabel>
                    <FormControl><Input placeholder="A brief summary of your story" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description / Synopsis</FormLabel>
                    <FormControl><Textarea placeholder="Overview of the plot and themes" {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="genre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genre</FormLabel>
                    <FormControl><Input placeholder="e.g., Sci-Fi, Drama, Comedy" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="concept" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Core Concept / Idea</FormLabel>
                    <FormControl><Textarea placeholder="Central idea of your story" {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="targetedRating" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Targeted Rating</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a rating" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(FilmRatingEnum).map(([key, value]) => (
                          <SelectItem key={key} value={key as FilmRatingType}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="storyLocation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Story Location</FormLabel>
                    <FormControl><Input placeholder="e.g., Mars Colony, Paris, Forest" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="specialRequest" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requests (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any specific elements to include?" {...field} rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isGenerating}>
                  {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Generate Script"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-xl sm:text-2xl">Generated Script Preview</CardTitle>
            <CardDescription>Your script will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] sm:h-[500px] md:h-[600px] flex flex-col">
            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary animate-spin mb-4" />
                <p className="text-base sm:text-lg font-medium mb-2 text-center">Generating Script...</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 text-center">This may take a few minutes. Please wait.</p>
                <Progress value={generationProgress} className="w-full max-w-xs sm:max-w-md" />
                <p className="text-xs text-muted-foreground mt-2">{generationProgress}%</p>
              </div>
            )}
            {generationError && !isGenerating && (
                <div className="flex flex-col items-center justify-center h-full text-destructive p-4">
                    <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mb-4" />
                    <p className="text-base sm:text-lg font-medium mb-2 text-center">Generation Failed</p>
                    <p className="text-xs sm:text-sm text-center px-2">
                        {generationError}
                    </p>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4" 
                        onClick={() => setGenerationError(null)}
                    >
                        Dismiss
                    </Button>
                </div>
            )}
            {!isGenerating && generatedScript && (
              <ScrollArea className="flex-grow border rounded-md p-2 sm:p-4 bg-gray-50 whitespace-pre-wrap font-mono text-xs sm:text-sm">
                {generatedScript}
              </ScrollArea>
            )}
            {!isGenerating && !generatedScript && !generationError && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <FileText className="h-12 w-12 sm:h-16 sm:w-16 mb-4" />
                <p className="text-center text-sm sm:text-base">Fill out the form and click "Generate Script" to create your screenplay.</p>
              </div>
            )}
          </CardContent>
          {generatedScript && !isGenerating && (
            <CardFooter>
              <Button 
                onClick={handleExportPdf} 
                className="w-full"
                disabled={exportPdfMutation.isPending}
              >
                {exportPdfMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" /> Download PDF</>
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}