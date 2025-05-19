// client/src/components/layout/Header.tsx
import { Link } from "wouter";
import { Home, FileText, ShoppingBag, Users, MapPin, PenTool } from "lucide-react"; // Added PenTool for Script Writer
import { HeaderProps } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="bg-secondary text-secondary-foreground shadow-sm border-b border-border sticky top-0 z-50">
      {/* bg-secondary is now white, text-secondary-foreground is dark */}
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex flex-wrap justify-between items-center">
        <div className="flex items-center h-8">
          <Link href="/" className="flex items-center">
            <img
              src="/assets/vadis-media-logo-dark.png"
              alt="Vadis Media Logo"
              className="h-6 sm:h-7 w-auto object-contain" // Responsive logo size
            />
          </Link>
          <span className="text-primary ml-2 text-[11px] sm:text-sm font-medium flex items-center h-full">Demo</span>
        </div>
        <nav className="overflow-x-auto py-1 w-full sm:w-auto mt-1 sm:mt-0">
          <ul className="flex gap-1 sm:gap-2 md:gap-3 min-w-max pr-2">
            {/* Improved spacing for mobile */}
            <li>
              <button
                onClick={() => onTabChange("welcome")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-1 rounded-md whitespace-nowrap", // Better mobile sizing
                  activeTab === "welcome"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted", // Adjusted active and hover states
                )}
              >
                <Home className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="inline-block leading-tight">Welcome</span>
              </button>
            </li>
            {/* Swapped Order: Script Writer now comes before Script Analysis */}
            <li>
              <button
                onClick={() => onTabChange("script-writer")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-1 rounded-md whitespace-nowrap",
                  activeTab === "script-writer"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <PenTool className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" /> {/* Icon for Script Writer */}
                <span className="inline-block leading-tight">Script Writer</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("script")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-1 rounded-md whitespace-nowrap",
                  activeTab === "script"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <FileText className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="inline-block leading-tight">Script Analysis</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("products")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-1 rounded-md whitespace-nowrap",
                  activeTab === "products"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <ShoppingBag className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="inline-block leading-tight">Brands</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("actors")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-1 rounded-md whitespace-nowrap",
                  activeTab === "actors"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <Users className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="inline-block leading-tight">Actors</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("locations")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-1 rounded-md whitespace-nowrap",
                  activeTab === "locations"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <MapPin className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="inline-block leading-tight">Locations</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}