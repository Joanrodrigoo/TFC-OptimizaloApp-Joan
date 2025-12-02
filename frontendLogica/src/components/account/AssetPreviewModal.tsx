import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AssetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    imageUrl?: string | null;
    youtubeVideoId?: string | null;
    youtubeLink?: string | null;
    fieldType: string;
    textValue?: string | null;
  } | null;
}

const AssetPreviewModal = ({
  isOpen,
  onClose,
  asset,
}: AssetPreviewModalProps) => {
  if (!asset) return null;

  const renderContent = () => {
    // Si es un vídeo de YouTube
    if (asset.youtubeVideoId || asset.youtubeLink) {
      let videoId = asset.youtubeVideoId;
      
      if (!videoId && asset.youtubeLink) {
        const match = asset.youtubeLink.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
        videoId = match ? match[1] : null;
      }

      if (videoId) {
        return (
          <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }
    }

    // Si es texto
    if (asset.textValue) {
      return (
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-lg leading-relaxed">{asset.textValue}</p>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Vista previa del recurso</DialogTitle>
        </DialogHeader>
        <div className="mt-4">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
};

export default AssetPreviewModal;
