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
        <Link href="/" className="flex items-center space-x-2">
            <img
              src="/assets/vadis-media-logo-dark.png"
              alt="Vadis Media Logo"
              className="h-10 sm:h-12 w-auto object-contain" // Responsive logo size
            />
        </Link>
        <nav>
          <ul className="flex space-x-1 sm:space-x-3 md:space-x-4">
            {/* Improved spacing for mobile */}
            <li>
              <button
                onClick={() => onTabChange("welcome")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-xs sm:text-sm px-1 sm:px-2 py-1 rounded-md", // Better mobile sizing
                  activeTab === "welcome"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted", // Adjusted active and hover states
                )}
              >
                <Home className="mr-0.5 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden xs:inline">Welcome</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("script")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-xs sm:text-sm px-1 sm:px-2 py-1 rounded-md",
                  activeTab === "script"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <FileText className="mr-0.5 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden xs:inline">Script</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("products")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-xs sm:text-sm px-1 sm:px-2 py-1 rounded-md",
                  activeTab === "products"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <ShoppingBag className="mr-0.5 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden xs:inline">Brands</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("actors")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-xs sm:text-sm px-1 sm:px-2 py-1 rounded-md",
                  activeTab === "actors"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <Users className="mr-0.5 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden xs:inline">Actors</span>
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
