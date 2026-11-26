import Link from "next/link";
import { budgetStats } from "@/lib/budgetStats";
import { formatMoney } from "@/lib/money";
import type { BudgetCategory, BudgetItem } from "@/lib/types";

const monthName = (month: string, style: "long" | "short") => {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-GB", { month: style });
};

const percent = (share: number) => `${Math.round(share * 100)}%`;

type BudgetStatsProps = { categories: BudgetCategory[]; items: BudgetItem[]; month: string; today: Date };

/** A small dashboard of the month: totals, pace, where it went, the last six months and the biggest items. */
export function BudgetStats({ categories, items, month, today }: BudgetStatsProps) {
  const stats = budgetStats(categories, items, month, today);
  const previous = monthName(stats.months[stats.months.length - 2].month, "long");
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const tallest = Math.max(...stats.months.map((item) => item.total), 1);

  return (
    <section className="budget-stats" aria-label="Stats">
      <p className="section-label">Stats</p>
      {stats.total === 0 ? (
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
