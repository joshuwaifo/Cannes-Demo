// import { SceneBreakdownProps } from "@/lib/types";
// import { cn } from "@/lib/utils";
// import { CheckCircle, Info } from "lucide-react";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Skeleton } from "@/components/ui/skeleton";

// export default function SceneBreakdown({
//   scenes,
//   activeSceneId,
//   projectTitle,
//   brandableSceneIds,
//   isLoading,
//   onSceneSelect,
// }: SceneBreakdownProps) {
//   if (isLoading) {
//     return (
//       <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow animate-pulse">
//         <h2 className="text-lg font-semibold mb-4 text-foreground">
//           <Skeleton className="h-6 w-3/4" />
//         </h2>
//         <div className="space-y-2">
//           {Array.from({ length: 6 }).map((_, i) => (
//             <div key={i} className="flex items-center">
//               <Skeleton className="h-6 w-full" />
//             </div>
//           ))}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow">
//       <h2 className="text-lg font-semibold mb-4 text-foreground">
//         {projectTitle
//           ? `Scene Breakdown for "${projectTitle}"`
//           : "Scene Breakdown"}
//       </h2>

//       <div className="h-[400px] overflow-hidden">
//         <ScrollArea className="h-full pr-2">
//           <ul className="space-y-2">
//             {scenes.map((scene) => (
//               <li
//                 key={scene.id}
//                 className={cn(
//                   "px-3 py-2 rounded-r cursor-pointer scene-item",
//                   activeSceneId === scene.id ? "active" : "",
//                 )}
//                 onClick={() => onSceneSelect(scene.id)}
//               >
//                 <div className="flex justify-between items-center">
//                   <div>
//                     <span className="font-semibold">
//                       Scene {scene.sceneNumber}
//                     </span>
//                     <p className="text-xs text-gray-600">{scene.heading}</p>
//                   </div>
//                   {brandableSceneIds.includes(scene.id) && (
//                     <Info className="h-5 w-5 brandable-indicator" />
//                   )}
//                 </div>
//               </li>
//             ))}
//           </ul>
//         </ScrollArea>
//       </div>

//       {brandableSceneIds.length > 0 && (
//         <div className="mt-6 pt-4 border-t border-gray-200">
//           <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
//             AI Suggested Brandable Scenes
//           </h3>
//           <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
//             <p className="text-sm text-yellow-800 mb-2 font-medium">
//               {`There are ${scenes.length} scenes with product placement potential. AI has suggested the following scenes for their branding potential:`}
//             </p>
//             <ul className="text-xs text-yellow-700 space-y-1">
//               {scenes
//                 .filter((scene) => brandableSceneIds.includes(scene.id))
//                 .map((scene) => {
//                   const category = scene.suggestedCategories?.length
//                     ? scene.suggestedCategories[0]
//                     : "Product";

//                   return (
//                     <li key={scene.id} className="flex items-center">
//                       <CheckCircle className="h-4 w-4 mr-1 text-yellow-600" />
//                       Scene {scene.sceneNumber}: {scene.heading} ({category})
//                     </li>
//                   );
//                 })}
//             </ul>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// client/src/components/script/SceneBreakdown.tsx
import { SceneBreakdownProps } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react"; // Changed from Info to Star
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
                  {brandableSceneIds.includes(scene.id) && (
                    <Star className="h-5 w-5 text-green-500 brandable-indicator" /> // Changed icon and color
                  )}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>

      {brandableSceneIds.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Vadis AI Suggested Brandable Scenes {/* Changed AI to Vadis AI */}
          </h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800 mb-2 font-medium">
              {/* Changed AI to Vadis AI */}
              {`There are ${scenes.length} scenes with product placement potential. Vadis AI has suggested the following scenes for their branding potential:`}
            </p>
            <ul className="text-xs text-yellow-700 space-y-1">
              {scenes
                .filter((scene) => brandableSceneIds.includes(scene.id))
                .map((scene) => {
                  const category = scene.suggestedCategories?.length
                    ? scene.suggestedCategories[0]
                    : "Product";

                  return (
                    <li key={scene.id} className="flex items-center">
                      <Star className="h-4 w-4 mr-1 text-yellow-600" />{" "}
                      {/* Changed icon */}
                      Scene {scene.sceneNumber}: {scene.heading} ({category})
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
