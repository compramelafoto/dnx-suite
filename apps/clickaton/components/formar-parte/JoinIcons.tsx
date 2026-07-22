import type { FormarParteIconId } from "@/content/formar-parte";

type JoinIconProps = {
  name: FormarParteIconId;
  className?: string;
};

/** Iconos SVG livianos (sin dependencia externa) para las tarjetas de valor. */
export function JoinIcon({ name, className = "size-6" }: JoinIconProps) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3v4" />
          <path d="M12 17v4" />
          <path d="M3 12h4" />
          <path d="M17 12h4" />
          <path d="m5.6 5.6 2.8 2.8" />
          <path d="m15.6 15.6 2.8 2.8" />
          <path d="m18.4 5.6-2.8 2.8" />
          <path d="m8.4 15.6-2.8 2.8" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M9 3 3 5.5v15L9 18l6 2.5L21 18V3l-6 2.5L9 3Z" />
          <path d="M9 3v15" />
          <path d="M15 5.5v15" />
        </svg>
      );
    case "signal":
      return (
        <svg {...common}>
          <path d="M2 12a10 10 0 0 1 10-10" />
          <path d="M2 12a10 10 0 0 0 10 10" />
          <path d="M6 12a6 6 0 0 1 6-6" />
          <path d="M6 12a6 6 0 0 0 6 6" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M19.5 12.6 12 20l-7.5-7.4a4.5 4.5 0 0 1 6.4-6.3L12 7l1.1-.7a4.5 4.5 0 0 1 6.4 6.3Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function ImagePlaceholderIcon({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18" />
    </svg>
  );
}
