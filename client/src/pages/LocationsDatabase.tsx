// import { useState } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { Location, LocationFormData } from "@/lib/types";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { toast } from "@/hooks/use-toast";
// import { Edit, Trash2, MapPin, Plus } from "lucide-react";
// import EditLocationModal from "@/components/locations/EditLocationModal";
// import AddLocationModal from "@/components/locations/AddLocationModal";
// import DeleteLocationDialog from "@/components/locations/DeleteLocationDialog";
// import { apiRequest } from "@/lib/queryClient";

// export default function LocationsDatabase() {
//   const [search, setSearch] = useState("");
//   const [country, setCountry] = useState("all");
//   const [page, setPage] = useState(1);
//   const pageSize = 10;
//   const [isAddModalOpen, setIsAddModalOpen] = useState(false);
//   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
//   const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
//   const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
//   const queryClient = useQueryClient();

//   // Query to fetch locations with filtering and pagination
//   const { data, isLoading, error } = useQuery({
//     queryKey: ['/api/locations', search, country, page],
//     queryFn: async () => {
//       const queryParams = new URLSearchParams();
//       if (search) queryParams.append('search', search);
//       if (country && country !== 'all') queryParams.append('country', country);
//       queryParams.append('page', page.toString());
//       queryParams.append('pageSize', pageSize.toString());

//       const response = await fetch(`/api/locations?${queryParams.toString()}`);
//       if (!response.ok) {
//         throw new Error('Failed to fetch locations');
//       }
//       return response.json();
//     }
//   });

//   // Query available countries for the dropdown
//   const { data: countriesData } = useQuery({
//     queryKey: ['/api/locations/countries'],
//     queryFn: async () => {
//       // We'll just extract unique countries from the data we have
//       if (data?.locations) {
//         const uniqueCountries = Array.from(new Set(data.locations.map((loc: Location) => loc.country)));
//         return uniqueCountries.sort();
//       }
//       return [];
//     },
//     enabled: !!data?.locations
//   });

//   // Handle errors
//   if (error) {
//     toast({
//       title: "Error",
//       description: `Failed to load locations: ${(error as Error).message}`,
//       variant: "destructive"
//     });
//   }

//   // Add location mutation
//   const addLocationMutation = useMutation({
//     mutationFn: async (data: LocationFormData) => {
//       return await apiRequest('POST', '/api/locations', data);
//     },
//     onSuccess: () => {
//       toast({
//         title: "Location added",
//         description: "The location has been added successfully.",
//       });
//       setIsAddModalOpen(false);
//       queryClient.invalidateQueries({
//         queryKey: ['/api/locations']
//       });
//     },
//     onError: (error: Error) => {
//       toast({
//         variant: "destructive",
//         title: "Failed to add location",
//         description: error.message || "There was an error adding the location.",
//       });
//     },
//   });

//   // Edit location mutation
//   const editLocationMutation = useMutation({
//     mutationFn: async ({ id, data }: { id: number, data: LocationFormData }) => {
//       return await apiRequest('PUT', `/api/locations/${id}`, data);
//     },
//     onSuccess: () => {
//       toast({
//         title: "Location updated",
//         description: "The location information has been updated successfully.",
//       });
//       setIsEditModalOpen(false);
//       queryClient.invalidateQueries({
//         queryKey: ['/api/locations', search, country, page]
//       });
//     },
//     onError: (error: Error) => {
//       toast({
//         variant: "destructive",
//         title: "Failed to update location",
//         description: error.message || "There was an error updating the location.",
//       });
//     },
//   });

//   // Delete location mutation
//   const deleteLocationMutation = useMutation({
//     mutationFn: async (id: number) => {
//       return await apiRequest('DELETE', `/api/locations/${id}`);
//     },
//     onSuccess: () => {
//       toast({
//         title: "Location deleted",
//         description: "The location has been deleted successfully.",
//       });
//       setIsDeleteDialogOpen(false);
//       queryClient.invalidateQueries({
//         queryKey: ['/api/locations', search, country, page]
//       });
//     },
//     onError: (error: Error) => {
//       toast({
//         variant: "destructive",
//         title: "Failed to delete location",
//         description: error.message || "There was an error deleting the location.",
//       });
//     },
//   });

