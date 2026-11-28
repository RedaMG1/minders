# Savings, Stats Toggle and Task Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep savings out of spending, let the stats be hidden, and let a task's name be edited.

**Architecture:**
- **Savings:** a `savings` flag on top-level budget categories. A helper `savingsIds(categories)` gives every savings category id, including subcategories. Every spending figure, on the Budget page and in `budgetStats`, filters those ids out, and the Budget page shows them in their own card and section.
- **Stats toggle:** a device-only flag in localStorage.
- **Task names:** an Edit task sheet that calls a new store function.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-28-savings-stats-toggle-task-edit-design.md`

## Global Constraints

- Savings never counts in any spending figure: the total, the plan, or any of the stats.
- Subcategories of a savings category are savings.
- The stats toggle is device-only, in localStorage key `minders-stats-hidden`.
- A task name can't be saved empty.
- Module tasks keep their module's name.
- Tests are browser checks against the pretend Supabase, in the session scratchpad. Always also run `npx tsc --noEmit` and `npm run lint`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A savings category with a subcategory:** the subcategory's items are savings too (Task 1 check).
2. **A savings category with a monthly limit:** its limit isn't part of "your plan" (Task 1 check).
3. **Stats with savings present:** savings don't appear in the bars, the biggest items or the over-limit count (Task 1 check).
4. **Editing a task name to blank:** Save is disabled (Task 3 check).
5. **Tapping a module task's name:** it opens the module's contents, not the edit sheet (Task 3 check).

---

### Task 1: Savings kept apart

**Files:**
- Modify:
  - `src/lib/types.ts` (`BudgetCategory.savings?: boolean`)
  - `src/lib/budgetStats.ts`
  - `src/app/budget/BudgetView.tsx`
  - `src/app/budget/category/CategoryView.tsx`
  - `src/components/BudgetCategorySheet.tsx`
  - `src/app/globals.css`
- Create: `src/lib/savings.ts`, exporting `savingsIds(categories: BudgetCategory[]): Set<string>`
- Test: `<scratchpad>/savings-e2e.mjs`

- [ ] **Step 1: Write the failing browser test.**
  - Seed November 2026:
    - Food (limit 50 €) with 30 € spent.
    - Savings (limit 500 €) with a subcategory Holiday. The parent has 200 € and Holiday has 100 €.
  - Check that `#category-savings` exists on Savings' edit sheet. Turning it on and saving sets `savings: true` locally and on the database row.
  - Budget page:
    - "Spent in November" reads 30,00 €.
    - The plan line mentions "50,00 €", not 550.
    - A `.budget-savings` card reads "Saved in November" and 300,00 €.
    - The Savings section lists Savings, and Savings is not in the spending list.
  - Stats:
    - The total is 30,00 €.
    - There's one bar (Food).
    - The biggest items contain none of the savings items.
  - Savings' own page reads "saved".
  - The subcategory's edit sheet has no savings switch.
- [ ] **Step 2: Run it.** Expected: FAIL at the switch check.
- [ ] **Step 3: Implement.**
  - `budgetStats` filters out items whose `categoryId` is in `savingsIds`, and categories in that set, before anything else.
  - BudgetView splits the top-level categories into spending and savings.
- [ ] **Step 4: Run** the savings, budgetstats and features3 tests, tsc and lint. Expected: all PASS.
- [ ] **Step 5: Commit** "Keep savings apart from spending".

### Task 2: Hide or show the stats

**Files:**
- Modify: `src/components/BudgetStats.tsx`, `src/app/globals.css`
- Test: add to `<scratchpad>/savings-e2e.mjs`

- [ ] **Step 1: Add checks.**
  - `[aria-label="Hide stats"]` hides the stats content; the bars and chart are gone, and the "Stats" title stays.
  - After a reload it's still hidden, and `localStorage["minders-stats-hidden"] === "1"`.
  - "Show stats" brings the content back.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with `useState` read once from localStorage (wrapped in try/catch) and written on toggle.
- [ ] **Step 4: Run** the test, tsc and lint. Expected: PASS.
- [ ] **Step 5: Commit** "Let the stats be hidden".

### Task 3: Edit a task's name

**Files:**
- Modify: `src/lib/store.ts`, `src/components/TaskRow.tsx`, `src/app/globals.css`
- Create: `src/components/TaskEditSheet.tsx`
- Test: `<scratchpad>/taskedit-e2e.mjs`

**Interfaces:**
- Produces `setTaskTitle(id: string, title: string): void`. It trims the title and ignores an empty one.

- [ ] **Step 1: Write the failing browser test.**
  - On Today, `[aria-label="Edit Call the bank"]` opens an "Edit task" sheet with `#task-name` holding "Call the bank".
  - Changing it to "Call the bank about the card" and saving updates the task locally and on the database row.
  - Clearing the field disables Save.
  - Tapping the name no longer ticks the task, while clicking `#task-<id>` still does.
  - The same works on Tomorrow.
  - Tapping a module task's name shows its module's contents (`.module-peek`) and opens no sheet.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The checkbox gets `aria-label="Mark <title> done"`.
  - The name becomes a button inside `.task-body`: Edit for normal tasks, or the module's contents for module tasks.
  - The label wraps only the checkbox.
- [ ] **Step 4: Run** taskedit, tasktime, onhold and moduletask, tsc and lint. Expected: all PASS.
- [ ] **Step 5: Commit** "Let a task's name be edited".

### Task 4: Copy a budget item to next month (added mid-build)

**Files:**
- Modify: `src/lib/store.ts`, `src/components/BudgetItemSheet.tsx`
- Test: `<scratchpad>/copyitem-e2e.mjs`

**Interfaces:**
- Produces `copyBudgetItemToNextMonth(id: string): BudgetItem | null`. The copy gets a new id, the same category, label and amount, and the date shifted one month, clamped to the month's last day.

- [ ] **Step 1: Write the failing browser test.**
  - "Copy to next month" on a 15 Nov item creates a 15 Dec item in the same category, with the same label and amount, locally and on the database.
  - The November item is unchanged.
  - A 31 Jan item copies to 28 Feb.
  - A message confirms the copy.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test and features3. Expected: PASS.
- [ ] **Step 5: Commit** "Copy a budget item to next month".

### Task 5: Ship

- [ ] **Step 1:** Final whole-branch review and its fix pass.
- [ ] **Step 2:** `npm run build` with the real env. Push `feature/supabase-sync`, fast-forward `main` to it, and push `main`.
- [ ] **Step 3:** Check the live site has "Saved in", "Hide stats" and "Edit task".
