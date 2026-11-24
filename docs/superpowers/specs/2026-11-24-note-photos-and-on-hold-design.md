# Note photos and On hold tasks

Date: 2026-11-24. Size: a small change, two parts.

## 1. Photos in notes

**Why:** to keep a picture with a note. Only a few photos in total, so storage size doesn't matter.

**Goals**
- Add a photo to a note from the camera or the photo library.
- Photos show under the note as small previews; tapping one opens it full screen; each can be removed.
- Photos sync with the note to every device the account signs in on.

**Anti-goals**
- Nobody can open another account's photo. Not through the app, a link, or the database.

**Approaches considered**
- *Supabase Storage, private (picked).* Files live in a private bucket; the database checks the account on every request.
- Supabase Storage with hidden links. Rejected: anyone holding a link could open the photo.
- Photo stored inside the note's text data. Rejected: slow sync and it would fill the phone's small app storage.
- Photo kept only on the phone. Rejected: lost with the phone.

**Decided**
- Private bucket `note-photos`. Each file is stored under the account's own folder: `<account id>/<note id>/<photo id>.jpg`.
- Storage rules: an account can add, open and delete files in its own folder only.
- A note keeps a list of its photos (id, file path, owner account, size, when added). The list syncs with the note.
- **Shared modules:** a photo stays visible only to the account that added it. Other accounts don't see it in the note at all. Their edits to the note keep it in place.
- Photos are scaled down to at most about 2000 px on the long side, as JPEG. They are not squeezed further.
- Removing a photo deletes its file. Deleting a note deletes the photos its account added.
- Opened photos are kept on the device, so they still show offline once seen.

**Left to the builder**
- Exact look of the previews and the full-screen view, in the app's current style.
- How a photo that is still uploading or failed to upload is shown.

**Not included:** photos in backups. The backup lists each note's photos but doesn't contain the files.

## 2. On hold tasks

**Why:** a task can be paused without being done or deleted.

**Decided**
- A task has three statuses: to do, on hold, done. An "On hold" button sets it; tapping it again puts it back to to do.
- On hold tasks stay on their day in an **On hold** section at the bottom of Today and Tomorrow. They are dimmed and tagged "On hold".
- Like unfinished tasks, they carry over to the next day until resumed or ticked.
- They don't count toward "X of Y done", and "Move all unfinished to tomorrow" skips them.
- Putting a task on hold clears Must do and First thing; ticking an on hold task marks it done.
- Works for module tasks too.

**Left to the builder:** where the On hold button sits in the already busy task row.
