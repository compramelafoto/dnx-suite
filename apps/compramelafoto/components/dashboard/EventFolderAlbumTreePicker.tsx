"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import type { EventFolderScope } from "@/lib/prisma";
import { ChevronRight, Folder } from "lucide-react";
import { DsEmptyState } from "@/components/ui/DsEmptyState";

type FolderRow = {
  id: number;
  parentId: number | null;
  folderScope: EventFolderScope;
  name: string;
  sortOrder: number;
  listedInPublicGallery: boolean;
  ownerPhotographerId: number | null;
  isActive?: boolean;
  _count?: { photos: number; children: number };
};

function cmpRow(a: FolderRow, b: FolderRow): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

function flatFolderOptions(
  list: FolderRow[],
  scope: EventFolderScope
): Array<{ id: number; label: string }> {
  const out: Array<{ id: number; label: string }> = [];
  function walk(parentKey: number | null, depth: number): void {
    list
      .filter((r) => r.folderScope === scope && (r.parentId ?? null) === parentKey)
      .sort(cmpRow)
      .forEach((r) => {
        const photos = typeof r._count?.photos === "number" ? r._count!.photos : null;
        const prefix = `${"– ".repeat(depth)}`;
        out.push({
          id: r.id,
          label: `${prefix}${r.name}${photos !== null ? ` · ${photos} fotos` : ""}`,
        });
        walk(r.id, depth + 1);
      });
  }
  walk(null, 0);
  return out;
}

