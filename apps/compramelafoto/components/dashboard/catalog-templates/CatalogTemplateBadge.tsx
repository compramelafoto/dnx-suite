import type { CatalogTemplateBadge } from "@/lib/catalog-templates/template-badges";

type CatalogTemplateBadgeProps = {
  badge: CatalogTemplateBadge;
  size?: "sm" | "md";
};

export default function CatalogTemplateBadgePill({
  badge,
  size = "sm",
}: CatalogTemplateBadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${sizeClass} ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
