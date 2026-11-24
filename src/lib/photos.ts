import { currentUserId, newId } from "./store";
import { getSupabase } from "./sync";
import type { Note, NotePhoto } from "./types";

const BUCKET = "note-photos";
/** Photos are scaled so the long side is at most this many pixels. */
const MAX_SIDE = 2000;
const QUALITY = 0.9;
/** Opened photos are kept here, so they still show offline. */
const CACHE = "minders-photos";

/** Scales a picked image to fit 2000 px, upright, as a JPEG. Never makes it bigger. */
export async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  // JPEG has no transparency, so see-through parts become white instead of black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Could not make the photo");
  return { blob, width, height };
}

/** Uploads a photo into the account's own folder. Throws if it can't be saved. */
export async function uploadPhoto(noteId: string, file: File): Promise<NotePhoto> {
  const { blob, width, height } = await preparePhoto(file);
  const supabase = getSupabase();
  const ownerId = currentUserId() ?? "";
  const id = newId();
  const path = `${ownerId || "local"}/${noteId}/${id}.jpg`;
  if (supabase) {
    if (!ownerId) throw new Error("Not signed in");
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
  }
  await remember(path, blob);
  return { id, path, ownerId, width, height, addedAt: new Date().toISOString() };
}

const urls = new Map<string, string>();

/** A URL the page can show for a photo: from this device if it was opened before, otherwise downloaded. */
export async function photoUrl(photo: NotePhoto): Promise<string> {
  const known = urls.get(photo.path);
  if (known) return known;
  let blob = await recall(photo.path);
  if (!blob) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Photo not on this device");
    const { data, error } = await supabase.storage.from(BUCKET).download(photo.path);
    if (error || !data) throw error ?? new Error("Photo not found");
    blob = data;
    await remember(photo.path, blob);
  }
  const url = URL.createObjectURL(blob);
  urls.set(photo.path, url);
  return url;
}

/** Deletes photo files from storage and this device. Best effort: never throws. */
export async function removePhotoFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    const cache = await caches.open(CACHE);
    await Promise.all(paths.map((path) => cache.delete(cacheKey(path))));
  } catch {}
  for (const path of paths) {
    const url = urls.get(path);
    if (url) URL.revokeObjectURL(url);
    urls.delete(path);
  }
  try {
    await getSupabase()?.storage.from(BUCKET).remove(paths);
  } catch {}
}

/** The note's photos this account may see: only the ones it added. */
export function visiblePhotos(note: Note): NotePhoto[] {
  const me = currentUserId() ?? "";
  return (note.photos ?? []).filter((photo) => photo.ownerId === me);
}

/** The paths of the photos this account added to these notes, for deleting their files. */
export function ownPhotoPaths(notes: Note[]): string[] {
  return notes.flatMap((note) => visiblePhotos(note).map((photo) => photo.path));
}

const cacheKey = (path: string) => `/__photos/${path}`;

async function remember(path: string, blob: Blob) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(cacheKey(path), new Response(blob, { headers: { "Content-Type": "image/jpeg" } }));
  } catch {}
}

async function recall(path: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(cacheKey(path));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}
