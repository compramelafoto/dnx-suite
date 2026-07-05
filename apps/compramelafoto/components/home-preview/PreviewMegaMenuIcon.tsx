import type { MegaMenuIcon } from "@/components/home-preview/preview-mega-menu";

const STROKE = "currentColor";

export default function PreviewMegaMenuIcon({ name }: { name: MegaMenuIcon }) {
  const props = {
    className: "w-5 h-5 text-[#c27b3d]",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: STROKE,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "sport":
      return (
        <svg {...props}>
          <path d="M6 12h12M12 6v12" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "school":
      return (
        <svg {...props}>
          <path d="M4 10 12 5l8 5-8 5-8-5z" />
          <path d="M6 12v6h12v-6" />
        </svg>
      );
    case "party":
      return (
        <svg {...props}>
          <path d="M12 3v3M5 8l2 2M19 8l-2 2M5 16l2-2M19 16l-2-2" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case "camera":
      return (
        <svg {...props}>
          <path d="M4 8h4l2-2h4l2 2h4v10H4V8z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
          <path d="M16 11h5M18.5 8.5v5" />
        </svg>
      );
    case "folder":
      return (
        <svg {...props}>
          <path d="M4 7h6l2 2h8v9H4V7z" />
        </svg>
      );
    case "gift":
      return (
        <svg {...props}>
          <rect x="4" y="10" width="16" height="10" rx="1" />
          <path d="M12 10V20M4 10h16M12 6c-1-2-3-2-3 0s2 2 3 0 3 2 3 0-2-2-3 0z" />
        </svg>
      );
    case "print":
      return (
        <svg {...props}>
          <path d="M7 8V4h10v4M7 16v4h10v-4M5 8h14v8H5V8z" />
        </svg>
      );
    case "building":
      return (
        <svg {...props}>
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h6" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...props}>
          <path d="M4 8h16v8H4a2 2 0 0 0 0-4 2 2 0 0 0 0-4V8z" />
        </svg>
      );
    case "percent":
      return (
        <svg {...props}>
          <circle cx="7" cy="7" r="2" />
          <circle cx="17" cy="17" r="2" />
          <path d="M19 5 5 19" />
        </svg>
      );
    case "qr":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="6" height="6" />
          <rect x="14" y="4" width="6" height="6" />
          <rect x="4" y="14" width="6" height="6" />
          <path d="M14 14h2v2h-2zM18 14v6M14 18h6" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7l-8-4z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...props}>
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
        </svg>
      );
    case "handshake":
      return (
        <svg {...props}>
          <path d="M4 12l4 4M20 12l-4 4M8 16l2-6 2 2 4-4 2 8" />
        </svg>
      );
    case "map":
      return (
        <svg {...props}>
          <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
