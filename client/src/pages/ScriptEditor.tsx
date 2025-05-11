// // client/src/pages/ScriptEditor.tsx
// import { useState, useEffect, useRef, useCallback } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Ensure useQueryClient is imported
// import { apiRequest } from "@/lib/queryClient";
// import { useToast } from "@/hooks/use-toast";
// import SceneBreakdown from "@/components/script/SceneBreakdown";
// import ScriptDisplay from "@/components/script/ScriptDisplay";
// import BrandableScenes from "@/components/script/BrandableScenes";
// import VideoPlayerModal from "@/components/script/VideoPlayerModal";
// import SuggestedLocations from "@/components/script/SuggestedLocations";
// import CharacterCasting from "@/components/script/CharacterCasting";
// import {
//     Script,
//     Scene,
//     SceneVariation as SharedSceneVariation,
//     ProductCategory,
// } from "@shared/schema";
// import {
//     RefreshCw,
//     FileText,
//     Wand2,
//     Info,
//     Loader2,
//     Download,
//     AlertTriangle,
//     DollarSign,
// } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Separator } from "@/components/ui/separator";

// import { SceneVariation } from "@/lib/types";

// type VideoGenerationStatus =
//     | "idle"
//     | "pending"
//     | "generating"
//     | "succeeded"
//     | "failed";
// interface VideoGenerationState {
//     status: VideoGenerationStatus;
//     predictionId?: string | null;
//     videoUrl?: string | null;
//     error?: string | null;
//     logs?: string | null;
//     progress?: number;
//     stageMessage?: string;
// }

// interface PredictionStatusResult {
//     status: VideoGenerationStatus;
//     outputUrl?: string | null;
//     error?: string | null;
//     logs?: string | null;
// }

// // Define default/initial values for states that need resetting
// const DEFAULT_PROJECT_BUDGET = 1000000; // Example default
// const DEFAULT_FILM_GENRE = "ACTION"; // Example default

// export default function ScriptEditor() {
//     const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
//     const { toast } = useToast();
//     const queryClient = useQueryClient(); // Get query client instance
//     const [isExporting, setIsExporting] = useState(false);
//     const [videoGenerationStates, setVideoGenerationStates] = useState<{
//         [key: number]: VideoGenerationState;
//     }>({});
//     const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
//     const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
//     const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
//     const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});
//     const [projectBudget, setProjectBudget] = useState<number | undefined>(
//         DEFAULT_PROJECT_BUDGET,
//     );
//     const [filmGenreForCasting, setFilmGenreForCasting] =
//         useState<string>(DEFAULT_FILM_GENRE);
//     const [projectBudgetTierForCasting, setProjectBudgetTierForCasting] =
//         useState<"low" | "medium" | "high" | "any">("medium");

//     // --- Queries ---
//     const {
//         data: script,
//         isLoading: isLoadingScript,
//         isError: isScriptError,
//     } = useQuery<Script | null>({
//         queryKey: ["/api/scripts/current"],
//         refetchOnWindowFocus: false,
//     });

//     const { data: scenes = [], isLoading: isLoadingScenes } = useQuery<Scene[]>(
//         {
//             queryKey: ["/api/scripts/scenes"],
//             enabled: !!script,
//         },
//     );

//     const {
//         data: brandableSceneObjects = [],
//         isLoading: isLoadingBrandableScenes,
//         refetch: refetchBrandableScenes,
//     } = useQuery<Scene[]>({
//         queryKey: ["/api/scripts/brandable-scenes"],
//         enabled: !!script && scenes.length > 0,
//     });
//     const brandableSceneIds = brandableSceneObjects.map((scene) => scene.id);

//     const {
//         data: sceneVariations = [],
//         isLoading: isLoadingVariations,
//         isFetching: isFetchingVariations,
//     } = useQuery<SceneVariation[]>({
//         queryKey: ["/api/scripts/scene-variations", activeSceneId],
//         enabled: !!activeSceneId,
//         staleTime: 1 * 60 * 1000,
//         refetchOnWindowFocus: false,
//         onSuccess: (data) => {
//             if (activeSceneId && data.length > 0) {
//                 const currentSceneObject = scenes.find(
//                     (s) => s.id === activeSceneId,
//                 );
//                 if (
//                     currentSceneObject &&
//                     !brandableSceneIds.includes(activeSceneId)
//                 ) {
//                     refetchBrandableScenes();
//                 }
//             }
//         },
//     });

//     // --- EFFECT: Reset component state when a new script is loaded ---
//     useEffect(() => {
//         if (script?.id) {
//             console.log(
//                 `[ScriptEditor] New script context (ID: ${script.id}). Resetting local states and script-specific queries.`,
//             );

//             // Reset local state that is script-dependent
//             setActiveSceneId(null);
//             setVideoGenerationStates({}); // Clear all video states
//             setProjectBudget(DEFAULT_PROJECT_BUDGET);
//             setFilmGenreForCasting(DEFAULT_FILM_GENRE); // Or derive from new script if possible
//             // projectBudgetTierForCasting will be updated by its own useEffect based on projectBudget

