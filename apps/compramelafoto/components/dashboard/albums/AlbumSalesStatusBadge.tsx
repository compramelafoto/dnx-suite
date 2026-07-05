import {
  ALBUM_SALES_STATUS_LABELS,
  evaluateAlbumSalesReadiness,
  type AlbumSalesReadinessInput,
  type AlbumSalesStatus,
} from "@/lib/albums/album-sales-readiness";

const STATUS_STYLES: Record<AlbumSalesStatus, string> = {
  pending: "bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]",
  incomplete: "bg-amber-50 text-amber-900 border-amber-200",
  active: "bg-emerald-50 text-emerald-900 border-emerald-200",
};

type AlbumSalesStatusBadgeProps = {
  album: AlbumSalesReadinessInput;
  className?: string;
};

export default function AlbumSalesStatusBadge({ album, className = "" }: AlbumSalesStatusBadgeProps) {
  const { status } = evaluateAlbumSalesReadiness(album);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]} ${className}`}
    >
      {ALBUM_SALES_STATUS_LABELS[status]}
    </span>
  );
}

export function albumSalesStatusFromInput(album: AlbumSalesReadinessInput): AlbumSalesStatus {
  return evaluateAlbumSalesReadiness(album).status;
}
