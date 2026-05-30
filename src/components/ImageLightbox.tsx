import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  onClose: () => void;
};

export default function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full bg-white/90 hover:bg-white p-2 shadow-md"
      >
        <X className="w-5 h-5 text-black" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[95vw] max-h-[92vh] object-contain rounded-2xl shadow-2xl"
      />
    </div>
  );
}
