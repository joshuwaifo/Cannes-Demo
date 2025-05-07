import { useState } from "react";
import { Switch, Route, useLocation } from "wouter"; // Import useLocation
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Welcome from "@/pages/Welcome";
import ScriptEditor from "@/pages/ScriptEditor";
import ProductDatabase from "@/pages/ProductDatabase";
import ActorsDatabase from "@/pages/ActorsDatabase";
import LocationsDatabase from "@/pages/LocationsDatabase";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/not-found";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { TabType } from "@/lib/types";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("welcome");
  const [location, setLocation] = useLocation(); // Wouter hook for navigation

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // If the current path is not the root path (where main components are rendered),
    // navigate to the root path to trigger the rendering of the new active tab.
    if (location !== "/") {
      setLocation("/");
    }
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
        return <ActorsDatabase />;
      case "locations":
        return <LocationsDatabase />;
      default:
        // Fallback to welcome, or handle as an error/redirect if preferred
        return <Welcome onTabChange={handleTabChange} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Header activeTab={activeTab} onTabChange={handleTabChange} />

        <main className="flex-grow container mx-auto px-4 py-6">
          {/* The Switch component will render the first Route that matches */}
          <Switch>
            {/* Static pages first, so they take precedence if their path is matched */}
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms-of-service" component={TermsOfService} />
            <Route path="/contact" component={Contact} />
            {/* The root path now uses renderActiveComponent, which depends on activeTab */}
            <Route path="/" component={() => renderActiveComponent()} />
            {/* Catch-all for 404 */}
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
