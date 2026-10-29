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

/**
 * Ícono de carpeta con la paleta de CompraMeLaFoto: cuerpo gris, pestaña cobre.
 * Abierta (carpeta en uso) el frente pasa a crema con borde cobre.
 */
export function FolderGlyph({ className, open }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 64 52" className={className} aria-hidden>
      <path d="M4 9a5 5 0 0 1 5-5h13.6a5 5 0 0 1 3.6 1.5L30 9.5h25a5 5 0 0 1 5 5V20H4z" fill="#c27b3d" />
      <rect x="4" y="11" width="56" height="37" rx="5" fill={open ? "#d9a77b" : "#a8a29e"} />
      <rect
        x="4"
        y="16"
        width="56"
        height="32"
        rx="5"
        fill={open ? "#f3e6dc" : "#e7e5e4"}
        stroke={open ? "#c27b3d" : "#a8a29e"}
        strokeWidth="1.5"
      />
      <rect x="12" y="38" width="16" height="3" rx="1.5" fill="#c27b3d" opacity={open ? 0.9 : 0.75} />
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
  "w-full flex items-center gap-1.5 h-8 rounded-md pr-2 text-left text-[13px] leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/50";

function rowState(selected: boolean) {
  return selected
    ? "bg-[#f3e6dc] text-[#111827] font-semibold"
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
            <Images className="w-4 h-4 shrink-0 text-[#c27b3d]" aria-hidden />
            <span className="truncate">Todas las fotos</span>
            {typeof allCount === "number" ? <Count value={allCount} /> : null}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect("none")}
            className={cn(rowBase, rowState(selection === "none"), "pl-2 disabled:opacity-60")}
          >
            <Inbox className="w-4 h-4 shrink-0 text-[#c27b3d]" aria-hidden />
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
