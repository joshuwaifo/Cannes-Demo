// client/src/components/script/ActorSuggestionCard.tsx
import { ActorSuggestionCardProps } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, AlertCircle, CheckCircle } from "lucide-react"; // Added CheckCircle for no controversy

export default function ActorSuggestionCard({ actor }: ActorSuggestionCardProps) {
  return (
    <Card className="flex items-center p-3 space-x-3 shadow-sm hover:shadow-md transition-shadow">
      <Avatar className="h-16 w-16">
        <AvatarImage src={actor.imageUrl || undefined} alt={actor.name} />
        <AvatarFallback>
          {actor.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex justify-between items-start">
            <h4 className="font-semibold text-sm">{actor.name}</h4>
            {actor.controversyFlag ? (
                <Badge variant="destructive" className="text-xs ml-2 whitespace-nowrap">
                    <AlertCircle className="h-3 w-3 mr-1" /> Risk
                </Badge>
            ) : (
                 <Badge variant="secondary" className="text-xs ml-2 whitespace-nowrap bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" /> Clear
                </Badge>
            )}
        </div>
        <p className="text-xs text-muted-foreground">
          {actor.gender}, {actor.nationality}
        </p>
        {actor.matchReason && (
          <p className="text-xs mt-1 italic text-primary/80">
            Match: {actor.matchReason}
          </p>
        )}
      </div>
      {/* Add more details or action buttons if needed */}
    </Card>
  );
}