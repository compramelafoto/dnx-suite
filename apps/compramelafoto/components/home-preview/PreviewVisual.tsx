import { cn } from "@/lib/utils";

/**
 * Ilustraciones SVG minimalistas para /home-preview.
 * TODO: reemplazar cada variant por assets de marca (WebP/AVIF en /public/home-preview/).
 */
export type PreviewVisualVariant =
  | "hero"
  | "photographers"
  | "organizers"
  | "schools"
  | "labs"
  | "community"
  | "events"
  | "albums";

type PreviewVisualProps = {
  variant: PreviewVisualVariant;
  className?: string;
  /** Contenedor con aspect ratio fijo (evita CLS) */
  aspect?: "video" | "square" | "portrait";
};

function Illustration({ variant }: { variant: PreviewVisualVariant }) {
  const stroke = "#9ca3af";
  const accent = "#c27b3d";
  const fill = "#f3f4f6";
  const fillAccent = "rgba(194,123,61,0.12)";

  switch (variant) {
    case "hero":
      return (
        <svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="480" height="360" rx="24" fill={fill} />
          <rect x="48" y="40" width="384" height="220" rx="16" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" />
          <rect x="64" y="56" width="120" height="80" rx="8" fill={fillAccent} />
          <rect x="196" y="56" width="120" height="80" rx="8" fill={fillAccent} />
          <rect x="328" y="56" width="88" height="80" rx="8" fill={fillAccent} />
          <rect x="64" y="148" width="168" height="96" rx="8" fill={fillAccent} />
          <rect x="248" y="148" width="168" height="96" rx="8" fill={fillAccent} />
          <circle cx="400" cy="300" r="28" fill={accent} fillOpacity="0.2" />
          <path d="M48 280h384" stroke="#e5e7eb" strokeWidth="1.5" />
          <rect x="64" y="292" width="96" height="12" rx="6" fill={accent} fillOpacity="0.35" />
          <rect x="176" y="292" width="64" height="12" rx="6" fill="#e5e7eb" />
        </svg>
      );
    case "photographers":
      return (
        <svg viewBox="0 0 320 200" fill="none" className="w-full h-full">
          <rect width="320" height="200" rx="16" fill={fill} />
          <rect x="40" y="36" width="88" height="64" rx="10" fill="#fff" stroke={stroke} strokeWidth="1.2" />
          <circle cx="84" cy="60" r="14" stroke={accent} strokeWidth="2" fill={fillAccent} />
          <rect x="148" y="48" width="132" height="10" rx="5" fill="#e5e7eb" />
          <rect x="148" y="68" width="96" height="8" rx="4" fill="#e5e7eb" />
          <rect x="40" y="120" width="240" height="48" rx="10" fill="#fff" stroke="#e5e7eb" strokeWidth="1.2" />
          <rect x="56" y="136" width="48" height="16" rx="4" fill={accent} fillOpacity="0.3" />
        </svg>
      );
    case "organizers":
      return (
        <svg viewBox="0 0 320 200" fill="none" className="w-full h-full">
          <rect width="320" height="200" rx="16" fill={fill} />
          <rect x="48" y="32" width="224" height="120" rx="12" fill="#fff" stroke="#e5e7eb" strokeWidth="1.2" />
          <path d="M80 88h160M80 108h120" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
          <rect x="200" y="140" width="72" height="72" rx="8" fill="#fff" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="212" y="152" width="48" height="48" rx="4" fill={fillAccent} />
        </svg>
      );
    case "schools":
      return (
        <svg viewBox="0 0 320 200" fill="none" className="w-full h-full">
          <rect width="320" height="200" rx="16" fill={fill} />
          <path d="M160 28L56 72v88h208V72L160 28z" fill="#fff" stroke="#e5e7eb" strokeWidth="1.2" />
          <rect x="96" y="96" width="128" height="56" rx="8" fill={fillAccent} />
          <circle cx="128" cy="120" r="12" fill={accent} fillOpacity="0.25" />
          <circle cx="160" cy="120" r="12" fill={accent} fillOpacity="0.25" />
          <circle cx="192" cy="120" r="12" fill={accent} fillOpacity="0.25" />
        </svg>
      );
    case "labs":
      return (
        <svg viewBox="0 0 320 200" fill="none" className="w-full h-full">
          <rect width="320" height="200" rx="16" fill={fill} />
          <rect x="56" y="48" width="96" height="112" rx="8" fill="#fff" stroke="#e5e7eb" strokeWidth="1.2" />
          <rect x="168" y="64" width="96" height="80" rx="8" fill={fillAccent} />
          <rect x="72" y="72" width="64" height="48" rx="4" fill={fillAccent} />
          <path d="M184 104h64" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    case "community":
      return (
        <svg viewBox="0 0 320 200" fill="none" className="w-full h-full">
          <rect width="320" height="200" rx="16" fill={fill} />
          <circle cx="100" cy="88" r="28" fill="#fff" stroke={stroke} strokeWidth="1.2" />
          <circle cx="160" cy="72" r="32" fill="#fff" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" />
          <circle cx="220" cy="88" r="28" fill="#fff" stroke={stroke} strokeWidth="1.2" />
          <path d="M72 140c16-24 48-24 64 0M184 140c16-24 48-24 64 0" stroke="#e5e7eb" strokeWidth="1.5" />
        </svg>
      );
    case "events":
      return (
        <svg viewBox="0 0 320 200" fill="none" className="w-full h-full">
          <rect width="320" height="200" rx="16" fill={fill} />
          <ellipse cx="160" cy="140" rx="100" ry="24" fill={fillAccent} />
          <path d="M80 120c20-40 40-56 80-56s60 16 80 56" stroke={accent} strokeWidth="2" strokeOpacity="0.4" fill="none" />
          <circle cx="120" cy="96" r="8" fill={accent} fillOpacity="0.35" />
          <circle cx="200" cy="88" r="8" fill={accent} fillOpacity="0.35" />
        </svg>
      );
    case "albums":
      return (
        <svg viewBox="0 0 320 200" fill="none" className="w-full h-full">
          <rect width="320" height="200" rx="16" fill={fill} />
          <rect x="48" y="40" width="72" height="72" rx="8" fill={fillAccent} />
          <rect x="128" y="40" width="72" height="72" rx="8" fill={fillAccent} />
          <rect x="208" y="40" width="72" height="72" rx="8" fill={fillAccent} />
          <rect x="80" y="128" width="160" height="12" rx="6" fill="#e5e7eb" />
        </svg>
      );
    default:
      return null;
  }
}

const aspectClass = {
  video: "aspect-[16/10]",
  square: "aspect-square",
  portrait: "aspect-[4/5]",
} as const;

export default function PreviewVisual({ variant, className, aspect = "video" }: PreviewVisualProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-[#e5e7eb]/80 bg-[#fafafa] min-w-0",
        aspectClass[aspect],
        className
      )}
      aria-hidden
    >
      <Illustration variant={variant} />
    </div>
  );
}
