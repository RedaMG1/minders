import { monthKey, shiftMonth } from "./money";
import { budgetItemsInMonth, categoryFamily, sumAmounts } from "./store";
import type { BudgetCategory, BudgetItem } from "./types";

const CHART_MONTHS = 6;
const BIGGEST_COUNT = 3;

export type CategoryShare = { id: string; name: string; color: string; amount: number; share: number };

export type BudgetStatsResult = {
  /** Cents spent in the month. */
  total: number;
  previousTotal: number;
  /** Percent change from the month before, or null when nothing was spent then. */
  change: number | null;
  dailyAverage: number;
  /** Where the month is heading at this pace. Only for the current month. */
  projected: number | null;
  /** Top-level categories with spending, largest first. Subcategories count inside their category. */
  byCategory: CategoryShare[];
  /** Six months ending at the month asked for, oldest first. */
  months: { month: string; total: number }[];
  biggest: BudgetItem[];
  overLimit: number;
};

const daysInMonth = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index, 0).getDate();
};

/** The numbers behind the Budget page's Stats section, for one month (YYYY-MM). */
export function budgetStats(categories: BudgetCategory[], items: BudgetItem[], month: string, today: Date): BudgetStatsResult {
  const inMonth = budgetItemsInMonth(items, month);
  const total = sumAmounts(inMonth);
  const previousTotal = sumAmounts(budgetItemsInMonth(items, shiftMonth(month, -1)));
  const change = previousTotal ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;

  // The current month is averaged over the days so far; other months over all their days.
  // Items dated later this month, like a bill entered ahead, count once as they are, never multiplied.
  const isCurrent = month === monthKey(today);
  const days = isCurrent ? today.getDate() : daysInMonth(month);
  const todayKey = `${month}-${String(today.getDate()).padStart(2, "0")}`;
  const later = isCurrent ? sumAmounts(inMonth.filter((item) => item.date > todayKey)) : 0;
  const soFar = total - later;
  const dailyAverage = Math.round(soFar / days);
  const projected = isCurrent ? Math.round((soFar / days) * daysInMonth(month)) + later : null;

  // A subcategory whose category is gone stands on its own, as on the Budget page.
  const ids = new Set(categories.map((category) => category.id));
  const topLevel = categories.filter((category) => !category.parentId || !ids.has(category.parentId));
  const byCategory = topLevel
    .map((category) => {
      const family = categoryFamily(categories, category.id);
      const amount = sumAmounts(inMonth.filter((item) => family.includes(item.categoryId)));
      return { id: category.id, name: category.name, color: category.color, amount, share: total ? amount / total : 0 };
    })
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const months = Array.from({ length: CHART_MONTHS }, (_, i) => {
    const key = shiftMonth(month, i - (CHART_MONTHS - 1));
    return { month: key, total: sumAmounts(budgetItemsInMonth(items, key)) };
  });

  const biggest = [...inMonth].sort((a, b) => b.amount - a.amount).slice(0, BIGGEST_COUNT);

  const overLimit = categories.filter((category) => {
    if (!category.monthlyLimit) return false;
    const counted = topLevel.includes(category) ? categoryFamily(categories, category.id) : [category.id];
    return sumAmounts(inMonth.filter((item) => counted.includes(item.categoryId))) > category.monthlyLimit;
  }).length;

  return { total, previousTotal, change, dailyAverage, projected, byCategory, months, biggest, overLimit };
}
