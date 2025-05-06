import { ProductCardProps } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";

export default function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  return (
    <Card className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="h-40 overflow-hidden bg-gray-100">
        <img 
          src={product.imageUrl} 
          alt={`${product.name} product`} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://placehold.co/300x160?text=No+Image";
          }}
        />
      </div>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500 mb-1">{product.companyName || "Unknown Company"}</p>
            <h3 className="font-medium line-clamp-1">{product.name}</h3>
          </div>
          <Badge variant="secondary" className="ml-2 shrink-0">
            {product.category}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-end space-x-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onEdit(product)}
        >
          <Edit className="h-3.5 w-3.5 mr-1" />
          Edit
        </Button>
        <Button 
          variant="destructive" 
          size="sm"
          onClick={() => onDelete(product)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
