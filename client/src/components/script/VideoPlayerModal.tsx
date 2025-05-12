// client/src/components/script/VideoPlayerModal.tsx
import { VideoPlayerModalProps } from "@/lib/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

export default function VideoPlayerModal({
    isOpen,
    onClose,
    videoUrl,
    title,
}: VideoPlayerModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleCanPlay = () => {
        setIsLoading(false);
        setHasError(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    const handleDownload = async () => {
        if (videoUrl) {
            try {
                // Fetch the video file as a blob
                const response = await fetch(videoUrl);
                const blob = await response.blob();
                
                // Create a blob URL and trigger download
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = blobUrl;
                
                // Create filename from the scene title or use default
                const filename = `${title.replace(/[^a-z0-9]/gi, "_")}_video.mp4`;
                link.download = filename;
                
                // Append to body, click, then clean up
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Release the blob URL
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            } catch (error) {
                console.error("Error downloading video:", error);
                // Fallback to direct link if fetch fails
                window.open(videoUrl, "_blank");
            }
        }
    };

    // Reset loading/error state when modal opens with a new URL
    // Changed from useState to useEffect to correctly handle prop changes
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            setHasError(false);
        }
    }, [isOpen, videoUrl]); // Depend on videoUrl as well to reset if it changes while open

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col w-[95vw] p-3 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">
                        {title || "Generated Video"}
                    </DialogTitle>
                    {/* The redundant DialogClose component that was here has been removed. 
                        The default close button from DialogContent (top right) will handle closing. */}
                </DialogHeader>

                <div className="flex-grow flex items-center justify-center bg-black rounded-md overflow-hidden relative min-h-[200px] sm:min-h-[300px] my-2">
                    {isLoading && !hasError && videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mb-2" />
                            <p className="text-sm sm:text-base">
                                Loading video...
                            </p>
                        </div>
                    )}
                    {hasError && videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
                            <p className="text-sm sm:text-base">
                                Error loading video.
                            </p>
                            <p className="text-xs sm:text-sm">
                                Please check the URL or try again later.
                            </p>
                        </div>
                    )}
                    {videoUrl && (
                        <video
                            key={videoUrl} // Force re-render if URL changes
                            controls
                            playsInline
                            webkit-playsinline="true" // For older iOS
                            controlsList="nodownload"
                            className={`w-full h-auto max-h-[60vh] object-contain ${isLoading || hasError ? "hidden" : "block"}`}
                            onCanPlay={handleCanPlay}
                            onError={handleError}
                            preload="metadata"
                            poster={videoUrl ? `${videoUrl}?poster=true` : ""} // Poster might not work for all video URLs
                        >
                            <source src={videoUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    )}
                    {!videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <p className="text-sm sm:text-base">
                                No video URL provided.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-end">
                    <Button
                        variant="default" // Changed to default for better visibility as primary action
                        onClick={handleDownload}
                        disabled={!videoUrl || isLoading || hasError}
                        className="flex items-center justify-center w-full sm:w-auto"
                    >
                        <Download className="mr-1 h-4 w-4" />
                        Download Video
                    </Button>
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto sm:ml-2"
                        >
                            Close
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
