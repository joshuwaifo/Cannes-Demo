// client/src/pages/ScriptEditor.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SceneBreakdown from "@/components/script/SceneBreakdown";
import ScriptDisplay from "@/components/script/ScriptDisplay";
import BrandableScenes from "@/components/script/BrandableScenes";
import VideoPlayerModal from "@/components/script/VideoPlayerModal";
import ImageZoomModal from "@/components/script/ImageZoomModal"; 
import SuggestedLocations from "@/components/script/SuggestedLocations";
import CharacterCasting from "@/components/script/CharacterCasting";
import {
    Script,
    Scene,
    SceneVariation as SharedSceneVariation,
    Actor,
    Location,
    Product,
} from "@shared/schema";
import { 
    Info, 
    Loader2, 
    AlertTriangle, 
    DollarSign, 
    PieChart, 
    BarChart, 
    ChevronDown, 
    CheckCircle, 
    Image as ImageIcon,
    ZoomIn,
    PlayCircle
} from "lucide-react";
import { SceneVariation, ScriptCharacter, ActorSuggestion, ClientSuggestedLocation } from "@/lib/types";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
    const [isExporting, setIsExporting] = useState(false);
    const [videoGenerationStates, setVideoGenerationStates] = useState<{
        [key: number]: VideoGenerationState;
    }>({});
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
    const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");

    // State for Image Zoom Modal
    const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [zoomedImageTitle, setZoomedImageTitle] = useState<string>("");
    
    // State for selected items
    const [selectedCharacters, setSelectedCharacters] = useState<ScriptCharacter[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<ClientSuggestedLocation[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<SceneVariation[]>([]);
    
    // State for financial analysis modal
    const [isFinancialAnalysisModalOpen, setIsFinancialAnalysisModalOpen] = useState(false);
    const [projectName, setProjectName] = useState<string>("");
    const [expectedReleaseDate, setExpectedReleaseDate] = useState<string>("");
    const [totalBudget, setTotalBudget] = useState<number>(DEFAULT_PROJECT_BUDGET);
    
    // State for info modal
    const [isSelectionInfoModalOpen, setIsSelectionInfoModalOpen] = useState(false);

    const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

    const [projectBudget, setProjectBudget] = useState<number | undefined>(
        DEFAULT_PROJECT_BUDGET,
    );
    const [filmGenreForCasting, setFilmGenreForCasting] =
        useState<string>(DEFAULT_FILM_GENRE);
    const [projectBudgetTierForCasting, setProjectBudgetTierForCasting] =
        useState<"low" | "medium" | "high" | "any">("medium");

    // --- Queries ---
    const {
        data: script,
        isLoading: isLoadingScript,
        isError: isScriptError,
        error: scriptError,
    } = useQuery<Script | null>({
        queryKey: ["/api/scripts/current"],
        refetchOnWindowFocus: false,
    });

    const { data: scenes = [], isLoading: isLoadingScenes } = useQuery<Scene[]>(
        {
            queryKey: ["/api/scripts/scenes", script?.id],
            enabled: !!script?.id,
        },
    );

    const {
        data: brandableSceneObjects = [],
        isLoading: isLoadingBrandableScenes,
        refetch: refetchBrandableScenes,
    } = useQuery<Scene[]>({
        queryKey: ["/api/scripts/brandable-scenes", script?.id],
        enabled: !!script?.id && scenes.length > 0,
    });
    const brandableSceneIds = brandableSceneObjects.map((scene) => scene.id);

    const {
        data: sceneVariations = [],
        isLoading: isLoadingVariations,
        isFetching: isFetchingVariations,
    } = useQuery<SceneVariation[]>({
        queryKey: ["/api/scripts/scene-variations", activeSceneId],
        enabled: !!activeSceneId,
        staleTime: 1 * 60 * 1000,
        refetchOnWindowFocus: false,
        onSuccess: (data) => {
            if (activeSceneId && data.length > 0) {
                const currentSceneObject = scenes.find(
                    (s) => s.id === activeSceneId,
                );
                if (
                    currentSceneObject &&
                    !brandableSceneIds.includes(activeSceneId)
                ) {
                    refetchBrandableScenes();
                }
            }
        },
    });

    const {
        data: scriptCharacters = [],
        isLoading: isLoadingScriptCharacters,
    } = useQuery<ScriptCharacter[]>({
        queryKey: ["/api/scripts/characters", script?.id],
        queryFn: async ({ queryKey }) => {
            const [, sId] = queryKey as [string, number | undefined];
            if (!sId) return [];
            const res = await apiRequest(
                "GET",
                `/api/scripts/${sId}/characters`,
            );
            return res.json();
        },
        enabled: !!script?.id,
    });

    useEffect(() => {
        setActiveSceneId(null);
        setVideoGenerationStates({});
        setProjectBudget(DEFAULT_PROJECT_BUDGET);
        setFilmGenreForCasting(DEFAULT_FILM_GENRE);
        Object.values(pollingIntervals.current).forEach(clearInterval);
        pollingIntervals.current = {};
    }, [script?.id]);

    useEffect(() => {
        setVideoGenerationStates({});
        Object.values(pollingIntervals.current).forEach(clearInterval);
        pollingIntervals.current = {};
    }, [activeSceneId]);

    useEffect(() => {
        if (
            projectBudget === undefined ||
            projectBudget === null ||
            isNaN(projectBudget)
        ) {
            setProjectBudgetTierForCasting("any");
        } else if (projectBudget < 1000000) {
            setProjectBudgetTierForCasting("low");
        } else if (projectBudget <= 20000000) {
            setProjectBudgetTierForCasting("medium");
        } else {
            setProjectBudgetTierForCasting("high");
        }
    }, [projectBudget]);

    const reanalyzeScriptMutation = useMutation({
        mutationFn: async () => apiRequest("POST", "/api/scripts/analyze", {}),
        onSuccess: () => {
            toast({
                title: "Analysis complete",
                description: "Script re-analyzed.",
            });
            queryClient.invalidateQueries({
                queryKey: ["/api/scripts/brandable-scenes", script?.id],
            });
            queryClient.invalidateQueries({
                queryKey: ["/api/scripts/scenes", script?.id],
            });
            if (activeSceneId) {
                queryClient.invalidateQueries({
                    queryKey: ["/api/scripts/scene-variations", activeSceneId],
                });
            }
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "Analysis failed",
                description: error.message,
            });
        },
    });

    const generatePlacementsMutation = useMutation({
        mutationFn: async () => {
            if (activeSceneId) {
                return queryClient.invalidateQueries({
                    queryKey: ["/api/scripts/scene-variations", activeSceneId],
                });
            }
            return queryClient.invalidateQueries({
                queryKey: ["/api/scripts/scene-variations"],
            });
        },
        onSuccess: () => {
            toast({
                title: "Placement Generation Triggered",
                description:
                    "Visual options will be generated for the selected scene.",
            });
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "Generation Trigger Failed",
                description: error.message,
            });
        },
    });

    const stopPollingPrediction = useCallback((predictionId: string) => {
        if (pollingIntervals.current[predictionId]) {
            clearInterval(pollingIntervals.current[predictionId]);
            delete pollingIntervals.current[predictionId];
        }
    }, []);

    const pollPredictionStatus = useCallback(
        async (predictionId: string, variationId: number) => {
            try {
                const response = await fetch(
                    `/api/replicate/predictions/${predictionId}`,
                );
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `API error ${response.status}: ${errorText || "Failed to fetch status"}`,
                    );
                }
                const data: PredictionStatusResult = await response.json();

                setVideoGenerationStates((prev) => {
                    // ... (rest of the polling logic remains the same)
                    const currentState = prev[variationId];
                    if (
                        !currentState ||
                        currentState.predictionId !== predictionId ||
                        currentState.status === "succeeded" ||
                        currentState.status === "failed"
                    ) {
                        stopPollingPrediction(predictionId);
                        return prev;
                    }
                    let progress = currentState.progress || 0;
                    let stageMessage =
                        currentState.stageMessage || "Processing...";
                    // Ensure visual state updates properly by always setting to "generating" for active states
                    let updatedStatus = currentState.status;
                    
                    switch (data.status) {
                        case "starting":
                            progress = 30;
                            stageMessage = "Initializing video engine...";
                            updatedStatus = "generating"; // Force to generating for visibility
                            break;
                        case "processing":
                            progress = Math.max(progress || 0, 50);
                            updatedStatus = "generating"; // Force to generating for visibility
                            
                            if (data.logs) {
                                if (
                                    data.logs
                                        .toLowerCase()
                                        .includes("frame generation")
                                ) {
                                    progress = 65;
                                    stageMessage = "Creating video frames...";
                                }
                                if (
                                    data.logs
                                        .toLowerCase()
                                        .includes("upscaling")
                                ) {
                                    progress = 85;
                                    stageMessage = "Enhancing video quality...";
                                }
                            } else {
                                stageMessage = "Processing your video...";
                            }
                            break;
                        case "succeeded":
                            progress = 100;
                            stageMessage = "Video ready!";
                            updatedStatus = "succeeded";
                            break;
                        case "failed":
                        case "canceled":
                            progress = 0;
                            stageMessage = data.error
                                ? `Failed: ${String(data.error).substring(0, 50)}...`
                                : "Generation failed.";
                            updatedStatus = "failed";
                            break;
                    }
                    const newStateUpdate: VideoGenerationState = {
                        ...currentState,
                        status: updatedStatus, // Use our properly mapped status
                        videoUrl: data.outputUrl ?? currentState.videoUrl,
                        error: data.error ? String(data.error) : null,
                        logs: data.logs ?? null,
                        progress: progress,
                        stageMessage: stageMessage,
                    };
                    if (
                        ["succeeded", "failed", "canceled"].includes(
                            data.status,
                        )
                    ) {
                        stopPollingPrediction(predictionId);
                        if (data.status === "succeeded") {
                            if (!data.outputUrl) {
                                toast({
                                    title: "Video Processed",
                                    description: `Video for var ${variationId} finished, but no URL.`,
                                    variant: "destructive",
                                });
                                newStateUpdate.status = "failed";
                                newStateUpdate.error =
                                    "Succeeded but no output URL.";
                            } else {
                                toast({
                                    title: "Video Ready!",
                                    description: `Video for variation ${variationId} is now available. Click "View Video" to watch it.`,
                                    duration: 6000, // Show this toast longer for better visibility
                                });
                            }
                        } else {
                            toast({
                                title: "Video Failed",
                                description: `Video for var ${variationId} failed: ${data.error || "Unknown"}.`,
                                variant: "destructive",
                            });
                        }
                    }
                    return { ...prev, [variationId]: newStateUpdate };
                });
            } catch (error: any) {
                stopPollingPrediction(predictionId);
                setVideoGenerationStates((prev) => {
                    const currentState = prev[variationId];
                    if (
                        currentState &&
                        currentState.predictionId === predictionId
                    ) {
                        return {
                            ...prev,
                            [variationId]: {
                                ...currentState,
                                status: "failed",
                                error: `Polling failed: ${error.message}`,
                                progress: 0,
                                stageMessage: "Polling Error",
                            },
                        };
                    }
                    return prev;
                });
                toast({
                    variant: "destructive",
                    title: "Polling Error",
                    description: `Could not get video status: ${error.message}`,
                });
            }
        },
        [stopPollingPrediction, toast],
    );

    const startPollingPrediction = useCallback(
        (predictionId: string, variationId: number) => {
            if (pollingIntervals.current[predictionId]) return;
            const initialTimeout = setTimeout(
                () => pollPredictionStatus(predictionId, variationId),
                2000,
            );
            pollingIntervals.current[predictionId] = setInterval(
                () => pollPredictionStatus(predictionId, variationId),
                5000,
            );
        },
        [pollPredictionStatus],
    );

    useEffect(() => {
        return () => {
            Object.values(pollingIntervals.current).forEach(clearInterval);
            pollingIntervals.current = {};
        };
    }, []);

    const startVideoGenerationMutation = useMutation({
        mutationFn: async (variationId: number) => {
            // Set initial pending state with visual feedback
            setVideoGenerationStates((prev) => ({
                ...prev,
                [variationId]: {
                    status: "pending",
                    error: null,
                    videoUrl: null,
                    predictionId: null,
                    progress: 10,
                    stageMessage: "Queueing video...",
                },
            }));
            
            // Toast notification for better visual feedback
            toast({
                title: "Starting Video Generation",
                description: "Connecting to video service...",
                duration: 3000,
            });
            
            // Make the API request
            const response = await apiRequest(
                "POST",
                `/api/variations/${variationId}/generate-video`,
                {},
            );
            const data = await response.json();
            return { variationId, responseData: data };
        },
        onSuccess: (result) => {
            const { variationId, responseData } = result;
            console.log("Video generation response:", responseData);
            
            if (
                responseData.predictionId &&
                responseData.status &&
                !["failed", "canceled"].includes(responseData.status)
            ) {
                // Force state to "generating" for clear visual feedback
                setVideoGenerationStates((prev) => ({
                    ...prev,
                    [variationId]: {
                        status: "generating",
                        predictionId: responseData.predictionId,
                        error: null,
                        videoUrl: null,
                        progress: 20,
                        stageMessage: "Creating your video...",
                    },
                }));
                
                // Start polling for status updates
                startPollingPrediction(responseData.predictionId, variationId);
                
                // Toast notification with clear instructions
                toast({
                    title: "Video Generation Started",
                    description: `Processing has begun. The button will update when your video is ready.`,
                    duration: 5000, // Show this toast a bit longer
                });
            } else {
                const errorMsg =
                    responseData.message ||
                    responseData.error ||
                    "Failed to get valid prediction ID.";
                setVideoGenerationStates((prev) => ({
                    ...prev,
                    [variationId]: {
                        status: "failed",
                        error: errorMsg,
                        predictionId: responseData.predictionId || null,
                        progress: 0,
                        stageMessage: `Error: ${String(errorMsg).substring(0, 30)}...`,
                    },
                }));
                toast({
                    title: "Video Start Failed",
                    description: errorMsg,
                    variant: "destructive",
                });
            }
        },
        onError: (error: Error, variationId) => {
            // ... (rest of the error logic remains the same)
            setVideoGenerationStates((prev) => ({
                ...prev,
                [variationId]: {
                    status: "failed",
                    error: `Failed to start: ${error.message}`,
                    predictionId: null,
                    progress: 0,
                    stageMessage: "Request Error",
                },
            }));
            toast({
                variant: "destructive",
                title: "Request Error",
                description: `Could not start video generation for var ${variationId}: ${error.message}`,
            });
        },
    });

    const handleExport = async () => {
        console.log("Export triggered");
        setIsExporting(true);
        setIsExporting(false);
    };
    const handleSceneSelect = (sceneId: number) => {
        if (activeSceneId !== sceneId) setActiveSceneId(sceneId);
    };
    const handleViewVideo = (videoUrl: string, title: string) => {
        setCurrentVideoUrl(videoUrl);
        setCurrentVideoTitle(title);
        setIsVideoModalOpen(true);
    };
    const handleCloseVideoModal = () => {
        setIsVideoModalOpen(false);
        setCurrentVideoUrl(null);
        setCurrentVideoTitle("");
    };

    // Handler for image zoom
    const handleImageZoom = (imageUrl: string, title: string) => {
        setZoomedImageUrl(imageUrl);
        setZoomedImageTitle(title);
        setIsImageZoomModalOpen(true);
    };
    const handleCloseImageZoomModal = () => {
        setIsImageZoomModalOpen(false);
        setZoomedImageUrl(null);
        setZoomedImageTitle("");
    };
    
    // Selection management functions
    const handleCharacterSelection = (character: ScriptCharacter) => {
        setSelectedCharacters(prev => {
            const exists = prev.some(c => c.name === character.name);
            if (exists) {
                return prev.filter(c => c.name !== character.name);
            } else {
                return [...prev, character];
            }
        });
    };
    
    const handleLocationSelection = (location: ClientSuggestedLocation) => {
        setSelectedLocations(prev => {
            const exists = prev.some(l => l.id === location.id);
            if (exists) {
                return prev.filter(l => l.id !== location.id);
            } else {
                return [...prev, location];
            }
        });
    };
    
    const handleProductSelection = (product: SceneVariation) => {
        setSelectedProducts(prev => {
            const exists = prev.some(p => p.id === product.id);
            if (exists) {
                return prev.filter(p => p.id !== product.id);
            } else {
                return [...prev, product];
            }
        });
    };
    
    const openSelectionInfoModal = () => {
        setIsSelectionInfoModalOpen(true);
    };
    
    const closeSelectionInfoModal = () => {
        setIsSelectionInfoModalOpen(false);
    };
    
    const openFinancialAnalysisModal = () => {
        // Set the project name to the script title by default
        setProjectName(script?.title || "");
        setIsFinancialAnalysisModalOpen(true);
    };
    
    const closeFinancialAnalysisModal = () => {
        setIsFinancialAnalysisModalOpen(false);
    };

    const activeSceneObject = scenes.find((s: Scene) => s.id === activeSceneId);
    const isPageLoading = isLoadingScript;
    const isLoadingCurrentVariations =
        !!activeSceneId && (isLoadingVariations || isFetchingVariations);
    const displayScript = script
        ? { id: script.id, title: script.title, content: script.content }
        : null;

    if (isPageLoading) {
        return (
            <div className="space-y-6 p-4 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 space-y-2">
                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-10 bg-gray-200 rounded"
                            ></div>
                        ))}
                    </div>
                    <div className="lg:col-span-3 space-y-6">
                        <div className="h-64 bg-gray-200 rounded"></div>
                        <div className="h-96 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (isScriptError && !script) {
        return (
            <div className="p-6 text-center text-red-600 flex flex-col items-center justify-center h-full">
                <AlertTriangle className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-semibold">Error Loading Script</h2>
                <p>
                    {(scriptError as Error)?.message ||
                        "An unknown error occurred. Please try again later."}
                </p>
            </div>
        );
    }

    if (!script) {
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
            {script && (
                <div className="flex justify-between items-center mb-4 px-1">
                    <h1 className="text-2xl font-bold text-gray-800">
                        Script Analysis: {/* Changed "Editor" to "Analysis" */}
                        <span className="text-primary">{script.title}</span>
                    </h1>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="rounded-full" 
                        onClick={openSelectionInfoModal}
                        title="View selected items"
                    >
                        <Info className="h-5 w-5" />
                    </Button>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <SceneBreakdown
                    scenes={scenes}
                    activeSceneId={activeSceneId}
                    projectTitle={script?.title}
                    brandableSceneIds={brandableSceneIds || []}
                    isLoading={isLoadingScenes || isLoadingBrandableScenes}
                    onSceneSelect={handleSceneSelect}
                />
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <ScriptDisplay
                            script={displayScript}
                            isLoading={false}
                            onSave={async () => {
                                console.warn("Save not implemented");
                            }}
                            onReanalyze={() => reanalyzeScriptMutation.mutate()}
                            onGeneratePlacements={() =>
                                generatePlacementsMutation.mutate()
                            }
                            onExport={handleExport}
                            activeScene={activeSceneObject || null}
                            isSaving={false}
                            isReanalyzing={reanalyzeScriptMutation.isPending}
                            isGenerating={generatePlacementsMutation.isPending}
                            isExporting={isExporting}
                        />
                    </div>
                    {scenes.length > 0 &&
                    activeSceneId !== null &&
                    activeSceneObject ? (
                        <div className="bg-white rounded-lg shadow p-4">
                            <BrandableScenes
                                activeSceneDetails={activeSceneObject}
                                projectTitle={script?.title}
                                scenes={scenes}
                                productVariations={sceneVariations}
                                isLoading={isLoadingCurrentVariations}
                                selectedSceneId={activeSceneId}
                                onGenerateVideoRequest={(variationId) =>
                                    startVideoGenerationMutation.mutate(
                                        variationId,
                                    )
                                }
                                videoGenerationStates={videoGenerationStates}
                                onViewVideo={handleViewVideo}
                                onImageZoom={handleImageZoom}
                                selectedProducts={selectedProducts}
                                onProductSelect={handleProductSelection}
                            />
                        </div>
                    ) : (
                        activeSceneId === null &&
                        scenes.length > 0 && (
                            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                                <Info className="inline-block mr-2 h-5 w-5" />
                                Select a scene from the breakdown list to view
                                details and placement options.
                            </div>
                        )
                    )}
                    {script && (
                        <>
                            <div className="my-6 border-t border-gray-200"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-lg shadow p-4">
                                    <h3 className="text-lg font-semibold text-foreground mb-3">
                                        Optimizing funding: Suggested Filming
                                        Locations & Incentives
                                    </h3>
                                    <div className="mb-4">
                                        <label
                                            htmlFor="projectBudget"
                                            className="text-sm font-medium text-gray-700"
                                        >
                                            Estimated Project Budget ($)
                                        </label>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <DollarSign className="h-5 w-5 text-gray-400" />
                                            <input
                                                id="projectBudget"
                                                type="number"
                                                value={
                                                    projectBudget === undefined
                                                        ? ""
                                                        : projectBudget
                                                }
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setProjectBudget(
                                                        val === ""
                                                            ? undefined
                                                            : parseInt(val, 10),
                                                    );
                                                }}
                                                placeholder="e.g., 1000000"
                                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                                step="100000"
                                            />
                                        </div>
                                    </div>
                                    <SuggestedLocations
                                        scriptId={script?.id || null}
                                        projectBudget={projectBudget}
                                        isLoading={isLoadingScenes}
                                        selectedLocations={selectedLocations}
                                        onLocationSelect={handleLocationSelection}
                                    />
                                </div>
                                <div className="bg-white rounded-lg shadow p-4">
                                    <h3 className="text-lg font-semibold text-foreground mb-3">
                                        Character Casting Suggestions
                                    </h3>
                                    <CharacterCasting
                                        scriptId={script?.id || null}
                                        isLoading={isLoadingScriptCharacters}
                                        filmGenre={filmGenreForCasting}
                                        projectBudgetTier={projectBudgetTierForCasting}
                                        selectedCharacters={selectedCharacters}
                                        onCharacterSelect={handleCharacterSelection}
                                    />
                                </div>
                            </div>
                            
                            {/* Selection summary and financial analysis button */}
                            {(selectedCharacters.length > 0 || selectedLocations.length > 0 || selectedProducts.length > 0) && (
                                <div className="mt-6 bg-white rounded-lg shadow p-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-semibold text-foreground">
                                            Selected Items Summary
                                        </h3>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={openSelectionInfoModal}
                                            className="flex items-center gap-1"
                                        >
                                            <Info className="h-4 w-4" />
                                            Details
                                        </Button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div>
                                            <h4 className="text-sm font-medium mb-2 flex items-center">
                                                <span className="mr-2">Cast</span>
                                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                                    {selectedCharacters.length} selected
                                                </span>
                                            </h4>
                                            <ul className="text-sm">
                                                {selectedCharacters.slice(0, 3).map(character => (
                                                    <li key={character.name} className="flex items-center mb-1">
                                                        <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                                                        <span className="flex flex-col">
                                                            <span>{character.name}</span>
                                                            {character.actorName && (
                                                                <span className="text-xs text-gray-500">
                                                                    Actor: {character.actorName || 'Unknown'}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </li>
                                                ))}
                                                {selectedCharacters.length > 3 && (
                                                    <li className="text-gray-500 text-xs">
                                                        +{selectedCharacters.length - 3} more
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                        
                                        <div>
                                            <h4 className="text-sm font-medium mb-2 flex items-center">
                                                <span className="mr-2">Locations</span>
                                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                                    {selectedLocations.length} selected
                                                </span>
                                            </h4>
                                            <ul className="text-sm">
                                                {selectedLocations.slice(0, 3).map(location => (
                                                    <li key={location.id} className="flex items-center mb-1">
                                                        <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                                                        {location.region}
                                                    </li>
                                                ))}
                                                {selectedLocations.length > 3 && (
                                                    <li className="text-gray-500 text-xs">
                                                        +{selectedLocations.length - 3} more
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                        
                                        <div>
                                            <h4 className="text-sm font-medium mb-2 flex items-center">
                                                <span className="mr-2">Brand Products</span>
                                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                                    {selectedProducts.length} selected
                                                </span>
                                            </h4>
                                            <ul className="text-sm">
                                                {selectedProducts.slice(0, 3).map(product => (
                                                    <li key={product.id} className="flex items-center mb-1">
                                                        <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                                                        <span className="flex flex-col">
                                                            <span>{product.productName || 'Unnamed product'}</span>
                                                            <span className="text-xs text-gray-500">
                                                                Brand: {product.productCategory || 'Unknown'}
                                                            </span>
                                                        </span>
                                                    </li>
                                                ))}
                                                {selectedProducts.length > 3 && (
                                                    <li className="text-gray-500 text-xs">
                                                        +{selectedProducts.length - 3} more
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-center">
                                        <Button 
                                            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                                            size="lg"
                                            disabled={selectedCharacters.length === 0 && selectedLocations.length === 0 && selectedProducts.length === 0}
                                            onClick={openFinancialAnalysisModal}
                                        >
                                            <PieChart className="h-5 w-5" />
                                            Project Financial Analysis
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            
            {/* Selection Info Modal */}
            <Dialog 
                open={isSelectionInfoModalOpen}
                onOpenChange={setIsSelectionInfoModalOpen}
            >
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Selected Project Elements</DialogTitle>
                        <DialogDescription>
                            Overview of all selected characters, locations, and brand product placements.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div>
                            <h4 className="text-base font-semibold mb-2 flex items-center">
                                <span className="mr-2">Selected Cast</span>
                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {selectedCharacters.length} characters
                                </span>
                            </h4>
                            {selectedCharacters.length > 0 ? (
                                <div className="border rounded-md divide-y">
                                    {selectedCharacters.map(character => (
                                        <div key={character.name} className="p-3 flex justify-between items-center">
                                            <div>
                                                <p className="font-medium">{character.name}</p>
                                                {character.estimatedAgeRange && (
                                                    <p className="text-sm text-gray-500">Estimated age: {character.estimatedAgeRange}</p>
                                                )}
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleCharacterSelection(character)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No characters selected yet.</p>
                            )}
                        </div>
                        
                        <div>
                            <h4 className="text-base font-semibold mb-2 flex items-center">
                                <span className="mr-2">Selected Filming Locations</span>
                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {selectedLocations.length} locations
                                </span>
                            </h4>
                            {selectedLocations.length > 0 ? (
                                <div className="border rounded-md divide-y">
                                    {selectedLocations.map(location => (
                                        <div key={location.id} className="p-3 flex justify-between items-center">
                                            <div>
                                                <p className="font-medium">{location.region}, {location.country}</p>
                                                {location.incentiveProgram && (
                                                    <p className="text-sm text-gray-500">{location.incentiveProgram}</p>
                                                )}
                                                {location.estimatedIncentiveValue && (
                                                    <p className="text-sm text-green-600">Est. benefit: {location.estimatedIncentiveValue}</p>
                                                )}
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleLocationSelection(location)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No locations selected yet.</p>
                            )}
                        </div>
                        
                        <div>
                            <h4 className="text-base font-semibold mb-2 flex items-center">
                                <span className="mr-2">Selected Brand Products</span>
                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {selectedProducts.length} placements
                                </span>
                            </h4>
                            {selectedProducts.length > 0 ? (
                                <div className="border rounded-md divide-y">
                                    {selectedProducts.map(product => (
                                        <div key={product.id} className="p-3 flex justify-between items-start">
                                            <div className="flex gap-3">
                                                {product.imageUrl && (
                                                    <div 
                                                        className="w-24 h-24 bg-gray-100 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                                                        onClick={() => handleImageZoom(product.imageUrl, product.productName || 'Product image')}
                                                    >
                                                        <img 
                                                            src={product.imageUrl} 
                                                            alt={product.productName || 'Product placement'} 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium">{product.productName || 'Unnamed product'}</p>
                                                    {product.productCategory && (
                                                        <p className="text-sm text-gray-500">Category: {product.productCategory}</p>
                                                    )}
                                                    <p className="text-sm text-gray-500">Scene: {
                                                        scenes.find(s => s.id === product.sceneId)?.sceneNumber || product.sceneId
                                                    }</p>
                                                    {videoGenerationStates[product.id]?.videoUrl && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            className="mt-2 text-xs"
                                                            onClick={() => handleViewVideo(
                                                                videoGenerationStates[product.id].videoUrl || '',
                                                                `${product.productName} - Scene ${scenes.find(s => s.id === product.sceneId)?.sceneNumber || product.sceneId}`
                                                            )}
                                                        >
                                                            <PlayCircle className="h-3 w-3 mr-1" />
                                                            View Video
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleProductSelection(product)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No brand products selected yet.</p>
                            )}
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={closeSelectionInfoModal}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <VideoPlayerModal
                isOpen={isVideoModalOpen}
                onClose={handleCloseVideoModal}
                videoUrl={currentVideoUrl}
                title={currentVideoTitle}
            />
            <ImageZoomModal
                isOpen={isImageZoomModalOpen}
                onClose={handleCloseImageZoomModal}
                imageUrl={zoomedImageUrl}
                title={zoomedImageTitle}
            />
            
            {/* Financial Analysis Modal */}
            <Dialog 
                open={isFinancialAnalysisModalOpen}
                onOpenChange={setIsFinancialAnalysisModalOpen}
            >
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Project Financial Analysis</DialogTitle>
                        <DialogDescription>
                            Complete the key project information to generate a financial analysis.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="project-name">Project Name</Label>
                                    <Input 
                                        id="project-name" 
                                        value={projectName} 
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="Enter project name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="release-date">Expected Release Date</Label>
                                    <Input 
                                        id="release-date" 
                                        type="date" 
                                        value={expectedReleaseDate} 
                                        onChange={(e) => setExpectedReleaseDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="budget">Total Budget ($)</Label>
                                <Input 
                                    id="budget" 
                                    type="number" 
                                    value={totalBudget} 
                                    onChange={(e) => setTotalBudget(Number(e.target.value))}
                                    placeholder="Enter total budget"
                                />
                            </div>
                        </div>
                        
                        <div className="rounded-lg border p-4 bg-muted/30">
                            <h3 className="text-lg font-medium mb-2 flex items-center">
                                <BarChart className="h-5 w-5 mr-2 text-primary" />
                                Project Summary
                            </h3>
                            <div className="space-y-3">
                                <p><strong>Selected Cast:</strong> {selectedCharacters.length} characters</p>
                                <p><strong>Selected Locations:</strong> {selectedLocations.length} locations</p>
                                <p><strong>Selected Brand Placements:</strong> {selectedProducts.length} placements</p>
                            </div>
                        </div>
                        
                        {selectedProducts.length > 0 && (
                            <div>
                                <h3 className="text-lg font-medium mb-3 flex items-center">
                                    <ImageIcon className="h-5 w-5 mr-2 text-primary" />
                                    Selected Assets for Export
                                </h3>
                                <div className="space-y-4">
                                    {/* Images Section */}
                                    <div>
                                        <h4 className="text-md font-medium mb-2">Images</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {selectedProducts.filter(p => p.imageUrl).map(product => (
                                                <div 
                                                    key={`img-${product.id}`}
                                                    className="aspect-video bg-gray-100 rounded overflow-hidden relative group cursor-pointer"
                                                    onClick={() => handleImageZoom(product.imageUrl || '', product.productName || 'Product')}
                                                >
                                                    <img 
                                                        src={product.imageUrl} 
                                                        alt={product.productName || 'Product placement'} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ZoomIn className="h-6 w-6 text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Videos Section */}
                                    {selectedProducts.some(p => videoGenerationStates[p.id]?.videoUrl) && (
                                        <div>
                                            <h4 className="text-md font-medium mb-2">Videos</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {selectedProducts
                                                    .filter(p => videoGenerationStates[p.id]?.videoUrl)
                                                    .map(product => (
                                                        <div 
                                                            key={`vid-${product.id}`}
                                                            className="bg-gray-100 rounded overflow-hidden relative group border"
                                                        >
                                                            <div className="p-2 flex justify-between items-center">
                                                                <span className="text-sm font-medium truncate">
                                                                    {product.productName || 'Video'} - Scene {
                                                                        scenes.find(s => s.id === product.sceneId)?.sceneNumber || product.sceneId
                                                                    }
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleViewVideo(
                                                                        videoGenerationStates[product.id]?.videoUrl || '',
                                                                        `${product.productName} - Scene ${scenes.find(s => s.id === product.sceneId)?.sceneNumber || product.sceneId}`
                                                                    )}
                                                                >
                                                                    <PlayCircle className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <DialogFooter className="flex justify-between items-center">
                        <Button variant="outline" onClick={closeFinancialAnalysisModal}>Cancel</Button>
                        <Button 
                            onClick={closeFinancialAnalysisModal}
                            disabled={selectedProducts.length === 0 || !projectName || !expectedReleaseDate || !totalBudget}
                        >
                            Export Project Assets
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