//             // Clear any active polling intervals
//             Object.values(pollingIntervals.current).forEach(clearInterval);
//             pollingIntervals.current = {};

//             // Invalidate queries specific to content *within* a script (e.g., variations, suggestions).
//             // Queries for script-level data (like scenes or brandable scenes) are already keyed by script?.id
//             // or will be re-enabled/refetched due to script loading.
//             // The cache clearing in Welcome.tsx should handle most of this, but local invalidation
//             // can be a good safeguard or for fine-grained control if needed.
//             // Since activeSceneId is set to null, queries dependent on it will become disabled or refetch appropriately.
//             queryClient.invalidateQueries({
//                 queryKey: ["/api/scripts/scene-variations"],
//             }); // General invalidation for all variations
//             queryClient.invalidateQueries({
//                 queryKey: ["/api/scenes/suggest-locations"],
//             });
//             queryClient.invalidateQueries({
//                 queryKey: ["/api/characters/suggest-actors"],
//             });
//         }
//     }, [script?.id, queryClient]); // Depend on script.id

//     // Effect to reset video states and polling when activeSceneId changes (within the same script)
//     useEffect(() => {
//         setVideoGenerationStates({}); // Clear all video generation states when scene changes
//         Object.values(pollingIntervals.current).forEach(clearInterval);
//         pollingIntervals.current = {};
//     }, [activeSceneId]); // Only activeSceneId as dependency here

//     // --- Mutations ---
//     const reanalyzeScriptMutation = useMutation({
//         mutationFn: async () => apiRequest("POST", "/api/scripts/analyze", {}),
//         onSuccess: () => {
//             toast({
//                 title: "Analysis complete",
//                 description: "Script re-analyzed.",
//             });
//             queryClient.invalidateQueries({
//                 queryKey: ["/api/scripts/brandable-scenes"],
//             });
//             queryClient.invalidateQueries({
//                 queryKey: ["/api/scripts/scenes"],
//             });
//             queryClient.invalidateQueries({
//                 queryKey: ["/api/scripts/scene-variations", activeSceneId],
//             });
//         },
//         onError: (error: Error) => {
//             toast({
//                 variant: "destructive",
//                 title: "Analysis failed",
//                 description: error.message,
//             });
//         },
//     });
//     const generatePlacementsMutation = useMutation({
//         mutationFn: async () => {
//             if (activeSceneId) {
//                 return queryClient.invalidateQueries({
//                     queryKey: ["/api/scripts/scene-variations", activeSceneId],
//                 });
//             }
//             return queryClient.invalidateQueries({
//                 queryKey: ["/api/scripts/scene-variations"],
//             });
//         },
//         onSuccess: () => {
//             toast({
//                 title: "Placement Generation Triggered",
//                 description: "Generating visual options...",
//             });
//         },
//         onError: (error: Error) => {
//             toast({
//                 variant: "destructive",
//                 title: "Generation Trigger Failed",
//                 description: error.message,
//             });
//         },
//     });

//     const stopPollingPrediction = useCallback((predictionId: string) => {
//         if (pollingIntervals.current[predictionId]) {
//             clearInterval(pollingIntervals.current[predictionId]);
//             delete pollingIntervals.current[predictionId];
//         }
//     }, []);

//     const pollPredictionStatus = useCallback(
//         async (predictionId: string, variationId: number) => {
//             try {
//                 const response = await fetch(
//                     `/api/replicate/predictions/${predictionId}`,
//                 );
//                 if (!response.ok) {
//                     const errorText = await response.text();
//                     throw new Error(
//                         `API error ${response.status}: ${errorText || "Failed to fetch status"}`,
//                     );
//                 }
//                 const data: PredictionStatusResult = await response.json();

