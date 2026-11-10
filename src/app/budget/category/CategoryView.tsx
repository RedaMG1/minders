"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BudgetCategorySheet } from "@/components/BudgetCategorySheet";
import { BudgetItemSheet } from "@/components/BudgetItemSheet";
import { Icon } from "@/components/Icon";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { TabBar } from "@/components/TabBar";
import { dayKey, shortDate } from "@/lib/dates";
import { formatMoney, isMonthKey, monthKey } from "@/lib/money";
import { budgetItemsInMonth, sumAmounts, useApp } from "@/lib/store";
import type { AppState, BudgetCategory } from "@/lib/types";

function CategoryScreen({ category, state, now, month }: { category: BudgetCategory; state: AppState; now: Date; month: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const items = budgetItemsInMonth(state.budgetItems, month, category.id);
  const spent = sumAmounts(items);
  const limit = category.monthlyLimit;
  const allItems = state.budgetItems.filter((item) => item.categoryId === category.id).length;
  const open = items.find((item) => item.id === openId);
  // New items default to today, or to the first day when looking at another month.
  const defaultDate = monthKey(now) === month ? dayKey(now) : `${month}-01`;

  return (
    <div className="screen">
      <div className={`module-top t-${category.color}`}>
        <div className="status" />
        <div className="editor-bar">
          <Link className="back" href={`/budget?month=${month}`}>
            <Icon name="back" />
            Budget
          </Link>
          <button className="icon-btn plain" type="button" aria-label="Edit category" onClick={() => setEditing(true)}>
            <Icon name="edit" />
          </button>
        </div>
        <div className="page-head">
          <div className="module-title">
            <span className="tile">
              <Icon name="wallet" />
            </span>
            <div>
              <h1 className="day-title">{category.name}</h1>
              <span className="kind">
                {formatMoney(spent)}
                {limit ? ` of ${formatMoney(limit)}` : " spent"}
              </span>
            </div>
          </div>
          <button className="icon-btn" type="button" aria-label="Add item" onClick={() => setAdding(true)}>
            <Icon name="plus" />
          </button>
        </div>
      </div>

      <MonthSwitcher month={month} onChange={(next) => router.replace(`/budget/category?id=${category.id}&month=${next}`)} />

      <div className="scroll reminder-list in-module">
        {items.length === 0 ? (
          <p className="empty">
            <b>Nothing this month</b>
            Tap the plus button to add what you spent.
          </p>
        ) : (
          <>
            {items.map((item) => (
              <button className="reminder budget-item" type="button" key={item.id} onClick={() => setOpenId(item.id)}>
                <time dateTime={item.date}>{shortDate(new Date(`${item.date}T12:00`))}</time>
                <div>
                  <b>{item.label}</b>
                </div>
                <span className="budget-amount">{formatMoney(item.amount)}</span>
              </button>
            ))}
            <div className="budget-sum">
              <span>
                Total, {items.length} {items.length === 1 ? "item" : "items"}
              </span>
              <b>{formatMoney(spent)}</b>
            </div>
          </>
        )}
      </div>

      <TabBar />
      {adding && (
        <BudgetItemSheet categoryId={category.id} categoryName={category.name} defaultDate={defaultDate} onClose={() => setAdding(false)} />
      )}
      {open && (
        <BudgetItemSheet
          key={open.id}
          categoryId={category.id}
          categoryName={category.name}
          item={open}
          defaultDate={defaultDate}
          onClose={() => setOpenId(null)}
        />
      )}
      {editing && <BudgetCategorySheet category={category} itemCount={allItems} onClose={() => setEditing(false)} />}
    </div>
  );
}

export function CategoryView() {
  const app = useApp();
  const params = useSearchParams();
  if (!app) return <div className="screen" />;

  const id = params.get("id");
  const requested = params.get("month");
  const found = app.state.budgetCategories.find((category) => category.id === id);

  if (!found) {
    return (
      <div className="screen">
        <div className="status" />
        <div className="missing">
          <h1 className="day-title">Category not found</h1>
          <p>It may have been deleted.</p>
          <Link className="chip" href="/budget">
            Back to Budget
          </Link>
        </div>
        <TabBar />
      </div>
    );
  }

  const month = isMonthKey(requested) ? requested : monthKey(app.now);
  return <CategoryScreen category={found} state={app.state} now={app.now} month={month} />;
}
