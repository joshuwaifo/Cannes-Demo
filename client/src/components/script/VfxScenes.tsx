import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { getSafeImageUrl } from "@/lib/utils";
import {
  Sparkles,
  Loader2,
  Video,
  PlayCircle,
  AlertTriangle,
  RefreshCcw,
  ZoomIn,
  Check,
} from "lucide-react";
import type { Scene, VfxQualityTierType, VfxSceneDetail } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface VfxScenesProps {
  activeSceneDetails: Scene | null;
  projectTitle?: string;
  scenes: Scene[];
  vfxScenes: any[];
  isLoading: boolean;
  selectedSceneId: number | null;
  onVfxTierSelect: (sceneId: number, tier: VfxQualityTierType, cost: number) => void;
  onGenerateVideoRequest?: (variationId: number) => void;
  videoGenerationStates?: { [key: number]: any };
  onViewVideo?: (videoUrl: string, title: string) => void;
  onImageZoom?: (imageUrl: string, title: string) => void;
}

interface SceneWithVfxDetails extends Scene {
  vfxDetails?: VfxSceneDetail[];
}

interface VfxVariation {
  id: number;
  sceneId: number;
  qualityTier: VfxQualityTierType;
  conceptualImageUrl: string | null;
  estimatedVfxCost: number;
  vfxDescription: string;
  vfxKeywords: string[];
  variationNumber: number;
  isSelected?: boolean;
}

const FALLBACK_IMAGE_URL =
  "https://placehold.co/600x400/gray/white?text=Image+Unavailable";

const VFX_TIER_CONFIG = {
  LOW: {
    name: "Low Quality VFX",
    description: "Basic visual effects for simple scenes",
    costRange: "$5K - $15K",
    variationNumber: 1
  },
  MEDIUM: {
    name: "Medium Quality VFX", 
    description: "Professional grade effects for standard production",
    costRange: "$20K - $75K",
    variationNumber: 2
  },
  HIGH: {
    name: "High Quality VFX",
    description: "Premium cinematic quality effects",
    costRange: "$100K - $500K",
    variationNumber: 3
  }
} as const;

