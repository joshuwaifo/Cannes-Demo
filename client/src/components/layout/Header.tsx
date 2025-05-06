import { Link } from "wouter";
import { Film } from "lucide-react";
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
                onClick={() => onTabChange("script")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium",
                  activeTab === "script" && "text-primary"
                )}
              >
                Script Editor
              </button>
            </li>
            <li>
              <button 
                onClick={() => onTabChange("products")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium",
                  activeTab === "products" && "text-primary"
                )}
              >
                Products
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
