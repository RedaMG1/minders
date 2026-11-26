"use client";

import { useEffect } from "react";
import type { NotePhoto } from "@/lib/types";
import { Icon } from "./Icon";
import { usePhotoSteps, usePhotoUrl } from "./PhotoCarousel";

/** Photos shown full screen, one at a time. Arrows, swipes and ←/→ move; the button or Escape closes. */
export function PhotoViewer({ photos, start, onClose }: { photos: NotePhoto[]; start: number; onClose: () => void }) {
  const { index, step, swipe } = usePhotoSteps(photos.length, start);
  const { src } = usePhotoUrl(photos[index]);
  const many = photos.length > 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  if (!photos.length) return null;

  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Photo" {...swipe}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a private photo from this device, not a page image */}
      {src && <img src={src} alt="" draggable={false} />}
      {many && (
        <>
          <button className="carousel-arrow prev" type="button" aria-label="Previous photo" onClick={() => step(-1)}>
            <Icon name="back" />
          </button>
          <button className="carousel-arrow next" type="button" aria-label="Next photo" onClick={() => step(1)}>
            <Icon name="forward" />
          </button>
          <span className="photo-count viewer-count">
            {index + 1} / {photos.length}
          </span>
        </>
      )}
      <button className="icon-btn viewer-close" type="button" aria-label="Close" onClick={onClose}>
        <Icon name="x" />
      </button>
    </div>
  );
}