/** Árbol recursivo dentro de un solo scope (mezclar padres equivocados rompe jerarquía). */
export function FolderScopeTreePickList({
  scope,
  title,
  rows,
  expanded,
  onToggleExpand,
  value,
  onPick,
  disabled,
}: {
  scope: EventFolderScope;
  title: string;
  rows: FolderRow[];
  expanded: ReadonlySet<number>;
  onToggleExpand: (id: number) => void;
  value: string;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const list = [...rows];

  function renderSubtree(parentKey: number | null, depth: number): ReactElement[] {
    const nodes = list
      .filter((r) => r.folderScope === scope && r.parentId === parentKey)
      .sort(cmpRow);
    const els: ReactElement[] = [];

    for (const f of nodes) {
      const hasKids = list.some((k) => k.parentId === f.id && k.folderScope === scope);
      const isOpen = expanded.has(f.id);
      const sel = String(f.id) === value;
      const photos = typeof f._count?.photos === "number" ? f._count!.photos : null;

      els.push(
        <div key={f.id} className="flex flex-col gap-0.5 min-w-0">
          <div
            className="flex items-stretch gap-1 min-w-0"
            style={{ paddingLeft: depth * 12 }}
          >
            {hasKids ? (
              <button
                type="button"
                className="shrink-0 w-9 flex items-center justify-center rounded-lg border border-[#111827]/10 bg-white text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d] disabled:opacity-50"
                aria-expanded={isOpen}
                disabled={disabled}
                onClick={() => onToggleExpand(f.id)}
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden strokeWidth={2} />
              </button>
            ) : (
              <span className="w-9 shrink-0" aria-hidden />
            )}
            <button
              type="button"
              role="radio"
              aria-checked={sel}
              disabled={disabled}
              onClick={() => onPick(String(f.id))}
              className={`min-w-0 flex-1 text-left rounded-xl border px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d] flex items-start gap-2 ${
                sel
                  ? "border-[#c27b3d]/80 bg-[#fef7f3] shadow-sm ring-1 ring-[#c27b3d]/15"
                  : "border-[#111827]/10 bg-white hover:border-[#111827]/18 hover:bg-gray-50/90"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <Folder
                className="w-4 h-4 shrink-0 mt-0.5 text-amber-700/85"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm text-[#111827] truncate ds-readable-text ds-readable-text--fluid">
                    {f.name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 bg-[#c27b3d]/12 text-[#9a5828]">
                    Organizador
                  </span>
                  {photos !== null ? (
                    <span className="text-xs text-[#6b7280] tabular-nums shrink-0">· {photos}</span>
                  ) : null}
                </span>
              </span>
            </button>
          </div>
          {hasKids && isOpen ? renderSubtree(f.id, depth + 1) : null}
        </div>
      );
    }
    return els;
  }

  const rootsEmpty = list.filter((r) => r.folderScope === scope && r.parentId == null).length === 0;
  const block = rootsEmpty ? (
    <p className="ds-readable-text ds-readable-text--fluid text-xs text-[#64748b] px-2 m-0">
      El organizador aún no publicó etiquetas para este evento.
    </p>
  ) : (
    <div className="flex flex-col gap-1 min-w-0">{renderSubtree(null, 0)}</div>
  );

  return (
    <div className="rounded-2xl border border-[#111827]/8 bg-gradient-to-b from-white to-[#fafafa]/90 px-3 py-3 sm:px-4 space-y-2 min-w-0 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] m-0">{title}</p>
      {block}
    </div>
  );
}

export type EventFolderAlbumTreePickerProps = {
  eventId?: number | null;
  /** En upload: vale "" para “sin carpeta”. En bulk, "" quiere decir “no elegiste todavía”. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** upload: permite vacío (= sin carpeta). bulk: usar __none__ explícito con botón auxiliar ya existente. */
  mode: "upload" | "bulk";
  /** explorer: árbol · compact: select plano para barra fija bulk. */
  layout?: "explorer" | "compact";
};

export default function EventFolderAlbumTreePicker({
  eventId,
  value,
  onChange,
  disabled,
  mode,
  layout = "explorer",
}: EventFolderAlbumTreePickerProps) {
  const [rows, setRows] = useState<FolderRow[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!Number.isFinite(eventId) || !(eventId! > 0)) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch(`/api/fotografo/events/${eventId}/folders`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRows([]);
        setLoadErr(typeof data?.error === "string" ? data.error : "No se cargaron carpetas.");
        setLoading(false);
        return;
      }
      const list = Array.isArray(data.folders) ? (data.folders as FolderRow[]) : [];
      setRows(list);
      setExpanded(new Set(list.map((f) => f.id)));
      setLoading(false);
    } catch {
      setLoadErr("Error de red.");
      setRows([]);
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleExpand = useCallback((id: number) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const organizerRows = useMemo(
    () => rows.filter((r) => r.folderScope === "ORGANIZER"),
    [rows]
  );

  const orgOptsFlat = useMemo(() => flatFolderOptions(organizerRows, "ORGANIZER"), [organizerRows]);

  const eventOk = typeof eventId === "number" && Number.isFinite(eventId) && eventId > 0;

  if (!eventOk) {
    return (
      <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#64748b] m-0">
        Este álbum no está ligado a un evento · no aplican carpetas de evento
      </p>
    );
  }

  if (layout === "compact" && mode === "bulk") {
    const bulkCompactId = `folder-bulk-select-${eventId}`;
    return (
      <div className="w-full space-y-1.5">
        {loadErr ? (
          <div
            className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800"
            role="alert"
          >
            {loadErr}
          </div>
        ) : null}
        <label
          htmlFor={bulkCompactId}
          className="block text-sm font-medium text-[#1a1a1a]"
        >
          Carpeta destino
        </label>
        <select
          id={bulkCompactId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled === true || loading}
          className="w-full min-h-11 rounded-xl border border-[#111827]/12 bg-white px-3 py-2.5 text-sm text-[#111827] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40 disabled:opacity-60"
        >
          <option value="">{loading ? "Cargando…" : "Elegí una carpeta"}</option>
          {orgOptsFlat.length > 0 ? (
            <optgroup label="Organizador">
              {orgOptsFlat.map((o) => (
                <option key={`o-${o.id}`} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
    );
  }

  const noneLabel =
    mode === "upload"
      ? "Sin carpeta (la subida va sin etiqueta de evento)"
      : "Usá «Quitar carpeta» en la barra para dejar sin etiqueta; acá elegí la carpeta destino.";

  return (
    <div className="space-y-3 ds-content-container min-w-0">
      {loadErr ? (
        <div
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {loadErr}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {mode === "upload" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
            role="radio"
            aria-checked={value === ""}
            className={`appearance-none font-inherit rounded-xl border px-3 py-2 text-sm whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d] ${
              value === ""
                ? "border-[#c27b3d]/70 bg-[#fef7f3]"
                : "border-[#111827]/10 bg-white hover:bg-gray-50"
            }`}
          >
            Sin carpeta
          </button>
        ) : null}
        <p className="ds-readable-text ds-readable-text--fluid text-xs text-[#64748b] flex-1 min-w-[220px] m-0 self-center">
          {noneLabel}
        </p>
      </div>

      <div className="ds-table-scroll max-h-[min(60vh,520px)] pr-1 sm:pr-2 -mr-1 min-w-0">
        {loading ? (
          <p className="text-sm text-[#64748b] px-2" role="status">
            Cargando carpetas…
          </p>
        ) : rows.length === 0 && !loadErr ? (
          <DsEmptyState title="Sin carpetas">
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#64748b] m-0">
              El organizador todavía no creó carpetas oficiales. Pedile que defina la estructura antes de subir.
            </p>
          </DsEmptyState>
        ) : (
          <FolderScopeTreePickList
            scope="ORGANIZER"
            title="Carpetas del organizador"
            rows={organizerRows}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            value={value}
            onPick={onChange}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
