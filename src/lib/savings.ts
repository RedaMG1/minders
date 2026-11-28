import type { BudgetCategory, BudgetItem } from "./types";

/** Every savings category's id: categories marked as savings and their subcategories. */
export function savingsIds(categories: BudgetCategory[]): Set<string> {
  const top = new Set(categories.filter((category) => category.savings && !category.parentId).map((category) => category.id));
  return new Set(categories.filter((category) => top.has(category.id) || (category.parentId && top.has(category.parentId))).map((category) => category.id));
}

/** Splits categories and items into spending and savings, so savings never count as spent. */
export function splitSavings(categories: BudgetCategory[], items: BudgetItem[]) {
  const saving = savingsIds(categories);
  return {
    saving,
    spendingCategories: categories.filter((category) => !saving.has(category.id)),
    spendingItems: items.filter((item) => !saving.has(item.categoryId)),
    savingsCategories: categories.filter((category) => saving.has(category.id)),
    savingsItems: items.filter((item) => saving.has(item.categoryId)),
  };
}
