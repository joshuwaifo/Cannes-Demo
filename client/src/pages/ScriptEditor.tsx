// client/src/pages/ScriptEditor.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SceneBreakdown from "@/components/script/SceneBreakdown";
import ScriptDisplay from "@/components/script/ScriptDisplay";
import BrandableScenes from "@/components/script/BrandableScenes";
import { Script, Scene, SceneVariation, ProductCategory } from "@shared/schema"; // Added ProductCategory
import { RefreshCw, FileText, Wand2, Info } from "lucide-react"; // Added Wand2, Info
import { Button } from "@/components/ui/button"; // Added Button

export default function ScriptEditor() {
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current script data
  const {
    data: script,
    isLoading: isLoadingScript,
    refetch: refetchScript,
    isError: isScriptError,
  } = useQuery<Script | null>({
    queryKey: ["/api/scripts/current"],
    refetchOnWindowFocus: false,
  });

  // Fetch all scenes for the current script
  const {
    data: scenes = [],
    isLoading: isLoadingScenes,
    refetch: refetchScenes,
  } = useQuery<Scene[]>({
    queryKey: ["/api/scripts/scenes"],
    enabled: !!script, // Only fetch if script data is available
  });

  // Fetch brandable scene IDs
  const {
    data: brandableSceneIds = [],
    isLoading: isLoadingBrandableIds,
    refetch: refetchBrandableIds,
  } = useQuery<number[]>({
    queryKey: ["/api/scripts/brandable-scenes"], // Endpoint should return full Scene objects
    enabled: !!script && scenes.length > 0,
    select: (data: Scene[]) => data.map((scene) => scene.id), // Extract IDs if full scenes are returned
  });

  // Get full brandable scene objects for the BrandableScenes component
  const brandableSceneObjects = scenes.filter((scene) =>
    brandableSceneIds.includes(scene.id),
  );

  // Fetch scene variations for the active brandable scene
  const {
    data: sceneVariations = [],
    isLoading: isLoadingVariations,
    isFetching: isFetchingVariations,
    refetch: refetchVariations,
  } = useQuery<SceneVariation[]>({
    queryKey: ["/api/scripts/scene-variations", activeSceneId],
    enabled: !!activeSceneId && brandableSceneIds.includes(activeSceneId),
  });

  // Save script (only updates timestamp currently, or could save content if editable)
  const saveScriptMutation = useMutation({
    mutationFn: async () => {
      if (!script) throw new Error("No script loaded to save.");
      return await apiRequest("PUT", "/api/scripts/save", {
        scriptId: script.id,
      });
    },
    onSuccess: () => {
      toast({ title: "Script Saved", description: "Timestamp updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/scripts/current"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message,
      });
    },
  });

  // Reanalyze script for brandable scenes
  const reanalyzeScriptMutation = useMutation({
    mutationFn: async () => {
      if (!script) throw new Error("No script loaded to re-analyze.");
      return await apiRequest("POST", "/api/scripts/analyze", {
        scriptId: script.id,
      });
    },
    onSuccess: () => {
      toast({
        title: "Re-analysis Complete",
        description: "Brandable scenes have been updated.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/scripts/brandable-scenes"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scripts/scenes"] }); // Also refetch all scenes in case properties changed
      // If an active scene was brandable and might no longer be, or a new one becomes brandable
      if (activeSceneId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/scripts/scene-variations", activeSceneId],
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Re-analysis Failed",
        description: error.message,
      });
    },
  });

  // Generate product placements
  const generatePlacementsMutation = useMutation({
    mutationFn: async () => {
      if (!script)
        throw new Error("No script loaded to generate placements for.");
      return await apiRequest("POST", "/api/scripts/generate-placements", {});
    },
    onSuccess: (data: any) => {
      // Type 'data' more specifically based on backend response
      toast({
        title: "Placement Generation Started",
        description: `Image generation initiated for ${data.brandableScenesCount || "brandable"} scenes. This may take a few minutes.`,
      });
      // Invalidate to show newly generated/updated variations and potentially new brandable flags
      queryClient.invalidateQueries({
        queryKey: ["/api/scripts/brandable-scenes"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scripts/scenes"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/scripts/scene-variations"],
      }); // Broad invalidation
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Placement Generation Failed",
        description: error.message,
      });
    },
  });

  // Select a specific variation
  const selectVariationMutation = useMutation({
    mutationFn: async (variationId: number) => {
      return await apiRequest("PUT", "/api/scripts/variations/select", {
        variationId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Variation Selected",
        description: "This product placement option is now active.",
      });
      // Refetch variations for the current active scene to update selection state
      if (activeSceneId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/scripts/scene-variations", activeSceneId],
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Select Variation",
        description: error.message,
      });
    },
  });

  // Handler for selecting a scene from the breakdown
  const handleSceneSelect = (sceneId: number) => {
    setActiveSceneId(sceneId);
    // queryClient.invalidateQueries will be triggered by `enabled` flag on useQuery for variations
  };

  const activeScene = scenes.find((s: Scene) => s.id === activeSceneId);

  const isPageLoading =
    isLoadingScript || (!!script && isLoadingScenes && scenes.length === 0);
  const isProcessingAction =
    saveScriptMutation.isPending ||
    reanalyzeScriptMutation.isPending ||
    generatePlacementsMutation.isPending;

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        <p className="ml-3 text-xl font-semibold text-secondary">
          Loading Script Editor...
        </p>
      </div>
    );
  }

  if (isScriptError && !script && !isLoadingScript) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-6">
        <FileText size={64} className="text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-3">
          Error Loading Script
        </h2>
        <p className="text-gray-600 mb-6 max-w-md">
          We couldn't load the script data. This might be because no script has
          been uploaded yet, or there was a network issue.
        </p>
        <Button
          onClick={() => refetchScript()}
          variant="outline"
          disabled={isLoadingScript}
        >
          {isLoadingScript ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Try Reloading Script
        </Button>
        <p className="text-sm text-gray-500 mt-4">
          If the problem persists, please try uploading a script from the
          Welcome page.
        </p>
      </div>
    );
  }

  if (!script && !isLoadingScript) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-6">
        <FileText size={64} className="text-gray-400 mb-6" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-3">
          No Script Active
        </h2>
        <p className="text-gray-500 mb-6 max-w-md">
          Please upload a script via the "Welcome" page to start analyzing and
          generating product placements.
        </p>
        {/* Add a button/link to navigate to Welcome page if your routing setup allows direct navigation */}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <SceneBreakdown
        scenes={scenes}
        activeSceneId={activeSceneId}
        brandableSceneIds={brandableSceneIds || []}
        isLoading={isLoadingScenes || isLoadingBrandableIds}
        onSceneSelect={handleSceneSelect}
      />

      <div className="lg:col-span-3">
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <ScriptDisplay
            script={script} // script will not be null here due to checks above
            isLoading={isPageLoading || isProcessingAction}
            onSave={() => saveScriptMutation.mutate()}
            onReanalyze={() => reanalyzeScriptMutation.mutate()}
            onGeneratePlacements={() => generatePlacementsMutation.mutate()}
            activeScene={activeScene || null} // Pass null if no scene is active
          />
        </div>

        {scenes.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <BrandableScenes
              brandableScenes={brandableSceneObjects} // Pass full scene objects that are brandable
              productVariations={sceneVariations}
              isLoading={
                isLoadingVariations ||
                isFetchingVariations ||
                generatePlacementsMutation.isPending
              }
              selectedSceneId={activeSceneId}
              onOptionSelect={(variationId: number) =>
                selectVariationMutation.mutate(variationId)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
