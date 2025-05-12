// client/src/components/script/BrandableScenes.tsx
import { BrandableScenesProps, SceneVariation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getSafeImageUrl } from "@/lib/utils";
import {
  ImageOff,
  Info,
  Loader2,
  Video,
  PlayCircle,
  AlertTriangle,
  RefreshCcw,
  Replace,
  ZoomIn,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Scene } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChangeProductModal from "./ChangeProductModal";

const FALLBACK_IMAGE_URL =
  "https://placehold.co/600x400/gray/white?text=Image+Unavailable";

export default function BrandableScenes({
  activeSceneDetails,
  projectTitle,
  scenes,
  productVariations,
  isLoading,
  selectedSceneId,
  onGenerateVideoRequest, // This prop is called directly now
  videoGenerationStates,
  onViewVideo,
  onImageZoom,
}: BrandableScenesProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editedPrompts, setEditedPrompts] = useState<{
    [variationId: number]: string;
  }>({});
  const [isChangeProductModalOpen, setIsChangeProductModalOpen] =
    useState(false);
  const [changingProductForVariationId, setChangingProductForVariationId] =
    useState<number | null>(null);

  useEffect(() => {
    const initialPrompts: { [variationId: number]: string } = {};
    if (productVariations && selectedSceneId) {
      productVariations
        .filter((v) => v.sceneId === selectedSceneId)
        .forEach((v) => {
          initialPrompts[v.id] = v.geminiPrompt || "";
        });
    }
    setEditedPrompts(initialPrompts);
  }, [productVariations, selectedSceneId]);

  const currentSceneToDisplay = activeSceneDetails;

  const currentSceneVariations = productVariations
    .filter((variation) => variation.sceneId === selectedSceneId)
    .map((variation) => ({
      ...variation,
      imageUrl: getSafeImageUrl(
        variation.imageUrl,
        "https://placehold.co/864x480/333/white?text=Processing...",
      ),
      productImageUrl: getSafeImageUrl(variation.productImageUrl || ""),
    }));

  const handlePromptChange = (variationId: number, newPrompt: string) => {
    setEditedPrompts((prev) => ({ ...prev, [variationId]: newPrompt }));
  };

  const updateAssetsMutation = useMutation({
    mutationFn: async ({
      variationId,
      newPrompt,
    }: {
      variationId: number;
      newPrompt: string;
    }) => {
      return apiRequest(
        "PUT",
        `/api/variations/${variationId}/update-prompt-and-image`,
        { newPrompt },
      );
    },
    onSuccess: (updatedVariationData: any, variables) => {
      toast({
        title: "Image Updated",
        description: `Image for variation ${variables.variationId} has been updated. Starting video generation...`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/scripts/scene-variations", selectedSceneId],
      });
      onGenerateVideoRequest(variables.variationId); // Call the prop from ScriptEditor
    },
    onError: (error: Error, variables) => {
      toast({
        variant: "destructive",
        title: "Asset Update Failed",
        description: `Could not update image for variation ${variables.variationId}: ${error.message}`,
      });
    },
  });

  const handleChangeProductMutation = useMutation({
    mutationFn: async ({
      variationId,
      newProductId,
    }: {
      variationId: number;
      newProductId: number;
    }) => {
      return apiRequest(
        "PUT",
        `/api/variations/${variationId}/change-product`,
        { newProductId },
      );
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Product Changed",
        description: `Product for variation ${variables.variationId} has been updated. Image & video will regenerate.`,
      });
      setIsChangeProductModalOpen(false);
      setChangingProductForVariationId(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/scripts/scene-variations", selectedSceneId],
      });
      onGenerateVideoRequest(variables.variationId); // Call the prop from ScriptEditor
    },
    onError: (error: Error, variables) => {
      toast({
        variant: "destructive",
        title: "Product Change Failed",
        description: `Could not change product for variation ${variables.variationId}: ${error.message}`,
      });
      setIsChangeProductModalOpen(false);
      setChangingProductForVariationId(null);
    },
  });

  const handleUpdateAssets = (variationId: number) => {
    const newPrompt = editedPrompts[variationId];
    if (newPrompt) {
      updateAssetsMutation.mutate({ variationId, newPrompt });
    } else {
      toast({
        variant: "destructive",
        title: "No Prompt",
        description: "Please ensure the prompt is not empty.",
      });
    }
  };

  const openChangeProductModal = (variationId: number) => {
    setChangingProductForVariationId(variationId);
    setIsChangeProductModalOpen(true);
  };

  const handleProductSelectedFromModal = (newProductId: number) => {
    if (changingProductForVariationId !== null) {
      handleChangeProductMutation.mutate({
        variationId: changingProductForVariationId,
        newProductId,
      });
    }
  };

  if (!selectedSceneId) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Select a Scene
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Select a scene from the "Scene Breakdown" list to view or generate
            product placement options. Scenes initially identified by Vadis AI
            are marked with a{" "}
            <Info className="inline h-4 w-4 text-primary align-middle" /> icon.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && currentSceneVariations.length === 0) {
    return (
      <div>
        <h3 className="text-md font-semibold text-foreground mb-3">
          Scene {currentSceneToDisplay?.sceneNumber || selectedSceneId}: Product
          Placement Options
        </h3>
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading placement options...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <Skeleton className="h-48 w-full bg-gray-200" />
              <CardContent className="p-2 sm:p-3">
                <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gray-200 inline-block mr-2" />
                <Skeleton className="h-4 w-20 sm:w-24 bg-gray-200 inline-block" />
                <Skeleton className="h-10 w-full bg-gray-200 mt-2" />
              </CardContent>
              <CardFooter className="p-2 sm:p-3 pt-0 flex justify-end">
                <Skeleton className="h-8 sm:h-9 w-24 sm:w-32 bg-gray-200" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  if (
    currentSceneVariations.length === 0 &&
    currentSceneToDisplay &&
    !isLoading
  ) {
    return (
      <div>
        <h3 className="text-md font-semibold text-foreground mb-3">
          Scene {currentSceneToDisplay?.sceneNumber}: Product Placement Options
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <ImageOff className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">
            No placement options generated yet for Scene{" "}
            {currentSceneToDisplay?.sceneNumber}.
          </p>
          <p className="text-sm text-gray-500">
            Variations are generated automatically when a scene is selected. If
            none appear, the scene might not have suggested categories or
            products.
          </p>
        </div>
      </div>
    );
  }
  if (!currentSceneToDisplay && !isLoading) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene Details Unavailable
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Details for the selected scene could not be loaded. Try selecting
            another scene.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm sm:text-md font-semibold text-foreground mb-2 sm:mb-3 line-clamp-2">
        {projectTitle ? `Placement Options for "${projectTitle}" - ` : ""}
        Scene {currentSceneToDisplay?.sceneNumber || selectedSceneId}
      </h3>
      {currentSceneToDisplay && (
        <>
          <p className="text-xs sm:text-sm text-muted-foreground mb-1 line-clamp-2">
            <span className="font-medium">Reason:</span>{" "}
            {currentSceneToDisplay.brandableReason ||
              (currentSceneToDisplay.isBrandable
                ? "Suitable for placement."
                : "Not initially identified as brandable by Vadis AI; categories generated on demand.")}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
            <span className="font-medium">Categories:</span>{" "}
            {currentSceneToDisplay.suggestedCategories?.join(", ") ||
              (isLoading ? "Loading categories..." : "None suggested yet")}
          </p>
          {scenes.length > 0 && (
            <p className="text-xs sm:text-sm text-yellow-800 bg-yellow-100 border border-yellow-300 p-2 rounded-md mb-2 font-medium">
              Vadis AI has initially identified{" "}
              {scenes.filter((s) => s.isBrandable).length} of {scenes.length}{" "}
              scenes with product placement potential. You can generate options
              for any scene.
            </p>
          )}
        </>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {currentSceneVariations.map((variation) => {
          const videoState = videoGenerationStates[variation.id] || {
            status: "idle",
            progress: 0,
            stageMessage: "Generate Video",
          };
          const isUpdatingThisAsset =
            updateAssetsMutation.isPending &&
            updateAssetsMutation.variables?.variationId === variation.id;
          const isChangingThisProduct =
            handleChangeProductMutation.isPending &&
            handleChangeProductMutation.variables?.variationId === variation.id;

          const isThisVideoProcessing =
            videoState.status === "pending" ||
            videoState.status === "generating";
          const showImageOverlay =
            isUpdatingThisAsset ||
            isChangingThisProduct ||
            isThisVideoProcessing;
          const cardDisabledClass = showImageOverlay
            ? "opacity-70 cursor-not-allowed"
            : "";

          const currentPromptText =
            editedPrompts[variation.id] ?? variation.geminiPrompt ?? "";
          const isPromptUnchangedOrEmpty =
            !currentPromptText ||
            currentPromptText === (variation.geminiPrompt || "");

          return (
            <Card
              key={variation.id}
              className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${variation.isSelected ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"} ${cardDisabledClass} w-full group`}
            >
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                <img
                  src={variation.imageUrl}
                  alt={`Option ${variation.variationNumber}: ${variation.productName} in ${currentSceneToDisplay?.heading}`}
                  className="w-full h-full object-cover transform scale-100 hover:scale-105 transition-transform duration-300 cursor-pointer"
                  loading="lazy"
                  onClick={() =>
                    !showImageOverlay &&
                    onImageZoom(
                      variation.imageUrl,
                      `Scene ${currentSceneToDisplay?.sceneNumber} - Option ${variation.variationNumber}: ${variation.productName}`,
                    )
                  }
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/864x480/grey/white?text=Image+Error";
                    (e.target as HTMLImageElement).alt = "Error loading image";
                  }}
                />
                {!showImageOverlay &&
                  variation.imageUrl &&
                  variation.imageUrl !== FALLBACK_IMAGE_URL && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 left-2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() =>
                        onImageZoom(
                          variation.imageUrl,
                          `Scene ${currentSceneToDisplay?.sceneNumber} - Option ${variation.variationNumber}: ${variation.productName}`,
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
                        ? "Updating Image..."
                        : isChangingThisProduct
                          ? "Changing Product..."
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
                {videoState.status === "succeeded" &&
                  videoState.videoUrl &&
                  !showImageOverlay && (
                    <div
                      className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg"
                      title="Video Ready"
                    >
                      <Video className="h-4 w-4" />
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
                    Option {variation.variationNumber}: {variation.productName}
                  </span>
                </div>
              </div>

              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center space-x-1 sm:space-x-2 mb-1.5">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
                    <img
                      src={variation.productImageUrl}
                      alt={variation.productName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (
                          parent &&
                          !parent.querySelector(".placeholder-icon")
                        ) {
                          parent.innerHTML +=
                            '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 placeholder-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                        }
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium leading-tight truncate">
                      {variation.productName}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-xs py-0 sm:py-0.5 px-1 sm:px-1.5 mt-0.5 inline-block"
                    >
                      <span className="truncate max-w-[80px] inline-block">
                        {variation.productCategory}
                      </span>
                    </Badge>
                  </div>
                </div>
                <Textarea
                  value={currentPromptText}
                  onChange={(e) =>
                    handlePromptChange(variation.id, e.target.value)
                  }
                  placeholder="Edit prompt for asset generation..."
                  className="text-xs sm:text-sm mt-2 min-h-[60px] max-h-[120px] resize-y p-2"
                  disabled={showImageOverlay}
                />
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
                    title={variation.description}
                  >
                    {variation.description}
                  </p>
                )}
              </CardContent>

              <CardFooter className="p-2 sm:p-3 pt-1 sm:pt-2 grid grid-cols-2 gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openChangeProductModal(variation.id)}
                  disabled={
                    showImageOverlay || handleChangeProductMutation.isPending
                  }
                  className="text-xs sm:text-sm h-auto py-1 px-2 sm:px-3"
                >
                  <Replace className="mr-1 h-3.5 w-3.5 flex-shrink-0" />{" "}
                  <span className="whitespace-nowrap">Change Product</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateAssets(variation.id)}
                  disabled={
                    showImageOverlay ||
                    isPromptUnchangedOrEmpty ||
                    updateAssetsMutation.isPending
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
                      <span className="whitespace-nowrap">Update Assets</span>
                    </>
                  )}
                </Button>

                {videoState.status === "succeeded" && videoState.videoUrl ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                      onViewVideo(
                        videoState.videoUrl!,
                        `Scene ${currentSceneToDisplay?.sceneNumber} - ${variation.productName}`,
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
                    <span className="whitespace-nowrap">
                      {videoState.status === "pending" ? (
                        <span className="flex items-center">
                          <span className="text-blue-400 animate-pulse">⚡</span>
                          <span className="ml-1">{videoState.stageMessage || "Queueing video..."}</span>
                        </span>
                      ) : (
                        videoState.stageMessage || "Processing..."
                      )}
                    </span>
                  </Button>
                ) : (
                  <Button
                    variant={
                      videoState.status === "failed" ? "destructive" : "outline"
                    }
                    size="sm"
                    onClick={() => onGenerateVideoRequest(variation.id)}
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

      {isChangeProductModalOpen && changingProductForVariationId !== null && (
        <ChangeProductModal
          isOpen={isChangeProductModalOpen}
          onClose={() => {
            setIsChangeProductModalOpen(false);
            setChangingProductForVariationId(null);
          }}
          currentProductId={
            productVariations.find(
              (v) => v.id === changingProductForVariationId,
            )?.productId || 0
          }
          onProductSelect={handleProductSelectedFromModal}
          isSubmitting={handleChangeProductMutation.isPending}
        />
      )}
    </div>
  );
}
