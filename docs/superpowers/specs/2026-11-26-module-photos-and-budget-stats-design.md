# Module photo browsing and budget stats

Date: 2026-11-26. Size: a small change. Approved in conversation ("yes and the photo get big when i click on them").

## 1. Photos, per module

**Why:** photos are small squares in a note, and there's no way to flip through them. The person keeps photos in a module and wants to browse that module's photos only, never the whole app's.

**Decided**
- Photos are browsed per module: the arrows only move through the photos of the module the person is in.
- **Module page:** a **Photos** section shows the module's photos (from all its notes, newest first) big, one at a time:
  - ‹ › arrows, swiping, and an "n / total" counter
  - the name of the note each photo came from; tapping it opens the note
- **Note page:** the note's photos show big in the same way, with a remove button for the photo shown.
- **Tapping a photo** opens it full screen. There, the arrows, swiping and the ←/→ keys move through the whole module's photos.
- Only the signed-in account's own photos ever show, so shared modules stay private (unchanged rule).
- With one photo, there are no arrows and no counter.

## 2. Budget stats

**Why:** the person wants a small dashboard of where their money goes, using their own categories.

**Decided:** a **Stats** section on the Budget page, for the month being viewed:
- **The total, compared with the month before:** "↓ 12% vs October", or "No spending last month" when there's nothing to compare.
- **The daily average:**
  - For the current month, it's over the days so far, plus "On pace for X" by month end.
  - For past months, it's over the whole month, with no projection.
- **A bar per top-level category,** with its amount and share of the month. Subcategories count inside their category, as on the rest of the Budget page. Tapping a bar opens that category.
- **The last 6 months** (ending at the month viewed) as a small bar chart of monthly totals.
- **The 3 biggest items** of the month.
- **How many categories are over their monthly limit**, shown only if any are.
- A month with no spending shows a short empty message instead of the numbers.

**Left to the builder:** exact looks, in the app's current style; the swipe threshold.
