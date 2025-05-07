import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Welcome from "@/pages/Welcome";
import ScriptEditor from "@/pages/ScriptEditor";
import ProductDatabase from "@/pages/ProductDatabase";
import ActorsDatabase from "@/pages/ActorsDatabase";
import NotFound from "@/pages/not-found";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { TabType } from "@/lib/types";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("welcome");

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Function to render the active component based on the selected tab
  const renderActiveComponent = () => {
    switch (activeTab) {
      case "welcome":
        return <Welcome onTabChange={handleTabChange} />;
      case "script":
        return <ScriptEditor />;
      case "products":
        return <ProductDatabase />;
      case "actors":
        // Sample Actor Data
        const sampleActors: Actor[] = [
          {
            name: "Tom Hanks",
            gender: "Male",
            nationality: "American",
            notableRoles: [
              "Forrest Gump",
              "Saving Private Ryan",
              "Cast Away",
              "Philadelphia",
              "Toy Story (Woody - Voice)",
            ],
            genres: [
              "Drama",
              "Comedy",
              "Historical",
              "War",
              "Animation (Voice)",
            ],
            recentPopularity: "Very High / Iconic",
            typicalRoles: [
              "Everyman heroes",
              "historical figures",
              "conveying warmth/integrity",
            ],
            estSalaryRange: "A-List Lead ($20M+)",
            socialMediaFollowing: "Moderate (Uses selectively)",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Prestigious dramas, biopics, roles requiring audience trust/sympathy, voice work. High budget needed. Safe choice.",
          },
          {
            name: "Meryl Streep",
            gender: "Female",
            nationality: "American",
            notableRoles: [
              "The Devil Wears Prada",
              "Sophie's Choice",
              "Kramer vs. Kramer",
              "Mamma Mia!",
            ],
            genres: ["Drama", "Comedy", "Musical", "Biopic"],
            recentPopularity: "Very High / Iconic",
            typicalRoles: [
              "Versatile dramatic leads",
              "complex/powerful women",
              "matriarchs",
            ],
            estSalaryRange: "A-List Lead ($10M+)",
            socialMediaFollowing: "Low / N/A",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Virtually any demanding dramatic or comedic lead/supporting role, biopics, prestige TV. High budget/prestige projects.",
          },
          {
            name: "Leonardo DiCaprio",
            gender: "Male",
            nationality: "American",
            notableRoles: [
              "Titanic",
              "Inception",
              "The Wolf of Wall Street",
              "The Revenant",
              "Killers of the Flower Moon",
            ],
            genres: ["Drama", "Thriller", "Historical", "Biopic", "Crime"],
            recentPopularity: "Very High",
            typicalRoles: [
              "Intense, conflicted protagonists in major director-driven films",
            ],
            estSalaryRange: "A-List Lead ($25M+)",
            socialMediaFollowing: "High (Activism focus)",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Intense leading roles in large-scale dramas/thrillers, often period pieces, collaborating with top directors. Very high budget required.",
          },
          {
            name: "Denzel Washington",
            gender: "Male",
            nationality: "American",
            notableRoles: [
              "Training Day",
              "Malcolm X",
              "Glory",
              "The Equalizer series",
              "Fences",
            ],
            genres: ["Drama", "Action", "Thriller", "Biopic"],
            recentPopularity: "Very High",
            typicalRoles: [
              "Charismatic leads",
              "authority figures",
              "mentors",
              "anti-heroes",
            ],
            estSalaryRange: "A-List Lead ($20M+)",
            socialMediaFollowing: "Low / N/A",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Leading roles in action-thrillers, prestige dramas, roles requiring gravitas/intensity. High budget. Bankable star.",
          },
          {
            name: "Robert De Niro",
            gender: "Male",
            nationality: "American (Dual Italian)",
            notableRoles: [
              "The Godfather Part II",
              "Taxi Driver",
              "Raging Bull",
              "Goodfellas",
              "Killers of the Flower Moon",
            ],
            genres: ["Drama", "Crime", "Comedy", "Thriller"],
            recentPopularity: "High / Iconic",
            typicalRoles: [
              "Gangsters",
              "tough guys",
              "complex dramatic characters",
              "comedic foils (later career)",
            ],
            estSalaryRange: "A-List Lead/Supporting ($10M+)",
            socialMediaFollowing: "Low / N/A",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Veteran gangsters, dramatic patriarchs, comedic supporting roles. Works frequently. Suitable for prestige/ensemble pieces.",
          },
          {
            name: "Al Pacino",
            gender: "Male",
            nationality: "American",
            notableRoles: [
              "The Godfather series",
              "Scarface",
              "Dog Day Afternoon",
              "Scent of a Woman",
              "Heat",
              "Hunters (TV)",
            ],
            genres: ["Drama", "Crime", "Thriller"],
            recentPopularity: "High / Iconic",
            typicalRoles: [
              "Intense, often explosive characters",
              "gangsters",
              "mentors",
            ],
            estSalaryRange: "A-List Lead/Supporting ($10M+)",
            socialMediaFollowing: "Low / N/A",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Intense dramatic roles, often figures of power or decay, mentors, high-profile TV. Selectively chooses larger projects.",
          },
          {
            name: "Morgan Freeman",
            gender: "Male",
            nationality: "American",
            notableRoles: [
              "The Shawshank Redemption",
              "Million Dollar Baby",
              "Invictus",
              "Seven",
              "numerous voiceovers",
            ],
            genres: ["Drama", "Thriller", "Voiceover"],
            recentPopularity: "Very High / Iconic",
            typicalRoles: ["Wise figures", "authority", "narrators", "God"],
            estSalaryRange: "A-List Supporting/Voice ($5M+)",
            socialMediaFollowing: "Low / N/A",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Narrator roles, wise mentors, authority figures. Highly sought for voiceovers. Adds prestige.",
          },
          {
            name: "Anthony Hopkins",
            gender: "Male",
            nationality: "Welsh (Dual American)",
            notableRoles: [
              "The Silence of the Lambs (Lecter)",
              "The Father",
              "Nixon",
              "Thor (Odin)",
              "Westworld (TV)",
            ],
            genres: ["Drama", "Thriller", "Horror", "Historical", "Sci-Fi"],
            recentPopularity: "High / Iconic",
            typicalRoles: [
              "Intense intellectuals",
              "villains",
              "historical figures",
              "patriarchs",
            ],
            estSalaryRange: "A-List Lead/Supporting ($5M-$15M+)",
            socialMediaFollowing: "Moderate",
            availability: "Active",
            bestSuitedRolesStrategic:
              "Complex dramatic leads/supporting roles, sophisticated villains, historical figures, prestige TV.",
          },
          {
            name: "Julia Roberts",
            gender: "Female",
            nationality: "American",
            notableRoles: [
              "Pretty Woman",
              "Erin Brockovich",
              "Notting Hill",
              "Ocean's Eleven",
              "Leave the World Behind",
            ],
            genres: ["Romantic Comedy", "Drama", "Thriller"],
            recentPopularity: "High",
            typicalRoles: [
              "Charismatic, relatable leads",
              "romantic interests",
            ],
            estSalaryRange: "A-List Lead ($15M+)",
            socialMediaFollowing: "High",
            availability: "Selectively Active",
            bestSuitedRolesStrategic:
              "Leading roles in rom-coms, dramas, thrillers requiring star power/relatability. Prefers specific directors/projects.",
          },
        ];

        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold mb-6">
              Actors Database (Sample)
            </h1>
            <p className="text-gray-700 mb-4">
              Displaying a sample of 10 actors. The full database will
              eventually contain around 1000 actors with more comprehensive
              filtering and suggestion capabilities.
            </p>
            <div className="overflow-x-auto bg-white shadow-md rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sampleActors.map((actor) => (
                    <tr key={actor.name}>
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
                        {actor.notableRoles.join(", ")}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {actor.genres.join(", ")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {actor.recentPopularity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {actor.typicalRoles.join(", ")}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 p-4 border border-blue-300 bg-blue-50 rounded">
              <p className="font-semibold text-blue-700">Developer Note:</p>
              <p className="text-blue-600">
                This is a sample display. Full implementation of the database,
                search, filtering, and AI suggestion features will be developed
                here. Due to current constraints (no new files), this
                functionality is not yet built out as a separate component and
                data is hardcoded.
              </p>
            </div>
          </div>
        );
      default:
        return <Welcome onTabChange={handleTabChange} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Header activeTab={activeTab} onTabChange={handleTabChange} />

        <main className="flex-grow container mx-auto px-4 py-6">
          <Switch>
            <Route path="/" component={() => renderActiveComponent()} />
            <Route component={NotFound} />
          </Switch>
        </main>

        <Footer />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;
