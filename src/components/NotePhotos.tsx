"use client";

import { useState } from "react";
import { modulePhotos, visiblePhotos } from "@/lib/photos";
import { removeNotePhoto, useApp } from "@/lib/store";
import type { Note, NotePhoto } from "@/lib/types";
import { PhotoCarousel } from "./PhotoCarousel";
import { PhotoViewer } from "./PhotoViewer";

/** The account's own photos in a note, shown big. Full screen goes through the whole module's photos. */
export function NotePhotos({ note, uploading }: { note: Note; uploading: number }) {
  const app = useApp();
  const [viewing, setViewing] = useState<{ photos: NotePhoto[]; start: number } | null>(null);
  const [removing, setRemoving] = useState<NotePhoto | null>(null);
  const photos = app ? visiblePhotos(app.state.photos, note.id).sort((a, b) => b.addedAt.localeCompare(a.addedAt)) : [];
  if (!app || (!photos.length && !uploading)) return null;

  function open(index: number) {
    if (!app) return;
    const all = modulePhotos(app.state.photos, app.state.notes, note.moduleId);
    const start = Math.max(0, all.findIndex((photo) => photo.id === photos[index]?.id));
    setViewing({ photos: all.length ? all : photos, start });
  }

  return (
    <div className="note-photos">
      {removing && (
        <div className="confirm">
          <p>Remove this photo? You can&apos;t undo this.</p>
          <button
            className="danger solid"
            type="button"
            onClick={() => {
              removeNotePhoto(removing);
              setRemoving(null);
            }}
          >
            Remove
          </button>
          <button className="ghost" type="button" onClick={() => setRemoving(null)}>
            Keep photo
          </button>
        </div>
      )}
      {photos.length > 0 && <PhotoCarousel photos={photos} onOpen={open} onRemove={setRemoving} />}
      {uploading > 0 && (
        <p className="photo-adding" role="status">
          Adding {uploading === 1 ? "a photo" : `${uploading} photos`}…
        </p>
      )}
      {viewing && <PhotoViewer photos={viewing.photos} start={viewing.start} onClose={() => setViewing(null)} />}
    </div>
  );
}
