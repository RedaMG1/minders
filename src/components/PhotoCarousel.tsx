"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { photoUrl } from "@/lib/photos";
import type { NotePhoto } from "@/lib/types";
import { Icon } from "./Icon";

/** A horizontal move longer than this, in pixels, changes the photo. */
const SWIPE_PIXELS = 40;

/** The URL to show a photo with, once it has loaded from this device or storage. */
export function usePhotoUrl(photo: NotePhoto | undefined) {
  const [loaded, setLoaded] = useState<{ path: string; src: string | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!photo) return;
    let current = true;
    photoUrl(photo)
      .then((src) => current && setLoaded({ path: photo.path, src, failed: false }))
      .catch(() => current && setLoaded({ path: photo.path, src: null, failed: true }));
    return () => {
      current = false;
    };
  }, [photo]);
  const mine = loaded && photo && loaded.path === photo.path ? loaded : null;
  return { src: mine?.src ?? null, failed: Boolean(mine?.failed) };
}

/**
 * Steps through photos with arrows, swipes and the keyboard, wrapping at the ends. It follows the photo
 * shown by its id, so photos arriving or leaving elsewhere in the list never change what's on screen.
 * If the shown photo itself is removed, its neighbour at the same place takes over.
 */
export function usePhotoSteps(ids: string[], start = 0) {
  const [at, setAt] = useState({ id: ids[start], index: start });
  const found = at.id ? ids.indexOf(at.id) : -1;
  const shown = found !== -1 ? found : ids.length ? Math.min(at.index, ids.length - 1) : 0;
  const step = (by: number) => {
    if (!ids.length) return;
    const next = (shown + by + ids.length) % ids.length;
    setAt({ id: ids[next], index: next });
  };
  const swipeStart = useRef<number | null>(null);
  const lastSwipe = useRef(0);
  const swipe = {
    onPointerDown: (event: PointerEvent) => {
      // Two fingers, or a zoomed-in view, mean pinching or panning, not swiping.
      swipeStart.current = event.isPrimary ? event.clientX : null;
    },
    onPointerUp: (event: PointerEvent) => {
      if (swipeStart.current === null) return;
      const moved = event.clientX - swipeStart.current;
      swipeStart.current = null;
      if ((window.visualViewport?.scale ?? 1) > 1) return;
      if (Math.abs(moved) <= SWIPE_PIXELS) return;
      lastSwipe.current = Date.now();
      step(moved < 0 ? 1 : -1);
    },
  };
  /** Whether a swipe just happened, so the tap that ends it doesn't also count as a tap. */
  const justSwiped = () => Date.now() - lastSwipe.current < 400;
  return { index: shown, step, swipe, justSwiped };
}

type PhotoCarouselProps = {
  photos: NotePhoto[];
  /** When set, each photo shows the name of its note, linking to it. */
  noteNames?: Map<string, string>;
  onOpen: (index: number) => void;
  onRemove?: (photo: NotePhoto) => void;
};

/** One big photo at a time, with arrows, swiping and an "n / total" counter. */
export function PhotoCarousel({ photos, noteNames, onOpen, onRemove }: PhotoCarouselProps) {
  const { index, step, swipe, justSwiped } = usePhotoSteps(photos.map((item) => item.id));
  const photo = photos[index];
  const { src, failed } = usePhotoUrl(photo);
  if (!photo) return null;
  const many = photos.length > 1;

  return (
    <div className="carousel">
      <div className="carousel-frame" data-photo-id={photo.id} {...swipe}>
        {src ? (
          <button className="carousel-open" type="button" aria-label="Open photo full screen" onClick={() => !justSwiped() && onOpen(index)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a private photo from this device, not a page image */}
            <img src={src} alt="" draggable={false} />
          </button>
        ) : (
          <span className="photo-wait">{failed ? "Can't load this photo" : "Loading…"}</span>
        )}
        {many && (
          <>
            <button className="carousel-arrow prev" type="button" aria-label="Previous photo" onClick={() => step(-1)}>
              <Icon name="back" />
            </button>
            <button className="carousel-arrow next" type="button" aria-label="Next photo" onClick={() => step(1)}>
              <Icon name="forward" />
            </button>
          </>
        )}
        {onRemove && (
          <button className="photo-remove" type="button" aria-label="Remove photo" onClick={() => onRemove(photo)}>
            <Icon name="x" small />
          </button>
        )}
      </div>
      <div className="carousel-foot">
        {noteNames?.has(photo.noteId) ? (
          <Link className="carousel-note" href={`/note?id=${photo.noteId}`}>
            {noteNames.get(photo.noteId)}
          </Link>
        ) : (
          <span />
        )}
        {many && (
          <span className="photo-count">
            {index + 1} / {photos.length}
          </span>
        )}
      </div>
    </div>
  );
}
