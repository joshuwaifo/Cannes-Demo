// client/src/components/script/BrandableScenes.tsx
import { BrandableScenesProps } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getSafeImageUrl } from "@/lib/utils";
import { ImageOff, Info, Loader2 } from "lucide-react";
import { Scene } from "@shared/schema";

export default function BrandableScenes({
  brandableScenes,
  scenes,
  productVariations,
  isLoading, // This prop is true if variations are loading OR a selection is being processed by the parent
  selectedSceneId,
  onOptionSelect,
}: BrandableScenesProps & { scenes: Scene[] }) {
  const currentScene = brandableScenes.find(
    (scene) => scene.id === selectedSceneId,
  );

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

  if (isLoading) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene {currentScene?.sceneNumber}: Product Placement Options
        </h3>
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">
            Loading placement options for Scene {currentScene?.sceneNumber}...
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <Skeleton className="h-48 w-full bg-gray-200" />
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Skeleton className="h-8 w-8 rounded-full bg-gray-200" />
                  <div>
                    <Skeleton className="h-4 w-24 bg-gray-200" />
                    <Skeleton className="h-3 w-16 mt-1 bg-gray-200" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full bg-gray-200" />
              </CardContent>
              <CardFooter className="p-3 pt-0 flex justify-end">
                <Skeleton className="h-9 w-20 bg-gray-200" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (currentSceneVariations.length === 0 && currentScene) {
    // Check currentScene to ensure a brandable scene was indeed selected
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene {currentScene?.sceneNumber}: Product Placement Options
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <ImageOff className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">
            No product placement options generated yet for Scene{" "}
            {currentScene?.sceneNumber}.
          </p>
          <p className="text-sm text-gray-500">
            Click the "Generate Placements" button in the Script Editor above to
            create visual options for brandable scenes.
          </p>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-yellow-800 mb-2 font-medium">
            AI has identified {brandableScenes.length} of {scenes.length} scenes with product placement potential:
          </p>
        </>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentSceneVariations.map((variation) => (
          <Card
            key={variation.id}
            className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${variation.isSelected ? "border-primary ring-2 ring-primary" : "border-gray-200"}`}
          >
            <div className="relative aspect-video bg-gray-100">
              <img
                src={variation.imageUrl}
                alt={`Option ${variation.variationNumber}: ${variation.productName} in ${currentScene?.heading}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://placehold.co/864x480/grey/white?text=Error+Loading";
                  e.currentTarget.alt = "Error loading image";
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <span className="text-white text-xs font-semibold">
                  Option {variation.variationNumber}: {variation.productName}
                </span>
              </div>
            </div>
            <CardContent className="p-3">
              <div className="flex items-center space-x-2 mb-1.5">
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
                  <img
                    src={variation.productImageUrl}
                    alt={variation.productName}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
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
              <p className="text-xs text-gray-600 line-clamp-2">
                {variation.description}
              </p>
            </CardContent>
            <CardFooter className="p-3 pt-0 flex justify-end">
              <Button
                variant={variation.isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => onOptionSelect(variation.id)}
                // The 'isLoading' prop passed from parent already covers if any relevant mutation is pending.
                // No need to check selectVariationMutation.isPending or variables here directly.
                disabled={isLoading}
              >
                {variation.isSelected ? "Selected" : "Select"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}