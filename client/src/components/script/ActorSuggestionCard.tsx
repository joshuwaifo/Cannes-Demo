// // client/src/components/script/ActorSuggestionCard.tsx
// import { ActorSuggestionCardProps } from "@/lib/types";
// import { Card, CardContent } from "@/components/ui/card";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { Badge } from "@/components/ui/badge";
// import { User, AlertCircle, CheckCircle } from "lucide-react"; // Added CheckCircle for no controversy

// export default function ActorSuggestionCard({ actor }: ActorSuggestionCardProps) {
//   return (
//     <Card className="flex items-center p-3 space-x-3 shadow-sm hover:shadow-md transition-shadow">
//       <Avatar className="h-16 w-16">
//         <AvatarImage src={actor.imageUrl || undefined} alt={actor.name} />
//         <AvatarFallback>
//           {actor.name.substring(0, 2).toUpperCase()}
//         </AvatarFallback>
//       </Avatar>
//       <div className="flex-1">
//         <div className="flex justify-between items-start">
//             <h4 className="font-semibold text-sm">{actor.name}</h4>
//             {actor.controversyFlag ? (
//                 <Badge variant="destructive" className="text-xs ml-2 whitespace-nowrap">
//                     <AlertCircle className="h-3 w-3 mr-1" /> Risk
//                 </Badge>
//             ) : (
//                  <Badge variant="secondary" className="text-xs ml-2 whitespace-nowrap bg-green-100 text-green-800 border-green-300">
//                     <CheckCircle className="h-3 w-3 mr-1" /> Clear
//                 </Badge>
//             )}
//         </div>
//         <p className="text-xs text-muted-foreground">
//           {actor.gender}, {actor.nationality}
//         </p>
//         {actor.matchReason && (
//           <p className="text-xs mt-1 italic text-primary/80">
//             Match: {actor.matchReason}
//           </p>
//         )}
//       </div>
//       {/* Add more details or action buttons if needed */}
//     </Card>
//   );
// }

// client/src/components/script/ActorSuggestionCard.tsx
import { useState } from "react";
import { ActorSuggestionCardProps, ActorSuggestion } from "@/lib/types";
import { Card } from "@/components/ui/card"; // Only Card is needed, CardContent was not used directly
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, AlertCircle, ShieldAlert, AlertOctagon, User, Info } from "lucide-react"; // Added more icons
import ActorDetailsDialog from "../actors/ActorDetailsDialog";

// Helper to get color and icon based on controversy level
const getControversyIndicator = (level?: ActorSuggestion['controversyLevel']) => {
    switch (level) {
        case 'none':
            return { color: "bg-green-500", icon: <CheckCircle className="h-3 w-3 text-white" />, label: "No notable controversy" };
        case 'low':
            return { color: "bg-yellow-400", icon: <AlertCircle className="h-3 w-3 text-black" />, label: "Low controversy risk" };
        case 'medium':
            return { color: "bg-orange-500", icon: <ShieldAlert className="h-3 w-3 text-white" />, label: "Medium controversy risk" };
        case 'high':
            return { color: "bg-red-600", icon: <AlertOctagon className="h-3 w-3 text-white" />, label: "High controversy risk" };
        default: // Undefined or unknown
            return { color: "bg-gray-400", icon: <User className="h-3 w-3 text-white" />, label: "Controversy level unknown" };
    }
};

export default function ActorSuggestionCard({ 
  actor, 
  onSelect,
  isSelected = false,
  characterName
}: ActorSuggestionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const controversyInfo = getControversyIndicator(actor.controversyLevel);

  const handleSelectClick = () => {
    if (onSelect && characterName) {
      onSelect({
        name: characterName,
        estimatedAgeRange: undefined, // We don't have this info from the actor
        actorId: actor.id, // Pass the actor ID for tracking selections
        actorName: actor.name // Include the actor name for display
      });
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering card click
    setShowDetails(true);
  };

  return (
    <>
      <Card 
        className={`flex items-center p-3 space-x-3 shadow-sm hover:shadow-md transition-shadow w-full ${isSelected ? 'border-green-500 bg-green-50' : ''}`}
        onClick={onSelect && characterName ? handleSelectClick : undefined}
        style={{ cursor: onSelect && characterName ? 'pointer' : 'default' }}
      >
        <Avatar className="h-16 w-16 rounded-md">
          <AvatarImage
              src={actor.imageUrl || undefined}
              alt={actor.name}
              className="object-cover w-full h-full"
          />
          <AvatarFallback className="rounded-md">
            {actor.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start space-x-2">
              <h4 className="font-semibold text-sm truncate" title={actor.name}>{actor.name}</h4>
              <div className="flex items-center space-x-1.5">
                <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className={`flex items-center justify-center h-5 w-5 rounded-full ${controversyInfo.color} flex-shrink-0`}
                                aria-label={controversyInfo.label}
                            >
                                {controversyInfo.icon}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                            <p>{controversyInfo.label}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                {isSelected && (
                  <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500 flex-shrink-0">
                    <CheckCircle className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {actor.gender}, {actor.nationality}
          </p>
          {actor.matchReason && (
            <p className="text-xs mt-1 italic text-primary/80 line-clamp-2" title={actor.matchReason}>
              Match: {actor.matchReason}
            </p>
          )}
          <div className="mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs" 
              onClick={handleViewDetails}
            >
              <Info className="h-3.5 w-3.5 mr-1" />
              View Details
            </Button>
          </div>
        </div>
      </Card>

      {/* Actor Details Dialog */}
      <ActorDetailsDialog 
        isOpen={showDetails}
        actor={actor}
        onClose={() => setShowDetails(false)}
      />
    </>
  );
}