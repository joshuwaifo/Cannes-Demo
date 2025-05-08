// // client/src/pages/ScriptEditor.tsx
// import { useState, useEffect, useRef, useCallback } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { apiRequest } from "@/lib/queryClient";
// import { useToast } from "@/hooks/use-toast";
// import SceneBreakdown from "@/components/script/SceneBreakdown";
// import ScriptDisplay from "@/components/script/ScriptDisplay";
// import BrandableScenes from "@/components/script/BrandableScenes";
// import VideoPlayerModal from "@/components/script/VideoPlayerModal";
// import { Script, Scene, SceneVariation, ProductCategory } from "@shared/schema";
// import { RefreshCw, FileText, Wand2, Info, Loader2, Download } from "lucide-react";
// import { Button } from "@/components/ui/button";

// type VideoGenerationStatus = 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
// interface VideoGenerationState {
//     status: VideoGenerationStatus;
//     predictionId?: string | null;
//     videoUrl?: string | null;
//     error?: string | null;
//     logs?: string | null;
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
//     isLoading: isLoadingVariations, // Loading state specifically for this query
//     isFetching: isFetchingVariations, // Fetching state specifically for this query
//      isSuccess: isVariationsSuccess, // Success state
//   } = useQuery<SceneVariation[]>({
//     queryKey: ["/api/scripts/scene-variations", activeSceneId],
//     // Only enable when a brandable scene is active
//     enabled: !!activeSceneId && brandableSceneIds.includes(activeSceneId),
//     staleTime: 5 * 60 * 1000, // Cache for 5 mins
//     // onSuccess: () => {
//     //    // Optional: Could reset video states here too, but watching activeSceneId is likely better
//     //    // setVideoGenerationStates({});
//     // }
//   });

//    // --- Effect to reset video states when active scene changes ---
//    useEffect(() => {
//        // console.log(`Active scene changed to: ${activeSceneId}, resetting video states.`);
//        setVideoGenerationStates({}); // Clear states for the new scene
//        // Stop any polling from the previously active scene
//         Object.keys(pollingIntervals.current).forEach(stopPollingPrediction);
//    }, [activeSceneId]); // Dependency on activeSceneId

//   // --- Mutations ---
//    const saveScriptMutation = useMutation({ mutationFn: async () => {/*...*/}, onSuccess: () => {/*...*/}, onError: () => {/*...*/}});
//    const reanalyzeScriptMutation = useMutation({ mutationFn: async () => {/*...*/}, onSuccess: () => {/*...*/}, onError: () => {/*...*/}});
//    const generatePlacementsMutation = useMutation({ mutationFn: async () => {/*...*/}, onSuccess: () => {/*...*/}, onError: () => {/*...*/}});

//    // --- Polling Logic (useCallback for stability) ---
//     const stopPollingPrediction = useCallback((predictionId: string) => {
//         if (pollingIntervals.current[predictionId]) {
//             clearInterval(pollingIntervals.current[predictionId]);
//             delete pollingIntervals.current[predictionId];
//         }
//     }, []); // No dependencies, safe to useCallback

//     const MAX_RETRIES = 3;
//     const INITIAL_RETRY_DELAY = 1000;

//     const pollPredictionStatus = useCallback(async (predictionId: string, variationId: number, retryCount = 0) => {
//         try {
//             const response = await fetch(`/api/replicate/predictions/${predictionId}`);
            
//             if (!response.ok) {
//                 const errorText = await response.text();
//                 if (retryCount < MAX_RETRIES && response.status >= 500) {
//                     // Exponential backoff for retries
//                     const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
//                     console.log(`Retrying prediction status check in ${delay}ms...`);
//                     setTimeout(() => {
//                         pollPredictionStatus(predictionId, variationId, retryCount + 1);
//                     }, delay);
//                     return;
//                 }
//                 throw new Error(`HTTP error ${response.status}: ${errorText || 'Failed to fetch status'}`);
//             }
            
//             const data: { status: VideoGenerationStatus, outputUrl?: string, error?: string, logs?: string } = await response.json();

//             console.log(`Poll Status for ${predictionId} (Var ${variationId}): ${data.status}`);

