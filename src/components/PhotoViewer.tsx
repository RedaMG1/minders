"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

/** A photo shown full screen. Closes with the button or Escape. */
export function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a private photo from this device, not a page image */}
      <img src={src} alt="" onClick={(event) => event.stopPropagation()} />
      <button className="icon-btn viewer-close" type="button" aria-label="Close" onClick={onClose}>
        <Icon name="x" />
      </button>
    </div>
  );
}
