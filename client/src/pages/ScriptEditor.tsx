// client/src/pages/ScriptEditor.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SceneBreakdown from "@/components/script/SceneBreakdown";
import ScriptDisplay from "@/components/script/ScriptDisplay";
import BrandableScenes from "@/components/script/BrandableScenes";
import VideoPlayerModal from "@/components/script/VideoPlayerModal";
import { Script, Scene, SceneVariation, ProductCategory } from "@shared/schema";
import { RefreshCw, FileText, Wand2, Info, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type VideoGenerationStatus = 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
interface VideoGenerationState {
    status: VideoGenerationStatus;
    predictionId?: string | null;
    videoUrl?: string | null;
    error?: string | null;
    logs?: string | null;
}

export default function ScriptEditor() {
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [videoGenerationStates, setVideoGenerationStates] = useState<{ [key: number]: VideoGenerationState }>({});
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
  const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // --- Queries ---
  const {
    data: script,
    isLoading: isLoadingScript,
    refetch: refetchScript,
    isError: isScriptError,
  } = useQuery<Script | null>({
    queryKey: ["/api/scripts/current"],
    refetchOnWindowFocus: false,
  });

  const {
    data: scenes = [],
    isLoading: isLoadingScenes,
  } = useQuery<Scene[]>({
    queryKey: ["/api/scripts/scenes"],
    enabled: !!script,
  });

  const {
    data: brandableSceneObjects = [],
    isLoading: isLoadingBrandableScenes,
  } = useQuery<Scene[]>({
    queryKey: ["/api/scripts/brandable-scenes"],
    enabled: !!script && scenes.length > 0,
  });
  const brandableSceneIds = brandableSceneObjects.map(scene => scene.id);

  const {
    data: sceneVariations = [],
    isLoading: isLoadingVariations, // Loading state specifically for this query
    isFetching: isFetchingVariations, // Fetching state specifically for this query
     isSuccess: isVariationsSuccess, // Success state
  } = useQuery<SceneVariation[]>({
    queryKey: ["/api/scripts/scene-variations", activeSceneId],
    // Only enable when a brandable scene is active
    enabled: !!activeSceneId && brandableSceneIds.includes(activeSceneId),
    staleTime: 5 * 60 * 1000, // Cache for 5 mins
    // onSuccess: () => {
    //    // Optional: Could reset video states here too, but watching activeSceneId is likely better
    //    // setVideoGenerationStates({});
    // }
  });

   // --- Effect to reset video states when active scene changes ---
   useEffect(() => {
       // console.log(`Active scene changed to: ${activeSceneId}, resetting video states.`);
       setVideoGenerationStates({}); // Clear states for the new scene
       // Stop any polling from the previously active scene
        Object.keys(pollingIntervals.current).forEach(stopPollingPrediction);
   }, [activeSceneId]); // Dependency on activeSceneId

  // --- Mutations ---
   const saveScriptMutation = useMutation({ mutationFn: async () => {/*...*/}, onSuccess: () => {/*...*/}, onError: () => {/*...*/}});
   const reanalyzeScriptMutation = useMutation({ mutationFn: async () => {/*...*/}, onSuccess: () => {/*...*/}, onError: () => {/*...*/}});
   const generatePlacementsMutation = useMutation({ mutationFn: async () => {/*...*/}, onSuccess: () => {/*...*/}, onError: () => {/*...*/}});

   // --- Polling Logic (useCallback for stability) ---
    const stopPollingPrediction = useCallback((predictionId: string) => {
        if (pollingIntervals.current[predictionId]) {
            clearInterval(pollingIntervals.current[predictionId]);
            delete pollingIntervals.current[predictionId];
        }
    }, []); // No dependencies, safe to useCallback

    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 1000;

    const pollPredictionStatus = useCallback(async (predictionId: string, variationId: number, retryCount = 0) => {
        try {
            const response = await fetch(`/api/replicate/predictions/${predictionId}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                if (retryCount < MAX_RETRIES && response.status >= 500) {
                    // Exponential backoff for retries
                    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
                    console.log(`Retrying prediction status check in ${delay}ms...`);
                    setTimeout(() => {
                        pollPredictionStatus(predictionId, variationId, retryCount + 1);
                    }, delay);
                    return;
                }
                throw new Error(`HTTP error ${response.status}: ${errorText || 'Failed to fetch status'}`);
            }
            
            const data: { status: VideoGenerationStatus, outputUrl?: string, error?: string, logs?: string } = await response.json();

            console.log(`Poll Status for ${predictionId} (Var ${variationId}): ${data.status}`);

            // Update state based on fetched status
            setVideoGenerationStates(prev => {
                // Ensure we don't overwrite if the state somehow got reset
                const currentState = prev[variationId];
                if (!currentState || currentState.predictionId !== predictionId) {
                     // If state doesn't match (e.g., scene changed), stop polling this one
                     stopPollingPrediction(predictionId);
                     return prev; // Don't update stale state
                }
                return {
                     ...prev,
                     [variationId]: {
                         ...currentState, // Keep existing predictionId
                         status: data.status,
                         videoUrl: data.outputUrl ?? currentState.videoUrl, // Keep old URL if new one is null/undefined
                         error: data.error ?? null,
                         logs: data.logs ?? null,
                     }
                };
            });


            // Stop polling if prediction is complete or failed/canceled
            if (['succeeded', 'failed', 'canceled'].includes(data.status)) {
                stopPollingPrediction(predictionId);
                 if(data.status === 'succeeded') {
                      toast({title: "Video Generated!", description: `Video for variation ${variationId} is ready.`});
                 } else {
                      toast({title: "Video Generation Failed", description: `Video for variation ${variationId} failed: ${data.error || 'Check server logs for details'}.`, variant: "destructive"});
                      console.error(`Replicate Logs for prediction ${predictionId}:`, data.logs)
                 }
            }
        } catch (error: any) {
            console.error(`Polling error for prediction ${predictionId} (Var ${variationId}):`, error);
            // Stop polling on error to prevent infinite loops on network issues
             stopPollingPrediction(predictionId);
             setVideoGenerationStates(prev => {
                  // Only update if the state still belongs to this prediction
                 const currentState = prev[variationId];
                 if (currentState && currentState.predictionId === predictionId) {
                     return {
                         ...prev,
                         [variationId]: { ...currentState, status: 'failed', error: `Polling failed: ${error.message}` }
                     };
                 }
                 return prev; // Don't update stale state
             });
        }
    }, [stopPollingPrediction, toast]);


    const startPollingPrediction = useCallback((predictionId: string, variationId: number) => {
        stopPollingPrediction(predictionId); // Clear existing interval first
        // console.log(`Starting polling for prediction ${predictionId} (Var ${variationId})`);
        // Initial immediate check after a short delay to allow Replicate to register the prediction
        setTimeout(() => pollPredictionStatus(predictionId, variationId), 1000);
        // Set interval for subsequent checks
        pollingIntervals.current[predictionId] = setInterval(() => {
            pollPredictionStatus(predictionId, variationId);
        }, 5000); // Poll every 5 seconds
    }, [pollPredictionStatus, stopPollingPrediction]);

     // Cleanup polling on component unmount
    useEffect(() => {
        return () => {
            Object.keys(pollingIntervals.current).forEach(stopPollingPrediction);
        };
    }, [stopPollingPrediction]);


   const startVideoGenerationMutation = useMutation({
       mutationFn: async (variationId: number) => {
           setVideoGenerationStates(prev => ({
               ...prev,
               [variationId]: { status: 'pending' }
           }));
           return await apiRequest("POST", `/api/variations/${variationId}/generate-video`, {});
       },
       onSuccess: (data: any, variationId) => { // Explicitly receive variationId
           if (data.predictionId) {
               console.log(`Video generation started for Var ${variationId}, Prediction ID: ${data.predictionId}`);
               setVideoGenerationStates(prev => ({
                   ...prev,
                   [variationId]: { status: 'generating', predictionId: data.predictionId }
               }));
               startPollingPrediction(data.predictionId, variationId); // Start polling
               toast({ title: "Video Generation Started", description: `Processing variation ${variationId}. We'll update you.` });
           } else {
                // Handle case where backend returns error immediately
                const errorMsg = data.message || 'Failed to get prediction ID from server';
                console.error(`Video generation init failed for Var ${variationId}: ${errorMsg}`);
               setVideoGenerationStates(prev => ({
                   ...prev,
                   [variationId]: { status: 'failed', error: errorMsg }
               }));
               toast({ title: "Video Generation Failed", description: errorMsg, variant: "destructive" });
           }
       },
       onError: (error: Error, variationId) => {
           console.error(`Video generation mutation error for Var ${variationId}: ${error.message}`);
           setVideoGenerationStates(prev => ({
               ...prev,
               [variationId]: { status: 'failed', error: error.message }
           }));
           toast({
               variant: "destructive",
               title: "Video Generation Error",
               description: `Failed to start video generation for variation ${variationId}: ${error.message}`,
           });
       },
   });

  // --- Export Handler ---
  const handleExport = async () => { /* ... existing export logic ... */ };

  // --- Scene Selection Handler ---
  const handleSceneSelect = (sceneId: number) => {
    if (activeSceneId !== sceneId) {
        setActiveSceneId(sceneId); // This triggers the useEffect to clear video states
         // Pre-fetch variations for the selected scene
        if (brandableSceneIds.includes(sceneId)) {
            queryClient.prefetchQuery({
                queryKey: ['/api/scripts/scene-variations', sceneId],
                staleTime: 60 * 1000
            });
        }
    }
  };

  // --- Video Modal Handlers ---
  const handleViewVideo = (videoUrl: string, title: string) => { /* ... */ };
  const handleCloseVideoModal = () => { /* ... */ };

  // --- Component Logic ---
  const activeScene = scenes.find((s: Scene) => s.id === activeSceneId);
  // Determine if the *initial* script/scene data is loading
  const isPageLoading = isLoadingScript || (!!script && isLoadingScenes && scenes.length === 0);
  // Determine if a major background action is running
  const isProcessingAction = reanalyzeScriptMutation.isPending || generatePlacementsMutation.isPending || isExporting;
  // Specific loading state for the variations section
  const isLoadingCurrentVariations = (isLoadingVariations || isFetchingVariations) && !!activeSceneId;

  const displayScript = script ? { id: script.id, title: script.title, content: script.content } : null;

  // --- Render Logic ---
  if (isPageLoading) { /* ... existing loading spinner ... */ }
  if (isScriptError && !script && !isLoadingScript) { /* ... existing error state ... */ }
  if (!script && !isLoadingScript) { /* ... existing no script state ... */ }

  return (
    <>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <SceneBreakdown
            scenes={scenes}
            activeSceneId={activeSceneId}
            brandableSceneIds={brandableSceneIds || []}
            // isLoading reflects initial scene list loading, not variations
            isLoading={isLoadingScenes || isLoadingBrandableScenes}
            onSceneSelect={handleSceneSelect}
          />

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <ScriptDisplay
                script={displayScript}
                isLoading={isPageLoading} // Pass initial page loading state
                onSave={() => {/* saveScriptMutation.mutateAsync() */}} // Save likely not needed now
                onReanalyze={() => reanalyzeScriptMutation.mutateAsync()}
                onGeneratePlacements={() => generatePlacementsMutation.mutateAsync()}
                onExport={handleExport}
                activeScene={activeScene || null}
                isSaving={saveScriptMutation.isPending}
                isReanalyzing={reanalyzeScriptMutation.isPending}
                isGenerating={generatePlacementsMutation.isPending}
                isExporting={isExporting}
              />
            </div>

            {/* Only render BrandableScenes if scenes exist */}
            {scenes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <BrandableScenes
                  brandableScenes={brandableSceneObjects}
                  scenes={scenes}
                  productVariations={sceneVariations}
                   // Pass the specific loading state for the current scene's variations
                  isLoading={isLoadingCurrentVariations}
                  selectedSceneId={activeSceneId}
                  onGenerateVideoRequest={(variationId) => startVideoGenerationMutation.mutate(variationId)}
                  videoGenerationStates={videoGenerationStates}
                  onViewVideo={handleViewVideo}
                />
              </div>
            )}
          </div>
        </div>

        {/* Video Player Modal */}
        <VideoPlayerModal
            isOpen={isVideoModalOpen}
            onClose={handleCloseVideoModal}
            videoUrl={currentVideoUrl}
            title={currentVideoTitle}
        />
    </>
  );
}