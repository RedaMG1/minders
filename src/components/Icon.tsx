import type { ReactNode } from "react";

const PATHS = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" />,
  note: <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7" />,
  bell: <path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  pin: <path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" />,
  repeat: <path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" />,
  list: <path d="M10 6h10M10 12h10M10 18h10M4 6l1 1 1.5-2M4 12l1 1 1.5-2M4 18l1 1 1.5-2" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  work: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V5h6v3M3 13h18" />
    </>
  ),
  car: (
    <>
      <path d="M4 17v-5l2-6h12l2 6v5zM4 12h16M6 17v2M18 17v2" />
      <circle cx="8" cy="14.5" r=".6" />
      <circle cx="16" cy="14.5" r=".6" />
    </>
  ),
  heart: <path d="M12 20S4 15 4 9a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" />,
  house: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-5 4-7 8-7s7 2 8 7" />
    </>
  ),
  book: <path d="M5 4h14v16H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.500 0 2.200-1 2.200-2 0-1.300-1-1.700-1-2.800 0-1 .8-1.700 2-1.700H17a4 4 0 0 0 4-4c0-4.200-4-7.500-9-7.500z" />
      <circle cx="7.500" cy="11" r="1" />
      <circle cx="11" cy="7.500" r="1" />
      <circle cx="16" cy="8.500" r="1" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  history: <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4.5h4.5M12 7.5V12l3 2" />,
  wallet: (
    <>
      <path d="M4 7.5V18a2 2 0 0 0 2 2h13V8H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h11v4" />
      <circle cx="15.5" cy="14" r="1" />
    </>
  ),
  forward: <path d="M9 5l7 7-7 7" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  shuffle: <path d="M4 7h3c2 0 3 1 4.5 3.5S14.5 17 16.5 17H20M4 17h3c1 0 1.800-.300 2.500-1M14 7.800c.700-.500 1.500-.800 2.500-.800H20M17 4l3 3-3 3M17 14l3 3-3 3" />,
  star: <path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.900-5.200-2.800-5.200 2.800 1-5.900-4.300-4.100 5.900-.8z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />,
  edit: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, small }: { name: IconName; small?: boolean }) {
  return (
    <svg className={small ? "i i-sm" : "i"} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** Module icons are saved as text, so this falls back if a saved name is unknown. */
export function ModuleIcon({ name }: { name: string }) {
  return <Icon name={name in PATHS ? (name as IconName) : "note"} />;
}
