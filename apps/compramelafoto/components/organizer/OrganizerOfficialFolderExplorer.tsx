"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  Copy,
  Folder,
  GripVertical,
  Scissors,
  Trash2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { cn } from "@/lib/utils";
import {
  childrenByParentMap,
  foldersByEventId,
  validateReparent,
  type FolderNode,
} from "@/lib/events/event-folder-domain";
import { EventFolderScope } from "@/lib/prisma";

export type OfficialFolderRow = {
  id: number;
  eventId: number;
  parentId: number | null;
  folderScope: "ORGANIZER" | "PHOTOGRAPHER";
  listedInPublicGallery: boolean;
  name: string;
  slug: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { photos: number; children: number };
};

type ClipboardState = { op: "copy" | "cut"; folderId: number } | null;

function cmp(a: OfficialFolderRow, b: OfficialFolderRow): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

function collectVisibleIds(section: OfficialFolderRow[], qRaw: string): Set<number> | null {
  const q = qRaw.trim().toLowerCase();
  if (!q) return null;
  const ids = section.map((f) => f.id);
  const byId = new Map(section.map((f) => [f.id, f] as const));
  const memo = new Map<number, boolean>();
  function subMatches(id: number): boolean {
    if (memo.has(id)) return memo.get(id)!;
    const f = byId.get(id);
    if (!f) {
      memo.set(id, false);
      return false;
    }
    const self = f.name.toLowerCase().includes(q) || (f.slug?.toLowerCase().includes(q) ?? false);
    let child = false;
    for (const n of ids) {
      const x = byId.get(n);
      if (x && x.parentId === id) child ||= subMatches(x.id);
    }
    const out = self || child;
    memo.set(id, out);
    return out;
  }
  let roots = section.filter((f) => f.parentId == null);
  if (roots.length === 0) roots = section.slice();
  for (const r of roots) subMatches(r.id);
  const matched = new Set<number>();
  function visit(id: number) {
    if (!memo.get(id)) return;
    matched.add(id);
    for (const n of ids) {
      const x = byId.get(n);
      if (x?.parentId === id) visit(n);
    }
  }
  for (const r of roots) visit(r.id);
  const out = new Set<number>();
  for (const fid of matched) {
    let cur: OfficialFolderRow | undefined = byId.get(fid);
    while (cur) {
      out.add(cur.id);
      if (cur.parentId == null) break;
      cur = byId.get(cur.parentId);
    }
  }
  return out;
}

function allNamesInEvent(rows: OfficialFolderRow[]): Set<string> {
  return new Set(rows.map((r) => r.name));
}

function nextUniqueName(existing: Set<string>, base = "Nueva carpeta"): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

function nextCopyName(existing: Set<string>, sourceName: string): string {
  const base = `Copia de ${sourceName}`;
  return nextUniqueName(existing, base);
}

/** Convierte filas locales a `FolderNode` para validar reparent igual que backend. */
function organizerRowsToFolderNodes(org: OfficialFolderRow[]): FolderNode[] {
  return org.map((f) => ({
    id: f.id,
    eventId: f.eventId,
    parentId: f.parentId,
    folderScope: EventFolderScope.ORGANIZER,
    ownerPhotographerId: null,
    name: f.name,
    slug: f.slug,
    sortOrder: f.sortOrder,
    isActive: f.isActive,
    listedInPublicGallery: f.listedInPublicGallery,
  }));
}

/** Orden DFS de carpetas oficiales visibles (búsqueda + expandidos). */
function visibleOfficialOrder(
  org: OfficialFolderRow[],
  expanded: ReadonlySet<number>,
  vis: Set<number> | null
): number[] {
  const out: number[] = [];
  function walk(parentKey: number | null): void {
    const kids = org
      .filter((f) => (f.parentId ?? null) === parentKey)
      .sort(cmp)
      .filter((f) => !vis || vis.has(f.id));
    for (const k of kids) {
      out.push(k.id);
      if (expanded.has(k.id)) walk(k.id);
    }
  }
  walk(null);
  return out;
}

