// client/src/pages/ScriptWriter.tsx
import { useState } from "react";
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

  const generateScriptMutation = useMutation({
    mutationFn: async (data: ScriptGenerationFormData) => {
      setIsGenerating(true);
      setGenerationProgress(10); // Initial progress
      setGeneratedScript(null);
      setGenerationError(null);

      // Simulate progress - slower for mobile to prevent too many UI updates
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.floor(Math.random() * 5) + 5; // Random increment between 5-10%
        });
      }, 2000); // Update progress every 2 seconds

      try {
        const controller = new AbortController();
        // Set timeout for the request (2 minutes)
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        
        const response = await apiRequest(
          "POST", 
          "/api/scripts/generate-from-prompt", 
          data,
          { signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        // Check if response is OK, if not, parse error message
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            message: "Failed to generate script. Server error." 
          }));
          
          // Map common status codes to user-friendly messages
          let errorMessage = errorData.message || `Error ${response.status}`;
          if (response.status === 500) {
            errorMessage = "Our script generator is currently experiencing issues. Please try again later.";
          } else if (response.status === 400) {
            errorMessage = "Please check your script details and try again.";
          } else if (response.status === 429) {
            errorMessage = "You've made too many requests. Please wait a moment and try again.";
          }
          
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        clearInterval(progressInterval);
        setGenerationProgress(100);
        return result.script;
      } catch (error: any) {
        clearInterval(progressInterval);
        setGenerationProgress(0);
        
        // Handle specific error types
        if (error.name === 'AbortError') {
          throw new Error("Script generation timed out. Please try again with a simpler concept.");
        }
        
        if (error.message?.includes("fetch failed")) {
          throw new Error("Network error. Please check your connection and try again.");
        }
        
        throw error; // Re-throw other errors to be caught by onError
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
      
      // Set user-friendly error message
      setGenerationError(errorMsg);
      
      // Only show toast for non-network errors
      if (!errorMsg.includes("Network error")) {
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

      {/* Responsive grid that stacks on mobile but shows side by side on larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Input form card */}
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

        {/* Output preview card */}
        <Card className="shadow-lg">
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-xl sm:text-2xl">Generated Script Preview</CardTitle>
            <CardDescription>Your script will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] sm:h-[500px] md:h-[600px] flex flex-col">
            {/* Loading state */}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary animate-spin mb-4" />
                <p className="text-base sm:text-lg font-medium mb-2 text-center">Generating Script...</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 text-center">This may take a few minutes. Please wait.</p>
                <Progress value={generationProgress} className="w-full max-w-xs sm:max-w-md" />
                <p className="text-xs text-muted-foreground mt-2">{generationProgress}%</p>
              </div>
            )}
            
            {/* Error state - improved for mobile */}
            {generationError && !isGenerating && (
                <div className="flex flex-col items-center justify-center h-full text-destructive p-4">
                    <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mb-4" />
                    <p className="text-base sm:text-lg font-medium mb-2 text-center">Generation Failed</p>
                    <p className="text-xs sm:text-sm text-center px-2">
                        {generationError === "An error occurred during AI script generation." 
                            ? "We couldn't generate your script. This could be due to server load or content restrictions. Please try again with different details."
                            : generationError}
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
            
            {/* Success state */}
            {!isGenerating && generatedScript && (
              <ScrollArea className="flex-grow border rounded-md p-2 sm:p-4 bg-gray-50 whitespace-pre-wrap font-mono text-xs sm:text-sm">
                {generatedScript}
              </ScrollArea>
            )}
            
            {/* Empty state */}
            {!isGenerating && !generatedScript && !generationError && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <FileText className="h-12 w-12 sm:h-16 sm:w-16 mb-4" />
                <p className="text-center text-sm sm:text-base">Fill out the form and click "Generate Script" to create your screenplay.</p>
              </div>
            )}
          </CardContent>
          
          {/* Export button */}
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