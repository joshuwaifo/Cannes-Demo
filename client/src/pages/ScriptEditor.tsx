
// // client/src/pages/ScriptEditor.tsx
// import { useState, useEffect, useRef, useCallback } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { apiRequest } from "@/lib/queryClient";
// import { useToast } from "@/hooks/use-toast";
// import SceneBreakdown from "@/components/script/SceneBreakdown";
// import ScriptDisplay from "@/components/script/ScriptDisplay";
// import BrandableScenes from "@/components/script/BrandableScenes";
// import VideoPlayerModal from "@/components/script/VideoPlayerModal";
// import { Script, Scene, SceneVariation as SharedSceneVariation, ProductCategory } from "@shared/schema"; // Use alias for schema type
// import { RefreshCw, FileText, Wand2, Info, Loader2, Download, AlertTriangle } from "lucide-react"; // Added AlertTriangle
// import { Button } from "@/components/ui/button";
// import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

// // Use SceneVariation type from lib which includes client-side state
// import { SceneVariation } from "@/lib/types";

// type VideoGenerationStatus = 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
// interface VideoGenerationState {
//     status: VideoGenerationStatus;
//     predictionId?: string | null;
//     videoUrl?: string | null;
//     error?: string | null;
//     logs?: string | null; // Store logs if backend sends them
//     progress?: number; // 0-100 for progress bar
//     stageMessage?: string; // Message for current stage
// }

// // Interface for the Replicate prediction status response (subset)
// // This should match the structure returned by your `/api/replicate/predictions/:predictionId` endpoint
// interface PredictionStatusResult {
//   status: VideoGenerationStatus; // 'starting', 'processing', 'succeeded', 'failed', 'canceled'
//   outputUrl?: string | null; // Ensure this matches the key your backend sends
//   error?: string | null;
//   logs?: string | null;
// }


// export default function ScriptEditor() {
//   const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
//   const { toast } = useToast();
//   const queryClient = useQueryClient();
//   const [isExporting, setIsExporting] = useState(false);
//   const [videoGenerationStates, setVideoGenerationStates] = useState<{ [key: number]: VideoGenerationState }>({});
//   const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
//   const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
//   const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
//   const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

//   // --- Queries ---
//   const {
//     data: script,
//     isLoading: isLoadingScript,
//     refetch: refetchScript,
//     isError: isScriptError,
//   } = useQuery<Script | null>({
//     queryKey: ["/api/scripts/current"],
//     refetchOnWindowFocus: false,
//   });

//   const {
//     data: scenes = [],
//     isLoading: isLoadingScenes,
//   } = useQuery<Scene[]>({
//     queryKey: ["/api/scripts/scenes"],
//     enabled: !!script,
//   });

//   const {
//     data: brandableSceneObjects = [],
//     isLoading: isLoadingBrandableScenes,
//   } = useQuery<Scene[]>({
//     queryKey: ["/api/scripts/brandable-scenes"],
//     enabled: !!script && scenes.length > 0,
//   });
//   const brandableSceneIds = brandableSceneObjects.map(scene => scene.id);

//   const {
//     data: sceneVariations = [],
//     isLoading: isLoadingVariations,
//     isFetching: isFetchingVariations,
//     isSuccess: isVariationsSuccess,
//   } = useQuery<SceneVariation[]>({
//     queryKey: ["/api/scripts/scene-variations", activeSceneId],
//     enabled: !!activeSceneId && brandableSceneIds.includes(activeSceneId),
//     staleTime: 1 * 60 * 1000,
//     refetchOnWindowFocus: false,
//   });

//    useEffect(() => {
//        // console.log(`[Effect] Active scene changed to: ${activeSceneId}. Clearing video states and stopping polls.`);
//        setVideoGenerationStates({});
//        Object.values(pollingIntervals.current).forEach(clearInterval);
//        pollingIntervals.current = {};
//    }, [activeSceneId]);