//                 setVideoGenerationStates((prev) => {
//                     const currentState = prev[variationId];
//                     if (
//                         !currentState ||
//                         currentState.predictionId !== predictionId ||
//                         currentState.status === "succeeded" ||
//                         currentState.status === "failed"
//                     ) {
//                         stopPollingPrediction(predictionId);
//                         return prev;
//                     }
//                     let progress = currentState.progress || 0;
//                     let stageMessage =
//                         currentState.stageMessage || "Processing...";
//                     switch (data.status) {
//                         case "starting":
//                             progress = 25;
//                             stageMessage = "Initializing video engine...";
//                             break;
//                         case "processing":
//                             progress = Math.max(progress || 0, 40);
//                             if (data.logs) {
//                                 if (
//                                     data.logs
//                                         .toLowerCase()
//                                         .includes("frame generation")
//                                 )
//                                     progress = 50;
//                                 if (
//                                     data.logs
//                                         .toLowerCase()
//                                         .includes("upscaling")
//                                 )
//                                     progress = 75;
//                             }
//                             stageMessage = "Generating video frames...";
//                             break;
//                         case "succeeded":
//                             progress = 100;
//                             stageMessage = "Video ready!";
//                             break;
//                         case "failed":
//                         case "canceled":
//                             progress = 0;
//                             stageMessage = data.error
//                                 ? `Failed: ${String(data.error).substring(0, 50)}...`
//                                 : "Generation failed.";
//                             break;
//                     }
//                     const newStateUpdate: VideoGenerationState = {
//                         ...currentState,
//                         status:
//                             data.status === "canceled" ? "failed" : data.status,
//                         videoUrl: data.outputUrl ?? currentState.videoUrl,
//                         error: data.error ? String(data.error) : null,
//                         logs: data.logs ?? null,
//                         progress: progress,
//                         stageMessage: stageMessage,
//                     };
//                     if (
//                         ["succeeded", "failed", "canceled"].includes(
//                             data.status,
//                         )
//                     ) {
//                         stopPollingPrediction(predictionId);
//                         if (data.status === "succeeded") {
//                             if (!data.outputUrl) {
//                                 toast({
//                                     title: "Video Processed",
//                                     description: `Video for var ${variationId} finished, but no URL.`,
//                                     variant: "destructive",
//                                 });
//                                 newStateUpdate.status = "failed";
//                                 newStateUpdate.error =
//                                     "Succeeded but no output URL.";
//                             } else {
//                                 toast({
//                                     title: "Video Ready!",
//                                     description: `Video for var ${variationId} finished.`,
//                                 });
//                             }
//                         } else {
//                             toast({
//                                 title: "Video Failed",
//                                 description: `Video for var ${variationId} failed: ${data.error || "Unknown"}.`,
//                                 variant: "destructive",
//                             });
//                         }
//                     }
//                     return { ...prev, [variationId]: newStateUpdate };
//                 });
//             } catch (error: any) {
//                 stopPollingPrediction(predictionId);
//                 setVideoGenerationStates((prev) => {
//                     const currentState = prev[variationId];
//                     if (
//                         currentState &&
//                         currentState.predictionId === predictionId
//                     ) {
//                         return {
//                             ...prev,
//                             [variationId]: {
//                                 ...currentState,
//                                 status: "failed",
//                                 error: `Polling failed: ${error.message}`,
//                                 progress: 0,
//                                 stageMessage: "Polling Error",
//                             },
//                         };
//                     }
//                     return prev;
//                 });
//                 toast({
//                     variant: "destructive",
//                     title: "Polling Error",
//                     description: `Could not get video status: ${error.message}`,
//                 });
//             }
//         },
//         [stopPollingPrediction, toast],
//     );

//     const startPollingPrediction = useCallback(
//         (predictionId: string, variationId: number) => {
//             if (pollingIntervals.current[predictionId]) return; // Avoid duplicate polling
//             // Poll immediately, then set interval
//             pollPredictionStatus(predictionId, variationId);
//             pollingIntervals.current[predictionId] = setInterval(
//                 () => pollPredictionStatus(predictionId, variationId),
//                 5000,
//             );
//         },
//         [pollPredictionStatus],
//     );

//     // Cleanup polling intervals on component unmount
//     useEffect(() => {
//         return () => {
//             Object.values(pollingIntervals.current).forEach(clearInterval);
//             pollingIntervals.current = {};
//         };
//     }, []);

//     const startVideoGenerationMutation = useMutation({
//         mutationFn: async (variationId: number) => {
//             setVideoGenerationStates((prev) => ({
//                 ...prev,
//                 [variationId]: {
//                     status: "pending",
//                     error: null,
//                     videoUrl: null,
//                     predictionId: null,
//                     progress: 10,
//                     stageMessage: "Queueing video...",
//                 },
//             }));
//             const response = await apiRequest(
//                 "POST",
//                 `/api/variations/${variationId}/generate-video`,
//                 {},
//             );
//             const data = await response.json(); // Assuming backend sends { predictionId, status, message/error }
//             return { variationId, responseData: data };
//         },
//         onSuccess: (result) => {
//             const { variationId, responseData } = result;
//             if (
//                 responseData.predictionId &&
//                 responseData.status &&
//                 !["failed", "canceled"].includes(responseData.status)
//             ) {
//                 setVideoGenerationStates((prev) => ({
//                     ...prev,
//                     [variationId]: {
//                         status: responseData.status as VideoGenerationStatus,
//                         predictionId: responseData.predictionId,
//                         error: null,
//                         videoUrl: null,
//                         progress: 20,
//                         stageMessage: "Video job started...",
//                     },
//                 }));
//                 startPollingPrediction(responseData.predictionId, variationId);
//                 toast({
//                     title: "Video Generation Started",
//                     description: `Processing variation ${variationId}...`,
//                 });
//             } else {
//                 const errorMsg =
//                     responseData.message ||
//                     responseData.error ||
//                     "Failed to get valid prediction ID.";
//                 setVideoGenerationStates((prev) => ({
//                     ...prev,
//                     [variationId]: {
//                         status: "failed",
//                         error: errorMsg,
//                         predictionId: responseData.predictionId || null,
//                         progress: 0,
//                         stageMessage: `Error: ${String(errorMsg).substring(0, 30)}...`,
//                     },
//                 }));
//                 toast({
//                     title: "Video Start Failed",
//                     description: errorMsg,
//                     variant: "destructive",
//                 });
//             }
//         },
//         onError: (error: Error, variationId) => {
//             setVideoGenerationStates((prev) => ({
//                 ...prev,
//                 [variationId]: {
//                     status: "failed",
//                     error: `Failed to start: ${error.message}`,
//                     predictionId: null,
//                     progress: 0,
//                     stageMessage: "Request Error",
//                 },
//             }));
//             toast({
//                 variant: "destructive",
//                 title: "Request Error",
//                 description: `Could not start video generation for var ${variationId}: ${error.message}`,
//             });
//         },
//     });

