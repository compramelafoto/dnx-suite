import type { AdminNavIcon as AdminNavIconName } from "@/config/admin/navigation";
import { cn } from "@/lib/cn";

type Props = {
  name: AdminNavIconName;
  className?: string;
};

/** Iconos SVG mínimos propios (sin lucide). */
export function AdminNavIcon({ name, className }: Props) {
  const common = cn("h-5 w-5 shrink-0", className);
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M4 4h7v7H4V4Zm9 0h7v5h-7V4ZM4 13h7v7H4v-7Zm9 3h7v4h-7v-4Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </svg>
      );
    case "editions":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M5 5h14v14H5V5Zm3 3h8M8 12h8M8 16h5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      );
    case "venues":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle cx="12" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );
    case "registrations":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M8 7V5h8v2M9 11h6M9 15h4M7 21h10a2 2 0 0 0 2-2V7H5v12a2 2 0 0 0 2 2Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      );
    case "sponsors":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M4 8h16v10H4V8Zm3-4h10v4H7V4Zm1 10h4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 3v2.2M12 18.8V21M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      );
    case "integrations":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M8 8h3v3H8V8Zm5 5h3v3h-3v-3ZM10 5v3M14 16v3M5 10h3M16 14h3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      );
    default:
      return null;
  }
}
