import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
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
  const [location] = useLocation();

  // Sync tab state with current URL
  useEffect(() => {
    if (location === "/") {
      setActiveTab("welcome");
    } else if (location === "/script") {
      setActiveTab("script");
    } else if (location === "/products") {
      setActiveTab("products");
    } else if (location === "/actors") {
      setActiveTab("actors");
    } else if (location === "/locations") {
      setActiveTab("locations");
    }
  }, [location]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Header activeTab={activeTab} onTabChange={handleTabChange} />

        <main className="flex-grow container mx-auto px-4 py-6">
          <Switch>
            <Route path="/" component={() => <Welcome onTabChange={handleTabChange} />} />
            <Route path="/script" component={ScriptEditor} />
            <Route path="/products" component={ProductDatabase} />
            <Route path="/actors" component={ActorsDatabase} />
            <Route path="/locations" component={LocationsDatabase} />
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms-of-service" component={TermsOfService} />
            <Route path="/contact" component={Contact} />
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