//     const handleExport = async () => {
//         console.log("Export triggered");
//         setIsExporting(true);
//         /* ... actual export logic ... */ setIsExporting(false);
//     };
//     const handleSceneSelect = (sceneId: number) => {
//         if (activeSceneId !== sceneId) setActiveSceneId(sceneId);
//     };
//     const handleViewVideo = (videoUrl: string, title: string) => {
//         setCurrentVideoUrl(videoUrl);
//         setCurrentVideoTitle(title);
//         setIsVideoModalOpen(true);
//     };
//     const handleCloseVideoModal = () => {
//         setIsVideoModalOpen(false);
//         setCurrentVideoUrl(null);
//         setCurrentVideoTitle("");
//     };

//     const activeSceneObject = scenes.find((s: Scene) => s.id === activeSceneId);
//     const isPageLoading =
//         isLoadingScript || (!!script && isLoadingScenes && scenes.length === 0);
//     const isLoadingCurrentVariations =
//         !!activeSceneId && (isLoadingVariations || isFetchingVariations);
//     const displayScript = script
//         ? { id: script.id, title: script.title, content: script.content }
//         : null;

//     useEffect(() => {
//         if (
//             projectBudget === undefined ||
//             projectBudget === null ||
//             isNaN(projectBudget)
//         ) {
//             setProjectBudgetTierForCasting("any");
//         } else if (projectBudget < 1000000) {
//             setProjectBudgetTierForCasting("low");
//         } else if (projectBudget <= 20000000) {
//             setProjectBudgetTierForCasting("medium");
//         } else {
//             setProjectBudgetTierForCasting("high");
//         }
//     }, [projectBudget]);

//     // Query for suggested locations - Renamed 'isLoading' from this query to avoid conflict
//     const { data: suggestedLocationsData, isLoading: isLoadingSuggLocations } =
//         useQuery({
//             queryKey: [
//                 "/api/scenes/suggest-locations",
//                 activeSceneId,
//                 projectBudget,
//             ],
//             queryFn: async ({ queryKey }) => {
//                 const [, sceneId, budget] = queryKey;
//                 if (!sceneId) return [];
//                 const res = await apiRequest(
//                     "GET",
//                     `/api/scenes/${sceneId}/suggest-locations?budget=${budget || 0}`,
//                 );
//                 return res.json();
//             },
//             enabled: !!activeSceneId,
//         });

//     const { data: scriptCharacters, isLoading: isLoadingScriptCharacters } =
//         useQuery({
//             queryKey: ["/api/scripts/characters", script?.id],
//             queryFn: async ({ queryKey }) => {
//                 const [, scriptId] = queryKey;
//                 if (!scriptId) return [];
//                 const res = await apiRequest(
//                     "GET",
//                     `/api/scripts/${scriptId}/characters`,
//                 );
//                 return res.json();
//             },
//             enabled: !!script?.id,
//         });

//     if (isPageLoading) {
//         return (
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
//         );
//     }

//     if (isScriptError && !script && !isLoadingScript) {
//         return (
//             <div className="p-6 text-center text-red-600">
//                 <AlertTriangle className="inline-block mr-2" />
//                 Failed to load script data. Please try again later.
//             </div>
//         );
//     }
//     if (!script && !isLoadingScript) {
//         return (
//             <div className="p-6 text-center text-gray-500">
//                 <Info className="inline-block mr-2" />
//                 No script loaded. Please upload a script on the Welcome page.
//             </div>
//         );
//     }

//     return (
//         <>
//             <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//                 <SceneBreakdown
//                     scenes={scenes}
//                     activeSceneId={activeSceneId}
//                     brandableSceneIds={brandableSceneIds || []}
//                     isLoading={isLoadingScenes || isLoadingBrandableScenes}
//                     onSceneSelect={handleSceneSelect}
//                 />
//                 <div className="lg:col-span-3 space-y-6">
//                     <div className="bg-white rounded-lg shadow p-4">
//                         <ScriptDisplay
//                             script={displayScript}
//                             isLoading={false} // Script data itself is no longer loading at this point
//                             onSave={async () => {
//                                 console.warn("Save not implemented");
//                             }}
//                             onReanalyze={() => reanalyzeScriptMutation.mutate()}
//                             onGeneratePlacements={() =>
//                                 generatePlacementsMutation.mutate()
//                             }
//                             onExport={handleExport}
//                             activeScene={activeSceneObject || null}
//                             isSaving={false}
//                             isReanalyzing={reanalyzeScriptMutation.isPending}
//                             isGenerating={generatePlacementsMutation.isPending}
//                             isExporting={isExporting}
//                         />
//                     </div>
//                     {scenes.length > 0 && activeSceneId !== null ? (
//                         <div className="bg-white rounded-lg shadow p-4">
//                             <BrandableScenes
//                                 activeSceneDetails={activeSceneObject}
//                                 scenes={scenes}
//                                 productVariations={sceneVariations}
//                                 isLoading={isLoadingCurrentVariations}
//                                 selectedSceneId={activeSceneId}
//                                 onGenerateVideoRequest={(variationId) =>
//                                     startVideoGenerationMutation.mutate(
//                                         variationId,
//                                     )
//                                 }
//                                 videoGenerationStates={videoGenerationStates}
//                                 onViewVideo={handleViewVideo}
//                             />
//                         </div>
//                     ) : (
//                         activeSceneId === null &&
//                         scenes.length > 0 && (
//                             <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
//                                 <Info className="inline-block mr-2 h-5 w-5" />
//                                 Select a scene from the breakdown list to view
//                                 details and placement options.
//                             </div>
//                         )
//                     )}

