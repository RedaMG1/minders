"use client";

import Link from "next/link";
import { useState } from "react";
import { budgetStats } from "@/lib/budgetStats";
import { formatMoney } from "@/lib/money";
import type { BudgetCategory, BudgetItem } from "@/lib/types";

const monthName = (month: string, style: "long" | "short") => {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-GB", { month: style });
};

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** Whether the stats are hidden is remembered on this device only. */
const HIDDEN_KEY = "minders-stats-hidden";
const readHidden = () => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
};

type BudgetStatsProps = { categories: BudgetCategory[]; items: BudgetItem[]; month: string; today: Date };

/** A small dashboard of the month: totals, pace, where it went, the last six months and the biggest items. */
export function BudgetStats({ categories, items, month, today }: BudgetStatsProps) {
  const [hidden, setHidden] = useState(readHidden);
  const stats = budgetStats(categories, items, month, today);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    try {
      if (next) localStorage.setItem(HIDDEN_KEY, "1");
      else localStorage.removeItem(HIDDEN_KEY);
    } catch {}
  }
  const previous = monthName(stats.months[stats.months.length - 2].month, "long");
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const tallest = Math.max(...stats.months.map((item) => item.total), 1);

  return (
    <section className="budget-stats" aria-label="Stats">
      <div className="stats-title">
        <p className="section-label">Stats</p>
        <button className="stats-toggle" type="button" aria-label={hidden ? "Show stats" : "Hide stats"} aria-expanded={!hidden} onClick={toggle}>
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      {hidden ? null : stats.total === 0 ? (
        <p className="empty stats-empty">Nothing spent in {monthName(month, "long")}.</p>
      ) : (
        <>
          <div className="stats-head">
            <strong>{formatMoney(stats.total)}</strong>
            <span>
              {stats.change === null
                ? "No spending last month"
                : stats.change === 0
                  ? `Same as ${previous}`
                  : `${Math.abs(stats.change)}% ${stats.change < 0 ? "less" : "more"} than ${previous}`}
            </span>
            <small>
              {formatMoney(stats.dailyAverage)} a day
              {stats.projected !== null && ` · On pace for ${formatMoney(stats.projected)}`}
            </small>
            {stats.overLimit > 0 && (
              <small className="over">
                {stats.overLimit} {stats.overLimit === 1 ? "category" : "categories"} over {stats.overLimit === 1 ? "its" : "their"} limit
              </small>
            )}
          </div>

          <div className="stats-bars">
            {stats.byCategory.map((category) => (
              <Link className={`stats-bar t-${category.color}`} href={`/budget/category?id=${category.id}&month=${month}`} key={category.id}>
                <span className="stats-bar-top">
                  <b>{category.name}</b>
                  <span>
                    {formatMoney(category.amount)} · {percent(category.share)}
                  </span>
                </span>
                <span className="stats-track" aria-hidden="true">
                  <i style={{ width: percent(category.share) }} />
                </span>
              </Link>
            ))}
          </div>

          <div className="stats-chart" role="img" aria-label="Spending over the last six months">
            {stats.months.map((item) => (
              <span
                className={item.month === month ? "stats-month current" : "stats-month"}
                key={item.month}
                title={`${monthName(item.month, "long")}: ${formatMoney(item.total)}`}
              >
                <i style={{ height: `${Math.round((item.total / tallest) * 100)}%` }} />
                {monthName(item.month, "short")}
              </span>
            ))}
          </div>

          <div className="stats-biggest">
            <b>Biggest</b>
            <ol>
              {stats.biggest.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.label}
                    <small>{names.get(item.categoryId) ?? ""}</small>
                  </span>
                  <b>{formatMoney(item.amount)}</b>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </section>
  );
}
