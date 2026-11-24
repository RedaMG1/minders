import { clock } from "@/lib/dates";
import type { ReminderRow } from "@/lib/store";

const CX = 170;
const CY = 130;
const RADIUS = 120;
const LABEL_RADIUS = 96;
const DAY_START = 6;
const DAY_HOURS = 18;
/** Labels closer than this share of the arc would overlap, so the later one is left out. */
const MIN_LABEL_GAP = 0.09;

const round = (value: number) => Math.round(value * 10) / 10;

/** How far through the 06:00 to midnight day this time is, from 0 to 1. */
function dayFraction(date: Date) {
  const hours = date.getHours() + date.getMinutes() / 60;
  return Math.min(1, Math.max(0, (hours - DAY_START) / DAY_HOURS));
}

function pointOnArc(fraction: number, radius = RADIUS) {
  const angle = Math.PI * (1 - fraction);
  return { x: round(CX + radius * Math.cos(angle)), y: round(CY - radius * Math.sin(angle)) };
}

function placeDots(rows: ReminderRow[]) {
  let lastLabel = -1;
  return rows.map((row) => {
    const fraction = dayFraction(row.at);
    const showLabel = fraction - lastLabel >= MIN_LABEL_GAP;
    if (showLabel) lastLabel = fraction;
    return { row, point: pointOnArc(fraction), label: showLabel ? pointOnArc(fraction, LABEL_RADIUS) : null };
  });
}

export function SunArc({ rows, now, done, total }: { rows: ReminderRow[]; now: Date; done: number; total: number }) {
  const sun = pointOnArc(dayFraction(now));
  const start = pointOnArc(0);
  const end = pointOnArc(1);
  const sent = rows.filter((row) => row.sent).length;
  const dots = placeDots(rows);

  return (
    <svg
      className="sun-arc"
      viewBox="0 0 340 150"
      role="img"
      aria-label={`Day from 06:00 to midnight. It is ${clock(now)}. ${sent} reminders sent and ${rows.length - sent} still to come today.`}
    >
      <path
        d={`M${start.x} ${start.y}A${RADIUS} ${RADIUS} 0 0 1 ${sun.x} ${sun.y}`}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d={`M${sun.x} ${sun.y}A${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 8"
      />
      {dots.map(({ row, point }) =>
        row.sent ? (
          <circle key={`${row.reminder.id}-sent`} cx={point.x} cy={point.y} r="5.5" fill="var(--ink)" />
        ) : (
          <circle key={row.reminder.id} cx={point.x} cy={point.y} r="6" fill="var(--ember)" stroke="var(--ink)" strokeWidth="2" />
        ),
      )}
      <circle cx={sun.x} cy={sun.y} r="13" fill="var(--ink)" />
      <g fontSize="12" fontWeight="600" fill="var(--ink)" textAnchor="middle">
        {dots.map(({ row, label }) =>
          label ? (
            <text key={`${row.reminder.id}-${row.sent}`} x={label.x} y={label.y + 4}>
              {clock(row.at)}
            </text>
          ) : null,
        )}
        <text x={start.x} y="146">
          06:00
        </text>
        <text x={end.x} y="146">
          24:00
        </text>
      </g>
      <text
        x={CX}
        y="104"
        textAnchor="middle"
        fontSize="36"
        fontWeight="800"
        fill="var(--ink)"
        style={{ fontFamily: "var(--display)", letterSpacing: "-0.03em" }}
      >
        {done} of {total}
      </text>
      <text x={CX} y="124" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        done today
      </text>
    </svg>
  );
}