//                     <Separator className="my-6" />

//                     {/* --- SUGGESTION AREA --- */}
//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                         {/* Location Suggestions */}
//                         <div className="bg-white rounded-lg shadow p-4">
//                             <h3 className="text-lg font-semibold text-foreground mb-3">
//                                 Optimizing funding: Suggested Filming Locations & Incentives
//                             </h3>
//                             <div className="mb-4">
//                                 <Label
//                                     htmlFor="projectBudget"
//                                     className="text-sm font-medium"
//                                 >
//                                     Estimated Project Budget ($)
//                                 </Label>
//                                 <div className="flex items-center space-x-2 mt-1">
//                                     <DollarSign className="h-5 w-5 text-muted-foreground" />
//                                     <Input
//                                         id="projectBudget"
//                                         type="number"
//                                         value={
//                                             projectBudget === undefined
//                                                 ? ""
//                                                 : projectBudget
//                                         }
//                                         onChange={(e) => {
//                                             const val = e.target.value;
//                                             setProjectBudget(
//                                                 val === ""
//                                                     ? undefined
//                                                     : parseInt(val, 10),
//                                             );
//                                         }}
//                                         placeholder="e.g., 1000000"
//                                         className="w-full"
//                                         step="100000"
//                                     />
//                                 </div>
//                             </div>
//                             <SuggestedLocations
//                                 activeScene={activeSceneObject || null}
//                                 projectBudget={projectBudget}
//                                 isLoading={isLoadingSuggLocations}
//                             />
//                         </div>

//                         {/* Character Casting */}
//                         <div className="bg-white rounded-lg shadow p-4">
//                             <h3 className="text-lg font-semibold text-foreground mb-3">
//                                 Character Casting Suggestions
//                             </h3>
//                             <CharacterCasting
//                                 scriptId={script?.id || null}
//                                 isLoading={isLoadingScriptCharacters}
//                                 filmGenre={filmGenreForCasting}
//                                 projectBudgetTier={projectBudgetTierForCasting}
//                             />
//                         </div>
//                     </div>
//                     {/* --- END SUGGESTION AREA --- */}
//                 </div>
//             </div>
//             <VideoPlayerModal
//                 isOpen={isVideoModalOpen}
//                 onClose={handleCloseVideoModal}
//                 videoUrl={currentVideoUrl}
//                 title={currentVideoTitle}
//             />
//         </>
//     );
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
import SuggestedLocations from "@/components/script/SuggestedLocations";
import CharacterCasting from "@/components/script/CharacterCasting";
import { Script, Scene, SceneVariation as SharedSceneVariation } from "@shared/schema"; // ProductCategory removed as not directly used
import { Info, Loader2, AlertTriangle, DollarSign } from "lucide-react"; // Removed unused icons
// Button, Skeleton, Input, Label, Separator are used within sub-components or implicitly
import { SceneVariation, ScriptCharacter } from "@/lib/types"; // Ensure ScriptCharacter is imported if used by CharacterCasting

type VideoGenerationStatus =
    | "idle"
    | "pending"
    | "generating"
    | "succeeded"
    | "failed";
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

const DEFAULT_PROJECT_BUDGET = 1000000;
const DEFAULT_FILM_GENRE = "ACTION";

