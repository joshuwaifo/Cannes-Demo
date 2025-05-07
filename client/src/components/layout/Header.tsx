import { Link } from "wouter";
import { Film, Home, FileText, ShoppingBag, Users } from "lucide-react";
import { HeaderProps } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="bg-secondary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Film className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold">VadisMedia</h1>
        </div>
        <nav>
          <ul className="flex space-x-6">
            <li>
              <button
                onClick={() => onTabChange("welcome")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center",
                  activeTab === "welcome" && "text-primary",
                )}
              >
                <Home className="mr-1 h-4 w-4" />
                Welcome
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("script")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center",
                  activeTab === "script" && "text-primary",
                )}
              >
                <FileText className="mr-1 h-4 w-4" />
                Script Editor
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("products")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center",
                  activeTab === "products" && "text-primary",
                )}
              >
                <ShoppingBag className="mr-1 h-4 w-4" />
                Brands
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("actors")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center",
                  activeTab === "actors" && "text-primary",
                )}
              >
                <Users className="mr-1 h-4 w-4" />
                Actors
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