//   // Handle search form submission
//   const handleSearchSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     setPage(1); // Reset to first page when search changes
//   };

//   // Handle pagination
//   const handlePreviousPage = () => {
//     if (page > 1) {
//       setPage(page - 1);
//     }
//   };

//   const handleNextPage = () => {
//     if (data && page < data.totalPages) {
//       setPage(page + 1);
//     }
//   };

//   // Open add modal
//   const openAddModal = () => {
//     setIsAddModalOpen(true);
//   };

//   // Open edit modal with selected location
//   const openEditModal = (location: Location) => {
//     setSelectedLocation(location);
//     setIsEditModalOpen(true);
//   };

//   // Open delete dialog with selected location
//   const openDeleteDialog = (location: Location) => {
//     setSelectedLocation(location);
//     setIsDeleteDialogOpen(true);
//   };

//   // Handle location add
//   const handleAddLocation = async (data: LocationFormData) => {
//     await addLocationMutation.mutate(data);
//   };

//   // Handle location edit
//   const handleEditLocation = async (id: number, data: LocationFormData) => {
//     await editLocationMutation.mutate({ id, data });
//   };

//   // Handle location delete
//   const handleDeleteLocation = async (id: number) => {
//     await deleteLocationMutation.mutate(id);
//   };

//   return (
//     <div className="p-4">
//       <div className="flex justify-between items-center mb-6">
//         <h1 className="text-3xl font-bold">Locations Database</h1>
//         <Button
//           onClick={openAddModal}
//           className="flex items-center"
//         >
//           <Plus className="mr-1 h-4 w-4" /> Add Location
//         </Button>
//       </div>

//       {/* Search and filter form */}
//       <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-wrap gap-4">
//         <div className="flex-1 min-w-[200px]">
//           <Input
//             placeholder="Search locations..."
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//         </div>

//         <div className="w-[250px]">
//           <Select value={country} onValueChange={setCountry}>
//             <SelectTrigger>
//               <SelectValue placeholder="Country" />
//             </SelectTrigger>
//             <SelectContent className="max-h-[300px]">
//               <SelectItem value="all">All Countries</SelectItem>
//               {countriesData && countriesData.map((countryName: string) => (
//                 <SelectItem key={countryName} value={countryName}>
//                   {countryName}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </div>

//         <Button type="submit">Search</Button>
//       </form>

//       {/* Loading state */}
//       {isLoading && (
//         <div className="text-center py-10">
//           <p className="text-gray-500">Loading locations...</p>
//         </div>
//       )}

