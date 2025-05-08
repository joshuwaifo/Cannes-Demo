// client/src/components/script/BrandableScenes.tsx
import { BrandableScenesProps, SceneVariation } from "@/lib/types"; // Use updated SceneVariation
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
  Download,
} from "lucide-react"; // Added icons
import { Progress } from "@/components/ui/progress"; // Added Progress
import { Scene } from "@shared/schema";

export default function BrandableScenes({
  brandableScenes,
  scenes, // Keep receiving all scenes if needed for context elsewhere
  productVariations,
  isLoading, // General loading state for variations/initial data
  selectedSceneId,
  onGenerateVideoRequest, // Updated handler name
  videoGenerationStates, // Receive video generation status
  onViewVideo, // Handler to open video modal
}: BrandableScenesProps) {
  // Use updated props type
  const currentScene = brandableScenes.find(
    (scene) => scene.id === selectedSceneId,
  );

  // Ensure variations have image URLs processed safely
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

  // --- Existing initial checks ---
  if (!selectedSceneId) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Select a Scene
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Select a scene marked with the{" "}
            <Info className="inline h-4 w-4 text-primary align-middle" /> icon
            from the "Scene Breakdown" list to view or generate product
            placement options.
          </p>
        </div>
      </div>
    );
  }

  if (selectedSceneId && !currentScene) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene Not Brandable
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <p className="text-muted-foreground">
            This scene is not currently identified as brandable. Try
            re-analyzing the script or selecting another scene.
          </p>
        </div>
      </div>
    );
  }

  // Show skeleton only if variations are loading *for the first time* for this scene
  if (isLoading && currentSceneVariations.length === 0) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene {currentScene?.sceneNumber || selectedSceneId}: Product
          Placement Options
        </h3>
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading placement options...</p>
        </div>
        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <Skeleton className="h-48 w-full bg-gray-200" />
              <CardContent className="p-3">
                <Skeleton className="h-8 w-8 rounded-full bg-gray-200 inline-block mr-2" />
                <Skeleton className="h-4 w-24 bg-gray-200 inline-block" />
                <Skeleton className="h-10 w-full bg-gray-200 mt-2" />
              </CardContent>
              <CardFooter className="p-3 pt-0 flex justify-end">
                <Skeleton className="h-9 w-32 bg-gray-200" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- No variations generated yet (after loading finishes) ---
  if (currentSceneVariations.length === 0 && currentScene && !isLoading) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene {currentScene?.sceneNumber}: Product Placement Options
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <ImageOff className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">
            No placement options generated yet for Scene{" "}
            {currentScene?.sceneNumber}.
          </p>
          <p className="text-sm text-gray-500">
            Use the "Generate Placements" button above to create visual options.
          </p>
        </div>
      </div>
    );
  }

  // --- Main Display Logic ---
  return (
    <div>
      <h3 className="text-md font-semibold text-secondary mb-3">
        Scene {currentScene?.sceneNumber}: Product Placement Options
      </h3>
      {currentScene && (
        <>
          <p className="text-sm text-muted-foreground mb-1">
            Reason: {currentScene.brandableReason || "Suitable for placement."}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Suggested Categories:{" "}
            {currentScene.suggestedCategories?.join(", ") || "N/A"}
          </p>
          {brandableScenes.length > 0 && scenes.length > 0 && (
            <p className="text-sm text-yellow-800 mb-2 font-medium">
              AI has identified {brandableScenes.length} of {scenes.length}{" "}
              scenes with product placement potential.
            </p>
          )}
        </>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Map over variations */}
        {currentSceneVariations.map((variation) => {
          // Get specific video state for this variation
          const videoState = videoGenerationStates[variation.id] || {
            status: "idle",
          };
          // Determine if *this specific variation* is currently generating a video
          const isGeneratingThisVideo =
            videoState.status === "pending" ||
            videoState.status === "generating";

          return (
            <Card
              key={variation.id}
              // Card styling based on video state or selection (if selection logic is separate)
              className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${variation.isSelected ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"} ${isGeneratingThisVideo ? "opacity-70 cursor-not-allowed" : ""}`} // Added cursor style
            >
              {/* Image Display & Overlays */}
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={variation.imageUrl}
                  alt={`Option ${variation.variationNumber}: ${variation.productName} in ${currentScene?.heading}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://placehold.co/864x480/grey/white?text=Image+Error"; // Updated fallback text
                    e.currentTarget.alt = "Error loading image";
                  }}
                />
                {/* Video Generation Progress Overlay */}
                {isGeneratingThisVideo && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p className="text-sm font-medium">Generating Video...</p>
                    {/* Progress bar could go here if available */}
                  </div>
                )}
                {/* Status Indicators */}
                {videoState.status === "succeeded" && videoState.videoUrl && (
                  <div
                    className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg"
                    title="Video Ready"
                  >
                    <Video className="h-4 w-4" />
                  </div>
                )}
                {videoState.status === "failed" && (
                  <div
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                    title={`Video Failed: ${videoState.error || ""}`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                )}
                {/* Option Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="text-white text-xs font-semibold">
                    Option {variation.variationNumber}: {variation.productName}
                  </span>
                </div>
              </div>

              {/* Card Content (Product Info & Error) */}
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-1.5">
                  {" "}
                  {/* Product Image & Name */}
                  <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
                    <img
                      src={variation.productImageUrl}
                      alt={variation.productName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                        const parent = e.currentTarget.parentElement;
                        if (
                          parent &&
                          !parent.querySelector(".placeholder-icon")
                        ) {
                          // Prevent adding multiple icons
                          parent.innerHTML +=
                            '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 placeholder-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                        }
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {variation.productName}
                    </p>
                    <Badge variant="outline" className="text-xs py-0.5 px-1.5">
                      {variation.productCategory}
                    </Badge>
                  </div>
                </div>
                {/* Display description or error message */}
                {videoState.status === "failed" ? (
                  <p
                    className="text-xs text-red-600 line-clamp-2 mt-1"
                    title={videoState.error || "Unknown video generation error"}
                  >
                    Failed: {videoState.error || "Unknown error"}
                  </p>
                ) : (
                  <p
                    className="text-xs text-gray-600 line-clamp-2"
                    title={variation.description}
                  >
                    {variation.description}
                  </p>
                )}
              </CardContent>

              {/* Card Footer (Action Buttons) */}
              <CardFooter className="p-3 pt-0 flex justify-end space-x-2">
                {/* View Video Button */}
                {videoState.status === "succeeded" && videoState.videoUrl && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                      onViewVideo(
                        videoState.videoUrl!,
                        `Scene ${currentScene?.sceneNumber} - ${variation.productName}`,
                      )
                    }
                    // Disable if parent says still loading variations
                    disabled={isLoading}
                  >
                    <PlayCircle className="mr-1 h-4 w-4" />
                    View Video
                  </Button>
                )}

                {/* Generate / Retry Button */}
                {videoState.status !== "succeeded" && (
                  <Button
                    variant={
                      videoState.status === "failed" ? "destructive" : "outline"
                    }
                    size="sm"
                    onClick={() => onGenerateVideoRequest(variation.id)}
                    // Disable if THIS video is generating OR if variations data is loading/refetching
                    disabled={isGeneratingThisVideo || isLoading}
                  >
                    {isGeneratingThisVideo ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : videoState.status === "failed" ? (
                      <>
                        <AlertTriangle className="mr-1 h-4 w-4" />
                        Retry Video
                      </>
                    ) : (
                      <>
                        <Video className="mr-1 h-4 w-4" />
                        Generate Video
                      </>
                    )}
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
