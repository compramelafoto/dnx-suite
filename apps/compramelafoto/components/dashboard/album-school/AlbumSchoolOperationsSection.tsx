"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { DsEmptyTableCell } from "@/components/ui/DsEmptyTableCell";

type OperationOrder = {
  id: number;
  status: string;
  createdAt: string;
  buyerName: string | null;
  buyerEmail: string;
  studentDisplayName: string;
  level: string | null;
  shift: string | null;
  courseName: string | null;
  division: string | null;
  packSummary: string;
  totalCents: number;
  photosTakenAt: string | null;
  photosTakenByUserId: number | null;
  studentNotes: string | null;
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Props = {
  albumId: number;
};

export default function AlbumSchoolOperationsSection({ albumId }: Props) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);
  const [photosTakenFilter, setPhotosTakenFilter] = useState<"all" | "yes" | "no">("all");

  const [orders, setOrders] = useState<OperationOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [noteModalOrderId, setNoteModalOrderId] = useState<number | null>(null);
  const [modalNoteText, setModalNoteText] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [patchingPhotosId, setPatchingPhotosId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [noteHoverPreview, setNoteHoverPreview] = useState<{
    text: string;
    leftPx: number;
    topPx: number;
  } | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    if (photosTakenFilter !== "all") sp.set("photosTaken", photosTakenFilter);
    return sp.toString();
  }, [debouncedQ, photosTakenFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/dashboard/albums/${albumId}/school-operations${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo cargar");
      }
      const list = Array.isArray(data.orders) ? data.orders : [];
      setOrders(list as OperationOrder[]);
      setTotal(typeof data.total === "number" ? data.total : list.length);
      setNotesDraft(() => {
        const next: Record<number, string> = {};
        for (const o of list as OperationOrder[]) {
          next[o.id] = o.studentNotes ?? "";
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [albumId, queryString]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNotes(orderId: number, textOverride?: string) {
    const text = textOverride !== undefined ? textOverride : (notesDraft[orderId] ?? "");
    setSavingId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/school-operations/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNotes: text.trim() ? text : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      }
      const saved = data.studentNotes != null ? String(data.studentNotes) : "";
      setNotesDraft((prev) => ({ ...prev, [orderId]: saved }));
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, studentNotes: data.studentNotes ?? null } : o))
      );
      if (textOverride !== undefined) {
        setNoteModalOrderId(null);
        setModalNoteText("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar nota");
    } finally {
      setSavingId(null);
    }
  }

  async function downloadExport(format: "xlsx" | "pdf") {
    setExporting(format);
    setError(null);
    try {
      const base =
        format === "xlsx"
          ? `/api/dashboard/albums/${albumId}/school-operations/export/xlsx`
          : `/api/dashboard/albums/${albumId}/school-operations/export/pdf`;
      const url = `${base}${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo exportar");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let fname = `operativo-escolar-album-${albumId}.${format}`;
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) fname = m[1];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setExporting(null);
    }
  }

  async function patchOrderPhotosTaken(orderId: number, taken: boolean) {
    setPatchingPhotosId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/school-operations/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photosTaken: taken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo actualizar");
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                photosTakenAt: data.photosTakenAt ?? null,
                photosTakenByUserId: data.photosTakenByUserId ?? null,
              }
            : o
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setPatchingPhotosId(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <Card className="w-full min-w-0 space-y-3 border-[#ebe8e4] p-4 shadow-sm sm:p-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#1a1a1a]">Control de preventa escolar</h2>
          <p className="mt-1 max-w-4xl text-xs leading-snug text-[#6b7280]">
            Un solo buscador para alumno, familia, curso, nivel, turno, división, mail, nota o nombre de pack. Filtrá
            por sesión y exportá con los mismos criterios. Hasta 500 pedidos.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-0 flex-1 basis-[min(100%,18rem)] space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af]">Buscar</span>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej.: Pérez · 3º · mañana · mamá · mail…"
              className="!min-h-0 min-h-9 min-w-0 rounded-lg border-[#e5e7eb] px-3 py-2 text-sm shadow-sm"
            />
          </label>

          <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af]">Sesión</span>
              <select
                value={photosTakenFilter}
                onChange={(e) => setPhotosTakenFilter(e.target.value as "all" | "yes" | "no")}
                className="h-9 min-w-[10.5rem] rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#374151] shadow-sm"
              >
                <option value="all">Todas</option>
                <option value="yes">Ya tomadas</option>
                <option value="no">Falta sesión</option>
              </select>
            </label>
            <Button type="button" variant="secondary" size="sm" onClick={() => load()} disabled={loading}>
              {loading ? "…" : "Refrescar"}
            </Button>
            <span className="pb-2 text-xs tabular-nums text-[#6b7280] sm:pb-0 sm:pl-1">
              {loading ? "…" : `${total} pedido${total === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[#e8eaed] bg-[#fafbfc] p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#1a1a1a]">Exportar lista</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">
              Respeta la búsqueda y el filtro de sesión.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-w-[8.5rem] justify-center"
              disabled={exporting !== null || loading}
              onClick={() => downloadExport("xlsx")}
            >
              {exporting === "xlsx" ? "…" : "Excel"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-w-[8.5rem] justify-center"
              disabled={exporting !== null || loading}
              onClick={() => downloadExport("pdf")}
            >
              {exporting === "pdf" ? "…" : "PDF"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-[#b91c1c]">{error}</p>
        )}
      </Card>

      <Card className="w-full min-w-0 overflow-hidden border-[#e5e7eb] p-0 shadow-sm">
        <div className="ds-table-scroll -mx-1 px-1 sm:mx-0 sm:px-0">
          <table className="min-w-[1120px] w-full text-sm">
            <thead>
              <tr className="bg-[#f9fafb] text-left text-xs text-[#6b7280] uppercase tracking-wide">
                <th className="px-3 py-2 font-medium min-w-[9rem]">Alumno</th>
                <th className="px-3 py-2 font-medium min-w-[4.5rem]">Nivel</th>
                <th className="px-3 py-2 font-medium min-w-[4.5rem]">Turno</th>
                <th className="px-3 py-2 font-medium min-w-[5rem]">Curso</th>
                <th className="px-3 py-2 font-medium min-w-[4rem]">Div.</th>
                <th className="px-3 py-2 font-medium min-w-[11rem]">Quien compró</th>
                <th className="px-3 py-2 font-medium min-w-[12rem]">Qué compró</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap min-w-[7rem]">Sesión</th>
                <th className="px-3 py-2 font-medium min-w-[14rem]">Notas</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap min-w-[9rem]">Acción</th>
              </tr>
            </thead>
            <tbody>
              {!loading && orders.length === 0 && (
                <tr>
                  <DsEmptyTableCell colSpan={10} innerClassName="min-w-[1120px]">
                    No hay pedidos que coincidan. Probá vaciar la búsqueda o usar otras palabras.
                  </DsEmptyTableCell>
                </tr>
              )}
              {loading && orders.length === 0 && (
                <tr>
                  <DsEmptyTableCell colSpan={10} innerClassName="min-w-[1120px]">
                    Cargando pedidos…
                  </DsEmptyTableCell>
                </tr>
              )}
              {orders.map((o) => {
                const taken = Boolean(o.photosTakenAt);
                const hasNote = Boolean((notesDraft[o.id] ?? o.studentNotes ?? "").trim());
                return (
                  <tr key={o.id} className="border-t border-[#e5e7eb] align-top">
                    <td className="px-3 py-2 font-medium text-[#1a1a1a] whitespace-nowrap">{o.studentDisplayName}</td>
                    <td className="px-3 py-2 text-[#374151]">{o.level ?? "—"}</td>
                    <td className="px-3 py-2 text-[#374151]">{o.shift ?? "—"}</td>
                    <td className="px-3 py-2 text-[#374151]">{o.courseName ?? "—"}</td>
                    <td className="px-3 py-2 text-[#374151]">{o.division ?? "—"}</td>
                    <td className="px-3 py-2 text-[#374151] min-w-[11rem]">
                      <div className="font-medium">{o.buyerName ?? "—"}</div>
                      <div className="text-xs text-[#9ca3af] break-all sm:break-words leading-snug mt-0.5">{o.buyerEmail}</div>
                    </td>
                    <td className="px-3 py-2 text-[#374151] min-w-[12rem]">
                      <div className="text-[#1a1a1a] leading-snug">{o.packSummary}</div>
                      <div className="text-xs text-[#9ca3af] tabular-nums mt-0.5">
                        Total:{" "}
                        {(o.totalCents / 100).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {taken ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-900 text-xs font-semibold px-2.5 py-1 border border-emerald-200">
                          Fotos hechas
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-900 text-xs font-semibold px-2.5 py-1 border border-amber-200/80">
                          Falta sesión
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      {hasNote ? (
                        <span
                          className="inline-block"
                          onMouseEnter={(e) => {
                            const text = (notesDraft[o.id] ?? o.studentNotes ?? "").trim();
                            const r = e.currentTarget.getBoundingClientRect();
                            setNoteHoverPreview({
                              text,
                              leftPx: r.right + 8,
                              topPx: e.clientY,
                            });
                          }}
                          onMouseMove={(e) => {
                            const text = (notesDraft[o.id] ?? o.studentNotes ?? "").trim();
                            const r = e.currentTarget.getBoundingClientRect();
                            setNoteHoverPreview({
                              text,
                              leftPx: r.right + 8,
                              topPx: e.clientY,
                            });
                          }}
                          onMouseLeave={() => setNoteHoverPreview(null)}
                        >
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={savingId === o.id}
                            onClick={() => {
                              setNoteHoverPreview(null);
                              setNoteModalOrderId(o.id);
                              setModalNoteText(notesDraft[o.id] ?? o.studentNotes ?? "");
                            }}
                          >
                            Editar nota
                          </Button>
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={savingId === o.id}
                          onClick={() => {
                            setNoteModalOrderId(o.id);
                            setModalNoteText(notesDraft[o.id] ?? o.studentNotes ?? "");
                          }}
                        >
                          Nota
                        </Button>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {!taken ? (
                        <Button
                          type="button"
                          disabled={patchingPhotosId === o.id}
                          onClick={() => patchOrderPhotosTaken(o.id, true)}
                        >
                          {patchingPhotosId === o.id ? "…" : "Marcar fotos hechas"}
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-[#6b7280]">
                            {o.photosTakenAt
                              ? new Date(o.photosTakenAt).toLocaleString("es-AR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : ""}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#6b7280] hover:text-[#b91c1c] text-left"
                            disabled={patchingPhotosId === o.id}
                            onClick={() => patchOrderPhotosTaken(o.id, false)}
                          >
                            Quitar marca
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {noteHoverPreview && (
        <div
          className="pointer-events-none fixed z-[70] max-h-48 max-w-md overflow-y-auto rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-left text-sm leading-relaxed text-[#1a1a1a] shadow-lg whitespace-pre-wrap break-words"
          style={{
            left: noteHoverPreview.leftPx,
            top: noteHoverPreview.topPx,
            transform: "translateY(-50%)",
          }}
          role="tooltip"
        >
          {noteHoverPreview.text}
        </div>
      )}

      {noteModalOrderId != null ? (
        <AppModal
          open
          maxWidthCapRem="80rem"
          size="xl"
          title="Notas del pedido"
          titleId="note-modal-title"
          onClose={() => {
            if (savingId === noteModalOrderId) return;
            setNoteModalOrderId(null);
            setModalNoteText("");
          }}
          closeOnBackdrop={savingId !== noteModalOrderId}
          closeOnEscape={savingId !== noteModalOrderId}
          panelClassName="max-h-[min(92vh,900px)] overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white shadow-xl"
        >
          <div className="min-h-0 flex-1 px-5 pb-8 pt-1 sm:px-8">
          <p className="text-base leading-relaxed text-gray-600 break-words">
            {orders.find((x) => x.id === noteModalOrderId)?.studentDisplayName ?? "Alumno"} ·{" "}
            {orders.find((x) => x.id === noteModalOrderId)?.buyerEmail ?? ""}
          </p>
          <label className="mt-5 block min-w-0">
            <span className="mb-2 block text-sm font-medium text-[#1a1a1a]">Nota interna</span>
            <Textarea
              className="min-h-[10rem] text-sm leading-relaxed shadow-sm focus:ring-1"
              placeholder="Ej.: vino con hermano / repetir toma / retiró la mamá"
              value={modalNoteText}
              onChange={(e) => setModalNoteText(e.target.value)}
              disabled={savingId === noteModalOrderId}
            />
          </label>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={savingId === noteModalOrderId}
              onClick={() => {
                setNoteModalOrderId(null);
                setModalNoteText("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingId === noteModalOrderId}
              onClick={() => void saveNotes(noteModalOrderId, modalNoteText)}
            >
              {savingId === noteModalOrderId ? "Guardando…" : "Guardar nota"}
            </Button>
          </div>
          </div>
        </AppModal>
      ) : null}
    </div>
  );
}