//             // Update state based on fetched status
//             setVideoGenerationStates(prev => {
//                 // Ensure we don't overwrite if the state somehow got reset
//                 const currentState = prev[variationId];
//                 if (!currentState || currentState.predictionId !== predictionId) {
//                      // If state doesn't match (e.g., scene changed), stop polling this one
//                      stopPollingPrediction(predictionId);
//                      return prev; // Don't update stale state
//                 }
//                 return {
//                      ...prev,
//                      [variationId]: {
//                          ...currentState, // Keep existing predictionId
//                          status: data.status,
//                          videoUrl: data.outputUrl ?? currentState.videoUrl, // Keep old URL if new one is null/undefined
//                          error: data.error ?? null,
//                          logs: data.logs ?? null,
//                      }
//                 };
//             });


//             // Stop polling if prediction is complete or failed/canceled
//             if (['succeeded', 'failed', 'canceled'].includes(data.status)) {
//                 stopPollingPrediction(predictionId);
//                  if(data.status === 'succeeded') {
//                       toast({title: "Video Generated!", description: `Video for variation ${variationId} is ready.`});
//                  } else {
//                       toast({title: "Video Generation Failed", description: `Video for variation ${variationId} failed: ${data.error || 'Check server logs for details'}.`, variant: "destructive"});
//                       console.error(`Replicate Logs for prediction ${predictionId}:`, data.logs)
//                  }
//             }
//         } catch (error: any) {
//             console.error(`Polling error for prediction ${predictionId} (Var ${variationId}):`, error);
//             // Stop polling on error to prevent infinite loops on network issues
//              stopPollingPrediction(predictionId);
//              setVideoGenerationStates(prev => {
//                   // Only update if the state still belongs to this prediction
//                  const currentState = prev[variationId];
//                  if (currentState && currentState.predictionId === predictionId) {
//                      return {
//                          ...prev,
//                          [variationId]: { ...currentState, status: 'failed', error: `Polling failed: ${error.message}` }
//                      };
//                  }
//                  return prev; // Don't update stale state
//              });
//         }
//     }, [stopPollingPrediction, toast]);


//     const startPollingPrediction = useCallback((predictionId: string, variationId: number) => {
//         stopPollingPrediction(predictionId); // Clear existing interval first
//         // console.log(`Starting polling for prediction ${predictionId} (Var ${variationId})`);
//         // Initial immediate check after a short delay to allow Replicate to register the prediction
//         setTimeout(() => pollPredictionStatus(predictionId, variationId), 1000);
//         // Set interval for subsequent checks
//         pollingIntervals.current[predictionId] = setInterval(() => {
//             pollPredictionStatus(predictionId, variationId);
//         }, 5000); // Poll every 5 seconds
//     }, [pollPredictionStatus, stopPollingPrediction]);

//      // Cleanup polling on component unmount
//     useEffect(() => {
//         return () => {
//             Object.keys(pollingIntervals.current).forEach(stopPollingPrediction);
//         };
//     }, [stopPollingPrediction]);


//    const startVideoGenerationMutation = useMutation({
//        mutationFn: async (variationId: number) => {
//            setVideoGenerationStates(prev => ({
//                ...prev,
//                [variationId]: { status: 'pending' }
//            }));
//            return await apiRequest("POST", `/api/variations/${variationId}/generate-video`, {});
//        },
//        onSuccess: (data: any, variationId) => { // Explicitly receive variationId
//            if (data.predictionId) {
//                console.log(`Video generation started for Var ${variationId}, Prediction ID: ${data.predictionId}`);
//                setVideoGenerationStates(prev => ({
//                    ...prev,
//                    [variationId]: { status: 'generating', predictionId: data.predictionId }
//                }));
//                startPollingPrediction(data.predictionId, variationId); // Start polling
//                toast({ title: "Video Generation Started", description: `Processing variation ${variationId}. We'll update you.` });
//            } else {
//                 // Handle case where backend returns error immediately
//                 const errorMsg = data.message || 'Failed to get prediction ID from server';
//                 console.error(`Video generation init failed for Var ${variationId}: ${errorMsg}`);
//                setVideoGenerationStates(prev => ({
//                    ...prev,
//                    [variationId]: { status: 'failed', error: errorMsg }
//                }));
//                toast({ title: "Video Generation Failed", description: errorMsg, variant: "destructive" });
//            }
//        },
//        onError: (error: Error, variationId) => {
//            console.error(`Video generation mutation error for Var ${variationId}: ${error.message}`);
//            setVideoGenerationStates(prev => ({
//                ...prev,
//                [variationId]: { status: 'failed', error: error.message }
//            }));
//            toast({
//                variant: "destructive",
//                title: "Video Generation Error",
//                description: `Failed to start video generation for variation ${variationId}: ${error.message}`,
//            });
//        },
//    });

