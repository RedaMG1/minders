const LOCALE = "fr-FR";
const CURRENCY = "EUR";
const MAX_CENTS = 100_000_000_00;

const formatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });

/** Cents to text, for example 123456 → "1 234,56 €". */
export function formatMoney(cents: number) {
  return formatter.format(cents / 100);
}

/** Cents to the plain number shown in an amount box, for example 1250 → "12,50". */
export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Reads what was typed in an amount box, as cents. Accepts "12", "12,5", "12.50" and "1 234,56".
 * Returns null for anything that isn't a positive amount.
 */
export function parseAmount(text: string) {
  const cleaned = text.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}

/** A month as YYYY-MM, which also sorts correctly as text. */
export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, by: number) {
  const [year, index] = month.split("-").map(Number);
  return monthKey(new Date(year, index - 1 + by, 1));
}

/** For example "November 2026". */
export function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  const label = new Date(year, index - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return label;
}

export function isMonthKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}
