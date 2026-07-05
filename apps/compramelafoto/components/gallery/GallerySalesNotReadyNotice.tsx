import { GALLERY_SALES_NOT_READY_MESSAGE } from "@/lib/albums/album-sales-readiness";

type GallerySalesNotReadyNoticeProps = {
  className?: string;
};

export default function GallerySalesNotReadyNotice({ className = "" }: GallerySalesNotReadyNoticeProps) {
  return (
    <div
      className={`mb-6 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4 text-sm text-[#374151] leading-relaxed ${className}`}
      role="status"
    >
      <p className="m-0 font-medium text-[#1a1a1a]">Galería disponible</p>
      <p className="mt-1.5 m-0">{GALLERY_SALES_NOT_READY_MESSAGE}</p>
    </div>
  );
}
