import { useState, useEffect } from "react";
import { EditProductModalProps, productFormSchema } from "@/lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    FilmRatingEnum, DemographicGenderEnum, DemographicAgeEnum, GenreEnum,
    FilmRatingType, DemographicGenderType, DemographicAgeType, GenreType, ProductCategory
} from "@shared/schema";

type FormValues = z.infer<typeof productFormSchema>;

export default function EditProductModal({
  isOpen,
  product,
  onClose,
  onEdit,
  isSubmitting,
}: EditProductModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      companyName: "",
      name: "",
      category: "BEVERAGE" as ProductCategory, // Ensure type assertion
      imageUrl: "",
      filmRating: null,
      demographicGender: null,
      demographicAge: [],
      genre: null,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        companyName: product.companyName || "",
        name: product.name,
        category: product.category,
        filmRating: product.filmRating || null,
        demographicGender: product.demographicGender || null,
        demographicAge: product.demographicAge || [],
        genre: product.genre || null,
        imageUrl: product.imageUrl || "",
      });
      setPreviewUrl(product.imageUrl || "");
    }
  }, [product, form]);

  const handleImagePreview = (url: string) => {
    if (url) setPreviewUrl(url);
  };

  const onSubmit = async (values: FormValues) => {
    if (product) {
      await onEdit(product.id, values);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          if (!isSubmitting) {
            setPreviewUrl("");
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  {/* CHANGED LABEL HERE */}
                  <FormLabel>Brand Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter brand name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  {/* CHANGED LABEL HERE */}
                  <FormLabel>Product Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value} 
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BEVERAGE">Beverage</SelectItem>
                      <SelectItem value="ELECTRONICS">Electronics</SelectItem>
                      <SelectItem value="FOOD">Food</SelectItem>
                      <SelectItem value="AUTOMOTIVE">Automotive</SelectItem>
                      <SelectItem value="FASHION">Fashion</SelectItem>
                      <SelectItem value="WATCH">Watch</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="filmRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audience Targeting: Film Rating</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined} 
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select film rating" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(FilmRatingEnum).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="demographicGender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Demographic Gender</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined} 
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(DemographicGenderEnum).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="demographicAge"
              render={() => (
                <FormItem>
                   <div className="mb-2">
                    <FormLabel>Demographic Age Ranges</FormLabel>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                  {Object.entries(DemographicAgeEnum).map(([key, value]) => (
                    <FormField
                      key={key}
                      control={form.control}
                      name="demographicAge" 
                      render={({ field }) => (
                         <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                           <FormControl>
                             <Checkbox
                               checked={field.value?.includes(key as DemographicAgeType)}
                               onCheckedChange={(checked) => {
                                 return checked
                                   ? field.onChange([...(field.value || []), key as DemographicAgeType])
                                   : field.onChange((field.value || []).filter((v: DemographicAgeType) => v !== key));
                               }}
                             />
                           </FormControl>
                           <FormLabel className="text-sm font-normal">{key === "AllAges" ? "All Ages" : value}</FormLabel>
                         </FormItem>
                      )}
                    />
                  ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="genre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Genre</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select genre" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(GenreEnum).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Image URL</FormLabel>
                  <FormControl>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Enter image URL"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleImagePreview(e.target.value);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />

                  {previewUrl && (
                    <div className="mt-2 border rounded-md overflow-hidden h-32 bg-gray-50 flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                        onError={() => setPreviewUrl("")}
                      />
                    </div>
                  )}

                  {!previewUrl && (
                    <div className="mt-2 border-2 border-dashed border-gray-300 rounded-md h-32 flex flex-col items-center justify-center bg-gray-50">
                      <Upload className="h-8 w-8 text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">
                        Enter URL to preview
                      </p>
                    </div>
                  )}
                </FormItem>
              )}
            />

            <DialogFooter className="sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}