//   // --- Mutations ---
//    const reanalyzeScriptMutation = useMutation({
//        mutationFn: async () => apiRequest("POST", "/api/scripts/analyze", {}),
//        onSuccess: () => {
//            toast({ title: "Analysis complete", description: "Script re-analyzed." });
//            queryClient.invalidateQueries({ queryKey: ['/api/scripts/brandable-scenes'] });
//            queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations'] });
//        },
//        onError: (error: Error) => {
//            toast({ variant: "destructive", title: "Analysis failed", description: error.message });
//        }
//    });
//    const generatePlacementsMutation = useMutation({
//         mutationFn: async () => queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations'] }),
//        onSuccess: () => {
//            toast({ title: "Placement Generation Triggered", description: "Generating visual options..." });
//        },
//        onError: (error: Error) => {
//            toast({ variant: "destructive", title: "Generation Trigger Failed", description: error.message });
//        }
//    });

//     const stopPollingPrediction = useCallback((predictionId: string) => {
//         if (pollingIntervals.current[predictionId]) {
//             clearInterval(pollingIntervals.current[predictionId]);
//             delete pollingIntervals.current[predictionId];
//         }
//     }, []);

//     const pollPredictionStatus = useCallback(async (predictionId: string, variationId: number) => {
//         try {
//             const response = await fetch(`/api/replicate/predictions/${predictionId}`);
//             if (!response.ok) {
//                 const errorText = await response.text();
//                 throw new Error(`API error ${response.status}: ${errorText || 'Failed to fetch status'}`);
//             }
//             const data: PredictionStatusResult = await response.json();

//             setVideoGenerationStates(prev => {
//                 const currentState = prev[variationId];
//                 if (!currentState || currentState.predictionId !== predictionId || currentState.status === 'succeeded' || currentState.status === 'failed') {
//                      stopPollingPrediction(predictionId);
//                      return prev;
//                  }

//                  let progress = currentState.progress || 0;
//                  let stageMessage = currentState.stageMessage || "Processing...";

//                  switch (data.status) {
//                     case 'starting':
//                         progress = 25;
//                         stageMessage = "Initializing video engine...";
//                         break;
//                     case 'processing':
//                         progress = Math.max(progress || 0, 40);
//                         if (data.logs) {
//                             if (data.logs.toLowerCase().includes("frame generation")) progress = 50;
//                             if (data.logs.toLowerCase().includes("upscaling")) progress = 75;
//                         }
//                         stageMessage = "Generating video frames...";
//                         break;
//                     case 'succeeded':
//                         progress = 100;
//                         stageMessage = "Video ready!";
//                         break;
//                     case 'failed':
//                     case 'canceled':
//                         progress = 0;
//                         stageMessage = data.error ? `Failed: ${String(data.error).substring(0,50)}...` : "Generation failed.";
//                         break;
//                  }


//                  const newStateUpdate: VideoGenerationState = {
//                      ...currentState,
//                      status: data.status === 'canceled' ? 'failed' : data.status,
//                      videoUrl: data.outputUrl ?? currentState.videoUrl, // Use outputUrl from PredictionStatusResult
//                      error: data.error ? String(data.error) : null,
//                      logs: data.logs ?? null,
//                      progress: progress,
//                      stageMessage: stageMessage,
//                  };

//                 if (['succeeded', 'failed', 'canceled'].includes(data.status)) {
//                     stopPollingPrediction(predictionId);
//                     if(data.status === 'succeeded') {
//                          if (!data.outputUrl) { // If succeeded but no URL, it's an issue
//                             toast({title: "Video Processed", description: `Video for variation ${variationId} finished, but no URL was returned.`, variant: "destructive"});
//                             newStateUpdate.status = 'failed'; // Treat as failed if no URL
//                             newStateUpdate.error = "Succeeded but no output URL.";
//                          } else {
//                             toast({title: "Video Ready!", description: `Video for variation ${variationId} finished processing.`});
//                          }
//                     } else {
//                          toast({title: "Video Failed", description: `Video generation failed for variation ${variationId}: ${data.error || 'Unknown reason'}.`, variant: "destructive"});
//                     }
//                 }
//                  return { ...prev, [variationId]: newStateUpdate };
//             });

