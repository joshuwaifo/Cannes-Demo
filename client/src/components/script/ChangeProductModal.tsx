// Create this new file: client/src/components/script/ChangeProductModal.tsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, X } from "lucide-react";
import { ProductCategory } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ChangeProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSelect: (productId: number) => void;
  currentProductId: number; // To disable the currently assigned product
  isSubmitting: boolean; // To disable interactions while parent is submitting
}

const ProductItemCard = ({
  product,
  onSelect,
  isSelected,
  isDisabled,
}: {
  product: Product;
  onSelect: (productId: number) => void;
  isSelected: boolean;
  isDisabled: boolean;
}) => (
  <div
    className={`border rounded-lg p-3 flex flex-col items-center space-y-2 cursor-pointer hover:shadow-md transition-shadow
                ${isSelected ? "border-primary ring-2 ring-primary" : "border-gray-200"}
                ${isDisabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "bg-white"}`}
    onClick={() => !isDisabled && onSelect(product.id)}
  >
    <img
      src={product.imageUrl}
      alt={product.name}
      className="w-24 h-24 object-contain rounded"
      onError={(e) => {
        (e.target as HTMLImageElement).src =
          "https://placehold.co/100x100?text=No+Img";
      }}
    />
    <div className="text-center">
      <p className="text-xs text-gray-500 truncate w-28">
        {product.companyName}
      </p>
      <p className="text-sm font-medium truncate w-28">{product.name}</p>
      <p className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full inline-block">
        {product.category}
      </p>
    </div>
    <Button
      size="sm"
      variant={isSelected ? "default" : "outline"}
      onClick={() => !isDisabled && onSelect(product.id)}
      disabled={isDisabled || isSelected}
      className="w-full mt-auto"
    >
      {isSelected ? "Selected" : "Select"}
    </Button>
  </div>
);

export default function ChangeProductModal({
  isOpen,
  onClose,
  onProductSelect,
  currentProductId,
  isSubmitting,
}: ChangeProductModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "ALL">(
    "ALL",
  );
  const [selectedStagedProductId, setSelectedStagedProductId] = useState<
    number | null
  >(null);
  const [page, setPage] = useState(1);
  const pageSize = 8; // Number of products per page in modal

  const {
    data: productsResponse,
    isLoading: isLoadingProducts,
    isFetching: isFetchingProducts,
  } = useQuery<{
    products: Product[];
    totalPages: number;
    currentPage: number;
  }>({
    queryKey: [
      "/api/products",
      { search: searchQuery, category: categoryFilter, page, pageSize },
    ],
    refetchOnWindowFocus: false,
    keepPreviousData: true, // Keep previous data while new data is fetching for smoother pagination
  });

  const products = productsResponse?.products || [];
  const totalPages = productsResponse?.totalPages || 1;

  const handleConfirmSelection = () => {
    if (selectedStagedProductId !== null) {
      onProductSelect(selectedStagedProductId);
    }
  };

  // Reset staged selection when modal is closed or current product changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedStagedProductId(null);
      setSearchQuery("");
      setCategoryFilter("ALL");
      setPage(1);
    }
  }, [isOpen, currentProductId]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Change Product for Variation</DialogTitle>
          <DialogClose
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="flex gap-2 p-1 border-b pb-3 mb-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-8 w-full"
              disabled={isSubmitting}
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value as ProductCategory | "ALL");
              setPage(1);
            }}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {Object.values(ProductCategory).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-grow pr-2 -mr-2">
          {" "}
          {/* Added padding for scrollbar */}
          {isLoadingProducts && products.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {Array.from({ length: pageSize }).map((_, i) => (
                <div
                  key={i}
                  className="border rounded-lg p-3 flex flex-col items-center space-y-2"
                >
                  <Skeleton className="w-24 h-24 rounded" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-full mt-2" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No products found matching your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {products.map((product) => (
                <ProductItemCard
                  key={product.id}
                  product={product}
                  onSelect={setSelectedStagedProductId}
                  isSelected={selectedStagedProductId === product.id}
                  isDisabled={product.id === currentProductId || isSubmitting}
                />
              ))}
            </div>
          )}
          {isFetchingProducts && (
            <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin text-primary" />
          )}
        </ScrollArea>

        {/* Pagination for Modal */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-2 pt-3 border-t mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || isFetchingProducts || isSubmitting}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={
                page === totalPages || isFetchingProducts || isSubmitting
              }
            >
              Next
            </Button>
          </div>
        )}

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={
              selectedStagedProductId === null ||
              isSubmitting ||
              selectedStagedProductId === currentProductId
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Changing...
              </>
            ) : (
              "Confirm Change"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
