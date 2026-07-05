type CatalogTemplatesGridSkeletonProps = {
  count?: number;
};

export default function CatalogTemplatesGridSkeleton({
  count = 6,
}: CatalogTemplatesGridSkeletonProps) {
  return (
    <div className="ds-catalog-card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ds-catalog-card animate-pulse overflow-hidden">
          <div className="aspect-square ds-catalog-cover-frame bg-[#e5e7eb]" />
          <div className="ds-catalog-card__body space-y-3">
            <div className="h-4 w-16 rounded-full bg-[#e5e7eb]" />
            <div className="h-4 w-3/4 rounded bg-[#e5e7eb]" />
            <div className="h-3 w-full rounded bg-[#f3f4f6]" />
            <div className="h-9 w-full rounded-lg bg-[#e5e7eb]" />
          </div>
        </div>
      ))}
    </div>
  );
}
