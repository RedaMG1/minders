import { Suspense } from "react";
import { CategoryView } from "./CategoryView";

export const metadata = { title: "Minders" };

// A query string keeps this working as plain static files: /budget/category?id=...&month=2026-11
export default function BudgetCategoryPage() {
  return (
    <Suspense fallback={<div className="screen" />}>
      <CategoryView />
    </Suspense>
  );
}
