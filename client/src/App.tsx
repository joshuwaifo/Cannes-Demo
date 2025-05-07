import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Welcome from "@/pages/Welcome";
import ScriptEditor from "@/pages/ScriptEditor";
import ProductDatabase from "@/pages/ProductDatabase";
import ActorsDatabase from "@/pages/ActorsDatabase";
import LocationsDatabase from "@/pages/LocationsDatabase";
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
        return <ActorsDatabase />;
      case "locations":
        return <LocationsDatabase />;
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