//   // --- Export Handler ---
//   const handleExport = async () => { /* ... existing export logic ... */ };

//   // --- Scene Selection Handler ---
//   const handleSceneSelect = (sceneId: number) => {
//     if (activeSceneId !== sceneId) {
//         setActiveSceneId(sceneId); // This triggers the useEffect to clear video states
//          // Pre-fetch variations for the selected scene
//         if (brandableSceneIds.includes(sceneId)) {
//             queryClient.prefetchQuery({
//                 queryKey: ['/api/scripts/scene-variations', sceneId],
//                 staleTime: 60 * 1000
//             });
//         }
//     }
//   };

//   // --- Video Modal Handlers ---
//   const handleViewVideo = (videoUrl: string, title: string) => { /* ... */ };
//   const handleCloseVideoModal = () => { /* ... */ };

//   // --- Component Logic ---
//   const activeScene = scenes.find((s: Scene) => s.id === activeSceneId);
//   // Determine if the *initial* script/scene data is loading
//   const isPageLoading = isLoadingScript || (!!script && isLoadingScenes && scenes.length === 0);
//   // Determine if a major background action is running
//   const isProcessingAction = reanalyzeScriptMutation.isPending || generatePlacementsMutation.isPending || isExporting;
//   // Specific loading state for the variations section
//   const isLoadingCurrentVariations = (isLoadingVariations || isFetchingVariations) && !!activeSceneId;

//   const displayScript = script ? { id: script.id, title: script.title, content: script.content } : null;

//   // --- Render Logic ---
//   if (isPageLoading) { /* ... existing loading spinner ... */ }
//   if (isScriptError && !script && !isLoadingScript) { /* ... existing error state ... */ }
//   if (!script && !isLoadingScript) { /* ... existing no script state ... */ }

//   return (
//     <>
//         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//           <SceneBreakdown
//             scenes={scenes}
//             activeSceneId={activeSceneId}
//             brandableSceneIds={brandableSceneIds || []}
//             // isLoading reflects initial scene list loading, not variations
//             isLoading={isLoadingScenes || isLoadingBrandableScenes}
//             onSceneSelect={handleSceneSelect}
//           />

//           <div className="lg:col-span-3">
//             <div className="bg-white rounded-lg shadow p-4 mb-6">
//               <ScriptDisplay
//                 script={displayScript}
//                 isLoading={isPageLoading} // Pass initial page loading state
//                 onSave={() => {/* saveScriptMutation.mutateAsync() */}} // Save likely not needed now
//                 onReanalyze={() => reanalyzeScriptMutation.mutateAsync()}
//                 onGeneratePlacements={() => generatePlacementsMutation.mutateAsync()}
//                 onExport={handleExport}
//                 activeScene={activeScene || null}
//                 isSaving={saveScriptMutation.isPending}
//                 isReanalyzing={reanalyzeScriptMutation.isPending}
//                 isGenerating={generatePlacementsMutation.isPending}
//                 isExporting={isExporting}
//               />
//             </div>

