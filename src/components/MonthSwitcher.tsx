import { Icon } from "./Icon";
import { monthLabel, shiftMonth } from "@/lib/money";

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="month-switcher">
      <button className="icon-btn" type="button" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        <Icon name="back" />
      </button>
      <span aria-live="polite">{monthLabel(month)}</span>
      <button className="icon-btn" type="button" aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        <Icon name="forward" />
      </button>
    </div>
  );
}
