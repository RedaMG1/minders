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

/** Steps through photos with arrows, swipes and the keyboard, wrapping at the ends. */
export function usePhotoSteps(total: number, start = 0) {
  const [index, setIndex] = useState(start);
  // A photo removed from the end leaves the index pointing at the last one still there.
  const shown = total ? Math.min(index, total - 1) : 0;
  const step = (by: number) => setIndex(total ? (shown + by + total) % total : 0);
  const swipeStart = useRef<number | null>(null);
  const lastSwipe = useRef(0);
  const swipe = {
    onPointerDown: (event: PointerEvent) => {
      swipeStart.current = event.clientX;
    },
    onPointerUp: (event: PointerEvent) => {
      if (swipeStart.current === null) return;
      const moved = event.clientX - swipeStart.current;
      swipeStart.current = null;
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
  const { index, step, swipe, justSwiped } = usePhotoSteps(photos.length);
  const photo = photos[index];
  const { src, failed } = usePhotoUrl(photo);
  if (!photo) return null;
  const many = photos.length > 1;

  return (
    <div className="carousel">
      <div className="carousel-frame" {...swipe}>
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