export default function VfxScenes({
  activeSceneDetails,
  projectTitle,
  scenes,
  vfxScenes,
  isLoading,
  selectedSceneId,
  onVfxTierSelect,
  onGenerateVideoRequest,
  videoGenerationStates = {},
  onViewVideo,
  onImageZoom
}: VfxScenesProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editedVfxDescriptions, setEditedVfxDescriptions] = useState<{
    [variationId: number]: string;
  }>({});

  // Move all hooks to top level before any returns
  const sceneWithDetails = activeSceneDetails as SceneWithVfxDetails;
  const vfxDetails = sceneWithDetails?.vfxDetails || [];

  useEffect(() => {
    const initialDescriptions: { [variationId: number]: string } = {};
    if (vfxDetails && selectedSceneId && activeSceneDetails) {
      vfxDetails.forEach((detail) => {
        initialDescriptions[detail.id] = detail.vfxElementsSummaryForTier || "";
      });
    }
    setEditedVfxDescriptions(initialDescriptions);
  }, [vfxDetails, selectedSceneId, activeSceneDetails]);

  if (!activeSceneDetails || !activeSceneDetails.isVfxScene) {
    return null;
  }

  const currentSceneToDisplay = activeSceneDetails;

  // Convert vfxDetails to match the brand placement pattern
  const currentVfxVariations: VfxVariation[] = vfxDetails.map((detail) => ({
    id: detail.id,
    sceneId: detail.sceneId,
    qualityTier: detail.qualityTier,
    conceptualImageUrl: detail.conceptualImageUrl,
    estimatedVfxCost: detail.estimatedVfxCost || 0,
    vfxDescription: detail.vfxDescription || "",
    vfxKeywords: Array.isArray(detail.vfxKeywords) 
      ? detail.vfxKeywords 
      : (typeof detail.vfxKeywords === 'string' 
          ? detail.vfxKeywords.split(',').map(k => k.trim()).filter(Boolean)
          : []),
    variationNumber: VFX_TIER_CONFIG[detail.qualityTier].variationNumber,
    isSelected: activeSceneDetails.selectedVfxTier === detail.qualityTier
  }));

  const handleVfxDescriptionChange = (variationId: number, newDescription: string) => {
    setEditedVfxDescriptions((prev) => ({ ...prev, [variationId]: newDescription }));
  };

  const updateVfxAssetsMutation = useMutation({
    mutationFn: async ({
      variationId,
      newDescription,
    }: {
      variationId: number;
      newDescription: string;
    }) => {
      return apiRequest(`/api/scenes/${selectedSceneId}/vfx-variations/${variationId}/update-assets`, {
        method: "POST",
        body: JSON.stringify({ vfxDescription: newDescription }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "VFX Assets Updated",
        description: "VFX concept image has been regenerated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scripts/vfx-scenes"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update VFX assets.",
      });
    },
  });

  const handleUpdateVfxAssets = (variationId: number) => {
    const newDescription = editedVfxDescriptions[variationId];
    if (newDescription) {
      updateVfxAssetsMutation.mutate({ variationId, newDescription });
    }
  };

  const formatCost = (cost: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cost);
  };

  return (
    <div className="space-y-4">
      {currentSceneToDisplay && (
        <>
          <h3 className="text-lg font-semibold text-purple-700 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            VFX Scene Options for Scene {currentSceneToDisplay.sceneNumber}
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium">Scene:</span> {currentSceneToDisplay.heading}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium">VFX Requirements:</span>{" "}
            {currentSceneToDisplay.vfxDescription ||
              (isLoading ? "Loading VFX requirements..." : "None specified yet")}
          </p>
        </>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {currentVfxVariations.map((variation) => {
          const videoState = videoGenerationStates[variation.id] || {
            status: "idle",
            progress: 0,
            stageMessage: "Generate Video",
          };
          const isUpdatingThisAsset =
            updateVfxAssetsMutation.isPending &&
            updateVfxAssetsMutation.variables?.variationId === variation.id;

          const isThisVideoProcessing =
            videoState.status === "pending" ||
            videoState.status === "generating";
          const showImageOverlay =
            isUpdatingThisAsset ||
            isThisVideoProcessing;
          const cardDisabledClass = showImageOverlay
            ? "opacity-70 cursor-not-allowed"
            : "";

          const currentVfxDescription =
            editedVfxDescriptions[variation.id] ?? variation.vfxDescription ?? "";
          const isDescriptionUnchangedOrEmpty =
            !currentVfxDescription ||
            currentVfxDescription === (variation.vfxDescription || "");

          const config = VFX_TIER_CONFIG[variation.qualityTier];

          return (
            <Card
              key={variation.id}
              className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 
                ${variation.isSelected ? "border-purple-500 ring-1 ring-purple-500" : "border-gray-200"} 
                ${cardDisabledClass} w-full group relative cursor-pointer`}
              onClick={() => !showImageOverlay && onVfxTierSelect(variation.sceneId, variation.qualityTier, variation.estimatedVfxCost)}
            >
              {variation.isSelected && (
                <div className="absolute top-2 right-2 z-10 bg-purple-500 rounded-full p-1">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                <img
                  src={getSafeImageUrl(variation.conceptualImageUrl, FALLBACK_IMAGE_URL)}
                  alt={`${config.name} - Scene ${currentSceneToDisplay?.sceneNumber}`}
                  className="w-full h-full object-cover transform scale-100 hover:scale-105 transition-transform duration-300 cursor-pointer"
                  loading="lazy"
                  onClick={() =>
                    !showImageOverlay &&
                    onImageZoom?.(
                      variation.conceptualImageUrl || FALLBACK_IMAGE_URL,
                      `Scene ${currentSceneToDisplay?.sceneNumber} - ${config.name}`,
                    )
                  }
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_IMAGE_URL;
                    (e.target as HTMLImageElement).alt = "Error loading VFX concept";
                  }}
                />
                {!showImageOverlay &&
                  variation.conceptualImageUrl &&
                  variation.conceptualImageUrl !== FALLBACK_IMAGE_URL && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 left-2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() =>
                        onImageZoom?.(
                          variation.conceptualImageUrl || FALLBACK_IMAGE_URL,
                          `Scene ${currentSceneToDisplay?.sceneNumber} - ${config.name}`,
                        )
                      }
                      title="Zoom Image"
                    >
                      <ZoomIn className="h-5 w-5" />
                    </Button>
                  )}
                {showImageOverlay && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-2 sm:p-4 text-center">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mb-1 sm:mb-2" />
                    <p className="text-xs sm:text-sm font-medium">
                      {isUpdatingThisAsset
                        ? "Updating VFX Image..."
                        : videoState.stageMessage || "Processing Video..."}
                    </p>
                    {isThisVideoProcessing && (
                      <p className="text-xs mt-1 bg-black/30 rounded-md p-1">
                        Processing...
                      </p>
                    )}
                    {(isThisVideoProcessing ||
                      (videoState.status === "succeeded" &&
                        !videoState.videoUrl)) &&
                      videoState.progress !== undefined &&
                      videoState.progress >= 0 &&
                      videoState.progress <= 100 && (
                        <Progress
                          value={videoState.progress}
                          className="w-3/4 h-1.5 mt-2 bg-gray-600 [&>div]:bg-primary"
                        />
                      )}
                  </div>
                )}
                {videoState.status === "failed" && !showImageOverlay && (
                  <div
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                    title={`Video Failed: ${videoState.error || ""}`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="text-white text-xs font-semibold">
                    Option {variation.variationNumber}: {config.name}
                  </span>
                </div>
              </div>

              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center space-x-1 sm:space-x-2 mb-1.5">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-purple-100 flex items-center justify-center overflow-hidden border">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium leading-tight truncate">
                      {config.name}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-xs py-0 sm:py-0.5 px-1 sm:px-1.5 mt-0.5 inline-block"
                    >
                      <span className="truncate max-w-[80px] inline-block">
                        {config.costRange}
                      </span>
                    </Badge>
                    {variation.estimatedVfxCost > 0 && (
                      <p className="text-xs font-semibold text-green-600">
                        Est: {formatCost(variation.estimatedVfxCost)}
                      </p>
                    )}
                  </div>
                </div>
                <Textarea
                  value={currentVfxDescription}
                  onChange={(e) =>
                    handleVfxDescriptionChange(variation.id, e.target.value)
                  }
                  placeholder="Edit VFX requirements and elements..."
                  className="text-xs sm:text-sm mt-2 min-h-[60px] max-h-[120px] resize-y p-2"
                  disabled={showImageOverlay}
                />
                {variation.vfxKeywords.length > 0 && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1">
                      {variation.vfxKeywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {videoState.status === "failed" && !isThisVideoProcessing ? (
                  <p
                    className="text-xs text-red-600 line-clamp-2 mt-1"
                    title={videoState.error || "Unknown video generation error"}
                  >
                    Video Failed: {videoState.error || "Unknown error"}
                  </p>
                ) : (
                  <p
                    className="text-[10px] sm:text-xs text-gray-600 line-clamp-2 mt-1 break-words"
                    title={config.description}
                  >
                    {config.description}
                  </p>
                )}
              </CardContent>

              <CardFooter className="p-2 sm:p-3 pt-1 sm:pt-2 grid grid-cols-2 gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onVfxTierSelect(variation.sceneId, variation.qualityTier, variation.estimatedVfxCost)}
                  disabled={showImageOverlay}
                  className="text-xs sm:text-sm h-auto py-1 px-2 sm:px-3"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5 flex-shrink-0" />{" "}
                  <span className="whitespace-nowrap">
                    {variation.isSelected ? 'Selected' : 'Select Tier'}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateVfxAssets(variation.id)}
                  disabled={
                    showImageOverlay ||
                    isDescriptionUnchangedOrEmpty ||
                    updateVfxAssetsMutation.isPending
                  }
                  className="text-xs sm:text-sm h-auto py-1 px-2 sm:px-3"
                >
                  {isUpdatingThisAsset ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin flex-shrink-0" />{" "}
                      <span className="whitespace-nowrap">Updating...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="mr-1 h-4 w-4 flex-shrink-0" />{" "}
                      <span className="whitespace-nowrap">Update VFX</span>
                    </>
                  )}
                </Button>

                {videoState.status === "succeeded" && videoState.videoUrl ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                      onViewVideo?.(
                        videoState.videoUrl!,
                        `Scene ${currentSceneToDisplay?.sceneNumber} - ${config.name}`,
                      )
                    }
                    disabled={showImageOverlay || isLoading}
                    className="col-span-2 w-full justify-center text-sm sm:text-base py-1 h-auto"
                  >
                    <PlayCircle className="mr-1 h-4 w-4 flex-shrink-0" />{" "}
                    <span className="whitespace-nowrap">View Video</span>
                  </Button>
                ) : isThisVideoProcessing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={true}
                    className="col-span-2 w-full justify-center text-sm sm:text-base py-1 h-auto"
                  >
                    <Loader2 className="mr-1 h-4 w-4 animate-spin flex-shrink-0" />
                    <span className="whitespace-nowrap flex items-center">
                      {videoState.status === "pending" ? (
                        <>
                          <span className="text-blue-400 animate-pulse mr-1">⚡</span>
                          <span>{videoState.stageMessage || "Queueing video..."}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-green-400 animate-pulse mr-1">🎬</span>
                          <span>{videoState.stageMessage || "Processing video..."}</span>
                        </>
                      )}
                    </span>
                  </Button>
                ) : (
                  <Button
                    variant={
                      videoState.status === "failed" ? "destructive" : "outline"
                    }
                    size="sm"
                    onClick={() => onGenerateVideoRequest?.(variation.id)}
                    disabled={showImageOverlay || isLoading}
                    className="col-span-2 w-full justify-center text-sm sm:text-base py-1 h-auto"
                  >
                    {videoState.status === "failed" ? (
                      <AlertTriangle className="mr-1 h-4 w-4 flex-shrink-0" />
                    ) : (
                      <Video className="mr-1 h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="whitespace-nowrap">
                      {videoState.status === "failed"
                        ? "Retry Video"
                        : "Generate Video"}
                    </span>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}