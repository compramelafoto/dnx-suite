import Link from "next/link";
import { Layers } from "lucide-react";
import type { PublicGalleryFolderFilter } from "@/lib/events/event-public-gallery-folder-filter";

type FolderChip = { id: number; name: string; slug: string | null };

function hrefForFilter(
  basePath: string,
  preservedQs: string,
  mode: "all" | "uncategorized" | { folderId: number },
): string {
  const p = new URLSearchParams(preservedQs);
  if (mode === "all") {
    p.delete("folderId");
    p.delete("folder");
  } else if (mode === "uncategorized") {
    p.set("folderId", "none");
    p.delete("folder");
  } else {
    p.set("folderId", String(mode.folderId));
    p.delete("folder");
  }
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function chipClass(active: boolean): string {
  const base =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold tracking-tight transition-[box-shadow,transform,background-color,border-color,color] duration-200 whitespace-nowrap scroll-mt-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d] focus-visible:ring-offset-2 active:scale-[0.98] shadow-sm";
  if (active) {
    return `${base} border-[#c27b3d] bg-[#c27b3d] text-white shadow-[0_2px_12px_-2px_rgba(194,123,61,0.45)]`;
  }
  return `${base} border-[#e8e6e3] bg-white text-[#374151] hover:border-[#c27b3d]/45 hover:bg-[#fefbf8] hover:shadow-[0_2px_10px_-4px_rgba(0,0,0,0.12)]`;
}

export default function EventGalleryFolderChips({
  basePath,
  folders,
  showUncategorizedChip,
  preservedSearchString,
  activeFilter,
}: {
  basePath: string;
  folders: FolderChip[];
  showUncategorizedChip: boolean;
  /** Sin `?`; solo params que deben persistir al cambiar carpeta */
  preservedSearchString: string;
  activeFilter: PublicGalleryFolderFilter;
}) {
  const allActive = activeFilter.kind === "all";
  const noneActive = activeFilter.kind === "uncategorized";

  return (
    <div className="ds-fill-width mb-6 max-w-6xl mx-auto min-w-0 px-2 sm:px-0 ds-content-container">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-[#9a5828]" strokeWidth={2} aria-hidden />
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#4b5563] m-0 font-medium">
          Filtrá por carpeta · orden visual en la galería
        </p>
      </div>
      <div
        className="ds-overflow-x-soft flex gap-2 sm:gap-2.5 pb-2 pt-0.5 -mx-2 px-2 sm:mx-0 sm:px-0 touch-pan-x snap-x snap-mandatory [scrollbar-width:thin]"
        role="toolbar"
        aria-label="Filtrar por carpeta"
      >
        <Link
          href={hrefForFilter(basePath, preservedSearchString, "all")}
          className={`${chipClass(allActive)} snap-start`}
        >
          Todas
        </Link>
        {showUncategorizedChip ? (
          <Link
            href={hrefForFilter(basePath, preservedSearchString, "uncategorized")}
            className={`${chipClass(noneActive)} snap-start`}
          >
            Sin carpeta
          </Link>
        ) : null}
        {folders.map((folder) => {
          const folderActive = activeFilter.kind === "folder" && activeFilter.id === folder.id;
          return (
            <Link
              key={folder.id}
              href={hrefForFilter(basePath, preservedSearchString, { folderId: folder.id })}
              className={`${chipClass(folderActive)} snap-start max-w-[min(100%,18rem)]`}
              title={folder.slug ? `slug: ${folder.slug}` : undefined}
            >
              <span className="truncate">{folder.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
