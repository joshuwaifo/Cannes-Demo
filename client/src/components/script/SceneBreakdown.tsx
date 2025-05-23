// client/src/components/script/SceneBreakdown.tsx
import { SceneBreakdownProps } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Star, Sparkles } from "lucide-react"; // Added Sparkles for VFX scenes
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export default function SceneBreakdown({
  scenes,
  activeSceneId,
  projectTitle,
  brandableSceneIds,
  isLoading,
  onSceneSelect,
}: SceneBreakdownProps) {
  if (isLoading) {
    return (
      <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow animate-pulse">
        <h2 className="text-lg font-semibold mb-4 text-foreground">
          <Skeleton className="h-6 w-3/4" />
        </h2>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4 text-foreground">
        {projectTitle
          ? `Scene Breakdown for "${projectTitle}"`
          : "Scene Breakdown"}
      </h2>

      <div className="h-[400px] overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <ul className="space-y-2">
            {scenes.map((scene) => (
              <li
                key={scene.id}
                className={cn(
                  "px-3 py-2 rounded-r cursor-pointer scene-item",
                  activeSceneId === scene.id ? "active" : "",
                )}
                onClick={() => onSceneSelect(scene.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold">
                      Scene {scene.sceneNumber}
                    </span>
                    <p className="text-xs text-gray-600">{scene.heading}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {scene.isVfxScene && (
                      <Sparkles className="h-4 w-4 text-purple-500" title="VFX Scene" />
                    )}
                    {brandableSceneIds.includes(scene.id) && (
                      <Star className="h-5 w-5 text-green-500 brandable-indicator" title="Brandable Scene" />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>

      {brandableSceneIds.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800 mb-2 font-medium">
              {`VADIS AI SUGGESTED BRANDABLE SCENES`}
            </p>
            <p className="text-xs text-green-600 mb-2">
              {`There are ${scenes.filter(scene => brandableSceneIds.includes(scene.id)).length} scenes with product placement potential. Vadis AI has suggested the following scenes for their branding potential:`}
            </p>
            <ul className="text-xs text-green-700 space-y-1">
              {scenes
                .filter((scene) => brandableSceneIds.includes(scene.id))
                .map((scene) => {
                  const category = scene.suggestedCategories?.length
                    ? scene.suggestedCategories[0]
                    : "Product";

                  return (
                    <li key={scene.id} className="flex items-center">
                      <Star className="h-4 w-4 mr-1 text-green-600" />
                      Scene {scene.sceneNumber}: {scene.heading.length > 30 ? scene.heading.substring(0, 30) + "..." : scene.heading} ({category})
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}

      {/* VFX Scenes Summary */}
      {scenes.length > 0 && scenes.some(scene => scene.isVfxScene) && (
        <div className="mt-4">
          <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
            <p className="text-sm text-purple-800 mb-2 font-medium">
              {`VADIS AI SUGGESTED VFX SCENES`}
            </p>
            <p className="text-xs text-purple-600 mb-2">
              {`There are ${scenes.filter(scene => scene.isVfxScene).length} scenes with VFX potential. Vadis AI has suggested the following scenes for their VFX potential:`}
            </p>
            <ul className="text-xs text-purple-700 space-y-1">
              {scenes
                .filter((scene) => scene.isVfxScene)
                .map((scene) => {
                  return (
                    <li key={scene.id} className="flex items-center">
                      <Sparkles className="h-4 w-4 mr-1 text-purple-600" />
                      Scene {scene.sceneNumber}: {scene.heading.length > 30 ? scene.heading.substring(0, 30) + "..." : scene.heading}
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
