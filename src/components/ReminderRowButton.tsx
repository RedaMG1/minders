import { Icon } from "./Icon";
import { clock, repeatLabel } from "@/lib/dates";
import type { ReminderRow } from "@/lib/store";

type ReminderRowButtonProps = {
  row: ReminderRow;
  /** Shown under the time, such as a date. */
  dateLabel?: string;
  moduleName?: string;
  onOpen: () => void;
};

export function ReminderRowButton({ row, dateLabel, moduleName, onOpen }: ReminderRowButtonProps) {
  const { reminder, at, sent } = row;
  const repeat = repeatLabel(reminder.repeat, at);
  const sub = moduleName && repeat ? `${moduleName}, ${repeat}` : moduleName || repeat;

  return (
    <button className={sent ? "reminder sent" : "reminder"} type="button" onClick={onOpen}>
      <time dateTime={at.toISOString()}>
        {clock(at)}
        {dateLabel && <small>{dateLabel}</small>}
      </time>
      <div>
        <b>{reminder.title}</b>
        {sub && (
          <div className="sub">
            {repeat && <Icon name="repeat" small />}
            {sub[0].toUpperCase() + sub.slice(1)}
          </div>
        )}
      </div>
      <span className="status-dot" role="img" aria-label={sent ? "Sent" : "Upcoming"} />
    </button>
  );
}
