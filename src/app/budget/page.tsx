import { Suspense } from "react";
import { BudgetView } from "./BudgetView";

export const metadata = { title: "Minders" };

// The month shown is kept in the address, /budget?month=2026-11, so going back keeps it.
export default function BudgetPage() {
  return (
    <Suspense fallback={<div className="screen" />}>
      <BudgetView />
    </Suspense>
  );
}
