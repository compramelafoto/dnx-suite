"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { ChevronRight, Images, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExplorerFolderRow, FolderViewKey } from "@/lib/albums/album-folder-view-model";
import { UNORGANIZED_FOLDER_LABEL } from "@/lib/albums/album-folder-view-model";

function cmpFolder(a: ExplorerFolderRow, b: ExplorerFolderRow): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

/** Ícono de carpeta al estilo de un sistema operativo (pestaña + frente). */
export function FolderGlyph({ className, open }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 64 52" className={className} aria-hidden>
      <path d="M4 8a4 4 0 0 1 4-4h15.5a4 4 0 0 1 3 1.35L30 9h26a4 4 0 0 1 4 4v3H4z" fill="#3d8ee0" />
      <rect x="4" y="12" width="56" height="36" rx="4" fill="#5aa6ef" />
      <path
        d={
          open
            ? "M2 22a4 4 0 0 1 4-4h52a4 4 0 0 1 4 4.4l-2.4 21.8A4 4 0 0 1 55.6 48H8.4a4 4 0 0 1-4-3.8z"
            : "M4 18a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"
        }
        fill="#7cbcf6"
      />
      {open ? null : <path d="M4 18a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v1H4z" fill="#a3d1fb" opacity={0.55} />}
    </svg>
  );
}

export type AlbumFolderBreadcrumbProps = {
  crumbs: Array<{ key: FolderViewKey; label: string }>;
  onNavigate: (key: FolderViewKey) => void;
  disabled?: boolean;
};

/** Ruta compacta (Álbum › Carpeta › Subcarpeta), como la barra de ruta de un explorador. */
export function AlbumFolderBreadcrumb({ crumbs, onNavigate, disabled }: AlbumFolderBreadcrumbProps) {
  return (
    <nav aria-label="Ubicación en el álbum" className="min-w-0">
      <ol className="flex items-center gap-0.5 text-[13px] text-[#4b5563] m-0 p-0 list-none min-w-0">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={String(crumb.key)} className="flex items-center gap-0.5 min-w-0">
              {idx > 0 ? (
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#9ca3af]" aria-hidden />
              ) : null}
              {isLast ? (
                <span className="font-semibold text-[#111827] truncate px-1" title={crumb.label} aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="truncate max-w-[10rem] rounded px-1.5 py-0.5 hover:bg-black/[0.06] hover:text-[#111827] disabled:opacity-50"
                  disabled={disabled}
                  title={crumb.label}
                  onClick={() => onNavigate(crumb.key)}
                >
                  {crumb.label}
                </button>
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
  /** Total de fotos del álbum (se muestra junto a «Todas las fotos»). */
  allCount?: number;
  canManage: boolean;
  disabled?: boolean;
  onSelect: (key: FolderViewKey) => void;
  onToggleExpand: (folderId: number) => void;
  onFolderContextMenu?: (folderId: number, e: ReactMouseEvent) => void;
};

const rowBase =
  "w-full flex items-center gap-1.5 h-8 rounded-md pr-2 text-left text-[13px] leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d8ee0]/60";

function rowState(selected: boolean) {
  return selected
    ? "bg-black/[0.08] text-[#111827] font-semibold"
    : "text-[#374151] hover:bg-black/[0.04]";
}

function Count({ value }: { value: number }) {
  return (
    <span className="ml-auto pl-2 shrink-0 text-[11px] font-normal tabular-nums text-[#9ca3af]">
      {value.toLocaleString("es-AR")}
    </span>
  );
}

export function AlbumFolderTreePanel({
  folders,
  selection,
  expanded,
  uncategorizedCount,
  allCount,
  canManage,
  disabled,
  onSelect,
  onToggleExpand,
  onFolderContextMenu,
}: AlbumFolderTreePanelProps) {
  function renderNodes(parentId: number | null, depth: number) {
    const nodes = folders.filter((f) => f.parentId === parentId).sort(cmpFolder);
    return nodes.map((folder) => {
      const hasKids = folders.some((f) => f.parentId === folder.id);
      const isOpen = expanded.has(folder.id);
      const selected = selection === folder.id;
      return (
        <li
          key={folder.id}
          className="min-w-0"
          role="treeitem"
          aria-selected={selected}
          aria-expanded={hasKids ? isOpen : undefined}
        >
          <div
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            className={cn(rowBase, rowState(selected), disabled ? "opacity-60 cursor-not-allowed" : "cursor-default")}
            style={{ paddingLeft: 4 + depth * 14 }}
            title={folder.name}
            onClick={() => !disabled && onSelect(folder.id)}
            onDoubleClick={() => !disabled && hasKids && onToggleExpand(folder.id)}
            onContextMenu={
              onFolderContextMenu && !disabled
                ? (e) => {
                    e.preventDefault();
                    onFolderContextMenu(folder.id, e);
                  }
                : undefined
            }
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(folder.id);
              } else if (hasKids && ((e.key === "ArrowRight" && !isOpen) || (e.key === "ArrowLeft" && isOpen))) {
                e.preventDefault();
                onToggleExpand(folder.id);
              }
            }}
          >
            {hasKids ? (
              <button
                type="button"
                tabIndex={-1}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-[#6b7280] hover:text-[#111827]"
                aria-label={isOpen ? "Contraer carpeta" : "Expandir carpeta"}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(folder.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <ChevronRight
                  className={cn("w-3 h-3 transition-transform", isOpen && "rotate-90")}
                  strokeWidth={2.5}
                  aria-hidden
                />
              </button>
            ) : (
              <span className="w-4 shrink-0" aria-hidden />
            )}
            <FolderGlyph className="w-[18px] h-[15px] shrink-0" open={selected} />
            <span className="min-w-0 truncate">{folder.name}</span>
            <Count value={folder.photoCount} />
          </div>
          {hasKids && isOpen ? (
            <ul role="group" className="m-0 p-0 list-none flex flex-col gap-px">
              {renderNodes(folder.id, depth + 1)}
            </ul>
          ) : null}
        </li>
      );
    });
  }

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full select-none">
      <div className="min-w-0">
        <p className="px-2 pb-1 m-0 text-[11px] font-semibold text-[#9ca3af]">Álbum</p>
        <div className="flex flex-col gap-px">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect("all")}
            className={cn(rowBase, rowState(selection === "all"), "pl-2 disabled:opacity-60")}
          >
            <Images className="w-4 h-4 shrink-0 text-[#3d8ee0]" aria-hidden />
            <span className="truncate">Todas las fotos</span>
            {typeof allCount === "number" ? <Count value={allCount} /> : null}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect("none")}
            className={cn(rowBase, rowState(selection === "none"), "pl-2 disabled:opacity-60")}
          >
            <Inbox className="w-4 h-4 shrink-0 text-[#3d8ee0]" aria-hidden />
            <span className="truncate">{UNORGANIZED_FOLDER_LABEL}</span>
            <Count value={uncategorizedCount} />
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <p className="px-2 pb-1 m-0 text-[11px] font-semibold text-[#9ca3af]">
          {canManage ? "Carpetas" : "Carpetas del evento"}
        </p>
        {folders.length > 0 ? (
          <ul role="tree" aria-label="Carpetas" className="m-0 p-0 list-none flex flex-col gap-px">
            {renderNodes(null, 0)}
          </ul>
        ) : (
          <p className="px-2 m-0 text-xs text-[#9ca3af]">Sin carpetas todavía</p>
        )}
      </div>
    </div>
  );
}
