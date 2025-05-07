import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Location, LocationFormData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, 
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Edit, Trash2, MapPin, Plus } from "lucide-react";
import EditLocationModal from "@/components/locations/EditLocationModal";
import AddLocationModal from "@/components/locations/AddLocationModal";
import DeleteLocationDialog from "@/components/locations/DeleteLocationDialog";
import { apiRequest } from "@/lib/queryClient";

export default function LocationsDatabase() {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const queryClient = useQueryClient();

  // Query to fetch locations with filtering and pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/locations', search, country, page],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (country && country !== 'all') queryParams.append('country', country);
      queryParams.append('page', page.toString());
      queryParams.append('pageSize', pageSize.toString());
      
      const response = await fetch(`/api/locations?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      return response.json();
    }
  });

  // Query available countries for the dropdown
  const { data: countriesData } = useQuery({
    queryKey: ['/api/locations/countries'],
    queryFn: async () => {
      // We'll just extract unique countries from the data we have
      if (data?.locations) {
        const uniqueCountries = Array.from(new Set(data.locations.map((loc: Location) => loc.country)));
        return uniqueCountries.sort();
      }
      return [];
    },
    enabled: !!data?.locations
  });

  // Handle errors
  if (error) {
    toast({
      title: "Error",
      description: `Failed to load locations: ${(error as Error).message}`,
      variant: "destructive"
    });
  }

  // Add location mutation
  const addLocationMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      return await apiRequest('POST', '/api/locations', data);
    },
    onSuccess: () => {
      toast({
        title: "Location added",
        description: "The location has been added successfully.",
      });
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/locations'] 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add location",
        description: error.message || "There was an error adding the location.",
      });
    },
  });

  // Edit location mutation
  const editLocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: LocationFormData }) => {
      return await apiRequest('PUT', `/api/locations/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Location updated",
        description: "The location information has been updated successfully.",
      });
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/locations', search, country, page] 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update location",
        description: error.message || "There was an error updating the location.",
      });
    },
  });

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/locations/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Location deleted",
        description: "The location has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/locations', search, country, page] 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete location",
        description: error.message || "There was an error deleting the location.",
      });
    },
  });

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page when search changes
  };

  // Handle pagination
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (data && page < data.totalPages) {
      setPage(page + 1);
    }
  };
  
  // Open add modal
  const openAddModal = () => {
    setIsAddModalOpen(true);
  };

  // Open edit modal with selected location
  const openEditModal = (location: Location) => {
    setSelectedLocation(location);
    setIsEditModalOpen(true);
  };

  // Open delete dialog with selected location
  const openDeleteDialog = (location: Location) => {
    setSelectedLocation(location);
    setIsDeleteDialogOpen(true);
  };
  
  // Handle location add
  const handleAddLocation = async (data: LocationFormData) => {
    await addLocationMutation.mutate(data);
  };

  // Handle location edit
  const handleEditLocation = async (id: number, data: LocationFormData) => {
    await editLocationMutation.mutate({ id, data });
  };

  // Handle location delete
  const handleDeleteLocation = async (id: number) => {
    await deleteLocationMutation.mutate(id);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Locations Database</h1>
        <Button 
          onClick={openAddModal}
          className="flex items-center"
        >
          <Plus className="mr-1 h-4 w-4" /> Add Location
        </Button>
      </div>
      
      {/* Search and filter form */}
      <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="w-[250px]">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger>
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Countries</SelectItem>
              {countriesData && countriesData.map((countryName: string) => (
                <SelectItem key={countryName} value={countryName}>
                  {countryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button type="submit">Search</Button>
      </form>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-10">
          <p className="text-gray-500">Loading locations...</p>
        </div>
      )}

      {/* Locations table */}
      {!isLoading && data?.locations && data.locations.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Incentive Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Minimum Spend
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eligible Production Types
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.locations.map((location: Location) => (
                  <tr key={location.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {location.imageUrl ? (
                        <div className="h-20 w-32 rounded overflow-hidden">
                          <img
                            src={location.imageUrl}
                            alt={`${location.country} - ${location.region}`}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "https://placehold.co/400x300/gray/white?text=No+Image";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-20 w-32 bg-gray-200 flex items-center justify-center rounded">
                          <MapPin className="text-gray-400 h-10 w-10" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {location.country}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {location.region}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {location.incentiveProgram}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {location.minimumSpend}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {location.eligibleProductionTypes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => openEditModal(location)}
                          title="Edit Location"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => openDeleteDialog(location)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete Location"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data.totalCount)} of {data.totalCount} locations
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={handlePreviousPage} 
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                onClick={handleNextPage} 
                disabled={page >= data.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* No results state */}
      {!isLoading && data?.locations && data.locations.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No locations found matching your criteria.</p>
        </div>
      )}

      {/* Add Location Modal */}
      <AddLocationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddLocation}
        isSubmitting={addLocationMutation.isPending}
      />

      {/* Edit Location Modal */}
      <EditLocationModal
        isOpen={isEditModalOpen}
        location={selectedLocation}
        onClose={() => setIsEditModalOpen(false)}
        onEdit={handleEditLocation}
        isSubmitting={editLocationMutation.isPending}
      />

      {/* Delete Location Dialog */}
      <DeleteLocationDialog
        isOpen={isDeleteDialogOpen}
        location={selectedLocation}
        onClose={() => setIsDeleteDialogOpen(false)}
        onDelete={handleDeleteLocation}
        isDeleting={deleteLocationMutation.isPending}
      />
    </div>
  );
}