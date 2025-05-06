import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@shared/schema";
import { ProductFormData } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/products/ProductCard";
import AddProductModal from "@/components/products/AddProductModal";
import EditProductModal from "@/components/products/EditProductModal";
import DeleteProductDialog from "@/components/products/DeleteProductDialog";

export default function ProductDatabase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Fetch products
  const {
    data: productsResponse,
    isLoading
  } = useQuery<{
    products: Product[],
    totalPages: number,
    currentPage: number
  }>({
    queryKey: ['/api/products', { search: searchQuery, category: categoryFilter, page: currentPage }],
    refetchOnWindowFocus: false,
  });

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return await apiRequest('POST', '/api/products', data);
    },
    onSuccess: () => {
      toast({
        title: "Brand added",
        description: "The brand has been added successfully.",
      });
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/products', { search: searchQuery, category: categoryFilter, page: currentPage }] 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add brand",
        description: error.message || "There was an error adding the brand.",
      });
    },
  });

  // Edit product mutation
  const editProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: ProductFormData }) => {
      return await apiRequest('PUT', `/api/products/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Brand updated",
        description: "The brand has been updated successfully.",
      });
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/products', { search: searchQuery, category: categoryFilter, page: currentPage }] 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update brand",
        description: error.message || "There was an error updating the brand.",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/products/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Brand deleted",
        description: "The brand has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/products', { search: searchQuery, category: categoryFilter, page: currentPage }] 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete brand",
        description: error.message || "There was an error deleting the brand.",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
    queryClient.invalidateQueries({ 
      queryKey: ['/api/products', { search: searchQuery, category: categoryFilter, page: 1 }] 
    });
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1); // Reset to first page on filter change
    queryClient.invalidateQueries({ 
      queryKey: ['/api/products', { search: searchQuery, category: value, page: 1 }] 
    });
  };

  const handleAddProduct = async (data: ProductFormData) => {
    await addProductMutation.mutateAsync(data);
  };

  const handleEditProduct = async (id: number, data: ProductFormData) => {
    await editProductMutation.mutateAsync({ id, data });
  };

  const handleDeleteProduct = async (id: number) => {
    await deleteProductMutation.mutateAsync(id);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const products = productsResponse?.products || [];
  const totalPages = productsResponse?.totalPages || 1;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-secondary">Brand Database</h2>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white"
        >
          <Plus className="h-5 w-5 mr-1" />
          Add New Brand
        </Button>
      </div>

      {/* Filter Controls */}
      <form 
        className="flex flex-col md:flex-row md:items-center mb-6 space-y-3 md:space-y-0 md:space-x-4"
        onSubmit={handleSearch}
      >
        <div className="flex-grow">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input 
              type="text" 
              placeholder="Search brands..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <Select 
            value={categoryFilter} 
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="BEVERAGE">Beverage</SelectItem>
              <SelectItem value="ELECTRONICS">Electronics</SelectItem>
              <SelectItem value="FOOD">Food</SelectItem>
              <SelectItem value="AUTOMOTIVE">Automotive</SelectItem>
              <SelectItem value="FASHION">Fashion</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            type="submit"
            variant="outline"
            size="icon"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>
      </form>

      {/* Brands Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-4 flex justify-end space-x-2">
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-9 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-2">No brands found</h3>
          <p className="text-muted-foreground">
            {searchQuery || categoryFilter !== "ALL" 
              ? "Try adjusting your search or filter criteria." 
              : "Add your first brand to get started."}
          </p>
          <Button 
            variant="default" 
            className="mt-4"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add New Brand
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard 
              key={product.id}
              product={product}
              onEdit={openEditModal}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {products.length > 0 && totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </nav>
        </div>
      )}

      {/* Modals */}
      <AddProductModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddProduct}
        isSubmitting={addProductMutation.isPending}
      />
      
      <EditProductModal 
        isOpen={isEditModalOpen}
        product={selectedProduct}
        onClose={() => setIsEditModalOpen(false)}
        onEdit={handleEditProduct}
        isSubmitting={editProductMutation.isPending}
      />
      
      <DeleteProductDialog 
        isOpen={isDeleteDialogOpen}
        product={selectedProduct}
        onClose={() => setIsDeleteDialogOpen(false)}
        onDelete={handleDeleteProduct}
        isDeleting={deleteProductMutation.isPending}
      />
    </div>
  );
}
