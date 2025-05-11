// client/src/components/layout/Header.tsx
import { Link } from "wouter";
import { Home, FileText, ShoppingBag, Users, MapPin } from "lucide-react";
import { HeaderProps } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="bg-secondary text-secondary-foreground shadow-sm border-b border-border">
      {" "}
      {/* bg-secondary is now white, text-secondary-foreground is dark */}
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/">
          <a className="flex items-center space-x-2">
            <img
              src="/assets/vadis-media-logo-dark.png"
              alt="Vadis Media Logo"
              className="h-10" // Adjusted height for header logo
            />
          </a>
        </Link>
        <nav>
          <ul className="flex space-x-3 md:space-x-4">
            {" "}
            {/* Reduced spacing slightly */}
            <li>
              <button
                onClick={() => onTabChange("welcome")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-sm px-2 py-1 rounded-md", // Added padding and rounding
                  activeTab === "welcome"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted", // Adjusted active and hover states
                )}
              >
                <Home className="mr-1.5 h-4 w-4" />
                Welcome
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("script")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-sm px-2 py-1 rounded-md",
                  activeTab === "script"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                Script Editor
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("products")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-sm px-2 py-1 rounded-md",
                  activeTab === "products"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <ShoppingBag className="mr-1.5 h-4 w-4" />
                Brands
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("actors")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-sm px-2 py-1 rounded-md",
                  activeTab === "actors"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <Users className="mr-1.5 h-4 w-4" />
                Actors
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("locations")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-sm px-2 py-1 rounded-md",
                  activeTab === "locations"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <MapPin className="mr-1.5 h-4 w-4" />
                Locations
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
