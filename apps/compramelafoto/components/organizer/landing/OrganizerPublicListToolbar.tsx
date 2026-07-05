"use client";

import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DsField } from "@/components/ui/DsField";
import type { FeaturedListSortKey } from "@/lib/organizer-landing-featured";
import { PUBLIC_FEATURED_SORT_OPTIONS } from "@/lib/organizer-public-landing-list";
import { cn } from "@/lib/utils";

type SortOption = { value: FeaturedListSortKey; label: string };

type Props = {
  className?: string;
  filter: string;
  sort: FeaturedListSortKey;
  onFilterChange: (value: string) => void;
  onSortChange: (value: FeaturedListSortKey) => void;
  resultCount: number;
  totalCount: number;
  filterId: string;
  sortId: string;
  filterLabel?: string;
  filterHint?: string;
  filterPlaceholder?: string;
  sortOptions?: SortOption[];
};

export default function OrganizerPublicListToolbar({
  className,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  resultCount,
  totalCount,
  filterId,
  sortId,
  filterLabel = "Buscar",
  filterHint,
  filterPlaceholder = "Nombre, ciudad, fotógrafo…",
  sortOptions = PUBLIC_FEATURED_SORT_OPTIONS,
}: Props) {
  const showCount = filter.trim().length > 0;

  return (
    <div
      className={cn(
        "org-public-list-toolbar ds-form-grid ds-fill-width grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_min(18rem,100%)] gap-3 w-full",
        className
      )}
    >
      <DsField label={filterLabel} hint={filterHint} htmlFor={filterId}>
        <Input
          id={filterId}
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder={filterPlaceholder}
        />
      </DsField>
      <DsField label="Ordenar por" htmlFor={sortId}>
        <Select
          id={sortId}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as FeaturedListSortKey)}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </DsField>
      {showCount ? (
        <p className="ds-readable-text ds-readable-text--fluid text-xs text-gray-500 m-0 lg:col-span-2">
          {resultCount} de {totalCount} {resultCount === 1 ? "resultado" : "resultados"}
        </p>
      ) : null}
    </div>
  );
}