//             {/* Only render BrandableScenes if scenes exist */}
//             {scenes.length > 0 && (
//               <div className="bg-white rounded-lg shadow p-4">
//                 <BrandableScenes
//                   brandableScenes={brandableSceneObjects}
//                   scenes={scenes}
//                   productVariations={sceneVariations}
//                    // Pass the specific loading state for the current scene's variations
//                   isLoading={isLoadingCurrentVariations}
//                   selectedSceneId={activeSceneId}
//                   onGenerateVideoRequest={(variationId) => startVideoGenerationMutation.mutate(variationId)}
//                   videoGenerationStates={videoGenerationStates}
//                   onViewVideo={handleViewVideo}
//                 />
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Video Player Modal */}
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
import { Script, Scene, SceneVariation as SharedSceneVariation, ProductCategory } from "@shared/schema"; // Use alias for schema type
import { RefreshCw, FileText, Wand2, Info, Loader2, Download, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

// Use SceneVariation type from lib which includes client-side state
import { SceneVariation } from "@/lib/types";

type VideoGenerationStatus = 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
interface VideoGenerationState {
    status: VideoGenerationStatus;
    predictionId?: string | null;
    videoUrl?: string | null;
    error?: string | null;
    logs?: string | null; // Store logs if backend sends them
}

export default function ScriptEditor() {
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false); // Keep export state if needed
  const [videoGenerationStates, setVideoGenerationStates] = useState<{ [key: number]: VideoGenerationState }>({});
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
  // useRef to store polling intervals
  const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // --- Queries ---
  const {
    data: script,
    isLoading: isLoadingScript,
    refetch: refetchScript, // Keep refetch if needed elsewhere
    isError: isScriptError,
  } = useQuery<Script | null>({
    queryKey: ["/api/scripts/current"],
    refetchOnWindowFocus: false, // Keep as false unless needed
  });

  const {
    data: scenes = [],
    isLoading: isLoadingScenes,
  } = useQuery<Scene[]>({
    queryKey: ["/api/scripts/scenes"],
    enabled: !!script, // Only fetch scenes if script exists
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
    isLoading: isLoadingVariations, // Loading state for this specific query
    isFetching: isFetchingVariations, // Fetching state for this specific query
    isSuccess: isVariationsSuccess, // Use this if needed
    // error: variationsError, // Capture error if needed
  } = useQuery<SceneVariation[]>({ // Use client-side SceneVariation type if different
    queryKey: ["/api/scripts/scene-variations", activeSceneId],
    // Only enable when a brandable scene is active
    enabled: !!activeSceneId && brandableSceneIds.includes(activeSceneId),
    staleTime: 1 * 60 * 1000, // Reduce stale time to refetch variations more readily if needed
    refetchOnWindowFocus: false, // Keep false typically
  });

   // --- Effect to reset video states and stop polling when active scene changes ---
   useEffect(() => {
       console.log(`[Effect] Active scene changed to: ${activeSceneId}. Clearing video states and stopping polls.`);
       setVideoGenerationStates({}); // Clear states for the new scene
       Object.values(pollingIntervals.current).forEach(clearInterval); // Clear all intervals
       pollingIntervals.current = {}; // Reset the intervals ref
   }, [activeSceneId]); // Dependency on activeSceneId

  // --- Mutations ---
   const reanalyzeScriptMutation = useMutation({ // Example structure
       mutationFn: async () => {
            console.log("[Mutation] Reanalyzing script...");
            await apiRequest("POST", "/api/scripts/analyze", {}); // Example endpoint
       },
       onSuccess: () => {
           toast({ title: "Analysis complete", description: "Script re-analyzed." });
           queryClient.invalidateQueries({ queryKey: ['/api/scripts/brandable-scenes'] });
           queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations'] }); // Invalidate variations too
       },
       onError: (error: Error) => {
           toast({ variant: "destructive", title: "Analysis failed", description: error.message });
       }
   });
   const generatePlacementsMutation = useMutation({ // Example structure
        mutationFn: async () => {
             console.log("[Mutation] Generating placements...");
             // This might implicitly trigger on-demand generation via the variations query invalidation
             // Or you might have a specific endpoint: await apiRequest("POST", "/api/scripts/generate-placements", {});
             // For now, just invalidate to trigger on-demand if needed
             await queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations'] });
        },
       onSuccess: () => {
           toast({ title: "Placement Generation Triggered", description: "Generating visual options..." });
           // Let the query refetch handle showing results/loading state
       },
       onError: (error: Error) => {
           toast({ variant: "destructive", title: "Generation Trigger Failed", description: error.message });
       }
   });


   // --- Polling Logic ---
    const stopPollingPrediction = useCallback((predictionId: string) => {
        if (pollingIntervals.current[predictionId]) {
            // console.log(`[Polling] Stopping polling for prediction ${predictionId}`);
            clearInterval(pollingIntervals.current[predictionId]);
            delete pollingIntervals.current[predictionId]; // Remove from ref
        }
    }, []); // No dependencies needed

    const pollPredictionStatus = useCallback(async (predictionId: string, variationId: number) => {
        // console.log(`[Polling] Checking status for prediction ${predictionId} (Var ${variationId})`);
        try {
            const response = await fetch(`/api/replicate/predictions/${predictionId}`);
            if (!response.ok) {
                // Handle non-OK HTTP responses from our API
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText || 'Failed to fetch status'}`);
            }
            const data: PredictionStatusResult = await response.json(); // Use interface from replicate-service
            // console.log(`[Polling] Status for ${predictionId}: ${data.status}, Output: ${!!data.outputUrl}, Error: ${data.error}`);

            // Update state only if the prediction is still relevant for the current view
            setVideoGenerationStates(prev => {
                const currentState = prev[variationId];
                 // Check if the state still belongs to this prediction ID before updating
                if (!currentState || currentState.predictionId !== predictionId || currentState.status === 'succeeded' || currentState.status === 'failed') {
                    // If state is missing, doesn't match ID, or already terminal, stop polling for this ID and don't update
                    // console.log(`[Polling] State mismatch or terminal state for ${predictionId}. Halting poll.`);
                     stopPollingPrediction(predictionId);
                     return prev;
                 }

                 // Update with new status, URL, error, logs
                 const newStateUpdate: VideoGenerationState = {
                     ...currentState, // Keep existing predictionId
                     status: data.status === 'canceled' ? 'failed' : data.status, // Treat canceled as failed visually
                     videoUrl: data.outputUrl ?? currentState.videoUrl, // Keep old URL if new one is null
                     error: data.error ?? null,
                     logs: data.logs ?? null,
                 };

                // If prediction reached a terminal state, stop polling
                if (['succeeded', 'failed', 'canceled'].includes(data.status)) {
                    console.log(`[Polling] Prediction ${predictionId} reached terminal state: ${data.status}. Stopping poll.`);
                    stopPollingPrediction(predictionId);
                    if(data.status === 'succeeded') {
                         toast({title: "Video Ready!", description: `Video for variation ${variationId} finished processing.`});
                    } else {
                         toast({title: "Video Failed", description: `Video generation failed for variation ${variationId}: ${data.error || 'Unknown reason'}.`, variant: "destructive"});
                         // console.error(`[Polling] Replicate Logs for failed prediction ${predictionId}:`, data.logs) // Log details
                    }
                }
                 return { ...prev, [variationId]: newStateUpdate };
            });

        } catch (error: any) {
            console.error(`[Polling] Error polling prediction ${predictionId} (Var ${variationId}):`, error);
            // Stop polling on error and mark as failed
             stopPollingPrediction(predictionId);
             setVideoGenerationStates(prev => {
                 const currentState = prev[variationId];
                 if (currentState && currentState.predictionId === predictionId) {
                     return { ...prev, [variationId]: { ...currentState, status: 'failed', error: `Polling failed: ${error.message}` }};
                 }
                 return prev; // Don't update stale state
             });
             toast({ variant: "destructive", title: "Polling Error", description: `Could not get video status: ${error.message}` });
        }
    }, [stopPollingPrediction, toast]); // Added toast dependency


    const startPollingPrediction = useCallback((predictionId: string, variationId: number) => {
        if (pollingIntervals.current[predictionId]) {
            console.warn(`[Polling] Polling already started for prediction ${predictionId}.`);
            return; // Avoid starting multiple intervals for the same ID
        }
        console.log(`[Polling] Starting polling for prediction ${predictionId} (Var ${variationId}) every 5s.`);
        // Initial check after a short delay
        const initialTimeout = setTimeout(() => pollPredictionStatus(predictionId, variationId), 2000); // Increased initial delay slightly
        // Set interval for subsequent checks
        pollingIntervals.current[predictionId] = setInterval(() => {
            pollPredictionStatus(predictionId, variationId);
        }, 5000); // Poll every 5 seconds

        // Optional: Store initial timeout to clear it if component unmounts quickly? Less critical.
    }, [pollPredictionStatus]); // Dependency

     // Cleanup polling on component unmount
    useEffect(() => {
        return () => {
            console.log("[Effect Cleanup] Unmounting ScriptEditor, clearing all polling intervals.");
            Object.values(pollingIntervals.current).forEach(clearInterval);
            pollingIntervals.current = {}; // Reset ref on unmount
        };
    }, []); // Empty dependency array means this runs only on unmount

   // Mutation to start video generation
   const startVideoGenerationMutation = useMutation({
       mutationFn: async (variationId: number) => {
            console.log(`[Mutation] Requesting video generation for Variation ID: ${variationId}`);
            setVideoGenerationStates(prev => ({ // Optimistic UI update
               ...prev,
               [variationId]: { status: 'pending', error: null, videoUrl: null, predictionId: null } // Reset previous errors/urls
            }));
           // Make the API request using the helper
           const response = await apiRequest("POST", `/api/variations/${variationId}/generate-video`, {});
           // The response itself needs parsing now
           const data = await response.json(); // Assuming backend sends JSON
            console.log(`[Mutation] Backend response for Var ${variationId}:`, data);
            // Pass variationId along with data for onSuccess/onError context
           return { variationId, responseData: data };
       },
       onSuccess: (result) => { // Result now contains { variationId, responseData }
            const { variationId, responseData } = result;
            console.log(`[Mutation Success] Var ${variationId}: Received response`, responseData);
           if (responseData.predictionId && responseData.status !== 'failed' && responseData.status !== 'canceled') {
               setVideoGenerationStates(prev => ({
                   ...prev,
                   [variationId]: {
                       status: 'generating', // Move to generating state
                       predictionId: responseData.predictionId, // Store the ID
                       error: null,
                       videoUrl: null
                   }
               }));
               startPollingPrediction(responseData.predictionId, variationId); // Start polling
               toast({ title: "Video Generation Started", description: `Processing variation ${variationId}...` });
           } else {
                // Handle case where backend returns error immediately or no ID
                const errorMsg = responseData.message || responseData.error || 'Failed to get valid prediction ID from server.';
                console.error(`[Mutation Success Decode Error] Var ${variationId}: ${errorMsg}`, responseData);
               setVideoGenerationStates(prev => ({
                   ...prev,
                   [variationId]: { status: 'failed', error: errorMsg, predictionId: responseData.predictionId || null }
               }));
               toast({ title: "Video Start Failed", description: errorMsg, variant: "destructive" });
           }
       },
       onError: (error: Error, variationId) => { // variationId is passed as the second argument here
           console.error(`[Mutation Error] Var ${variationId}: Video generation request failed: ${error.message}`);
           // Update state to reflect the failure to *start* the process
           setVideoGenerationStates(prev => ({
               ...prev,
               [variationId]: { status: 'failed', error: `Failed to start: ${error.message}`, predictionId: null }
           }));
           toast({
               variant: "destructive",
               title: "Request Error",
               description: `Could not start video generation for variation ${variationId}: ${error.message}`,
           });
       },
   });

  // --- Export Handler ---
  const handleExport = async () => { /* ... existing export logic ... */ };

  // --- Scene Selection Handler ---
  const handleSceneSelect = (sceneId: number) => {
    if (activeSceneId !== sceneId) {
        console.log(`[UI] Scene selected: ${sceneId}`);
        setActiveSceneId(sceneId); // This triggers the useEffect to clear video states
        // Prefetching can be useful but might trigger on-demand gen prematurely if not careful.
        // Consider prefetching only if variations are likely needed soon after selection.
        // if (brandableSceneIds.includes(sceneId)) {
        //     queryClient.prefetchQuery({
        //         queryKey: ['/api/scripts/scene-variations', sceneId],
        //         staleTime: 60 * 1000
        //     });
        // }
    }
  };

  // --- Video Modal Handlers ---
  const handleViewVideo = (videoUrl: string, title: string) => {
      console.log(`[UI] Viewing video: ${title}, URL: ${videoUrl}`);
      setCurrentVideoUrl(videoUrl);
      setCurrentVideoTitle(title);
      setIsVideoModalOpen(true);
  };
  const handleCloseVideoModal = () => {
      setIsVideoModalOpen(false);
      setCurrentVideoUrl(null);
      setCurrentVideoTitle("");
  };

  // --- Component Logic ---
  const activeScene = scenes.find((s: Scene) => s.id === activeSceneId);
  const isPageLoading = isLoadingScript || (!!script && isLoadingScenes && scenes.length === 0);
  // Determine if a major background action is running that affects the whole editor
  const isProcessingAction = reanalyzeScriptMutation.isPending || generatePlacementsMutation.isPending || isExporting;
  // Specific loading state for the variations section when a scene is active
  const isLoadingCurrentVariations = !!activeSceneId && (isLoadingVariations || isFetchingVariations);

  // Only pass necessary script data to display component
  const displayScript = script ? { id: script.id, title: script.title, content: script.content } : null;

  // --- Render Logic ---
  if (isPageLoading) {
       return (
            <div className="space-y-6 p-4">
                <Skeleton className="h-8 w-1/4" />
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <Skeleton className="h-[500px] lg:col-span-1" />
                    <div className="lg:col-span-3 space-y-6">
                        <Skeleton className="h-[300px] w-full" />
                        <Skeleton className="h-[400px] w-full" />
                    </div>
                </div>
            </div>
       );
   }

  if (isScriptError && !script && !isLoadingScript) {
      return <div className="p-6 text-center text-red-600"><AlertTriangle className="inline-block mr-2"/>Failed to load script data. Please try again later.</div>;
  }
  if (!script && !isLoadingScript) {
       return <div className="p-6 text-center text-gray-500"><Info className="inline-block mr-2"/>No script loaded. Please upload a script on the Welcome page.</div>;
   }

  return (
    <>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Scene Breakdown */}
          <SceneBreakdown
            scenes={scenes}
            activeSceneId={activeSceneId}
            brandableSceneIds={brandableSceneIds || []}
            isLoading={isLoadingScenes || isLoadingBrandableScenes} // Loading state for scene list
            onSceneSelect={handleSceneSelect}
          />

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Script Display / Editor */}
            <div className="bg-white rounded-lg shadow p-4">
              <ScriptDisplay
                script={displayScript}
                isLoading={false} // Script data is loaded if we reach here
                onSave={async () => {console.warn("Save not implemented")}} // Placeholder
                onReanalyze={() => reanalyzeScriptMutation.mutate()}
                onGeneratePlacements={() => generatePlacementsMutation.mutate()} // Trigger variation generation/refetch
                onExport={handleExport} // Keep if export exists
                activeScene={activeScene || null} // Pass the found active scene
                isSaving={false} // Add actual mutation state if save is implemented
                isReanalyzing={reanalyzeScriptMutation.isPending}
                isGenerating={generatePlacementsMutation.isPending}
                isExporting={isExporting}
              />
            </div>

            {/* Brandable Scenes & Variations */}
             {/* Conditional rendering: Show only if scenes exist and an active scene is selected */}
            {scenes.length > 0 && activeSceneId !== null ? (
              <div className="bg-white rounded-lg shadow p-4">
                <BrandableScenes
                  brandableScenes={brandableSceneObjects} // Pass the list of brandable scenes
                  scenes={scenes} // Pass all scenes for context if needed
                  productVariations={sceneVariations} // Pass fetched variations
                  isLoading={isLoadingCurrentVariations} // Use specific loading state for variations
                  selectedSceneId={activeSceneId}
                  onGenerateVideoRequest={(variationId) => startVideoGenerationMutation.mutate(variationId)} // Pass mutation trigger
                  videoGenerationStates={videoGenerationStates} // Pass the state map
                  onViewVideo={handleViewVideo} // Pass modal opener
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