function OrganizerSiblingDnD(props: {
  parentKey: number | null;
  depth: number;
  organizerScoped: OfficialFolderRow[];
  expanded: ReadonlySet<number>;
  toggle: (id: number) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  visible: Set<number> | null;
  disabled: boolean;
  onReorder: (anchor: OfficialFolderRow, orderedIds: number[]) => void | Promise<void>;
  renderNested: (parentId: number, depth: number) => ReactElement | null;
  editingId: number | null;
  draftName: string;
  onDraftChange: (v: string) => void;
  onCommitRename: (folderId: number) => void;
  onCancelRename: () => void;
  onRowDoubleClick: (folder: OfficialFolderRow) => void;
  onContextMenu: (e: React.MouseEvent, folder: OfficialFolderRow) => void;
}): ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const kids = props.organizerScoped
    .filter((f: OfficialFolderRow) => (f.parentId ?? null) === props.parentKey)
    .sort(cmp)
    .filter((f: OfficialFolderRow) => !props.visible || props.visible.has(f.id));

  if (kids.length === 0) return <></>;

  const ids = kids.map((k: OfficialFolderRow) => k.id);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = ids.indexOf(Number(active.id));
    const newI = ids.indexOf(Number(over.id));
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(ids, oldI, newI) as number[];
    const anchor = kids[0];
    if (anchor) void props.onReorder(anchor, next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="m-0 p-0 list-none space-y-0.5 min-w-0" role="list">
          {kids.map((f: OfficialFolderRow) => {
            const hasKids = props.organizerScoped.some((k: OfficialFolderRow) => k.parentId === f.id);
            const isOpen = props.expanded.has(f.id);
            return (
              <li key={f.id} className="min-w-0">
                <OrganizerSortableRow
                  folder={f}
                  hasKids={hasKids}
                  isOpen={isOpen}
                  selected={props.selectedId === f.id}
                  disabled={props.disabled}
                  isEditing={props.editingId === f.id}
                  draftName={props.draftName}
                  onDraftChange={props.onDraftChange}
                  onCommitRename={() => props.onCommitRename(f.id)}
                  onCancelRename={props.onCancelRename}
                  onToggle={() => props.toggle(f.id)}
                  onSelect={() => props.onSelect(f.id)}
                  onDoubleClick={() => props.onRowDoubleClick(f)}
                  onContextMenu={(e) => props.onContextMenu(e, f)}
                />
                {hasKids && isOpen ? (
                  <div className="mt-0.5 min-w-0 border-l-2 border-[#c27b3d]/25 pl-2 sm:pl-3 ml-3 sm:ml-4">
                    {props.renderNested(f.id, props.depth + 1)}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function OrganizerSortableRow(props: {
  folder: OfficialFolderRow;
  hasKids: boolean;
  isOpen: boolean;
  selected: boolean;
  disabled: boolean;
  isEditing: boolean;
  draftName: string;
  onDraftChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onToggle: () => void;
  onSelect: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.folder.id,
    disabled: props.disabled || props.isEditing,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const photos = typeof props.folder._count?.photos === "number" ? props.folder._count!.photos : null;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [props.isEditing]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="treeitem"
      aria-selected={props.selected}
      aria-expanded={props.hasKids ? props.isOpen : undefined}
      className={`group flex items-stretch gap-1 sm:gap-1.5 min-w-0 rounded-lg border bg-white px-1 py-1 transition-shadow ${
        props.selected
          ? "border-[#c27b3d]/80 bg-[#fef7f3] ring-1 ring-[#c27b3d]/25"
          : "border-[#111827]/10 hover:border-[#111827]/20 hover:bg-gray-50/90"
      } ${isDragging ? "opacity-75 shadow-md z-10 relative" : ""}`}
      onContextMenu={props.onContextMenu}
    >
      <button
        type="button"
        className="shrink-0 w-7 sm:w-8 flex items-center justify-center rounded-md text-[#64748b] hover:bg-amber-50/80 cursor-grab active:cursor-grabbing touch-none disabled:opacity-40"
        aria-label="Arrastrar para reordenar"
        disabled={props.disabled || props.isEditing}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2} aria-hidden />
      </button>

      {props.hasKids ? (
        <button
          type="button"
          className="shrink-0 w-7 sm:w-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-[#111827]"
          aria-expanded={props.isOpen}
          disabled={props.disabled}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle();
          }}
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${props.isOpen ? "rotate-90" : ""}`} aria-hidden />
        </button>
      ) : (
        <span className="w-7 sm:w-8 shrink-0" aria-hidden />
      )}

      <div className="min-w-0 flex-1 flex items-center gap-2 py-0.5">
        <Folder
          className={`w-[1rem] sm:w-[1.15rem] shrink-0 ${props.folder.isActive ? "text-amber-700/90" : "text-gray-400"}`}
          strokeWidth={1.75}
          aria-hidden
        />
        {props.isEditing ? (
          <input
            ref={inputRef}
            value={props.draftName}
            onChange={(e) => props.onDraftChange(e.target.value)}
            onBlur={() => props.onCommitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                props.onCommitRename();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                props.onCancelRename();
              }
            }}
            disabled={props.disabled}
            aria-label="Nombre de carpeta"
            className={cn(
              "block w-full max-w-full min-w-0 flex-1 rounded-2xl border border-[#111827]/10 bg-white px-3 py-2",
              "text-sm text-[#111827] placeholder:text-[#6b7280]",
              "h-9 focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
            )}
          />
        ) : (
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => props.onSelect()}
            onDoubleClick={(e) => {
              e.preventDefault();
              props.onDoubleClick();
            }}
            className="min-w-0 flex-1 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40"
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
              <span className="ds-readable-text ds-readable-text--fluid text-sm font-semibold text-[#111827] truncate">
                {props.folder.name}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 rounded-full bg-[#c27b3d]/12 text-[#9a5828] px-1.5 py-px">
                Oficial
              </span>
              {!props.folder.isActive ? (
                <span className="text-[10px] font-bold uppercase shrink-0 rounded-full bg-gray-100 text-gray-600 px-1.5 py-px">
                  Inactiva
                </span>
              ) : null}
              {!props.folder.listedInPublicGallery ? (
                <span className="text-[10px] font-semibold shrink-0 rounded-full bg-slate-100 text-slate-700 px-1.5 py-px">
                  Oculta en galería
                </span>
              ) : null}
            </span>
            <span className="ds-readable-text ds-readable-text--fluid block text-[11px] text-[#64748b] mt-0.5 m-0">
              {photos !== null ? `${photos} foto${photos === 1 ? "" : "s"}` : "Sin fotos"}
              {props.folder.slug ? (
                <>
                  {" "}
                  · <span className="font-mono">{props.folder.slug}</span>
                </>
              ) : null}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export type OrganizerOfficialFolderExplorerProps = {
  eventId: number;
  folders: OfficialFolderRow[];
  onFoldersRefresh: () => Promise<void>;
  loading: boolean;
  selectedId: number | null;
  onSelectedIdChange: (id: number | null) => void;
  expanded: Set<number>;
  onExpandedChange: React.Dispatch<React.SetStateAction<Set<number>>>;
  /** Búsqueda compartida con otras vistas (opcional si no se pasa se usa estado interno). */
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
};

export default function OrganizerOfficialFolderExplorer({
  eventId,
  folders,
  onFoldersRefresh,
  loading,
  selectedId,
  onSelectedIdChange,
  expanded,
  onExpandedChange,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
}: OrganizerOfficialFolderExplorerProps) {
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [internalSearch, setInternalSearch] = useState("");
  const search =
    typeof searchQueryProp === "string" ? searchQueryProp : internalSearch;
  const setSearch = onSearchQueryChange ?? setInternalSearch;
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; folder: OfficialFolderRow } | null>(null);

  const ctxMenuStyle = useMemo((): CSSProperties | null => {
    if (!ctx) return null;
    const MENU_W = 224;
    const MENU_H = 280;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      left: Math.max(8, Math.min(ctx.x, vw - MENU_W - 8)),
      top: Math.max(8, Math.min(ctx.y, vh - MENU_H - 8)),
      maxWidth: "min(100vw - 16px, 14rem)",
    };
  }, [ctx]);

  const organizerScoped = useMemo(
    () => folders.filter((f) => f.folderScope === "ORGANIZER"),
    [folders]
  );
  const visOrg = useMemo(() => collectVisibleIds(organizerScoped, search), [organizerScoped, search]);

  const selectedOfficial = useMemo(
    () =>
      selectedId != null
        ? organizerScoped.find((f) => f.id === selectedId) ?? null
        : null,
    [organizerScoped, selectedId]
  );

  const byIdAll = useMemo(() => new Map(folders.map((f) => [f.id, f] as const)), [folders]);

  /** Nombres únicos en todo el evento (coincide con validación de API). */
  const nameSet = useMemo(() => allNamesInEvent(folders), [folders]);

  const toggleExpanded = useCallback(
    (id: number) => {
      onExpandedChange((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    },
    [onExpandedChange]
  );

  const flatOrder = useMemo(
    () => visibleOfficialOrder(organizerScoped, expanded, visOrg),
    [organizerScoped, expanded, visOrg]
  );

  useEffect(() => {
    function closeCtx() {
      setCtx(null);
    }
    window.addEventListener("click", closeCtx);
    return () => window.removeEventListener("click", closeCtx);
  }, []);

  const disabled = busy || loading;

  function startRename(f: OfficialFolderRow) {
    if (disabled) return;
    setEditingId(f.id);
    setDraftName(f.name);
    onSelectedIdChange(f.id);
  }

  function cancelRename() {
    setEditingId(null);
    setDraftName("");
  }

  async function commitRename(folderId: number) {
    const f = organizerScoped.find((x) => x.id === folderId);
    if (!f) {
      cancelRename();
      return;
    }
    const next = draftName.trim();
    if (next === "" || next === f.name) {
      cancelRename();
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/folders/${folderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data?.error || "No se pudo renombrar." });
        setBusy(false);
        return;
      }
      cancelRename();
      await onFoldersRefresh();
      setBanner({ kind: "ok", text: "Nombre actualizado." });
      setTimeout(() => setBanner(null), 2500);
    } catch {
      setBanner({ kind: "err", text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }

  async function reorderSiblings(of: OfficialFolderRow, orderedIds: number[]) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/folders/reorder`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: of.parentId ?? null, orderedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data?.error || "No se reordenaron." });
        setBusy(false);
        return;
      }
      await onFoldersRefresh();
    } catch {
      setBanner({ kind: "err", text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }

  async function patchFolder(
    folderId: number,
    body: Record<string, unknown>,
    okMsg?: string
  ) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/folders/${folderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data?.error || "No se pudo actualizar." });
        setBusy(false);
        return;
      }
      await onFoldersRefresh();
      if (okMsg) {
        setBanner({ kind: "ok", text: okMsg });
        setTimeout(() => setBanner(null), 2500);
      }
    } catch {
      setBanner({ kind: "err", text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }

  async function createFolder(parentId: number | null, name: string, thenEdit: boolean) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/folders`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentId: parentId ?? undefined,
          listedInPublicGallery: true,
          isActive: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data?.error || "No se pudo crear la carpeta." });
        setBusy(false);
        return;
      }
      await onFoldersRefresh();
      if (typeof data?.id === "number") {
        onSelectedIdChange(data.id);
        onExpandedChange((prev) => new Set(prev).add(data.id));
        if (thenEdit) {
          setEditingId(data.id);
          setDraftName(String(data.name ?? name));
        }
      }
    } catch {
      setBanner({ kind: "err", text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }

  const handleNewFolder = useCallback(() => {
    const parentId =
      selectedOfficial != null && selectedOfficial.folderScope === "ORGANIZER"
        ? selectedOfficial.id
        : null;
    const nm = nextUniqueName(nameSet);
    void createFolder(parentId, nm, true);
  }, [selectedOfficial, nameSet, eventId]);

  const handleDuplicate = useCallback(
    async (f: OfficialFolderRow) => {
      const nm = nextCopyName(nameSet, f.name);
      setBusy(true);
      setBanner(null);
      try {
        const res = await fetch(`/api/organizer/events/${eventId}/folders`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nm,
            parentId: f.parentId ?? undefined,
            listedInPublicGallery: f.listedInPublicGallery,
            isActive: f.isActive,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBanner({ kind: "err", text: data?.error || "No se pudo duplicar." });
          setBusy(false);
          return;
        }
        await onFoldersRefresh();
        if (typeof data?.id === "number") onSelectedIdChange(data.id);
        setBanner({ kind: "ok", text: "Carpeta duplicada (sin subcarpetas)." });
        setTimeout(() => setBanner(null), 2800);
      } catch {
        setBanner({ kind: "err", text: "Error de red." });
      } finally {
        setBusy(false);
      }
    },
    [eventId, nameSet, onFoldersRefresh, onSelectedIdChange]
  );

  const handleDelete = useCallback(
    async (f: OfficialFolderRow) => {
      const childCount = f._count?.children ?? 0;
      const photoCount = f._count?.photos ?? 0;
      if (childCount > 0 || photoCount > 0) {
        setBanner({
          kind: "err",
          text: "Esta carpeta tiene fotos o subcarpetas. Desactivá la carpeta o mové el contenido antes de eliminarla.",
        });
        return;
      }
      const ok =
        typeof window !== "undefined" &&
        window.confirm(`¿Eliminar la carpeta «${f.name}»? Esta acción no se puede deshacer.`);
      if (!ok) return;
      setBusy(true);
      setBanner(null);
      try {
        const res = await fetch(`/api/organizer/events/${eventId}/folders/${f.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBanner({
            kind: "err",
            text:
              data?.error ||
              "No se puede eliminar. Si tiene fotos o subcarpetas, desactivá la carpeta o mové el contenido.",
          });
          setBusy(false);
          return;
        }
        if (selectedId === f.id) onSelectedIdChange(null);
        await onFoldersRefresh();
        setBanner({ kind: "ok", text: "Carpeta eliminada." });
        setTimeout(() => setBanner(null), 2500);
      } catch {
        setBanner({ kind: "err", text: "Error de red." });
      } finally {
        setBusy(false);
      }
    },
    [eventId, selectedId, onSelectedIdChange, onFoldersRefresh]
  );

  const handlePaste = useCallback(async () => {
    if (!clipboard) {
      setBanner({ kind: "err", text: "No hay nada en el portapapeles interno. Usá Copiar o Cortar." });
      return;
    }
    const targetParent: number | null =
      selectedOfficial != null && selectedOfficial.folderScope === "ORGANIZER"
        ? selectedOfficial.id
        : null;

    const cutFolder = byIdAll.get(clipboard.folderId);
    if (!cutFolder || cutFolder.folderScope !== "ORGANIZER") return;

    if (clipboard.op === "cut") {
      const folderRows = organizerRowsToFolderNodes(organizerScoped);
      const byId = foldersByEventId(folderRows);
      const childrenMap = childrenByParentMap(folderRows);
      const vr = validateReparent({
        candidateId: clipboard.folderId,
        newParentId: targetParent,
        byId,
        childrenMap,
        enforceScope: EventFolderScope.ORGANIZER,
        allowParentScopes: [EventFolderScope.ORGANIZER],
      });
      if (!vr.ok) {
        setBanner({ kind: "err", text: vr.error });
        return;
      }
      await patchFolder(
        clipboard.folderId,
        { parentId: targetParent },
        "Carpeta movida."
      );
      setClipboard(null);
      return;
    }

    /** copy → duplicado vacío bajo padre elegido */
    const base = cutFolder.name;
    const nm = nextCopyName(nameSet, base);
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/folders`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nm,
          parentId: targetParent ?? undefined,
          listedInPublicGallery: cutFolder.listedInPublicGallery,
          isActive: cutFolder.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", text: data?.error || "No se pudo pegar (duplicar)." });
        setBusy(false);
        return;
      }
      await onFoldersRefresh();
      setBanner({
        kind: "ok",
        text: "Pegado: carpeta nueva vacía (subcarpetas no se copian en esta versión).",
      });
      setTimeout(() => setBanner(null), 3200);
    } catch {
      setBanner({ kind: "err", text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }, [clipboard, selectedOfficial, byIdAll, organizerScoped, eventId, onFoldersRefresh, nameSet]);

  const renderOfficialSubtree = useCallback(
    (parentKey: number | null, depth: number): ReactElement | null => {
      const hasAny = organizerScoped.some(
        (f) => (f.parentId ?? null) === parentKey && (!visOrg || visOrg.has(f.id))
      );
      if (!hasAny) return null;
      return (
        <OrganizerSiblingDnD
          parentKey={parentKey}
          depth={depth}
          organizerScoped={organizerScoped}
          expanded={expanded}
          toggle={toggleExpanded}
          selectedId={selectedId}
          onSelect={onSelectedIdChange}
          visible={visOrg}
          disabled={disabled}
          onReorder={(anchor, orderedIds) => void reorderSiblings(anchor, orderedIds)}
          renderNested={(pid, d) => renderOfficialSubtree(pid, d)}
          editingId={editingId}
          draftName={draftName}
          onDraftChange={setDraftName}
          onCommitRename={commitRename}
          onCancelRename={cancelRename}
          onRowDoubleClick={(f) => startRename(f)}
          onContextMenu={(e, f) => {
            e.preventDefault();
            setCtx({ x: e.clientX, y: e.clientY, folder: f });
          }}
        />
      );
    },
    [
      organizerScoped,
      visOrg,
      expanded,
      toggleExpanded,
      selectedId,
      onSelectedIdChange,
      disabled,
      editingId,
      draftName,
    ]
  );

  const onPanelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingId != null) return;
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "F2" && selectedOfficial) {
        e.preventDefault();
        startRename(selectedOfficial);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedOfficial) {
        e.preventDefault();
        void handleDelete(selectedOfficial);
        return;
      }

      if (mod && e.key.toLowerCase() === "d" && selectedOfficial) {
        e.preventDefault();
        void handleDuplicate(selectedOfficial);
        return;
      }

      if (mod && e.key.toLowerCase() === "c" && selectedOfficial) {
        e.preventDefault();
        setClipboard({ op: "copy", folderId: selectedOfficial.id });
        setBanner({ kind: "ok", text: "Copiado al portapapeles interno." });
        setTimeout(() => setBanner(null), 1800);
        return;
      }

      if (mod && e.key.toLowerCase() === "x" && selectedOfficial) {
        e.preventDefault();
        setClipboard({ op: "cut", folderId: selectedOfficial.id });
        setBanner({ kind: "ok", text: "Cortado (listo para pegar en otra ubicación)." });
        setTimeout(() => setBanner(null), 2200);
        return;
      }

      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void handlePaste();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (flatOrder.length === 0) return;
        const idx = selectedId != null ? flatOrder.indexOf(selectedId) : -1;
        const nextIdx =
          e.key === "ArrowDown"
            ? Math.min(flatOrder.length - 1, idx < 0 ? 0 : idx + 1)
            : Math.max(0, idx <= 0 ? 0 : idx - 1);
        onSelectedIdChange(flatOrder[nextIdx]);
        return;
      }

      if (e.key === "ArrowRight" && selectedId != null) {
        e.preventDefault();
        onExpandedChange((prev) => new Set(prev).add(selectedId));
        return;
      }
      if (e.key === "ArrowLeft" && selectedId != null) {
        e.preventDefault();
        onExpandedChange((prev) => {
          const n = new Set(prev);
          n.delete(selectedId);
          return n;
        });
        return;
      }
    },
    [
      editingId,
      selectedOfficial,
      selectedId,
      flatOrder,
      onSelectedIdChange,
      onExpandedChange,
      handleDelete,
      handleDuplicate,
      handlePaste,
    ]
  );

  const officialRoot = renderOfficialSubtree(null, 0);

  return (
    <div className="rounded-2xl border border-[#111827]/10 bg-[#fafafa] shadow-sm overflow-hidden min-w-0">
      <div className="ds-explorer-toolbar px-3 py-2 sm:px-4 border-b border-[#111827]/8 bg-white min-w-0 ds-overflow-x-soft">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-9 whitespace-nowrap"
          disabled={disabled}
          onClick={handleNewFolder}
        >
          Nueva carpeta
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 whitespace-nowrap"
          disabled={disabled || !selectedOfficial}
          onClick={() => selectedOfficial && startRename(selectedOfficial)}
        >
          Renombrar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 whitespace-nowrap"
          disabled={disabled || !selectedOfficial}
          onClick={() => selectedOfficial && void handleDuplicate(selectedOfficial)}
        >
          Duplicar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 whitespace-nowrap text-red-700 border-red-200 hover:bg-red-50"
          disabled={disabled || !selectedOfficial}
          onClick={() => selectedOfficial && void handleDelete(selectedOfficial)}
        >
          <Trash2 className="w-3.5 h-3.5 inline mr-1" aria-hidden />
          Eliminar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 whitespace-nowrap"
          disabled={disabled || !selectedOfficial}
          onClick={() =>
            selectedOfficial &&
            void patchFolder(selectedOfficial.id, { isActive: !selectedOfficial.isActive }, "Estado actualizado.")
          }
        >
          {selectedOfficial?.isActive ? "Desactivar" : "Activar"}
        </Button>
        <div className="ds-explorer-search">
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
            className="h-9 text-sm w-full"
            aria-label="Buscar carpetas"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 whitespace-nowrap"
          disabled={disabled || organizerScoped.length === 0}
          onClick={() => onExpandedChange(new Set(organizerScoped.map((f) => f.id)))}
        >
          Expandir todo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 whitespace-nowrap"
          disabled={disabled}
          onClick={() => onExpandedChange(new Set())}
        >
          Contraer todo
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 whitespace-nowrap"
          disabled={disabled || !clipboard}
          title="Pegar (Ctrl+V)"
          onClick={() => void handlePaste()}
        >
          Pegar
        </Button>
      </div>

      <div className="ds-explorer-hints px-3 py-2 sm:px-4 bg-amber-50/50 border-b border-amber-100 text-[11px] text-amber-950/90">
        <span className="font-semibold">Atajos:</span>
        <span>F2 renombrar</span>
        <span>·</span>
        <span>Supr borrar</span>
        <span>·</span>
        <span>Ctrl/Cmd+D duplicar</span>
        <span>·</span>
        <span>Ctrl/Cmd+C / X / V copiar, cortar, pegar (interno)</span>
        <span>·</span>
        <span>↑↓ selección</span>
        <span>·</span>
        <span>←→ contraer / expandir</span>
      </div>

      {banner ? (
        <div
          role={banner.kind === "err" ? "alert" : "status"}
          className={`mx-3 sm:mx-4 mt-2 rounded-lg border px-3 py-2 text-sm ${
            banner.kind === "err"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="flex flex-col xl:flex-row xl:items-start min-w-0">
        <div
          tabIndex={0}
          role="tree"
          aria-label="Carpetas oficiales del evento"
          className="flex-1 min-w-0 p-3 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c27b3d]/40"
          onKeyDown={onPanelKeyDown}
        >
          {loading ? (
            <p className="text-sm text-gray-500">Cargando…</p>
          ) : organizerScoped.length === 0 ? (
            <DsEmptyState title="Sin carpetas oficiales">
              <p className="ds-readable-text text-sm text-gray-600 m-0">
                Usá «Nueva carpeta» para crear la primera.
              </p>
            </DsEmptyState>
          ) : (
            officialRoot ?? (
              <p className="text-sm text-gray-500">Sin resultados para la búsqueda.</p>
            )
          )}
        </div>

        <aside className="xl:w-96 shrink-0 min-w-0 border-t xl:border-t-0 xl:border-l border-[#111827]/10 bg-[#fafafa] p-4 sm:p-5 space-y-3 ds-organizer-panel--stack">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] m-0">Detalles</p>
          {!selectedOfficial ? (
            <p className="ds-readable-text text-sm text-gray-600 m-0">
              Elegí una carpeta para editar slug, descripción, orden y visibilidad en la galería pública.
            </p>
          ) : (
            <OfficialFolderDetailForm
              key={selectedOfficial.id}
              eventId={eventId}
              folder={selectedOfficial}
              organizerScoped={organizerScoped}
              disabled={disabled}
              onSaved={onFoldersRefresh}
              onCopyFolder={() => {
                setClipboard({ op: "copy", folderId: selectedOfficial.id });
                setBanner({ kind: "ok", text: "Copiado al portapapeles interno." });
                setTimeout(() => setBanner(null), 1800);
              }}
              onCutFolder={() => {
                setClipboard({ op: "cut", folderId: selectedOfficial.id });
                setBanner({ kind: "ok", text: "Cortado (listo para pegar en otra ubicación)." });
                setTimeout(() => setBanner(null), 2200);
              }}
              onMessage={(k, t) => {
                setBanner({ kind: k, text: t });
                setTimeout(() => setBanner(null), 3000);
              }}
            />
          )}
        </aside>
      </div>

      {ctx && ctxMenuStyle ? (
        <div
          className="fixed z-50 min-w-[12rem] rounded-xl border border-[#111827]/12 bg-white py-1 shadow-xl"
          style={ctxMenuStyle}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              const p = ctx.folder.id;
              const nm = nextUniqueName(nameSet);
              void createFolder(p, nm, true);
              setCtx(null);
            }}
          >
            Nueva subcarpeta
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              startRename(ctx.folder);
              setCtx(null);
            }}
          >
            Renombrar
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              void handleDuplicate(ctx.folder);
              setCtx(null);
            }}
          >
            Duplicar
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-700"
            onClick={() => {
              void handleDelete(ctx.folder);
              setCtx(null);
            }}
          >
            Eliminar
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              void patchFolder(ctx.folder.id, { isActive: !ctx.folder.isActive }, "Estado actualizado.");
              setCtx(null);
            }}
          >
            {ctx.folder.isActive ? "Desactivar" : "Activar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OfficialFolderDetailForm({
  eventId,
  folder,
  organizerScoped,
  disabled,
  onSaved,
  onCopyFolder,
  onCutFolder,
  onMessage,
}: {
  eventId: number;
  folder: OfficialFolderRow;
  organizerScoped: OfficialFolderRow[];
  disabled: boolean;
  onSaved: () => Promise<void>;
  onCopyFolder: () => void;
  onCutFolder: () => void;
  onMessage: (kind: "ok" | "err", text: string) => void;
}) {
  const [slug, setSlug] = useState(folder.slug ?? "");
  const [desc, setDesc] = useState(folder.description ?? "");
  const [sort, setSort] = useState(String(folder.sortOrder));
  const [listed, setListed] = useState(folder.listedInPublicGallery);
  const [parent, setParent] = useState<string>(folder.parentId == null ? "null" : String(folder.parentId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSlug(folder.slug ?? "");
    setDesc(folder.description ?? "");
    setSort(String(folder.sortOrder));
    setListed(folder.listedInPublicGallery);
    setParent(folder.parentId == null ? "null" : String(folder.parentId));
  }, [folder]);

  const orgDepthById = useMemo(() => {
    const depths = new Map<number, number>();
    function walk(parentKey: number | null, depth: number) {
      const kids = organizerScoped.filter((f) => f.parentId === parentKey).sort(cmp);
      for (const k of kids) {
        depths.set(k.id, depth);
        walk(k.id, depth + 1);
      }
    }
    walk(null, 0);
    return depths;
  }, [organizerScoped]);

  const parentChoices = useMemo(() => {
    function blockedDescendants(fid: number): Set<number> {
      const banned = new Set<number>([fid]);
      let added = true;
      while (added) {
        added = false;
        for (const f of organizerScoped) {
          if (typeof f.parentId === "number" && banned.has(f.parentId) && !banned.has(f.id)) {
            banned.add(f.id);
            added = true;
          }
        }
      }
      return banned;
    }
    const ban = blockedDescendants(folder.id);
    return organizerScoped.filter((f) => !ban.has(f.id));
  }, [organizerScoped, folder.id]);

  async function save() {
    setSaving(true);
    try {
      const parsedParent = parent === "null" || parent === "" ? null : parseInt(parent, 10);
      if (parsedParent != null && (!Number.isFinite(parsedParent) || parsedParent <= 0)) {
        onMessage("err", "Carpeta padre inválida.");
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/organizer/events/${eventId}/folders/${folder.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim() === "" ? null : slug,
          description: desc.trim() === "" ? null : desc,
          sortOrder: sort.trim() === "" ? undefined : parseInt(sort, 10),
          listedInPublicGallery: listed,
          parentId: parsedParent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMessage("err", data?.error || "No se guardaron los detalles.");
        setSaving(false);
        return;
      }
      await onSaved();
      onMessage("ok", "Detalles guardados.");
    } catch {
      onMessage("err", "Error de red.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 min-w-0">
      <DsInfoPanel title="Campos avanzados" className="!text-xs">
        <p className="ds-readable-text text-xs text-gray-600 m-0 mb-2">
          El nombre se edita en el árbol (doble clic o Renombrar / F2).
        </p>
      </DsInfoPanel>
      <div className="min-w-0">
        <label className="block text-xs font-semibold text-gray-700 mb-1">Slug (opc.)</label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={disabled || saving}
          className="w-full font-mono text-xs h-9"
        />
      </div>
      <div className="min-w-0">
        <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
        <Textarea
          className="text-sm min-h-[5rem]"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          disabled={disabled || saving}
        />
      </div>
      <div className="clf-form-grid clf-form-grid--2">
        <div className="clf-form-field-stack min-w-0">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Orden</label>
          <Input
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            disabled={disabled || saving}
            className="h-9 text-sm w-full"
            inputMode="numeric"
          />
        </div>
        <label className="clf-wizard-check items-end pb-1 text-xs">
          <input
            type="checkbox"
            checked={listed}
            onChange={(e) => setListed(e.target.checked)}
            disabled={disabled || saving}
            className="rounded border-gray-300"
          />
          <span className="clf-wizard-check__body leading-snug">Mostrar en galería pública</span>
        </label>
      </div>
      <div className="min-w-0">
        <label className="block text-xs font-semibold text-gray-700 mb-1">Carpeta padre</label>
        <select
          value={parent}
          onChange={(e) => setParent(e.target.value)}
          disabled={disabled || saving}
          className="w-full rounded-lg border border-gray-300 h-10 text-sm"
        >
          <option value="null">Raíz</option>
          {parentChoices.map((o) => {
            const d = orgDepthById.get(o.id) ?? 0;
            return (
              <option key={o.id} value={String(o.id)}>
                {"– ".repeat(d + 1)}
                {o.name}
              </option>
            );
          })}
        </select>
      </div>
      <Button type="button" variant="primary" disabled={disabled || saving} onClick={() => void save()}>
        {saving ? "Guardando…" : "Guardar detalles"}
      </Button>
      <div className="flex flex-wrap gap-2 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs whitespace-nowrap shrink-0"
          disabled={disabled || saving}
          title="Copiar al portapapeles interno (Ctrl/Cmd+C en el árbol)"
          onClick={onCopyFolder}
        >
          <Copy className="w-3.5 h-3.5 inline mr-1" aria-hidden />
          Copiar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs whitespace-nowrap shrink-0"
          disabled={disabled || saving}
          title="Cortar para pegar en otra ubicación (Ctrl/Cmd+X)"
          onClick={onCutFolder}
        >
          <Scissors className="w-3.5 h-3.5 inline mr-1" aria-hidden />
          Cortar
        </Button>
      </div>
    </div>
  );
}
