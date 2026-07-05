"use client";

import type { VisualCatalogCategoryId } from "@/lib/catalog-templates/visual-categories";
import { getVisualCategory } from "@/lib/catalog-templates/visual-categories";

type CatalogTemplateCategoryChipProps = {
  categoryId: VisualCatalogCategoryId | "all";
  label?: string;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
};

export default function CatalogTemplateCategoryChip({
  categoryId,
  label,
  count,
  selected = false,
  onClick,
  size = "md",
}: CatalogTemplateCategoryChipProps) {
  const isAll = categoryId === "all";
  const cat = isAll ? null : getVisualCategory(categoryId);
  const displayLabel = label ?? (isAll ? "Todos" : cat!.label);

  const sizeClass =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  const base =
    "inline-flex items-center gap-1.5 rounded-full font-medium border transition-colors min-w-0";

  const selectedClass = selected
    ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
    : isAll
      ? "bg-white text-[#374151] border-[#e5e7eb] hover:border-[#d1d5db] hover:bg-[#f9fafb]"
      : `${cat!.chipClass} hover:opacity-90`;

  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`${base} ${sizeClass} ${selectedClass}`}
      aria-pressed={onClick ? selected : undefined}
    >
      <span className="truncate">{displayLabel}</span>
      {typeof count === "number" ? (
        <span
          className={`tabular-nums ${selected ? "text-white/80" : "text-[#9ca3af]"}`}
        >
          {count}
        </span>
      ) : null}
    </Tag>
  );
}
