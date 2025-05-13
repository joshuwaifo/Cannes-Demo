import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Actor } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ActorDetailsDialogProps {
  isOpen: boolean;
  actor: Actor | null;
  onClose: () => void;
}

export default function ActorDetailsDialog({ isOpen, actor, onClose }: ActorDetailsDialogProps) {
  if (!actor) return null;
  
  // Format arrays for display
  const formatArray = (value: string[] | string | null): string => {
    if (!value) return "-";
    return Array.isArray(value) ? value.join(", ") : value;
  };
  
  // Calculate age if birthdate is available
  const calculateAge = (dateOfBirth: string): number => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogDescription className="sr-only">
          Detailed information about {actor.name}
        </DialogDescription>
        <DialogHeader className="flex-row space-y-0 items-start justify-between">
          <DialogTitle className="text-xl font-bold">{actor.name}</DialogTitle>
          {/* Button removed as Dialog already has a close button */}
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {/* Left column - Image and basic info */}
          <div className="space-y-4">
            <div className="rounded-md overflow-hidden border bg-card h-64 w-full">
              {actor.imageUrl ? (
                <img 
                  src={actor.imageUrl} 
                  alt={actor.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://placehold.co/300x400/gray/white?text=No+Image";
                  }}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-muted">
                  <span className="text-2xl font-semibold">
                    {actor.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="font-semibold w-24">Gender:</span>
                <span>{actor.gender || "-"}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold w-24">Nationality:</span>
                <span>{actor.nationality || "-"}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold w-24">Birthdate:</span>
                <span>{actor.dateOfBirth || "-"}</span>
              </div>
              {actor.dateOfBirth && (
                <div className="flex items-center">
                  <span className="font-semibold w-24">Age:</span>
                  <span>{calculateAge(actor.dateOfBirth)} years</span>
                </div>
              )}
              <div className="flex items-center">
                <span className="font-semibold w-24">Popularity:</span>
                <span>{actor.recentPopularity || "-"}</span>
              </div>
            </div>
          </div>
          
          {/* Right column - Details */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <h3 className="text-md font-semibold border-b pb-1">Career Details</h3>
              <div className="grid grid-cols-1 gap-3 mt-2">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Notable Roles</span>
                  <p className="mt-1">{formatArray(actor.notableRoles)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Typical Roles</span>
                  <p className="mt-1">{formatArray(actor.typicalRoles)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Genres</span>
                  <p className="mt-1">{formatArray(actor.genres)}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-md font-semibold border-b pb-1">Production Information</h3>
              <div className="grid grid-cols-1 gap-3 mt-2">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Estimated Salary Range</span>
                  <p className="mt-1">{actor.estSalaryRange || "-"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Social Media Following</span>
                  <p className="mt-1">{actor.socialMediaFollowing || "-"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Availability</span>
                  <p className="mt-1">{actor.availability || "-"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Best Suited Strategic Roles</span>
                  <p className="mt-1">{actor.bestSuitedRolesStrategic || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}