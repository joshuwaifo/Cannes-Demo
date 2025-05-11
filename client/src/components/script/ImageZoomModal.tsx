// client/src/components/script/ImageZoomModal.tsx
import { ImageZoomModalProps } from "@/lib/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter, // Not strictly needed but good for consistency
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Loader2, AlertTriangle, Download } from "lucide-react";
import { useState, useEffect } from "react";

export default function ImageZoomModal({
    isOpen,
    onClose,
    imageUrl,
    title,
}: ImageZoomModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (isOpen && imageUrl) {
            setIsLoading(true);
            setHasError(false);
        }
    }, [isOpen, imageUrl]);

    const handleImageLoad = () => {
        setIsLoading(false);
        setHasError(false);
    };

    const handleImageError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    const handleDownload = () => {
        if (imageUrl) {
            const link = document.createElement("a");
            link.href = imageUrl;
            link.download = title
                ? `${title.replace(/[^a-z0-9]/gi, "_")}.png`
                : "zoomed_image.png"; // Basic filename
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{title || "Image Preview"}</DialogTitle>
                    <DialogClose
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </DialogHeader>

                <div className="flex-grow flex items-center justify-center bg-black/90 overflow-auto p-4">
                    {isLoading && !hasError && imageUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <Loader2 className="h-12 w-12 animate-spin mb-3" />
                            <p>Loading image...</p>
                        </div>
                    )}
                    {hasError && imageUrl && (
                        <div className="flex flex-col items-center justify-center text-red-400 p-4 text-center">
                            <AlertTriangle className="h-12 w-12 mb-3" />
                            <p>Error loading image.</p>
                        </div>
                    )}
                    {imageUrl && (
                        <img
                            src={imageUrl}
                            alt={title || "Zoomed Image"}
                            className={`max-w-full max-h-[calc(80vh-80px)] object-contain transition-opacity duration-300 ${isLoading || hasError ? "opacity-0" : "opacity-100"}`}
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                        />
                    )}
                    {!imageUrl && (
                        <div className="flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                            <AlertTriangle className="h-12 w-12 mb-3" />
                            <p>No image URL provided.</p>
                        </div>
                    )}
                </div>
                <DialogFooter className="p-4 border-t sm:justify-end">
                    <Button
                        variant="outline"
                        onClick={handleDownload}
                        disabled={!imageUrl || isLoading || hasError}
                        className="flex items-center"
                    >
                        <Download className="mr-1 h-4 w-4" />
                        Download Image
                    </Button>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
