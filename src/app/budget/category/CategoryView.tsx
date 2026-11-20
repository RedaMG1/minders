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
import { budgetItemsInMonth, categoryFamily, sumAmounts, useApp } from "@/lib/store";
import type { AppState, BudgetCategory } from "@/lib/types";

/** The share of a limit spent, as a bar width that never goes past the end. */
const barWidth = (spent: number, limit: number) => `${Math.min(100, Math.round((spent / limit) * 100))}%`;

function CategoryScreen({ category, state, now, month }: { category: BudgetCategory; state: AppState; now: Date; month: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const parent = category.parentId ? state.budgetCategories.find((item) => item.id === category.parentId) : undefined;
  // Only a top-level category holds subcategories.
  const subcategories = parent
    ? []
    : state.budgetCategories.filter((item) => item.parentId === category.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const family = categoryFamily(state.budgetCategories, category.id);
  const names = new Map(subcategories.map((item) => [item.id, item.name]));

  const items = budgetItemsInMonth(state.budgetItems, month, family);
  const spent = sumAmounts(items);
  const limit = category.monthlyLimit;
  const allItems = state.budgetItems.filter((item) => family.includes(item.categoryId)).length;
  const open = items.find((item) => item.id === openId);
  // New items default to today, or to the first day when looking at another month.
  const defaultDate = monthKey(now) === month ? dayKey(now) : `${month}-01`;
  const backHref = parent ? `/budget/category?id=${parent.id}&month=${month}` : `/budget?month=${month}`;

  return (
    <div className="screen">
      <div className={`module-top t-${category.color}`}>
        <div className="status" />
        <div className="editor-bar">
          <Link className="back" href={backHref}>
            <Icon name="back" />
            {parent ? parent.name : "Budget"}
          </Link>
          <button
            className="icon-btn plain"
            type="button"
            aria-label={parent ? "Edit subcategory" : "Edit category"}
            onClick={() => setEditing(true)}
          >
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
        {!parent && (
          <div className="sub-section">
            <p className="section-label">Subcategories</p>
            <div className="budget-list">
              {subcategories.map((sub) => {
                const subSpent = sumAmounts(items.filter((item) => item.categoryId === sub.id));
                const subLimit = sub.monthlyLimit;
                return (
                  <Link className={`budget-row sub-row t-${sub.color}`} href={`/budget/category?id=${sub.id}&month=${month}`} key={sub.id}>
                    <span className="budget-row-main">
                      <span className="budget-row-top">
                        <b>{sub.name}</b>
                        <span className="budget-amount">{formatMoney(subSpent)}</span>
                      </span>
                      {subLimit ? (
                        <>
                          <span className="budget-bar" aria-hidden="true">
                            <i className={subSpent > subLimit ? "over" : undefined} style={{ width: barWidth(subSpent, subLimit) }} />
                          </span>
                          <small className={subSpent > subLimit ? "over" : undefined}>
                            {subSpent > subLimit
                              ? `${formatMoney(subSpent - subLimit)} over ${formatMoney(subLimit)}`
                              : `${formatMoney(subLimit - subSpent)} left of ${formatMoney(subLimit)}`}
                          </small>
                        </>
                      ) : null}
                    </span>
                    <Icon name="arrow" small />
                  </Link>
                );
              })}
              <button className="move-all sub-add" type="button" onClick={() => setAddingSub(true)}>
                <Icon name="plus" small />
                New subcategory
              </button>
            </div>
          </div>
        )}

        {subcategories.length > 0 && <p className="section-label">All items</p>}
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
                  {names.has(item.categoryId) && <small className="item-sub">{names.get(item.categoryId)}</small>}
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
        <BudgetItemSheet
          categoryId={category.id}
          categoryName={category.name}
          subcategories={subcategories}
          defaultDate={defaultDate}
          onClose={() => setAdding(false)}
        />
      )}
      {open && (
        <BudgetItemSheet
          key={open.id}
          categoryId={open.categoryId}
          categoryName={category.name}
          parentId={parent ? undefined : category.id}
          subcategories={subcategories}
          item={open}
          defaultDate={defaultDate}
          onClose={() => setOpenId(null)}
        />
      )}
      {editing && (
        <BudgetCategorySheet
          category={category}
          itemCount={allItems}
          subCount={subcategories.length}
          onClose={() => setEditing(false)}
        />
      )}
      {addingSub && <BudgetCategorySheet parent={category} onClose={() => setAddingSub(false)} />}
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