//         } catch (error: any) {
//             console.error(`[Polling] Error polling prediction ${predictionId} (Var ${variationId}):`, error);
//              stopPollingPrediction(predictionId);
//              setVideoGenerationStates(prev => {
//                  const currentState = prev[variationId];
//                  if (currentState && currentState.predictionId === predictionId) {
//                      return { ...prev, [variationId]: { ...currentState, status: 'failed', error: `Polling failed: ${error.message}`, progress: 0, stageMessage: "Polling Error" }};
//                  }
//                  return prev;
//              });
//              toast({ variant: "destructive", title: "Polling Error", description: `Could not get video status: ${error.message}` });
//         }
//     }, [stopPollingPrediction, toast]);


//     const startPollingPrediction = useCallback((predictionId: string, variationId: number) => {
//         if (pollingIntervals.current[predictionId]) {
//             return;
//         }
//         const initialTimeout = setTimeout(() => pollPredictionStatus(predictionId, variationId), 2000);
//         pollingIntervals.current[predictionId] = setInterval(() => {
//             pollPredictionStatus(predictionId, variationId);
//         }, 5000);
//     }, [pollPredictionStatus]);

//     useEffect(() => {
//         return () => {
//             Object.values(pollingIntervals.current).forEach(clearInterval);
//             pollingIntervals.current = {};
//         };
//     }, []);

//    const startVideoGenerationMutation = useMutation({
//        mutationFn: async (variationId: number) => {
//             setVideoGenerationStates(prev => ({
//                ...prev,
//                [variationId]: { status: 'pending', error: null, videoUrl: null, predictionId: null, progress: 10, stageMessage: "Queueing video..." }
//             }));
//            const response = await apiRequest("POST", `/api/variations/${variationId}/generate-video`, {});
//            const data = await response.json();
//            return { variationId, responseData: data };
//        },
//        onSuccess: (result) => {
//             const { variationId, responseData } = result;
//            if (responseData.predictionId && responseData.status !== 'failed' && responseData.status !== 'canceled') {
//                setVideoGenerationStates(prev => ({
//                    ...prev,
//                    [variationId]: {
//                        status: 'generating',
//                        predictionId: responseData.predictionId,
//                        error: null,
//                        videoUrl: null,
//                        progress: 20, 
//                        stageMessage: "Video job started..."
//                    }
//                }));
//                startPollingPrediction(responseData.predictionId, variationId);
//                toast({ title: "Video Generation Started", description: `Processing variation ${variationId}...` });
//            } else {
//                 const errorMsg = responseData.message || responseData.error || 'Failed to get valid prediction ID from server.';
//                setVideoGenerationStates(prev => ({
//                    ...prev,
//                    [variationId]: { status: 'failed', error: errorMsg, predictionId: responseData.predictionId || null, progress: 0, stageMessage: `Error: ${String(errorMsg).substring(0,30)}...` }
//                }));
//                toast({ title: "Video Start Failed", description: errorMsg, variant: "destructive" });
//            }
//        },
//        onError: (error: Error, variationId) => {
//            setVideoGenerationStates(prev => ({
//                ...prev,
//                [variationId]: { status: 'failed', error: `Failed to start: ${error.message}`, predictionId: null, progress: 0, stageMessage: "Request Error" }
//            }));
//            toast({
//                variant: "destructive",
//                title: "Request Error",
//                description: `Could not start video generation for variation ${variationId}: ${error.message}`,
//            });
//        },
//    });

//   const handleExport = async () => { /* ... */ };

