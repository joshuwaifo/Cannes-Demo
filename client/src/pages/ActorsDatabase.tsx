import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Actor, ActorFormData } from "@/lib/types";
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
import { Edit, Pencil } from "lucide-react";
import EditActorModal from "@/components/actors/EditActorModal";
import { apiRequest } from "@/lib/queryClient";

export default function ActorsDatabase() {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("all");
  const [nationality, setNationality] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const queryClient = useQueryClient();

  // Query to fetch actors with filtering and pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/actors', search, gender, nationality, page],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (gender && gender !== 'all') queryParams.append('gender', gender);
      if (nationality && nationality !== 'all') queryParams.append('nationality', nationality);
      queryParams.append('page', page.toString());
      queryParams.append('pageSize', pageSize.toString());
      
      const response = await fetch(`/api/actors?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch actors');
      }
      return response.json();
    }
  });

  // Handle errors
  if (error) {
    toast({
      title: "Error",
      description: `Failed to load actors: ${(error as Error).message}`,
      variant: "destructive"
    });
  }

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
  
  // Open edit modal with selected actor
  const openEditModal = (actor: Actor) => {
    setSelectedActor(actor);
    setIsEditModalOpen(true);
  };
  
  // Edit actor mutation
  const editActorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: ActorFormData }) => {
      return await apiRequest('PUT', `/api/actors/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Actor updated",
        description: "The actor information has been updated successfully.",
      });
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/actors', search, gender, nationality, page] 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update actor",
        description: error.message || "There was an error updating the actor.",
      });
    },
  });
  
  // Handle actor edit
  const handleEditActor = async (id: number, data: ActorFormData) => {
    await editActorMutation.mutate({ id, data });
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Actors Database</h1>
      
      {/* Search and filter form */}
      <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="w-[150px]">
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Non-Binary">Non-Binary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-[200px]">
          <Select value={nationality} onValueChange={setNationality}>
            <SelectTrigger>
              <SelectValue placeholder="Nationality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nationalities</SelectItem>
              <SelectItem value="American">American</SelectItem>
              <SelectItem value="British">British</SelectItem>
              <SelectItem value="Australian">Australian</SelectItem>
              <SelectItem value="Canadian">Canadian</SelectItem>
              <SelectItem value="French">French</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button type="submit">Search</Button>
      </form>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-10">
          <p className="text-gray-500">Loading actors...</p>
        </div>
      )}

      {/* Actors table */}
      {!isLoading && data?.actors && data.actors.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nationality
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notable Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Genres
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Popularity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typical Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Social Following
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Availability
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Best Suited (Strategic)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.actors.map((actor: Actor) => (
                  <tr key={actor.id || actor.name}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {actor.imageUrl ? (
                        <div className="h-20 w-16 rounded overflow-hidden">
                          <img
                            src={actor.imageUrl}
                            alt={`${actor.name}`}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "https://placehold.co/300x400/gray/white?text=No+Image";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-20 w-16 bg-gray-200 flex items-center justify-center rounded">
                          <span className="text-gray-500 text-xs text-center">No Image</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {actor.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {actor.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {actor.nationality}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {Array.isArray(actor.notableRoles) ? actor.notableRoles.join(", ") : actor.notableRoles}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {Array.isArray(actor.genres) ? actor.genres.join(", ") : actor.genres}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {actor.recentPopularity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {Array.isArray(actor.typicalRoles) ? actor.typicalRoles.join(", ") : actor.typicalRoles}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {actor.estSalaryRange}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {actor.socialMediaFollowing}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {actor.availability}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {actor.bestSuitedRolesStrategic}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openEditModal(actor)}
                        className="flex items-center"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{((page - 1) * pageSize) + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(page * pageSize, data.totalCount)}
              </span>{" "}
              of <span className="font-medium">{data.totalCount}</span> actors
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
      {!isLoading && data?.actors && data.actors.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No actors found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}