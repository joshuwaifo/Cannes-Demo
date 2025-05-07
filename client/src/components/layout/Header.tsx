import { Link, useLocation } from "wouter";
import { Film, Home, FileText, ShoppingBag, Users, MapPin } from "lucide-react";
import { HeaderProps } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const [location] = useLocation();

  const handleNavigation = (tab: string) => {
    onTabChange(tab as any);
  };

  return (
    <header className="bg-secondary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/">
          <div className="flex items-center space-x-2 cursor-pointer">
            <Film className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">VadisMedia</h1>
          </div>
        </Link>
        <nav>
          <ul className="flex space-x-6">
            <li>
              <Link 
                href="/"
                onClick={() => handleNavigation("welcome")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center cursor-pointer",
                  (activeTab === "welcome" || location === "/") && "text-primary",
                )}
              >
                <Home className="mr-1 h-4 w-4" />
                Welcome
              </Link>
            </li>
            <li>
              <Link 
                href="/script"
                onClick={() => handleNavigation("script")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center cursor-pointer",
                  (activeTab === "script" || location === "/script") && "text-primary",
                )}
              >
                <FileText className="mr-1 h-4 w-4" />
                Script Editor
              </Link>
            </li>
            <li>
              <Link 
                href="/products"
                onClick={() => handleNavigation("products")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center cursor-pointer",
                  (activeTab === "products" || location === "/products") && "text-primary",
                )}
              >
                <ShoppingBag className="mr-1 h-4 w-4" />
                Brands
              </Link>
            </li>
            <li>
              <Link 
                href="/actors"
                onClick={() => handleNavigation("actors")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center cursor-pointer",
                  (activeTab === "actors" || location === "/actors") && "text-primary",
                )}
              >
                <Users className="mr-1 h-4 w-4" />
                Actors
              </Link>
            </li>
            <li>
              <Link 
                href="/locations"
                onClick={() => handleNavigation("locations")}
                className={cn(
                  "hover:text-primary transition-colors duration-200 font-medium flex items-center cursor-pointer",
                  (activeTab === "locations" || location === "/locations") && "text-primary",
                )}
              >
                <MapPin className="mr-1 h-4 w-4" />
                Locations
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