//       {/* Locations table */}
//       {!isLoading && data?.locations && data.locations.length > 0 && (
//         <>
//           <div className="overflow-x-auto bg-white shadow-md rounded-lg">
//             <table className="min-w-full divide-y divide-gray-200">
//               <thead className="bg-gray-50">
//                 <tr>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Image
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Country
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Region
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Incentive Program
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Minimum Spend
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Eligible Production Types
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Actions
//                   </th>
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {data.locations.map((location: Location) => (
//                   <tr key={location.id}>
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       {location.imageUrl ? (
//                         <div className="h-20 w-32 rounded overflow-hidden">
//                           <img
//                             src={location.imageUrl}
//                             alt={`${location.country} - ${location.region}`}
//                             className="h-full w-full object-cover"
//                             onError={(e) => {
//                               const target = e.target as HTMLImageElement;
//                               target.src = "https://placehold.co/400x300/gray/white?text=No+Image";
//                             }}
//                           />
//                         </div>
//                       ) : (
//                         <div className="h-20 w-32 bg-gray-200 flex items-center justify-center rounded">
//                           <MapPin className="text-gray-400 h-10 w-10" />
//                         </div>
//                       )}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
//                       {location.country}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                       {location.region}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                       {location.incentiveProgram}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                       {location.minimumSpend}
//                     </td>
//                     <td className="px-6 py-4 text-sm text-gray-500">
//                       {location.eligibleProductionTypes}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                       <div className="flex space-x-2">
//                         <Button
//                           variant="outline"
//                           size="icon"
//                           onClick={() => openEditModal(location)}
//                           title="Edit Location"
//                         >
//                           <Edit className="h-4 w-4" />
//                         </Button>
//                         <Button
//                           variant="outline"
//                           size="icon"
//                           onClick={() => openDeleteDialog(location)}
//                           className="text-red-500 hover:text-red-700"
//                           title="Delete Location"
//                         >
//                           <Trash2 className="h-4 w-4" />
//                         </Button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>

//           {/* Pagination */}
//           <div className="mt-4 flex justify-between items-center">
//             <div className="text-sm text-gray-500">
//               Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data.totalCount)} of {data.totalCount} locations
//             </div>
//             <div className="flex space-x-2">
//               <Button
//                 variant="outline"
//                 onClick={handlePreviousPage}
//                 disabled={page === 1}
//               >
//                 Previous
//               </Button>
//               <Button
//                 variant="outline"
//                 onClick={handleNextPage}
//                 disabled={page >= data.totalPages}
//               >
//                 Next
//               </Button>
//             </div>
//           </div>
//         </>
//       )}

//       {/* No results state */}
//       {!isLoading && data?.locations && data.locations.length === 0 && (
//         <div className="text-center py-10 bg-gray-50 rounded-lg">
//           <p className="text-gray-500">No locations found matching your criteria.</p>
//         </div>
//       )}

//       {/* Add Location Modal */}
//       <AddLocationModal
//         isOpen={isAddModalOpen}
//         onClose={() => setIsAddModalOpen(false)}
//         onAdd={handleAddLocation}
//         isSubmitting={addLocationMutation.isPending}
//       />

//       {/* Edit Location Modal */}
//       <EditLocationModal
//         isOpen={isEditModalOpen}
//         location={selectedLocation}
//         onClose={() => setIsEditModalOpen(false)}
//         onEdit={handleEditLocation}
//         isSubmitting={editLocationMutation.isPending}
//       />

//       {/* Delete Location Dialog */}
//       <DeleteLocationDialog
//         isOpen={isDeleteDialogOpen}
//         location={selectedLocation}
//         onClose={() => setIsDeleteDialogOpen(false)}
//         onDelete={handleDeleteLocation}
//         isDeleting={deleteLocationMutation.isPending}
//       />
//     </div>
//   );
// }

import { useState, useEffect } from "react";
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
import { Edit, Trash2, MapPin, Plus, AlertTriangle } from "lucide-react";
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
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null,
  );
  const queryClient = useQueryClient();

  // Query to fetch locations with filtering and pagination
  const { data, isLoading, error } = useQuery<{
    locations: Location[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }>({
    queryKey: ["/api/locations", { search, country, page, pageSize }],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (country && country !== "all") queryParams.append("country", country);
      queryParams.append("page", page.toString());
      queryParams.append("pageSize", pageSize.toString());

      const response = await fetch(`/api/locations?${queryParams.toString()}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch locations: ${response.status} ${
            errorText || response.statusText
          }`,
        );
      }
      return response.json();
    },
  });

  // Use useEffect to handle errors from the main query and show toast messages
  useEffect(() => {
    if (error) {
      // The toast is now shown via the dedicated error block in JSX,
      // but this useEffect could be used for other side effects if needed.
      // For now, ensure no toast is called directly here to avoid the previous error.
      console.error("Error fetching locations:", error);
    }
  }, [error]);

  // Query available countries for the dropdown
  const { data: countriesData } = useQuery<string[]>({
    queryKey: ["derivedCountriesFromLocations", data?.totalCount], // Re-fetch if total locations count changes significantly
    queryFn: async () => {
      if (data?.locations && data.locations.length > 0) {
        const uniqueCountries = Array.from(
          new Set(data.locations.map((loc: Location) => loc.country)),
        );
        return uniqueCountries.sort();
      }
      try {
        const allLocationsResponse = await queryClient.fetchQuery<{
          locations: Location[];
        }>({
          queryKey: [
            "/api/locations",
            { search: "", country: "all", page: 1, pageSize: 1000 }, // Fetch a large page
          ],
        });
        if (allLocationsResponse?.locations) {
          const uniqueCountries = Array.from(
            new Set(
              allLocationsResponse.locations.map(
                (loc: Location) => loc.country,
              ),
            ),
          );
          return uniqueCountries.sort();
        }
      } catch (e) {
        console.error("Failed to fetch all countries for dropdown:", e);
      }
      return [];
    },
    enabled: true,
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
  });

  const addLocationMutation = useMutation({
    mutationFn: async (newLocationData: LocationFormData) => {
      return await apiRequest("POST", "/api/locations", newLocationData);
    },
    onSuccess: () => {
      toast({
        title: "Location added",
        description: "The location has been added successfully.",
      });
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({
        queryKey: ["derivedCountriesFromLocations"],
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add location",
        description: err.message || "There was an error adding the location.",
      });
    },
  });

  const editLocationMutation = useMutation({
    mutationFn: async ({
      id,
      data: updatedData,
    }: {
      id: number;
      data: LocationFormData;
    }) => {
      return await apiRequest("PUT", `/api/locations/${id}`, updatedData);
    },
    onSuccess: () => {
      toast({
        title: "Location updated",
        description: "The location information has been updated successfully.",
      });
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({
        queryKey: ["derivedCountriesFromLocations"],
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update location",
        description: err.message || "There was an error updating the location.",
      });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/locations/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Location deleted",
        description: "The location has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({
        queryKey: ["derivedCountriesFromLocations"],
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete location",
        description: err.message || "There was an error deleting the location.",
      });
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };
  const handlePreviousPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => {
    if (data && page < data.totalPages) setPage((p) => p + 1);
  };
  const openAddModal = () => setIsAddModalOpen(true);
  const openEditModal = (location: Location) => {
    setSelectedLocation(location);
    setIsEditModalOpen(true);
  };
  const openDeleteDialog = (location: Location) => {
    setSelectedLocation(location);
    setIsDeleteDialogOpen(true);
  };
  const handleAddLocation = async (locationData: LocationFormData) =>
    await addLocationMutation.mutateAsync(locationData);
  const handleEditLocation = async (
    id: number,
    locationData: LocationFormData,
  ) => await editLocationMutation.mutateAsync({ id, data: locationData });
  const handleDeleteLocation = async (id: number) =>
    await deleteLocationMutation.mutateAsync(id);

  const locations = data?.locations;
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 0;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Locations Database</h1>
        <Button onClick={openAddModal} className="flex items-center">
          <Plus className="mr-1 h-4 w-4" /> Add Location
        </Button>
      </div>

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
              {countriesData?.map((countryName: string) => (
                <SelectItem key={countryName} value={countryName}>
                  {countryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {isLoading && (
        <div className="text-center py-10">
          <p className="text-gray-500">Loading locations...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center py-10 bg-red-50 text-red-700 rounded-lg p-4">
          <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
          <h3 className="text-lg font-medium">Error Fetching Locations</h3>
          <p className="text-sm mt-1">
            {(error as Error).message || "An unknown error occurred."}
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {locations && locations.length > 0 ? (
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
                    {locations.map((location: Location) => (
                      <tr key={location.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {location.imageUrl ? (
                            <div className="h-20 w-32 rounded overflow-hidden">
                              <img
                                src={location.imageUrl}
                                alt={`${location.country} - ${location.region}`}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "https://placehold.co/400x300/gray/white?text=No+Image";
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
              {totalPages > 1 && (
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(page * pageSize, totalCount)} of {totalCount}{" "}
                    locations
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
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded-lg">
              <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                No Locations Found
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                There are currently no locations in the database matching your
                criteria, or the database is empty.
              </p>
              {!search && (!country || country === "all") && (
                <Button onClick={openAddModal} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" /> Add New Location
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <AddLocationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddLocation}
        isSubmitting={addLocationMutation.isPending}
      />
      <EditLocationModal
        isOpen={isEditModalOpen}
        location={selectedLocation}
        onClose={() => setIsEditModalOpen(false)}
        onEdit={handleEditLocation}
        isSubmitting={editLocationMutation.isPending}
      />
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
