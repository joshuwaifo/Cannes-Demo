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
import { Download, X, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function VideoPlayerModal({
    isOpen,
    onClose,
    videoUrl,
    title,
}: VideoPlayerModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // This ensures we don't get stuck in a loading state
    useEffect(() => {
        if (isOpen && videoUrl && isLoading) {
            // Set a fallback timeout to stop showing the loading spinner after 10 seconds
            // This helps if the onCanPlay event doesn't fire on some mobile devices
            const timeout = setTimeout(() => {
                setIsLoading(false);
            }, 10000);
            
            setLoadingTimeout(timeout);
            
            return () => {
                if (timeout) clearTimeout(timeout);
            };
        }
    }, [isOpen, videoUrl, isLoading]);
    
    // Cleanup timeout when component unmounts
    useEffect(() => {
        return () => {
            if (loadingTimeout) clearTimeout(loadingTimeout);
        };
    }, [loadingTimeout]);

    const handleCanPlay = () => {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setIsLoading(false);
        setHasError(false);
    };

    const handleError = () => {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setIsLoading(false);
        setHasError(true);
        console.error("Video error occurred for URL:", videoUrl);
    };
    
    // Handle click on video container to attempt play (helps on iOS)
    const handleContainerClick = () => {
        if (videoRef.current && isLoading) {
            try {
                videoRef.current.play().catch(err => {
                    console.log("Auto-play failed, user interaction required:", err);
                });
            } catch (err) {
                console.log("Error attempting to play video:", err);
            }
        }
    };

    const handleDownload = async () => {
        if (videoUrl) {
            try {
                // For mobile, open in a new tab instead of trying to download directly
                if (/Android|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent)) {
                    window.open(videoUrl, "_blank");
                    return;
                }
                
                // Desktop download logic
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
    
    // Open in a new tab for better mobile compatibility
    const handleOpenInNewTab = () => {
        if (videoUrl) {
            window.open(videoUrl, "_blank");
        }
    };

    // Reset loading/error state when modal opens with a new URL
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
                </DialogHeader>

                <div 
                    className="flex-grow flex items-center justify-center bg-black rounded-md overflow-hidden relative min-h-[200px] sm:min-h-[300px] my-2"
                    onClick={handleContainerClick}
                >
                    {isLoading && !hasError && videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mb-2" />
                            <p className="text-sm sm:text-base">
                                Loading video...
                            </p>
                            <Button
                                variant="link"
                                className="text-blue-400 mt-2 text-xs sm:text-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInNewTab();
                                }}
                            >
                                Open directly in browser <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    )}
                    {hasError && videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
                            <p className="text-sm sm:text-base">
                                Error loading video.
                            </p>
                            <p className="text-xs sm:text-sm mb-2">
                                Please try opening the video directly in your browser.
                            </p>
                            <Button
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInNewTab();
                                }}
                                className="bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700"
                            >
                                <ExternalLink className="h-3 w-3 mr-1" /> Open in new tab
                            </Button>
                        </div>
                    )}
                    {videoUrl && (
                        <video
                            ref={videoRef}
                            key={videoUrl} // Force re-render if URL changes
                            controls
                            playsInline
                            webkit-playsinline="true" // For older iOS
                            controlsList="nodownload"
                            className={`w-full h-auto max-h-[60vh] object-contain ${isLoading || hasError ? "hidden" : "block"}`}
                            onCanPlay={handleCanPlay}
                            onLoadedData={handleCanPlay} // Additional event to catch more load states
                            onError={handleError}
                            preload="auto" // Changed from metadata to auto for better mobile loading
                            autoPlay
                            muted // Muted to help with autoplay policies on mobile
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
                        variant="default"
                        onClick={handleDownload}
                        disabled={!videoUrl || isLoading || hasError}
                        className="flex items-center justify-center w-full sm:w-auto"
                    >
                        <Download className="mr-1 h-4 w-4" />
                        Download Video
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleOpenInNewTab}
                        disabled={!videoUrl}
                        className="flex items-center justify-center w-full sm:w-auto sm:ml-2"
                    >
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Open in Browser
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