//   const handleSceneSelect = (sceneId: number) => {
//     if (activeSceneId !== sceneId) {
//         setActiveSceneId(sceneId);
//     }
//   };

//   const handleViewVideo = (videoUrl: string, title: string) => {
//       setCurrentVideoUrl(videoUrl);
//       setCurrentVideoTitle(title);
//       setIsVideoModalOpen(true);
//   };
//   const handleCloseVideoModal = () => {
//       setIsVideoModalOpen(false);
//       setCurrentVideoUrl(null);
//       setCurrentVideoTitle("");
//   };

//   const activeScene = scenes.find((s: Scene) => s.id === activeSceneId);
//   const isPageLoading = isLoadingScript || (!!script && isLoadingScenes && scenes.length === 0);
//   const isProcessingAction = reanalyzeScriptMutation.isPending || generatePlacementsMutation.isPending || isExporting;
//   const isLoadingCurrentVariations = !!activeSceneId && (isLoadingVariations || isFetchingVariations);
//   const displayScript = script ? { id: script.id, title: script.title, content: script.content } : null;

//   if (isPageLoading) {
//        return (
//             <div className="space-y-6 p-4">
//                 <Skeleton className="h-8 w-1/4" />
//                 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//                     <Skeleton className="h-[500px] lg:col-span-1" />
//                     <div className="lg:col-span-3 space-y-6">
//                         <Skeleton className="h-[300px] w-full" />
//                         <Skeleton className="h-[400px] w-full" />
//                     </div>
//                 </div>
//             </div>
//        );
//    }

//   if (isScriptError && !script && !isLoadingScript) {
//       return <div className="p-6 text-center text-red-600"><AlertTriangle className="inline-block mr-2"/>Failed to load script data. Please try again later.</div>;
//   }
//   if (!script && !isLoadingScript) {
//        return <div className="p-6 text-center text-gray-500"><Info className="inline-block mr-2"/>No script loaded. Please upload a script on the Welcome page.</div>;
//    }

//   return (
//     <>
//         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//           <SceneBreakdown
//             scenes={scenes}
//             activeSceneId={activeSceneId}
//             brandableSceneIds={brandableSceneIds || []}
//             isLoading={isLoadingScenes || isLoadingBrandableScenes}
//             onSceneSelect={handleSceneSelect}
//           />
//           <div className="lg:col-span-3 space-y-6">
//             <div className="bg-white rounded-lg shadow p-4">
//               <ScriptDisplay
//                 script={displayScript}
//                 isLoading={false}
//                 onSave={async () => {console.warn("Save not implemented")}}
//                 onReanalyze={() => reanalyzeScriptMutation.mutate()}
//                 onGeneratePlacements={() => generatePlacementsMutation.mutate()}
//                 onExport={handleExport}
//                 activeScene={activeScene || null}
//                 isSaving={false}
//                 isReanalyzing={reanalyzeScriptMutation.isPending}
//                 isGenerating={generatePlacementsMutation.isPending}
//                 isExporting={isExporting}
//               />
//             </div>
//             {scenes.length > 0 && activeSceneId !== null ? (
//               <div className="bg-white rounded-lg shadow p-4">
//                 <BrandableScenes
//                   brandableScenes={brandableSceneObjects}
//                   scenes={scenes}
//                   productVariations={sceneVariations}
//                   isLoading={isLoadingCurrentVariations}
//                   selectedSceneId={activeSceneId}
//                   onGenerateVideoRequest={(variationId) => startVideoGenerationMutation.mutate(variationId)}
//                   videoGenerationStates={videoGenerationStates}
//                   onViewVideo={handleViewVideo}
//                 />
//               </div>
//             ) : (
//                  activeSceneId === null && scenes.length > 0 && (
//                     <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
//                        <Info className="inline-block mr-2 h-5 w-5" />
//                        Select a scene from the breakdown list to view details and placement options.
//                     </div>
//                  )
//             )}
//           </div>
//         </div>
//         <VideoPlayerModal
//             isOpen={isVideoModalOpen}
//             onClose={handleCloseVideoModal}
//             videoUrl={currentVideoUrl}
//             title={currentVideoTitle}
//         />
//     </>
//   );
// }

