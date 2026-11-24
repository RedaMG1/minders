"use client";

import { useEffect, useState } from "react";
import { photoUrl, visiblePhotos } from "@/lib/photos";
import { removeNotePhoto } from "@/lib/store";
import type { Note, NotePhoto } from "@/lib/types";
import { Icon } from "./Icon";
import { PhotoViewer } from "./PhotoViewer";

function Preview({ photo, onOpen, onRemove }: { photo: NotePhoto; onOpen: (src: string) => void; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    photoUrl(photo)
      .then((url) => current && setSrc(url))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [photo]);

  return (
    <div className="note-photo">
      {src ? (
        <button className="photo-open" type="button" aria-label="Open photo" onClick={() => onOpen(src)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a private photo from this device, not a page image */}
          <img src={src} alt="" />
        </button>
      ) : (
        <span className="photo-wait">{failed ? "Can't load" : ""}</span>
      )}
      <button className="photo-remove" type="button" aria-label="Remove photo" onClick={onRemove}>
        <Icon name="x" small />
      </button>
    </div>
  );
}

/** The account's own photos in a note, with a placeholder for each one still uploading. */
export function NotePhotos({ note, uploading }: { note: Note; uploading: number }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<NotePhoto | null>(null);
  const photos = visiblePhotos(note);
  if (!photos.length && !uploading) return null;

  return (
    <div className="note-photos">
      {removing && (
        <div className="confirm">
          <p>Remove this photo? You can&apos;t undo this.</p>
          <button
            className="danger solid"
            type="button"
            onClick={() => {
              removeNotePhoto(note.id, removing);
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
      <div className="photo-grid">
        {photos.map((photo) => (
          <Preview key={photo.id} photo={photo} onOpen={setViewing} onRemove={() => setRemoving(photo)} />
        ))}
        {Array.from({ length: uploading }, (_, index) => (
          <div className="note-photo" key={`uploading-${index}`}>
            <span className="photo-wait" role="status">
              Adding…
            </span>
          </div>
        ))}
      </div>
      {viewing && <PhotoViewer src={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
