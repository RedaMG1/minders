# Module Photos and Budget Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browse a module's photos big, with arrows and full screen, and add a Stats section to the Budget page.

**Architecture:** The photo parts are built on one shared list, `modulePhotos(...)`:
- `PhotoCarousel` shows one big photo with arrows, swipe and a counter.
- `PhotoViewer` becomes a full-screen version that also navigates.
- The module page gets a Photos section, and the note page swaps its small grid for the carousel.

The budget stats are a pure function, `budgetStats(...)` in `src/lib/budgetStats.ts`, drawn by a `BudgetStats` component on the Budget page.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript; plain CSS in `src/app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-11-26-module-photos-and-budget-stats-design.md`

## Global Constraints

- Arrows only ever move through the photos of the current module, and only the signed-in account's own photos (`visiblePhotos` rule).
- Module photos are newest first (`addedAt` descending).
- With one photo, show no arrows and no counter. The counter reads "n / total".
- Stats use top-level categories, with subcategories counted inside them (`categoryFamily`).
- The 6-month chart ends at the month being viewed.
- "On pace for X" shows only for the current month.
- Tests are browser checks against the pretend Supabase, kept in the session scratchpad as before. Always also run `npx tsc --noEmit` and `npm run lint`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Removing the photo being shown:** the carousel moves to a neighbour and never shows an empty slot (Task 1 check).
2. **A shared module:** another account's photos never appear on the module page (Task 1 check, two accounts).
3. **A month with no spending, or no spending the month before:** no NaN, no Infinity, and no "↑ ∞%" (Task 2 checks).
4. **Viewing a past month:** no "On pace" line, and the daily average uses all the days of that month (Task 2 check).
5. **An item in a subcategory whose category was deleted:** it doesn't crash. It counts under its own subcategory, as the Budget page does (Task 2 check).

---

### Task 1: Browse a module's photos