// client/src/pages/ScriptEditor.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SceneBreakdown from "@/components/script/SceneBreakdown";
import ScriptDisplay from "@/components/script/ScriptDisplay";
import BrandableScenes from "@/components/script/BrandableScenes";
import VideoPlayerModal from "@/components/script/VideoPlayerModal";
import { Script, Scene, SceneVariation as SharedSceneVariation, ProductCategory } from "@shared/schema";
import { RefreshCw, FileText, Wand2, Info, Loader2, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { SceneVariation } from "@/lib/types"; // Using the extended type from lib/types

type VideoGenerationStatus = 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
interface VideoGenerationState {
    status: VideoGenerationStatus;
    predictionId?: string | null;
    videoUrl?: string | null;
    error?: string | null;
    logs?: string | null;
    progress?: number;
    stageMessage?: string;
}

interface PredictionStatusResult {
  status: VideoGenerationStatus;
  outputUrl?: string | null;
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
    data: brandableSceneObjects = [], // These are scenes initially marked by AI
    isLoading: isLoadingBrandableScenes,
    refetch: refetchBrandableScenes, // Allow refetching this if a scene becomes brandable
  } = useQuery<Scene[]>({
    queryKey: ["/api/scripts/brandable-scenes"],
    enabled: !!script && scenes.length > 0,
  });
  const brandableSceneIds = brandableSceneObjects.map(scene => scene.id);

  const {
    data: sceneVariations = [],
    isLoading: isLoadingVariations,
    isFetching: isFetchingVariations,
  } = useQuery<SceneVariation[]>({
    queryKey: ["/api/scripts/scene-variations", activeSceneId],
    // MODIFIED: Enable whenever a scene is selected, not just AI-brandable ones
    enabled: !!activeSceneId,
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
        // After variations are fetched (potentially generated on-demand),
        // refetch the list of brandable scenes in case the current scene
        // was just marked as brandable by the backend.
        if (activeSceneId && data.length > 0) { // Only if variations were actually generated/fetched
            const currentSceneObject = scenes.find(s => s.id === activeSceneId);
            if (currentSceneObject && !brandableSceneIds.includes(activeSceneId)) {
                 // If the current scene wasn't in the initial brandable list, but we got variations for it,
                 // it means it likely became brandable. Refetch to update highlighting.
                refetchBrandableScenes();
            }
        }
    }
  });

   useEffect(() => {
       setVideoGenerationStates({});
       Object.values(pollingIntervals.current).forEach(clearInterval);
       pollingIntervals.current = {};
   }, [activeSceneId]);

  // --- Mutations ---
   const reanalyzeScriptMutation = useMutation({
       mutationFn: async () => apiRequest("POST", "/api/scripts/analyze", {}), // This endpoint might need to be more generic if it's just for re-checking brandability
       onSuccess: () => {
           toast({ title: "Analysis complete", description: "Script re-analyzed." });
           queryClient.invalidateQueries({ queryKey: ['/api/scripts/brandable-scenes'] });
           queryClient.invalidateQueries({ queryKey: ['/api/scripts/scenes'] }); // Also refetch all scenes
           queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations', activeSceneId] }); // And variations for current
       },
       onError: (error: Error) => {
           toast({ variant: "destructive", title: "Analysis failed", description: error.message });
       }
   });
   const generatePlacementsMutation = useMutation({ // This button might now be less relevant if any scene selection triggers generation
        mutationFn: async () => {
            // If an active scene is selected, invalidate its variations to trigger on-demand generation
            if (activeSceneId) {
                return queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations', activeSceneId] });
            }
            // If no specific scene, maybe invalidate all brandable scenes or a general key
            return queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations'] });
        },
       onSuccess: () => {
           toast({ title: "Placement Generation Triggered", description: "Generating visual options..." });
       },
       onError: (error: Error) => {
           toast({ variant: "destructive", title: "Generation Trigger Failed", description: error.message });
       }
   });

    const stopPollingPrediction = useCallback((predictionId: string) => { /* ... same ... */ }, []);
    const pollPredictionStatus = useCallback(async (predictionId: string, variationId: number) => { /* ... same ... */ }, [stopPollingPrediction, toast]);
    const startPollingPrediction = useCallback((predictionId: string, variationId: number) => { /* ... same ... */ }, [pollPredictionStatus]);

    useEffect(() => {
        return () => {
            Object.values(pollingIntervals.current).forEach(clearInterval);
            pollingIntervals.current = {};
        };
    }, []);

   const startVideoGenerationMutation = useMutation({ /* ... same ... */ });

  const handleExport = async () => { /* ... */ };

  const handleSceneSelect = (sceneId: number) => {
    if (activeSceneId !== sceneId) {
        setActiveSceneId(sceneId);
    }
  };

  const handleViewVideo = (videoUrl: string, title: string) => { /* ... same ... */ };
  const handleCloseVideoModal = () => { /* ... same ... */ };

  const activeSceneObject = scenes.find((s: Scene) => s.id === activeSceneId); // Use this for passing to BrandableScenes
  const isPageLoading = isLoadingScript || (!!script && isLoadingScenes && scenes.length === 0);
  const isLoadingCurrentVariations = !!activeSceneId && (isLoadingVariations || isFetchingVariations);
  const displayScript = script ? { id: script.id, title: script.title, content: script.content } : null;

  if (isPageLoading) { /* ... same loading skeleton ... */ }
  if (isScriptError && !script && !isLoadingScript) { /* ... same error display ... */ }
  if (!script && !isLoadingScript) { /* ... same no script display ... */ }

  return (
    <>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <SceneBreakdown
            scenes={scenes}
            activeSceneId={activeSceneId}
            brandableSceneIds={brandableSceneIds || []} // Still pass AI-identified ones for highlighting
            isLoading={isLoadingScenes || isLoadingBrandableScenes}
            onSceneSelect={handleSceneSelect}
          />
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <ScriptDisplay
                script={displayScript}
                isLoading={false}
                onSave={async () => {console.warn("Save not implemented")}}
                onReanalyze={() => reanalyzeScriptMutation.mutate()}
                onGeneratePlacements={() => generatePlacementsMutation.mutate()}
                onExport={handleExport}
                activeScene={activeSceneObject || null} // Pass the actual selected scene object
                isSaving={false}
                isReanalyzing={reanalyzeScriptMutation.isPending}
                isGenerating={generatePlacementsMutation.isPending}
                isExporting={isExporting}
              />
            </div>
            {scenes.length > 0 && activeSceneId !== null ? (
              <div className="bg-white rounded-lg shadow p-4">
                <BrandableScenes
                  // Pass the specific active scene's details if available
                  // The component will use this for reason/categories
                  activeSceneDetails={activeSceneObject} 
                  scenes={scenes} // Pass all scenes for context if needed by internal logic
                  productVariations={sceneVariations}
                  isLoading={isLoadingCurrentVariations}
                  selectedSceneId={activeSceneId}
                  onGenerateVideoRequest={(variationId) => startVideoGenerationMutation.mutate(variationId)}
                  videoGenerationStates={videoGenerationStates}
                  onViewVideo={handleViewVideo}
                />
              </div>
            ) : (
                 activeSceneId === null && scenes.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                       <Info className="inline-block mr-2 h-5 w-5" />
                       Select a scene from the breakdown list to view details and placement options.
                    </div>
                 )
            )}
          </div>
        </div>
        <VideoPlayerModal /* ... same ... */ />
    </>
  );
}