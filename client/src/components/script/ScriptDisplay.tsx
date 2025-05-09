import { ScriptDisplayProps } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ScriptDisplay({
  script,
  isLoading,
  onSave,
  onReanalyze,
  onGeneratePlacements,
  activeScene,
}: ScriptDisplayProps) {
  const [editorContent, setEditorContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeScene) {
      setEditorContent(activeScene.content);
    } else if (script) {
      setEditorContent(script.content || "");
    }
  }, [script, activeScene]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave();
      toast({
        title: "Script saved",
        description: "Your script has been successfully saved.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "There was an error saving your script.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReanalyze = async () => {
    try {
      setIsReanalyzing(true);
      await onReanalyze();
      toast({
        title: "Analysis complete",
        description: "Your script has been re-analyzed for brandable scenes.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: "There was an error analyzing your script.",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleGeneratePlacements = async () => {
    if (!onGeneratePlacements) return;

    try {
      setIsGenerating(true);
      await onGeneratePlacements();
      toast({
        title: "Generation complete",
        description: "We've generated product placements for brandable scenes.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "There was an error generating product placements.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-secondary">
            Script Editor
          </h2>
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {activeScene
            ? `Scene ${activeScene.sceneNumber}: ${activeScene.heading}`
            : "Script Editor"}
        </h2>
        <div className="flex space-x-2"></div>
      </div>

      <Textarea
        value={editorContent}
        onChange={(e) => setEditorContent(e.target.value)}
        className="h-64 font-mono text-sm bg-gray-50 resize-none script-editor"
        placeholder="Script content will appear here once uploaded..."
      />
    </div>
  );
}
