import type { ReactNode } from "react";

type Props = {
  hasPhotos: boolean;
  hasVideos: boolean;
  className?: string;
  size?: "sm" | "md";
};

function BadgeShell({
  children,
  label,
  size,
}: {
  children: ReactNode;
  label: string;
  size: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm ring-1 ring-white/25 shadow-sm`}
      title={label}
      aria-label={label}
    >
      <span className={icon}>{children}</span>
    </span>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

/** Indicadores de fotos y/o videos en portadas y thumbnails de galería. */
export default function GalleryMediaTypeBadges({
  hasPhotos,
  hasVideos,
  className = "",
  size = "md",
}: Props) {
  if (!hasPhotos && !hasVideos) return null;

  return (
    <div
      className={`pointer-events-none absolute bottom-2 right-2 z-20 flex items-center gap-1.5 ${className}`}
      role="group"
      aria-label={[
        hasPhotos ? "Incluye fotos" : null,
        hasVideos ? "Incluye videos" : null,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      {hasPhotos ? (
        <BadgeShell label="Fotos" size={size}>
          <PhotoIcon />
        </BadgeShell>
      ) : null}
      {hasVideos ? (
        <BadgeShell label="Videos" size={size}>
          <VideoIcon />
        </BadgeShell>
      ) : null}
    </div>
  );
}

export function GalleryMediaTypeBadgeSingle({
  type,
  className = "",
  size = "sm",
}: {
  type: "photo" | "video";
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={`pointer-events-none absolute bottom-2 right-2 z-20 ${className}`}>
      <BadgeShell label={type === "photo" ? "Foto" : "Video"} size={size}>
        {type === "photo" ? <PhotoIcon /> : <VideoIcon />}
      </BadgeShell>
    </div>
  );
}
