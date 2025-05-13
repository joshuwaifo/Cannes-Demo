// client/src/components/layout/Header.tsx
import { Link } from "wouter";
import { Home, FileText, ShoppingBag, Users, MapPin } from "lucide-react";
import { HeaderProps } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="bg-secondary text-secondary-foreground shadow-sm border-b border-border">
      {/* bg-secondary is now white, text-secondary-foreground is dark */}
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex flex-wrap justify-between items-center">
        <div className="logo-section flex items-center">
          <Link href="/" className="flex items-center">
            <img
              src="/assets/vadis-media-logo-dark.png"
              alt="Vadis Media Logo"
              className="h-7 sm:h-8 w-auto object-contain" // Responsive logo size
            />
          </Link>
          <span className="demo-text ml-2 text-sm sm:text-base sm:ml-3">Demo</span>
        </div>
        <nav className="overflow-x-auto pb-1 w-full sm:w-auto mt-1 sm:mt-0">
          <ul className="flex space-x-1 sm:space-x-2 md:space-x-3 min-w-max">
            {/* Improved spacing for mobile */}
            <li>
              <button
                onClick={() => onTabChange("welcome")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md", // Better mobile sizing
                  activeTab === "welcome"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted", // Adjusted active and hover states
                )}
              >
                <Home className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Welcome</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("script")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md",
                  activeTab === "script"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <FileText className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Script Analysis</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("products")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md",
                  activeTab === "products"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <ShoppingBag className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Brands</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("actors")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md",
                  activeTab === "actors"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <Users className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Actors</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("locations")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center text-[11px] sm:text-xs md:text-sm px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md",
                  activeTab === "locations"
                    ? "text-primary bg-primary/10"
                    : "text-vadis-dark-text hover:bg-muted",
                )}
              >
                <MapPin className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Locations</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