export default function ScriptEditor() {
    const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isExporting, setIsExporting] = useState(false); // Kept if export functionality is planned
    const [videoGenerationStates, setVideoGenerationStates] = useState<{ [key: number]: VideoGenerationState }>({});
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
    const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
    const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

    const [projectBudget, setProjectBudget] = useState<number | undefined>(DEFAULT_PROJECT_BUDGET);
    const [filmGenreForCasting, setFilmGenreForCasting] = useState<string>(DEFAULT_FILM_GENRE);
    const [projectBudgetTierForCasting, setProjectBudgetTierForCasting] = useState<'low' | 'medium' | 'high' | 'any'>("medium");

    // --- Queries ---
    const {
        data: script,
        isLoading: isLoadingScript,
        isError: isScriptError,
        error: scriptError,
    } = useQuery<Script | null>({
        queryKey: ["/api/scripts/current"],
        refetchOnWindowFocus: false, // Usually good for primary data
    });

    const {
        data: scenes = [],
        isLoading: isLoadingScenes,
    } = useQuery<Scene[]>({
        queryKey: ["/api/scripts/scenes", script?.id], // Key by script.id
        enabled: !!script?.id, // Only fetch if script is loaded
    });

    const {
        data: brandableSceneObjects = [],
        isLoading: isLoadingBrandableScenes,
        refetch: refetchBrandableScenes,
    } = useQuery<Scene[]>({
        queryKey: ["/api/scripts/brandable-scenes", script?.id], // Key by script.id
        enabled: !!script?.id && scenes.length > 0,
    });
    const brandableSceneIds = brandableSceneObjects.map(scene => scene.id);

    const {
        data: sceneVariations = [],
        isLoading: isLoadingVariations,
        isFetching: isFetchingVariations,
    } = useQuery<SceneVariation[]>({
        queryKey: ["/api/scripts/scene-variations", activeSceneId],
        enabled: !!activeSceneId,
        staleTime: 1 * 60 * 1000, // Cache for 1 min
        refetchOnWindowFocus: false,
        onSuccess: (data) => {
            if (activeSceneId && data.length > 0) {
                const currentSceneObject = scenes.find(s => s.id === activeSceneId);
                if (currentSceneObject && !brandableSceneIds.includes(activeSceneId)) {
                    refetchBrandableScenes();
                }
            }
        }
    });

    // Query for script characters
    const { data: scriptCharacters = [], isLoading: isLoadingScriptCharacters } = useQuery<ScriptCharacter[]>({
        queryKey: ['/api/scripts/characters', script?.id],
        queryFn: async ({ queryKey }) => {
            const [, sId] = queryKey as [string, number | undefined];
            if (!sId) return [];
            const res = await apiRequest("GET", `/api/scripts/${sId}/characters`);
            return res.json();
        },
        enabled: !!script?.id,
    });


    // Effect to reset states when script context changes (e.g., new script loaded or script becomes null)
    useEffect(() => {
        console.log("[ScriptEditor] Script context changed. Current script ID:", script?.id);
        setActiveSceneId(null); // Deselect any active scene
        setVideoGenerationStates({}); // Clear video generation states
        setProjectBudget(DEFAULT_PROJECT_BUDGET);
        setFilmGenreForCasting(DEFAULT_FILM_GENRE);
        // projectBudgetTierForCasting will update via its own useEffect

        // Clear any active polling intervals
        Object.values(pollingIntervals.current).forEach(clearInterval);
        pollingIntervals.current = {};

    }, [script?.id]); // Depend on script.id


    // Effect to reset video states and polling when activeSceneId changes (within the same script)
    useEffect(() => {
        setVideoGenerationStates({});
        Object.values(pollingIntervals.current).forEach(clearInterval);
        pollingIntervals.current = {};
    }, [activeSceneId]);

    // Effect to update budget tier for casting based on projectBudget
    useEffect(() => {
        if (projectBudget === undefined || projectBudget === null || isNaN(projectBudget)) {
            setProjectBudgetTierForCasting("any");
        } else if (projectBudget < 1000000) {
            setProjectBudgetTierForCasting("low");
        } else if (projectBudget <= 20000000) {
            setProjectBudgetTierForCasting("medium");
        } else {
            setProjectBudgetTierForCasting("high");
        }
    }, [projectBudget]);


    // --- Mutations ---
    const reanalyzeScriptMutation = useMutation({ // Kept for completeness
        mutationFn: async () => apiRequest("POST", "/api/scripts/analyze", {}),
        onSuccess: () => {
            toast({ title: "Analysis complete", description: "Script re-analyzed." });
            queryClient.invalidateQueries({ queryKey: ["/api/scripts/brandable-scenes", script?.id] });
            queryClient.invalidateQueries({ queryKey: ["/api/scripts/scenes", script?.id] });
            if (activeSceneId) {
                queryClient.invalidateQueries({ queryKey: ["/api/scripts/scene-variations", activeSceneId] });
            }
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Analysis failed", description: error.message });
        }
    });

    // This mutation might not be strictly needed if BrandableScenes directly fetches on scene selection
    const generatePlacementsMutation = useMutation({
        mutationFn: async () => {
            if (activeSceneId) {
                return queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations', activeSceneId] });
            }
            // If no active scene, maybe invalidate all to ensure fresh data if user selects one later
            return queryClient.invalidateQueries({ queryKey: ['/api/scripts/scene-variations'] });
        },
        onSuccess: () => {
            toast({ title: "Placement Generation Triggered", description: "Visual options will be generated for the selected scene." });
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Generation Trigger Failed", description: error.message });
        }
    });

    const stopPollingPrediction = useCallback((predictionId: string) => {
        if (pollingIntervals.current[predictionId]) {
            clearInterval(pollingIntervals.current[predictionId]);
            delete pollingIntervals.current[predictionId];
        }
    }, []);

    const pollPredictionStatus = useCallback(async (predictionId: string, variationId: number) => {
        try {
            const response = await fetch(`/api/replicate/predictions/${predictionId}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText || 'Failed to fetch status'}`);
            }
            const data: PredictionStatusResult = await response.json();

            setVideoGenerationStates(prev => {
                const currentState = prev[variationId];
                if (!currentState || currentState.predictionId !== predictionId || currentState.status === 'succeeded' || currentState.status === 'failed') {
                    stopPollingPrediction(predictionId); return prev;
                }
                let progress = currentState.progress || 0;
                let stageMessage = currentState.stageMessage || "Processing...";
                switch (data.status) {
                    case 'starting': progress = 25; stageMessage = "Initializing video engine..."; break;
                    case 'processing': progress = Math.max(progress || 0, 40); if (data.logs) { if (data.logs.toLowerCase().includes("frame generation")) progress = 50; if (data.logs.toLowerCase().includes("upscaling")) progress = 75; } stageMessage = "Generating video frames..."; break;
                    case 'succeeded': progress = 100; stageMessage = "Video ready!"; break;
                    case 'failed': case 'canceled': progress = 0; stageMessage = data.error ? `Failed: ${String(data.error).substring(0, 50)}...` : "Generation failed."; break;
                }
                const newStateUpdate: VideoGenerationState = { ...currentState, status: data.status === 'canceled' ? 'failed' : data.status, videoUrl: data.outputUrl ?? currentState.videoUrl, error: data.error ? String(data.error) : null, logs: data.logs ?? null, progress: progress, stageMessage: stageMessage, };
                if (['succeeded', 'failed', 'canceled'].includes(data.status)) {
                    stopPollingPrediction(predictionId);
                    if (data.status === 'succeeded') { if (!data.outputUrl) { toast({ title: "Video Processed", description: `Video for var ${variationId} finished, but no URL.`, variant: "destructive" }); newStateUpdate.status = 'failed'; newStateUpdate.error = "Succeeded but no output URL."; } else { toast({ title: "Video Ready!", description: `Video for var ${variationId} finished.` }); } }
                    else { toast({ title: "Video Failed", description: `Video for var ${variationId} failed: ${data.error || 'Unknown'}.`, variant: "destructive" }); }
                }
                return { ...prev, [variationId]: newStateUpdate };
            });
        } catch (error: any) {
            stopPollingPrediction(predictionId);
            setVideoGenerationStates(prev => { const currentState = prev[variationId]; if (currentState && currentState.predictionId === predictionId) { return { ...prev, [variationId]: { ...currentState, status: 'failed', error: `Polling failed: ${error.message}`, progress: 0, stageMessage: "Polling Error" } }; } return prev; });
            toast({ variant: "destructive", title: "Polling Error", description: `Could not get video status: ${error.message}` });
        }
    }, [stopPollingPrediction, toast]);

    const startPollingPrediction = useCallback((predictionId: string, variationId: number) => {
        if (pollingIntervals.current[predictionId]) return;
        const initialTimeout = setTimeout(() => pollPredictionStatus(predictionId, variationId), 2000); // Ensure initial check happens
        pollingIntervals.current[predictionId] = setInterval(() => pollPredictionStatus(predictionId, variationId), 5000);
    }, [pollPredictionStatus]);

    useEffect(() => { // Cleanup polling intervals on component unmount
        return () => { Object.values(pollingIntervals.current).forEach(clearInterval); pollingIntervals.current = {}; };
    }, []);

    const startVideoGenerationMutation = useMutation({
        mutationFn: async (variationId: number) => {
            setVideoGenerationStates(prev => ({ ...prev, [variationId]: { status: 'pending', error: null, videoUrl: null, predictionId: null, progress: 10, stageMessage: "Queueing video..." } }));
            const response = await apiRequest("POST", `/api/variations/${variationId}/generate-video`, {});
            const data = await response.json();
            return { variationId, responseData: data };
        },
        onSuccess: (result) => {
            const { variationId, responseData } = result;
            if (responseData.predictionId && responseData.status && !['failed', 'canceled'].includes(responseData.status)) {
                setVideoGenerationStates(prev => ({ ...prev, [variationId]: { status: responseData.status as VideoGenerationStatus, predictionId: responseData.predictionId, error: null, videoUrl: null, progress: 20, stageMessage: "Video job started..." } }));
                startPollingPrediction(responseData.predictionId, variationId);
                toast({ title: "Video Generation Started", description: `Processing variation ${variationId}...` });
            } else {
                const errorMsg = responseData.message || responseData.error || 'Failed to get valid prediction ID.';
                setVideoGenerationStates(prev => ({ ...prev, [variationId]: { status: 'failed', error: errorMsg, predictionId: responseData.predictionId || null, progress: 0, stageMessage: `Error: ${String(errorMsg).substring(0, 30)}...` } }));
                toast({ title: "Video Start Failed", description: errorMsg, variant: "destructive" });
            }
        },
        onError: (error: Error, variationId) => {
            setVideoGenerationStates(prev => ({ ...prev, [variationId]: { status: 'failed', error: `Failed to start: ${error.message}`, predictionId: null, progress: 0, stageMessage: "Request Error" } }));
            toast({ variant: "destructive", title: "Request Error", description: `Could not start video generation for var ${variationId}: ${error.message}` });
        },
    });

    const handleExport = async () => { console.log("Export triggered"); setIsExporting(true); /* ... actual export logic ... */ setIsExporting(false); };
    const handleSceneSelect = (sceneId: number) => { if (activeSceneId !== sceneId) setActiveSceneId(sceneId); };
    const handleViewVideo = (videoUrl: string, title: string) => { setCurrentVideoUrl(videoUrl); setCurrentVideoTitle(title); setIsVideoModalOpen(true); };
    const handleCloseVideoModal = () => { setIsVideoModalOpen(false); setCurrentVideoUrl(null); setCurrentVideoTitle(""); };

    const activeSceneObject = scenes.find((s: Scene) => s.id === activeSceneId);
    const isPageLoading = isLoadingScript; // Simplified page loading state
    const isLoadingCurrentVariations = !!activeSceneId && (isLoadingVariations || isFetchingVariations);
    const displayScript = script ? { id: script.id, title: script.title, content: script.content } : null;


    if (isPageLoading) {
        return (
            <div className="space-y-6 p-4 animate-pulse">
                {/* Simulating header/title area */}
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 space-y-2">
                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded"></div>)}
                    </div>
                    <div className="lg:col-span-3 space-y-6">
                        <div className="h-64 bg-gray-200 rounded"></div>
                        <div className="h-96 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (isScriptError && !script) { // Added !script to ensure it only shows if script is truly not loaded
        return (
            <div className="p-6 text-center text-red-600 flex flex-col items-center justify-center h-full">
                <AlertTriangle className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-semibold">Error Loading Script</h2>
                <p>{(scriptError as Error)?.message || "An unknown error occurred. Please try again later."}</p>
            </div>
        );
    }

    if (!script) { // If no script is loaded (e.g., first visit or after an error/clear)
        return (
            <div className="p-6 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                <Info className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-semibold">No Script Loaded</h2>
                <p>Please upload a script via the Welcome page to begin.</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <SceneBreakdown
                    scenes={scenes}
                    activeSceneId={activeSceneId}
                    brandableSceneIds={brandableSceneIds || []}
                    isLoading={isLoadingScenes || isLoadingBrandableScenes}
                    onSceneSelect={handleSceneSelect}
                />
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <ScriptDisplay
                            script={displayScript}
                            isLoading={false} // Script itself is loaded by this point
                            onSave={async () => { console.warn("Save not implemented") }}
                            onReanalyze={() => reanalyzeScriptMutation.mutate()}
                            onGeneratePlacements={() => generatePlacementsMutation.mutate()}
                            onExport={handleExport}
                            activeScene={activeSceneObject || null}
                            isSaving={false} // Placeholder
                            isReanalyzing={reanalyzeScriptMutation.isPending}
                            isGenerating={generatePlacementsMutation.isPending}
                            isExporting={isExporting}
                        />
                    </div>
                    {scenes.length > 0 && activeSceneId !== null && activeSceneObject ? (
                        <div className="bg-white rounded-lg shadow p-4">
                            <BrandableScenes
                                activeSceneDetails={activeSceneObject}
                                scenes={scenes}
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
                    {/* --- SUGGESTION AREA (Only if script is loaded) --- */}
                    {script && (
                        <>
                            <div className="my-6 border-t border-gray-200"></div> {/* Visual Separator */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-lg shadow p-4">
                                    <h3 className="text-lg font-semibold text-foreground mb-3">Optimizing funding: Suggested Filming Locations & Incentives</h3>
                                    <div className="mb-4">
                                        <label htmlFor="projectBudget" className="text-sm font-medium text-gray-700">Estimated Project Budget ($)</label>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <DollarSign className="h-5 w-5 text-gray-400" />
                                            <input
                                                id="projectBudget"
                                                type="number"
                                                value={projectBudget === undefined ? "" : projectBudget}
                                                onChange={(e) => { const val = e.target.value; setProjectBudget(val === "" ? undefined : parseInt(val, 10)); }}
                                                placeholder="e.g., 1000000"
                                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                                step="100000"
                                            />
                                        </div>
                                    </div>
                                    <SuggestedLocations
                                        scriptId={script?.id || null}
                                        projectBudget={projectBudget}
                                        isLoading={isLoadingScenes} // Simplified, can be refined if distinct loading for suggestions is needed
                                    />
                                </div>
                                <div className="bg-white rounded-lg shadow p-4">
                                    <h3 className="text-lg font-semibold text-foreground mb-3">Character Casting Suggestions</h3>
                                    <CharacterCasting
                                        scriptId={script?.id || null}
                                        isLoading={isLoadingScriptCharacters}
                                        filmGenre={filmGenreForCasting}
                                        projectBudgetTier={projectBudgetTierForCasting}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <VideoPlayerModal
                isOpen={isVideoModalOpen}
                onClose={handleCloseVideoModal}
                videoUrl={currentVideoUrl}
                title={currentVideoTitle}
            />
        </>
    );
}