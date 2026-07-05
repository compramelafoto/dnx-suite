"use client";

import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ExplorerFolderRow, FolderViewKey } from "@/lib/albums/album-folder-view-model";
import { UNORGANIZED_FOLDER_LABEL } from "@/lib/albums/album-folder-view-model";

function cmpFolder(a: ExplorerFolderRow, b: ExplorerFolderRow): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

export type AlbumFolderBreadcrumbProps = {
  crumbs: Array<{ key: FolderViewKey; label: string }>;
  onNavigate: (key: FolderViewKey) => void;
  disabled?: boolean;
};

export function AlbumFolderBreadcrumb({ crumbs, onNavigate, disabled }: AlbumFolderBreadcrumbProps) {
  return (
    <nav aria-label="Ubicación en el álbum" className="min-w-0 w-full">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-[#374151] m-0 p-0 list-none">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={String(crumb.key)} className="flex items-center gap-1 min-w-0">
              {idx > 0 ? (
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#9ca3af]" aria-hidden />
              ) : null}
              {isLast ? (
                <span className="font-medium text-[#1a1a1a] truncate max-w-full" title={crumb.label} aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 max-w-[14rem] truncate text-[#374151]"
                  disabled={disabled}
                  title={crumb.label}
                  onClick={() => onNavigate(crumb.key)}
                >
                  {crumb.label}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type AlbumFolderTreePanelProps = {
  folders: ExplorerFolderRow[];
  selection: FolderViewKey;
  expanded: ReadonlySet<number>;
  uncategorizedCount: number;
  canManage: boolean;
  disabled?: boolean;
  onSelect: (key: FolderViewKey) => void;
  onToggleExpand: (folderId: number) => void;
};

export function AlbumFolderTreePanel({
  folders,
  selection,
  expanded,
  uncategorizedCount,
  canManage,
  disabled,
  onSelect,
  onToggleExpand,
}: AlbumFolderTreePanelProps) {
  function renderNodes(parentId: number | null, depth: number) {
    const nodes = folders.filter((f) => f.parentId === parentId).sort(cmpFolder);
    return nodes.map((folder) => {
      const hasKids = folders.some((f) => f.parentId === folder.id);
      const isOpen = expanded.has(folder.id);
      const selected = selection === folder.id;
      return (
        <div key={folder.id} className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-stretch gap-1 min-w-0" style={{ paddingLeft: depth * 8 }}>
            {hasKids ? (
              <button
                type="button"
                className="shrink-0 w-9 min-h-[44px] flex items-center justify-center rounded-lg border border-[#111827]/10 bg-white text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d] disabled:opacity-50"
                aria-expanded={isOpen}
                disabled={disabled}
                onClick={() => onToggleExpand(folder.id)}
              >
                <ChevronRight
                  className={cn("w-4 h-4 transition-transform", isOpen && "rotate-90")}
                  aria-hidden
                />
              </button>
            ) : (
              <span className="w-9 shrink-0" aria-hidden />
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(folder.id)}
              className={cn(
                "min-w-0 flex-1 min-h-[44px] text-left rounded-xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d] flex items-center gap-2",
                selected
                  ? "border-[#c27b3d]/80 bg-[#fef7f3] shadow-sm"
                  : "border-[#111827]/10 bg-white hover:border-[#111827]/18 hover:bg-gray-50/90",
                disabled && "opacity-60 cursor-not-allowed"
              )}
            >
              {selected ? (
                <FolderOpen className="w-4 h-4 shrink-0 text-[#c27b3d]" aria-hidden />
              ) : (
                <Folder className="w-4 h-4 shrink-0 text-amber-700/85" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[#1a1a1a] truncate" title={folder.name}>
                  {folder.name}
                </span>
                <span className="block text-xs text-[#6b7280]">
                  {folder.photoCount} foto{folder.photoCount !== 1 ? "s" : ""}
                  {folder.childCount > 0
                    ? ` · ${folder.childCount} subcarpeta${folder.childCount !== 1 ? "s" : ""}`
                    : ""}
                </span>
              </span>
            </button>
          </div>
          {hasKids && isOpen ? renderNodes(folder.id, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <div className="flex flex-col gap-2 min-w-0 w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("all")}
        className={cn(
          "w-full min-h-[44px] text-left rounded-xl border px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]",
          selection === "all"
            ? "border-[#c27b3d]/80 bg-[#fef7f3]"
            : "border-[#111827]/10 bg-white hover:bg-gray-50/90"
        )}
      >
        <span className="text-sm font-medium text-[#1a1a1a]">Todas las fotos</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("none")}
        className={cn(
          "w-full min-h-[44px] text-left rounded-xl border px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]",
          selection === "none"
            ? "border-[#c27b3d]/80 bg-[#fef7f3]"
            : "border-[#111827]/10 bg-white hover:bg-gray-50/90"
        )}
      >
        <span className="text-sm font-medium text-[#1a1a1a]">{UNORGANIZED_FOLDER_LABEL}</span>
        <span className="block text-xs text-[#6b7280]">{uncategorizedCount} foto{uncategorizedCount !== 1 ? "s" : ""}</span>
      </button>
      {folders.length > 0 ? (
        <div className="pt-1 border-t border-[#e5e7eb] flex flex-col gap-1">
          <p className="text-xs font-medium text-[#6b7280] px-1 m-0">
            {canManage ? "Carpetas" : "Carpetas del evento"}
          </p>
          {renderNodes(null, 0)}
        </div>
      ) : null}
    </div>
  );
}
