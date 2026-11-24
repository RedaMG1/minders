# Note Photos and On Hold Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a task be put on hold, and let each account add private photos to its notes.

**Architecture:** On hold is a new flag on `Task`, handled in the store and shown on Today, Tomorrow and Home. Photos are JPEG files in a private Supabase Storage bucket `note-photos`, under `<account id>/<note id>/<photo id>.jpg`. Storage rules only let an account touch its own folder. A note keeps a `photos` list that syncs like the rest of the note, and the app shows only the signed-in account's photos.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, `@supabase/supabase-js` 2 (Storage), Cache Storage for offline photos.

**Spec:** `docs/superpowers/specs/2026-11-24-note-photos-and-on-hold-design.md`

## Global Constraints

- Nobody can open another account's photo, whether through the app, a link or the database. The bucket is private; there are no public URLs and no signed URLs.
- In a shared module, a photo is shown only to the account that added it. Edits by other accounts keep it in the note's `photos` list.
- Photos are scaled to at most 2000 px on the long side, as JPEG with quality 0.9. They are not squeezed further.
- Backups list photos (they're part of `notes`) but don't contain the files.
- A task's statuses are to do, on hold and done; `onHold` and `done` are never both true.
- Tests are browser checks run against the pretend Supabase used for earlier features (headless Edge through DevTools). They live outside the repo, in the session scratchpad, as before. Every task also passes `npx tsc --noEmit` and `npm run lint`.
- Git author is the repo-local config. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Photo taken on an iPhone in portrait:** it must show upright. Decode with `createImageBitmap(file, { imageOrientation: "from-image" })` (Task 3 test: a tall image stays tall).
2. **A note with only a photo and no text:** it must not be thrown away as blank (Task 3 test).
3. **Adding a photo while offline or when the upload fails:** no broken photo is added to the note, and a toast says it failed (Task 3 test with the pretend server returning 500).
4. **Another account editing a shared note that has your photo:** your photo stays in the list and they never see it (Task 4 test).
5. **An on hold task from yesterday:** it still shows today in On hold, and it doesn't count as unfinished (Task 1 test).

---

### Task 1: On hold tasks

**Files:**
- Modify: `src/lib/types.ts` (Task), `src/lib/store.ts` (task functions, `tasksForToday`), `src/components/Icon.tsx`, `src/components/TaskRow.tsx`, `src/app/today/page.tsx`, `src/app/tomorrow/page.tsx`, `src/app/page.tsx` (Home Today card), `src/components/SunArc.tsx` caller on Today, `src/app/globals.css`
- Modify: `supabase/functions/notifications/due.ts` and `due_test.ts` (the morning summary skips on hold tasks)
- Test: `<scratchpad>/onhold-e2e.mjs`

**Interfaces:**
- Produces: `Task.onHold?: boolean`; `toggleOnHold(id: string): void` in `store.ts`; icon name `"pause"`.

- [ ] **Step 1: Write the failing browser test** `onhold-e2e.mjs`, with these checks:
  - Tapping `[aria-label="Put <title> on hold"]` sets `onHold: true` locally and on the database row.
  - Putting a must do first-thing task on hold leaves `mustDo` and `first` false.
  - Today shows it under a section labelled "On hold", with the tag "On hold"; the Home card reads "0 of 1 done" when one task is to do and one is on hold.
  - "Move all … unfinished to tomorrow" moves the to do task but not the on hold one.
  - An on hold task dated yesterday still shows in Today's On hold section.
  - Tapping `[aria-label="Resume <title>"]` clears it; ticking an on hold task gives `done: true, onHold: false`.
  - It works the same on Tomorrow, including for a module task.
- [ ] **Step 2: Run it.** `node <scratchpad>/onhold-e2e.mjs out <scratchpad>/shots-onhold` after a build with `NEXT_PUBLIC_SUPABASE_URL=http://localhost:4192`. Expected: FAIL at the first check.
- [ ] **Step 3: Implement.**
  - Add `toggleOnHold(id: string)`. Going on hold sets `onHold: true, mustDo: false, first: false`; resuming sets `onHold: false`. `toggleTask` also clears `onHold` when it ticks a task done.
  - Add icon `pause`: `<path d="M8 5v14M16 5v14" />`.
  - TaskRow:
    - A not done task gets a pause button: `Put <title> on hold`, or `Resume <title>` with `aria-pressed` when it's on hold.
    - An on hold row is dimmed (`.task-row.on-hold`, opacity about 0.6), shows the tag "On hold", and hides the must do button and the `actions` buttons.
    - In task rows, `.row-btn` is 36 px wide so the extra button fits at 390 px.
  - Today and Tomorrow:
    - Split tasks into to do, on hold and done; on hold renders under `<p className="section-label">On hold</p>`.
    - Progress counts (Today's SunArc `done`/`total`, Home's "X of Y done") leave on hold tasks out.
  - `due.ts` `openTasksFor`: skip tasks with `onHold`, and add a Deno test for it.
- [ ] **Step 4: Run** the browser test (expect all PASS), `npx --yes deno@2.9.6 test supabase/functions/notifications` (expect all PASS), tsc and lint.
- [ ] **Step 5: Commit** "Let a task be put on hold".

### Task 2: Photo storage in the database

**Files:**
- Create: `supabase/migrations/2026-11-24-note-photos.sql`
- Modify: `supabase/schema.sql` (append the same)

**Interfaces:**
- Produces: bucket `note-photos`; an account may select, insert and delete objects whose first path folder equals its `auth.uid()`.

- [ ] **Step 1: Write the SQL.**
  - `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('note-photos', 'note-photos', false, 15728640, array['image/jpeg'])`.
  - Three policies on `storage.objects` for `authenticated`: `select`, `insert` (with check) and `delete`. Each uses `bucket_id = 'note-photos' and (storage.foldername(name))[1] = (select auth.uid())::text`.
  - No policy for `anon`, and none for `update`.
- [ ] **Step 2: Run it on the live project** in the Supabase SQL editor (the dashboard is the only way in; the MCP tool has no permission).
- [ ] **Step 3: Verify in the SQL editor:**
  - Acting as one account (`set local role authenticated` plus `request.jwt.claims`), inserting into `storage.objects` under another account's folder fails with an RLS error.
  - Selecting another account's object returns 0 rows.
  - `curl` without signing in to `/storage/v1/object/note-photos/<any path>` is refused.
- [ ] **Step 4: Commit** "Add private storage for note photos".

### Task 3: Adding, viewing and removing photos in a note

**Files:**
- Create: `src/lib/photos.ts`, `src/components/NotePhotos.tsx`, `src/components/PhotoViewer.tsx`
- Modify: `src/lib/types.ts` (Note), `src/lib/store.ts` (`saveNote` blank check, `deleteNote`, `deleteModule`), `src/app/note/NoteView.tsx`, `src/components/Icon.tsx` (`camera`), `src/app/globals.css`, `public/sw.js` (bump `VERSION` to `v6`)
- Test: `<scratchpad>/photos-e2e.mjs`. Its pretend server adds Storage endpoints that follow the same folder rule as Task 2: upload, authenticated download and remove. Read the exact routes from `node_modules/@supabase/storage-js`.

**Interfaces:**
- Consumes: `getSupabase()` and `currentUserId()`.
- Produces:
  - `type NotePhoto = { id: string; path: string; ownerId: string; width: number; height: number; addedAt: string }` and `Note.photos?: NotePhoto[]`.
  - In `photos.ts`:
    - `preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }>`
    - `uploadPhoto(noteId: string, file: File): Promise<NotePhoto>`, which throws on failure.
    - `photoUrl(photo: NotePhoto): Promise<string>`, an object URL served from Cache Storage `minders-photos` first.
    - `removePhotoFiles(paths: string[]): Promise<void>`, best effort, never throws.
    - `visiblePhotos(note: Note): NotePhoto[]`, the photos whose `ownerId` is the current account. With no database, `ownerId` is `""` and everything shows.

- [ ] **Step 1: Write the failing browser test** `photos-e2e.mjs`, with these checks:
  - The note toolbar has `[aria-label="Add a photo"]`. Setting a 3000×1500 PNG on `#photo-input` (`DOM.setFileInputFiles`) adds one photo of 2000×1000 to the note, locally and on the database row. The pretend server holds a JPEG at `user-a/<note id>/<photo id>.jpg`.
  - A 900×1600 image keeps width < height (it stays tall).
  - A new note with only a photo is saved, not dropped as blank.
  - The preview `img` loads (`naturalWidth > 0`). Tapping it opens the viewer (`[role="dialog"][aria-label="Photo"]`), and Close shuts it.
  - `[aria-label="Remove photo"]` and its confirm take the photo off the note and delete the file on the pretend server.
  - Deleting the note deletes its files.
  - With the pretend server returning 500 on upload, no photo is added and a toast reads "Couldn't add the photo".
- [ ] **Step 2: Run it.** Expected: FAIL at the first check.
- [ ] **Step 3: Implement.**
  - `preparePhoto`: scale with `createImageBitmap(file, { imageOrientation: "from-image" })`, a canvas sized to fit 2000 px on the long side (never upscaled), and `toBlob("image/jpeg", 0.9)`.
  - `uploadPhoto` uploads with `upsert: false` and `contentType: "image/jpeg"`.
  - `NotePhotos` sits under the note text:
    - A grid of square previews (`object-fit: cover`), each with a remove button.
    - The hidden `<input type="file" id="photo-input" accept="image/*">` is opened by the toolbar camera button, so iPhone offers both the camera and the photo library.
    - A placeholder tile shows while uploading.
  - `PhotoViewer` is a full-screen dark layer with the image (`object-fit: contain`), a Close button and Escape to close.
  - `saveNote` counts `photos` as content.
  - `deleteNote` and `deleteModule` pass their notes' own photo paths to `removePhotoFiles`.
- [ ] **Step 4: Run** the browser test (expect all PASS), tsc and lint.
- [ ] **Step 5: Commit** "Add photos to notes".

### Task 4: Photos stay private in shared modules

**Files:**
- Modify: `src/components/NotePhotos.tsx` and `src/app/module/ModuleView.tsx` if it shows photo counts. The task mostly proves Task 3's `visiblePhotos`.
- Test: extend `<scratchpad>/photos-e2e.mjs`

- [ ] **Step 1: Add checks.**
  - A adds a photo to a note in a shared module. B signs in and opens that note: no photo previews show, and `photoUrl` for A's path is refused by the pretend server.
  - B edits the note's text, and the database row still lists A's photo.
  - A signs back in and still sees and opens the photo.
- [ ] **Step 2: Run it.** Expected: PASS if Task 3 is right. Fix `NotePhotos` if not.
- [ ] **Step 3: Commit** (only if code changed) "Keep note photos private in shared modules".

### Task 5: Ship

- [ ] **Step 1:** `npm run build` with the real `.env.local`; it should end with the static route list and no errors.
- [ ] **Step 2:** Push `feature/supabase-sync`. Check that the live site's Today page chunk contains `"Put "` and `"on hold"`, and the note page chunk contains `"Add a photo"`.
- [ ] **Step 3:** On the live database, signed in as the real account in the browser pane if the person signs in there: add and remove one photo. Otherwise say what wasn't checked live.
