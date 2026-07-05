"use client";

type AlbumSaleProductCardProps = {
  id?: string;
  active: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export default function AlbumSaleProductCard({
  id,
  active,
  disabled,
  onToggle,
  title,
  description,
  children,
}: AlbumSaleProductCardProps) {
  return (
    <section
      id={id}
      className={`w-full min-w-0 scroll-mt-24 rounded-xl border-2 transition-colors ${
        active
          ? "border-[#c27b3d] bg-[#fffbf7] shadow-[0_4px_20px_-8px_rgba(194,123,61,0.35)]"
          : "border-[#e5e7eb] bg-white"
      }`}
    >
      <label
        className={`flex w-full min-w-0 cursor-pointer items-start gap-3 px-4 py-4 sm:px-5 sm:py-5 ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-[#c27b3d]"
          checked={active}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#1a1a1a]">{title}</span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                active ? "bg-[#c27b3d]/15 text-[#9a5f2e]" : "bg-[#f3f4f6] text-[#6b7280]"
              }`}
            >
              {active ? "Activo" : "Inactivo"}
            </span>
          </span>
          <span className="ds-readable-text ds-readable-text--fluid block text-sm text-[#6b7280]">
            {description}
          </span>
        </span>
      </label>

      {active && children ? (
        <div className="border-t border-[#e5e7eb]/80 px-4 pb-5 pt-4 sm:px-5">{children}</div>
      ) : null}
    </section>
  );
}
