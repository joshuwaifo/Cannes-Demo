import { useState, useEffect } from "react";
import { EditActorModalProps, actorFormSchema } from "@/lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type FormValues = z.infer<typeof actorFormSchema>;

export default function EditActorModal({ 
  isOpen, 
  actor, 
  onClose, 
  onEdit,
  isSubmitting 
}: EditActorModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  
  const form = useForm<FormValues>({
    resolver: zodResolver(actorFormSchema),
    defaultValues: {
      name: "",
      gender: "",
      nationality: "",
      notableRoles: "",
      genres: "",
      recentPopularity: "",
      typicalRoles: "",
      estSalaryRange: "",
      socialMediaFollowing: "",
      availability: "",
      bestSuitedRolesStrategic: "",
      dateOfBirth: "",
      imageUrl: ""
    }
  });

  useEffect(() => {
    if (actor) {
      form.reset({
        name: actor.name,
        gender: actor.gender,
        nationality: actor.nationality,
        notableRoles: Array.isArray(actor.notableRoles) ? actor.notableRoles.join(", ") : actor.notableRoles as unknown as string,
        genres: Array.isArray(actor.genres) ? actor.genres.join(", ") : actor.genres as unknown as string,
        recentPopularity: actor.recentPopularity,
        typicalRoles: Array.isArray(actor.typicalRoles) ? actor.typicalRoles.join(", ") : actor.typicalRoles as unknown as string,
        estSalaryRange: actor.estSalaryRange,
        socialMediaFollowing: actor.socialMediaFollowing,
        availability: actor.availability,
        bestSuitedRolesStrategic: actor.bestSuitedRolesStrategic,
        dateOfBirth: actor.dateOfBirth || "",
        imageUrl: actor.imageUrl || ""
      });
      setPreviewUrl(actor.imageUrl || "");
    }
  }, [actor, form]);

  const handleImagePreview = (url: string) => {
    if (url) setPreviewUrl(url);
  };

  const onSubmit = async (values: FormValues) => {
    if (actor && actor.id) {
      // Convert comma-separated strings back to arrays
      const formattedValues = {
        ...values,
        notableRoles: values.notableRoles.split(",").map(role => role.trim()),
        genres: values.genres.split(",").map(genre => genre.trim()),
        typicalRoles: values.typicalRoles.split(",").map(role => role.trim()),
      };
      
      await onEdit(actor.id, formattedValues as any);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        // Don't reset during active submission
        if (!isSubmitting) {
          setPreviewUrl("");
        }
      }
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Actor</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter actor name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter gender" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input placeholder="YYYY-MM-DD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter nationality" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="recentPopularity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recent Popularity</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter recent popularity status" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="estSalaryRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Salary Range</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter estimated salary range" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="socialMediaFollowing"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social Media Following</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter social media following" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Availability</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter availability" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notableRoles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notable Roles (comma-separated)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter notable roles, separated by commas" 
                      {...field} 
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="genres"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Genres (comma-separated)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter genres, separated by commas" 
                      {...field} 
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="typicalRoles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typical Roles (comma-separated)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter typical roles, separated by commas" 
                      {...field} 
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="bestSuitedRolesStrategic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Best Suited Roles (Strategic)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter best suited roles" 
                      {...field} 
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter image URL" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        handleImagePreview(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {previewUrl && (
                    <div className="mt-2 w-48 h-64 overflow-hidden border rounded">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={() => setPreviewUrl("https://placehold.co/400x600/gray/white?text=Invalid+Image+URL")}
                      />
                    </div>
                  )}
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}