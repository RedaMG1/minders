"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BudgetCategorySheet } from "@/components/BudgetCategorySheet";
import { Icon } from "@/components/Icon";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { TabBar } from "@/components/TabBar";
import { formatMoney, isMonthKey, monthKey, monthLabel } from "@/lib/money";
import { budgetItemsInMonth, sumAmounts, useApp } from "@/lib/store";

/** The share of a limit spent, as a bar width that never goes past the end. */
const barWidth = (spent: number, limit: number) => `${Math.min(100, Math.round((spent / limit) * 100))}%`;

export function BudgetView() {
  const app = useApp();
  const router = useRouter();
  const requested = useSearchParams().get("month");
  const [creating, setCreating] = useState(false);
  if (!app) return <div className="screen" />;

  const { state, now } = app;
  const month = isMonthKey(requested) ? requested : monthKey(now);
  const items = budgetItemsInMonth(state.budgetItems, month);
  const total = sumAmounts(items);
  const categories = [...state.budgetCategories].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const planned = categories.reduce((sum, category) => sum + (category.monthlyLimit ?? 0), 0);
  const left = planned - total;

  return (
    <div className="screen">
      <div className="status" />
      <div className="page-head">
        <h1 className="day-title">Budget</h1>
      </div>
      <MonthSwitcher month={month} onChange={(next) => router.replace(`/budget?month=${next}`)} />

      <div className="scroll home-body">
        <div className="budget-total">
          <span>Spent in {monthLabel(month).split(" ")[0]}</span>
          <strong>{formatMoney(total)}</strong>
          {planned > 0 && (
            <>
              <div className="budget-bar" aria-hidden="true">
                <i className={left < 0 ? "over" : undefined} style={{ width: barWidth(total, planned) }} />
              </div>
              <small>
                {left >= 0 ? `${formatMoney(left)} left of ${formatMoney(planned)}` : `${formatMoney(-left)} over your ${formatMoney(planned)} plan`}
              </small>
            </>
          )}
        </div>

        {categories.length === 0 && (
          <p className="empty">
            <b>Create your first category</b>
            Make one for each kind of spending, like Food, Car or Rent, then add what you spend to it.
          </p>
        )}

        <div className="budget-list">
          {categories.map((category) => {
            const mine = items.filter((item) => item.categoryId === category.id);
            const spent = sumAmounts(mine);
            const limit = category.monthlyLimit;
            return (
              <Link className={`budget-row t-${category.color}`} href={`/budget/category?id=${category.id}&month=${month}`} key={category.id}>
                <span className="tile">
                  <Icon name="wallet" />
                </span>
                <span className="budget-row-main">
                  <span className="budget-row-top">
                    <b>{category.name}</b>
                    <span className="budget-amount">{formatMoney(spent)}</span>
                  </span>
                  {limit ? (
                    <>
                      <span className="budget-bar" aria-hidden="true">
                        <i className={spent > limit ? "over" : undefined} style={{ width: barWidth(spent, limit) }} />
                      </span>
                      <small className={spent > limit ? "over" : undefined}>
                        {spent > limit ? `${formatMoney(spent - limit)} over ${formatMoney(limit)}` : `${formatMoney(limit - spent)} left of ${formatMoney(limit)}`}
                      </small>
                    </>
                  ) : (
                    <small>
                      {mine.length} {mine.length === 1 ? "item" : "items"}
                    </small>
                  )}
                </span>
              </Link>
            );
          })}
          <button className="module add" type="button" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            New category
          </button>
        </div>
      </div>

      <TabBar />
      {creating && <BudgetCategorySheet onClose={() => setCreating(false)} />}
    </div>
  );
}
