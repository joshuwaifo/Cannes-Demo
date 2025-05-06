import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/script/FileUpload";
import SceneBreakdown from "@/components/script/SceneBreakdown";
import ScriptDisplay from "@/components/script/ScriptDisplay";
import BrandableScenes from "@/components/script/BrandableScenes";
import { Script, Scene, SceneVariation } from "@shared/schema";

export default function ScriptEditor() {
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch script data
  const {
    data: script,
    isLoading: isLoadingScript,
    refetch: refetchScript,
  } = useQuery<Script | null>({
    queryKey: ["/api/scripts/current"],
    refetchOnWindowFocus: false,
    retry: 1, // Limit retry attempts
    onError: (error) => {
      console.error("Error fetching script:", error);
      toast({
        variant: "destructive",
        title: "Error loading script",
        description:
          "Could not load the script data. Please try uploading a script first.",
      });
    },
  });

  // Fetch scenes
  const {
    data: scenes = [],
    isLoading: isLoadingScenes,
    refetch: refetchScenes,
  } = useQuery<Scene[]>({
    queryKey: ["/api/scripts/scenes"],
    refetchOnWindowFocus: false,
    enabled: !!script,
    retry: 1, // Limit retry attempts
    onError: (error) => {
      console.error("Error fetching scenes:", error);
    },
  });

  // Fetch brandable scenes
  const {
    data: brandableScenes = [],
    isLoading: isLoadingBrandable,
    refetch: refetchBrandable,
  } = useQuery<Scene[]>({
    queryKey: ["/api/scripts/brandable-scenes"],
    refetchOnWindowFocus: false,
    enabled: !!script && scenes.length > 0,
    retry: 1, // Limit retry attempts
    onError: (error) => {
      console.error("Error fetching brandable scenes:", error);
    },
  });

  // Fetch scene variations
  const {
    data: sceneVariations = [],
    isLoading: isLoadingVariations,
    refetch: refetchVariations,
  } = useQuery<SceneVariation[]>({
    queryKey: ["/api/scripts/scene-variations", activeSceneId],
    refetchOnWindowFocus: false,
    enabled:
      !!activeSceneId &&
      brandableScenes.some((scene) => scene.id === activeSceneId),
  });

  // Upload script mutation
  const uploadScriptMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("script", file);

      const response = await fetch("/api/scripts/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to upload script");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Script uploaded successfully",
        description: "Your script has been processed and analyzed.",
      });
      refetchScript();
      refetchScenes();
      refetchBrandable();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description:
          error.message || "There was an error uploading your script.",
      });
    },
  });

  // Save script mutation
  const saveScriptMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", "/api/scripts/save", {
        scriptId: script?.id,
      });
    },
    onSuccess: () => {
      refetchScript();
    },
  });

  // Reanalyze script mutation
  const reanalyzeScriptMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/scripts/analyze", {
        scriptId: script?.id,
      });
    },
    onSuccess: () => {
      refetchBrandable();
      toast({
        title: "Script re-analyzed",
        description: "We've identified new brandable scenes for your script.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: "Failed to analyze the script. Please try again.",
      });
    },
  });

  // Select variation mutation
  const selectVariationMutation = useMutation({
    mutationFn: async (variationId: number) => {
      return await apiRequest("PUT", "/api/scripts/variations/select", {
        variationId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Variation selected",
        description: "This product placement option has been selected.",
      });
      refetchVariations();
    },
  });

  const handleFileUpload = async (file: File) => {
    setScriptFile(file);
    await uploadScriptMutation.mutateAsync(file);
  };

  const handleSceneSelect = (sceneId: number) => {
    setActiveSceneId(sceneId);

    // If the selected scene is a brandable scene, load variations
    if (brandableScenes.some((scene) => scene.id === sceneId)) {
      refetchVariations();
    }
  };

  const handleSaveScript = async () => {
    await saveScriptMutation.mutateAsync();
  };

  const handleReanalyzeScript = async () => {
    await reanalyzeScriptMutation.mutateAsync();
  };

  const handleOptionSelect = async (variationId: number) => {
    await selectVariationMutation.mutateAsync(variationId);
  };

  const isScriptLoaded = !!script && !isLoadingScript;
  const activeScene =
    scenes.find((scene) => scene.id === activeSceneId) || null;
  const brandableSceneIds = brandableScenes.map((scene) => scene.id);
  const isLoading =
    isLoadingScript || isLoadingScenes || uploadScriptMutation.isPending;

  return (
    <div>
      {!isScriptLoaded ? (
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-6">Upload a Script</h2>
            <p className="text-gray-600 mb-6">
              Please upload a screenplay PDF file to begin analyzing it for
              product placement opportunities.
            </p>
            <FileUpload
              onFileUpload={handleFileUpload}
              isLoading={uploadScriptMutation.isPending}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <SceneBreakdown
            scenes={scenes}
            activeSceneId={activeSceneId}
            brandableSceneIds={brandableSceneIds}
            isLoading={isLoadingScenes}
            onSceneSelect={handleSceneSelect}
          />

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <ScriptDisplay
                script={script}
                isLoading={isLoading}
                onSave={handleSaveScript}
                onReanalyze={handleReanalyzeScript}
                activeScene={activeScene}
              />

              <div className="mt-6">
                <BrandableScenes
                  brandableScenes={brandableScenes}
                  productVariations={sceneVariations}
                  isLoading={isLoadingVariations}
                  selectedSceneId={activeSceneId}
                  onOptionSelect={handleOptionSelect}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
