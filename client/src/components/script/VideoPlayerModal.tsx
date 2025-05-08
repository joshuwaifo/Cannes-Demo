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
import { useState } from "react";

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

    const handleDownload = () => {
        if (videoUrl) {
            const link = document.createElement("a");
            link.href = videoUrl;
            // Attempt to extract a filename or use a default
            const filename =
                videoUrl.substring(videoUrl.lastIndexOf("/") + 1) ||
                `${title.replace(/[^a-z0-9]/gi, "_")}_video.mp4`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Reset loading/error state when modal opens with a new URL
    useState(() => {
        if (isOpen) {
            setIsLoading(true);
            setHasError(false);
        }
    });

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title || "Generated Video"}</DialogTitle>
                    <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </DialogHeader>

                <div className="flex-grow flex items-center justify-center bg-black rounded-md overflow-hidden relative min-h-[300px]">
                    {isLoading && !hasError && videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>Loading video...</p>
                        </div>
                    )}
                    {hasError && videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                            <AlertTriangle className="h-8 w-8 mb-2" />
                            <p>Error loading video.</p>
                            <p className="text-xs">
                                Please check the URL or try again later.
                            </p>
                        </div>
                    )}
                    {videoUrl && (
                        <video
                            key={videoUrl} // Force re-render if URL changes
                            controls
                            className={`max-w-full max-h-[75vh] ${isLoading || hasError ? "hidden" : "block"}`} // Hide while loading/error
                            onCanPlay={handleCanPlay}
                            onError={handleError}
                            preload="auto"
                        >
                            <source src={videoUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    )}
                    {!videoUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <p>No video URL provided.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-4 sm:justify-end">
                    <Button
                        variant="default"
                        onClick={handleDownload}
                        disabled={!videoUrl || isLoading || hasError}
                        className="flex items-center"
                    >
                        <Download className="mr-1 h-4 w-4" />
                        Download Video
                    </Button>
                    {/* <DialogClose asChild> // DialogClose is already handled by the X icon and clicking outside
                        <Button type="button" variant="outline">
                            Close
                        </Button>
                    </DialogClose> */}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
