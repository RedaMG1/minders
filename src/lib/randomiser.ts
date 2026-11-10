import type { ChecklistItem } from "./types";

export const PICK_COUNT = 3;
/** How many times to reshuffle when the new pick matches the old one. */
const MAX_TRIES = 10;

/** The items a pick is drawn from: unticked ones, or every item once all are ticked. */
export function pickPool(items: ChecklistItem[]) {
  const written = items.filter((item) => item.text.trim());
  const open = written.filter((item) => !item.done);
  return open.length ? open : written;
}

function shuffled<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks up to three items at random, avoiding the same set as last time when there are other choices. */
export function pickRandom(items: ChecklistItem[], previous: string[] = []) {
  const pool = pickPool(items).map((item) => item.id);
  const count = Math.min(PICK_COUNT, pool.length);
  const same = (pick: string[]) => pick.length === previous.length && pick.every((id) => previous.includes(id));
  let pick = shuffled(pool).slice(0, count);
  for (let tries = 0; tries < MAX_TRIES && pool.length > count && same(pick); tries++) {
    pick = shuffled(pool).slice(0, count);
  }
  return pick;
}