**Files:**
- Modify:
  - `src/lib/photos.ts`
  - `src/components/PhotoViewer.tsx`
  - `src/components/NotePhotos.tsx`
  - `src/app/module/ModuleView.tsx` (NotesContent)
  - `src/app/globals.css`
  - `src/components/Icon.tsx` (a `"left"` chevron if the `back` icon doesn't fit)
- Create: `src/components/PhotoCarousel.tsx`
- Test: `<scratchpad>/modulephotos-e2e.mjs`

**Interfaces:**
- Produces:
  - `modulePhotos(photos: NotePhoto[], notes: Note[], moduleId: string): NotePhoto[]` in photos.ts. It returns `visiblePhotos` of every note in the module, newest first.
  - `PhotoCarousel({ photos, noteNames?, onOpen, onRemove? })`. `noteNames?: Map<string, string>` shows a note-name link under the photo. `onOpen(index: number)` and `onRemove?(photo: NotePhoto)` are callbacks.
  - `PhotoViewer({ photos, start, onClose })`, which replaces the old `{ src, onClose }`.
- Labels for the tests:
  - Carousel: `[aria-label="Previous photo"]`, `[aria-label="Next photo"]`, the counter `.photo-count`, and the big image `.carousel img`.
  - Viewer: `[role="dialog"][aria-label="Photo"]`, the same arrow labels inside it, and its own `.photo-count`.

- [ ] **Step 1: Write the failing browser test** with these checks:
  - Setup:
    - Module "Trips" has note A with 2 photos and note B with 1 photo.
    - Module "Other" has 1 photo.
    - Photos are added through the app, as in the photo test.
  - **Module page "Trips":**
    - It shows a Photos section with one big image and "1 / 3", newest first.
    - Next goes to "2 / 3", then "3 / 3"; Next at the end wraps to "1 / 3".
    - The note name under the photo links to `/note?id=<that note>`.
    - "Other"'s photo never appears (the counter total stays 3).
  - **Full screen:**
    - Tapping the big image opens the viewer on the same photo.
    - Next and the ArrowRight key move within the 3 photos only.
    - Close shuts the viewer.
  - **Note A page:**
    - It shows its photos big with "1 / 2".
    - Tapping opens the viewer with a total of 3, the module's photos.
  - **One photo:** module "Other"'s page shows no arrows and no counter.
  - **Removing:** removing the shown photo on note A leaves "1 / 1" and a visible image.
  - **Shared module:** account B, opening a shared module where A added a photo, sees no Photos section.
- [ ] **Step 2: Run it.** Expected: FAIL at the first check.
- [ ] **Step 3: Implement.**
  - The carousel keeps an `index` in state and clamps it when `photos.length` shrinks.
  - Swipe uses pointer events: a horizontal move over 40 px changes the photo.
  - Images load through `photoUrl`.
  - The big image is 4:3 with `object-fit: cover`. The viewer uses `contain`.
- [ ] **Step 4: Run** the new test, the existing `photos` test, tsc and lint. Expected: all PASS.
- [ ] **Step 5: Commit** "Browse a module's photos big, with arrows and full screen".

### Task 2: Budget stats

**Files:**
- Create: `src/lib/budgetStats.ts`, `src/components/BudgetStats.tsx`
- Modify: `src/app/budget/BudgetView.tsx`, `src/app/globals.css`
- Test: `<scratchpad>/budgetstats-e2e.mjs`

**Interfaces:**
- Produces `budgetStats(categories: BudgetCategory[], items: BudgetItem[], month: string, today: Date)`. It returns `BudgetStatsResult`:
  - `total: number` (cents) and `previousTotal: number`
  - `change: number | null`: the percent change, null when `previousTotal` is 0
  - `dailyAverage: number`
  - `projected: number | null`: only when `month === monthKey(today)`
  - `byCategory: { id, name, color, amount, share }[]`: top-level categories with spending, largest first, `share` from 0 to 1
  - `months: { month, total }[]`: 6 entries, oldest first, the last one being `month`
  - `biggest: BudgetItem[]`: up to 3, largest first
  - `overLimit: number`
- The section is `<section className="budget-stats" aria-label="Stats">`.

- [ ] **Step 1: Write the failing browser test.**
  - Seed data with today in November 2026:
    - Food (limit 50 €) with subcategory Groceries
    - Car
    - October: Food 100 €
    - November: Food 30 €, Groceries 40 €, Car 20 €
  - Checks for November:
    - The Stats section reads "90,00 €" and "10% less than October". The total fell from 100 to 90.
    - It shows a daily average, and "On pace for".
    - Food's bar reads "70,00 €" and "78%". Car's reads "20,00 €" and "22%". Groceries has no bar of its own.
    - Tapping Food opens `/budget/category?id=<food>`.
    - There are 6 month bars, and the last is labelled "Nov".
    - The biggest items are listed in the order 40, 30, 20.
    - It says "1 category over its limit" (Food 70 > 50).
  - Viewing October: no "On pace", and the daily average is 100/31, shown as "3,23 €".
  - Viewing September (nothing spent): an empty message, with no "NaN", "Infinity" or "%".
  - Viewing December (nothing spent, November had spending): an empty message.
  - A subcategory whose category is gone (seeded separately): the page renders, and the orphan shows as its own bar.
- [ ] **Step 2: Run it.** Expected: FAIL at the first check.
- [ ] **Step 3: Implement.**
  - Months use `shiftMonth`. The days in a month come from `new Date(y, m, 0).getDate()`.
  - The current month's daily average uses `today.getDate()` days.
  - `projected = dailyAverage × daysInMonth`.
  - Change text: "N% less/more than <Month>", or "Same as <Month>", or "No spending last month" when `change` is null.
  - Bars use the category colour via `t-${color}` and `--deep`.
- [ ] **Step 4: Run** the new test, the `features3` test (budget subcategories), tsc and lint. Expected: all PASS.
- [ ] **Step 5: Commit** "Add a Stats section to the Budget page".

### Task 3: Ship

- [ ] **Step 1:** Run the final whole-branch review and its fix pass, as in executing-plans.
- [ ] **Step 2:** Merge `origin/main` into `feature/supabase-sync`, so that `main` can fast-forward. Then `npm run build` with the real env.
- [ ] **Step 3:** Push `feature/supabase-sync`, fast-forward `main` to it, and push `main`.
- [ ] **Step 4:** Check the live site has "Next photo" and "budget-stats" in its chunks.
