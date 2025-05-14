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

      // Simulate progress
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1500); // Simulate progress every 1.5 seconds

      try {
        const response = await apiRequest("POST", "/api/scripts/generate-from-prompt", data);
        // Check if response is OK, if not, parse error message
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Failed to generate script. Server error." }));
            throw new Error(errorData.message || `Server responded with ${response.status}`);
        }
        const result = await response.json();
        clearInterval(progressInterval);
        setGenerationProgress(100);
        return result.script;
      } catch (error) {
        clearInterval(progressInterval);
        setGenerationProgress(0);
        throw error; // Re-throw to be caught by onError
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
      setGenerationError(error.message || "Failed to generate script. Please try again.");
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message || "An unexpected error occurred.",
      });
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
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Vadis Script Writer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Script Details</CardTitle>
            <CardDescription>Provide the details for your new script.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormControl><Textarea placeholder="A more detailed overview of the plot and themes" {...field} rows={4} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="genre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genre</FormLabel>
                    <FormControl><Input placeholder="e.g., Sci-Fi Adventure, Romantic Comedy" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="concept" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Core Concept / Idea</FormLabel>
                    <FormControl><Textarea placeholder="What is the central idea or unique element of your story?" {...field} rows={4} /></FormControl>
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
                    <FormControl><Input placeholder="e.g., Mars Colony, 1920s Paris, A mystical forest" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="specialRequest" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requests (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any specific elements, themes, or plot points to include?" {...field} rows={3} /></FormControl>
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
          <CardHeader>
            <CardTitle>Generated Script Preview</CardTitle>
            <CardDescription>Your AI-generated script will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="h-[600px] flex flex-col">
            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium mb-2">Generating Script...</p>
                <p className="text-sm text-muted-foreground mb-4">This may take a few minutes. Please wait.</p>
                <Progress value={generationProgress} className="w-full max-w-md" />
                <p className="text-xs text-muted-foreground mt-2">{generationProgress}%</p>
              </div>
            )}
            {generationError && !isGenerating && (
                <div className="flex flex-col items-center justify-center h-full text-destructive">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium mb-2">Generation Failed</p>
                    <p className="text-sm text-center">{generationError}</p>
                </div>
            )}
            {!isGenerating && generatedScript && (
              <ScrollArea className="flex-grow border rounded-md p-4 bg-gray-50 whitespace-pre-wrap font-mono text-sm">
                {generatedScript}
              </ScrollArea>
            )}
            {!isGenerating && !generatedScript && !generationError && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mr-4" />
                <p>Your generated script will be displayed here.</p>
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
                {exportPdfMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</> : <><Download className="mr-2 h-4 w-4" /> Script: Feature Film</>}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}