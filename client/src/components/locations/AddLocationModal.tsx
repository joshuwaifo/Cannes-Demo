import { useState } from "react";
import { AddLocationModalProps, locationFormSchema } from "@/lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type FormValues = z.infer<typeof locationFormSchema>;

export default function AddLocationModal({ isOpen, onClose, onAdd, isSubmitting }: AddLocationModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  
  const form = useForm<FormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      country: "",
      region: "",
      incentiveProgram: "",
      incentiveDetails: "",
      minimumSpend: "",
      eligibleProductionTypes: "",
      limitsCaps: "",
      qualifyingExpenses: "",
      applicationProcess: "",
      applicationDeadlines: "",
      imageUrl: ""
    }
  });

  const handleImagePreview = (url: string) => {
    if (url) setPreviewUrl(url);
  };

  const onSubmit = async (values: FormValues) => {
    await onAdd(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        // Don't reset during active submission
        if (!isSubmitting) {
          form.reset();
          setPreviewUrl("");
        }
      }
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Location</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter country name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter region or state" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="incentiveProgram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incentive Program</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter incentive program name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="minimumSpend"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Spend</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter minimum spend requirement" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="eligibleProductionTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Eligible Production Types</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter eligible production types" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="applicationDeadlines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application Deadlines</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter application deadlines" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="incentiveDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Incentive Details</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter incentive details" 
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
              name="limitsCaps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limits & Caps</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter limits and caps information" 
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
              name="qualifyingExpenses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qualifying Expenses</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter qualifying expenses information" 
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
              name="applicationProcess"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application Process</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter application process details" 
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
                    <div className="mt-2 w-48 h-32 overflow-hidden border rounded">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={() => setPreviewUrl("https://placehold.co/400x300/gray/white?text=Invalid+Image+URL")}
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
                    Adding...
                  </>
                ) : (
                  'Add Location'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}