"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { ChevronRight, Folder } from "lucide-react";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import OrganizerOfficialFolderExplorer, {
  type OfficialFolderRow,
} from "@/components/organizer/OrganizerOfficialFolderExplorer";

export type EventFoldersSectionProps = {
  eventId: number;
};

export type ApiFolder = OfficialFolderRow & {
  createdByUserId: number | null;
  ownerPhotographerId: number | null;
};

function cmp(a: ApiFolder, b: ApiFolder): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

function collectVisibleIds(section: ApiFolder[], qRaw: string): Set<number> | null {
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
    const self = f.name.toLowerCase().includes(q);
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
  if (roots.length === 0) {
    roots = section.slice();
  }
  for (const r of roots) {
    subMatches(r.id);
  }

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
    let cur: ApiFolder | undefined = byId.get(fid);
    while (cur) {
      out.add(cur.id);
      if (cur.parentId == null) break;
      cur = byId.get(cur.parentId);
    }
  }
  return out;
}

function PhotographerExplorerLevel(props: {
  parentKey: number | null;
  folders: ApiFolder[];
  expanded: ReadonlySet<number>;
  toggle: (id: number) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  visible: Set<number> | null;
  disabled: boolean;
}): ReactElement {
  const kids = props.folders
    .filter((f) => f.folderScope === "PHOTOGRAPHER" && (f.parentId ?? null) === props.parentKey)
    .sort(cmp)
    .filter((f) => !props.visible || props.visible.has(f.id));

  if (kids.length === 0) return <></>;

  return (
    <ul className="m-0 p-0 list-none space-y-1 min-w-0" role="list">
      {kids.map((f) => {
        const hasKids = props.folders.some((k) => k.folderScope === "PHOTOGRAPHER" && k.parentId === f.id);
        const isOpen = props.expanded.has(f.id);
        const photos = typeof f._count?.photos === "number" ? f._count!.photos : null;
        return (
          <li key={f.id} className="min-w-0">
            <div
              className={`flex items-stretch gap-1 sm:gap-2 min-w-0 rounded-xl border px-1.5 sm:px-2 py-1.5 transition ${
                props.selectedId === f.id
                  ? "border-indigo-400/70 bg-indigo-50/80 shadow-sm"
                  : "border-[#111827]/10 bg-white hover:bg-gray-50/90"
              } ${props.disabled ? "opacity-60" : ""}`}
            >
              {hasKids ? (
                <button
                  type="button"
                  className="shrink-0 w-8 flex items-center justify-center rounded-lg border border-transparent hover:bg-gray-100"
                  aria-expanded={isOpen}
                  disabled={props.disabled}
                  onClick={() => props.toggle(f.id)}
                >
                  {isOpen ? (
                    <ChevronRight className="w-4 h-4 rotate-90" aria-hidden />
                  ) : (
                    <ChevronRight className="w-4 h-4" aria-hidden />
                  )}
                </button>
              ) : (
                <span className="w-8 shrink-0" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => props.onSelect(f.id)}
                disabled={props.disabled}
                className="min-w-0 flex-1 text-left flex gap-2 items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              >
                <Folder className="w-[1.1rem] h-[1.1rem] shrink-0 text-indigo-600/80" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap gap-x-2 gap-y-0.5 items-center min-w-0">
                    <span className="ds-readable-text ds-readable-text--fluid text-sm font-semibold text-[#111827] truncate">
                      {f.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 rounded-full bg-indigo-50 text-indigo-900 px-1.5 py-px">
                      Fotógrafo #{f.ownerPhotographerId ?? "?"}
                    </span>
                    {!f.isActive ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 rounded-full bg-gray-100 text-gray-600 px-1.5 py-px">
                        Inactiva
                      </span>
                    ) : null}
                    {!f.listedInPublicGallery ? (
                      <span className="text-[10px] font-semibold shrink-0 rounded-full bg-slate-100 text-slate-700 px-1.5 py-px">
                        Oculta en galería
                      </span>
                    ) : null}
                  </span>
                  <span className="ds-readable-text ds-readable-text--fluid block text-xs text-[#64748b] mt-0.5 m-0 max-w-none">
                    {photos !== null ? `${photos} foto${photos === 1 ? "" : "s"}` : "—"}
                    {f.slug ? (
                      <>
                        {" "}
                        · slug: <span className="font-mono text-[11px]">{f.slug}</span>
                      </>
                    ) : null}
                  </span>
                </span>
              </button>
            </div>
            {hasKids && isOpen ? (
              <div className="mt-1 min-w-0 border-l border-indigo-100 pl-2 sm:pl-3 ml-2">
                <PhotographerExplorerLevel
                  parentKey={f.id}
                  folders={props.folders}
                  expanded={props.expanded}
                  toggle={props.toggle}
                  selectedId={props.selectedId}
                  onSelect={props.onSelect}
                  visible={props.visible}
                  disabled={props.disabled}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function EventFoldersSection({ eventId }: EventFoldersSectionProps) {
  const sectionHeadingId = "organizer-event-folders-explorer-heading";
  const [folders, setFolders] = useState<ApiFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    setLoading(true);
    const res = await fetch(`/api/organizer/events/${eventId}/folders`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFolders([]);
      setBanner({ kind: "err", text: data?.error || "No se pudieron cargar las carpetas." });
      setLoading(false);
      return;
    }
    const list = Array.isArray(data.folders) ? (data.folders as ApiFolder[]) : [];
    setFolders(list);
    setExpanded((prev) => {
      const n = new Set<number>();
      for (const f of list) if (prev.has(f.id)) n.add(f.id);
      return n;
    });
    setBanner(null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const photoScoped = useMemo(
    () => folders.filter((f) => f.folderScope === "PHOTOGRAPHER"),
    [folders]
  );

  const visPh = useMemo(() => collectVisibleIds(photoScoped, search), [photoScoped, search]);

  const selected = useMemo(
    () => (selectedId != null ? folders.find((f) => f.id === selectedId) ?? null : null),
    [folders, selectedId]
  );

  const toggleExpanded = useCallback((id: number) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const disabled = loading;

  const photoRootsEmpty =
    photoScoped.filter((f) => f.parentId == null).length === 0 && photoScoped.length > 0;

  return (
    <section
      className="ds-organizer-panel ds-organizer-panel--stack w-full min-w-0"
      aria-labelledby={sectionHeadingId}
    >
      <div className="min-w-0 w-full ds-content-container space-y-2">
        <h2 id={sectionHeadingId} className="text-xl font-bold text-[#111827] tracking-tight m-0">
          Carpetas del evento
        </h2>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0 max-w-none">
          Estructura oficial tipo explorador. Las carpetas de fotógrafos se gestionan en cada álbum; acá solo se
          consultan.
        </p>
      </div>

      <details className="group rounded-2xl border border-[#111827]/10 bg-white/80 shadow-sm min-w-0 overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-2 text-sm font-semibold text-[#374151] hover:bg-amber-50/40 transition-colors">
          <span>Guía y alcance (galería pública y responsabilidades)</span>
          <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90 text-[#9a5828]" aria-hidden />
        </summary>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3 border-t border-[#111827]/6 bg-[#fdfcfb]/80">
          <DsInfoPanel title="Galería pública" className="!border-amber-200/60 !bg-amber-50/40">
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 m-0 max-w-none">
              Las carpetas oficiales aparecen en la galería pública cuando están activas y marcadas como visibles. Las
              carpetas de fotógrafo solo se muestran ahí si el autor las marca visibles en su álbum.
            </p>
          </DsInfoPanel>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/95 m-0 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3">
            Esta sección ordena vistas y etiquetas;{" "}
            <strong className="font-semibold">no altera checkout, precios ni comisiones</strong>.
          </p>
        </div>
      </details>

      {banner ? (
        <div
          role={banner.kind === "err" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-2.5 text-sm ds-readable-text ds-readable-text--fluid ${
            banner.kind === "err"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <OrganizerOfficialFolderExplorer
        eventId={eventId}
        folders={folders}
        onFoldersRefresh={refresh}
        loading={loading}
        selectedId={
          selectedId != null && selected?.folderScope === "ORGANIZER" ? selectedId : null
        }
        onSelectedIdChange={(id) => setSelectedId(id)}
        expanded={expanded}
        onExpandedChange={setExpanded}
        searchQuery={search}
        onSearchQueryChange={setSearch}
      />

      {/* Nota: si había foto seleccionado, explorer no muestra panel derecho oficial — detalle aquí */}
      {selected?.folderScope === "PHOTOGRAPHER" ? (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-5 min-w-0 mt-4">
          <p className="text-sm font-semibold text-indigo-950 m-0">Carpeta de fotógrafo (solo lectura)</p>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#4338ca] m-0 mt-2">
            «{selected.name}» pertenece al fotógrafo #{selected.ownerPhotographerId ?? "?"}. No se editan ni eliminan desde
            el panel del organizador.
          </p>
          <ul className="ds-readable-text ds-readable-text--fluid text-xs text-[#3730a3] list-disc pl-5 m-0 mt-3 space-y-1">
            <li>Activa: {selected.isActive ? "sí" : "no"}</li>
            <li>
              Fotos vinculadas: {selected._count?.photos ?? "?"} · subcarpetas:{" "}
              {typeof selected._count?.children === "number" ? selected._count.children : "?"}
            </li>
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-indigo-100/80 bg-white px-3 py-3 sm:px-4 min-w-0 mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-900/80 m-0 mb-1">
          Carpetas de fotógrafos
        </p>
        <p className="ds-readable-text ds-readable-text--fluid text-xs text-[#64748b] m-0 mb-3">
          Misma búsqueda que en «Buscar» del explorador oficial. Solo lectura; cada fotógrafo gestiona las suyas en su
          álbum.
        </p>
        {!photoScoped.length ? (
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#64748b] m-0">
            Aún no hay carpetas auxiliares de fotógrafos.
          </p>
        ) : photoRootsEmpty ? (
          <p className="text-sm text-[#64748b] m-0">Sin raíces visibles para esta búsqueda.</p>
        ) : (
          <div className="ds-table-scroll max-h-[min(48vh,400px)] min-w-0">
            <PhotographerExplorerLevel
              parentKey={null}
              folders={folders}
              expanded={expanded}
              toggle={toggleExpanded}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              visible={visPh}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </section>
  );
}
