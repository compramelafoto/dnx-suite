"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DesignEditor from "@/components/design-v2/DesignEditor";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { emptySlotIds, type DesignV2Data, type DesignV2Edit } from "@/lib/design-v2/design-data";
import { DESIGN_STATUS_TONES, designStatusLabel } from "@/lib/design-v2/labels";

type DesignInfo = {
  id: number;
  status: string;
  reviewNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  album: { id: number; title: string } | null;
  orderId: number | null;
  buyer: { name: string | null; email: string | null; student: string | null };
};

type Loaded = { design: DesignInfo; data: DesignV2Data; template: DesignTemplatePayload; photos: DesignPhotoPayload[] };

const SAVE_DELAY_MS = 700;

export default function DesignReviewClient({ designId }: { designId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "pending" | "saving" | "error">("idle");
  const [busy, setBusy] = useState<"approve" | "changes" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const queue = useRef<DesignV2Edit[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/fotografo/disenos/${designId}`, { credentials: "include", cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      setLoadError(body.error || "No se pudo abrir el diseño.");
      return;
    }
    setLoaded({ design: body.design, data: body.data, template: body.template, photos: body.photos });
  }, [designId]);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const edits = queue.current;
    if (edits.length === 0) return true;
    queue.current = [];
    setSaving("saving");
    try {
      const res = await fetch(`/api/fotografo/disenos/${designId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudieron guardar los cambios.");
      setLoaded((prev) => (prev ? { ...prev, design: { ...prev.design, status: body.status ?? prev.design.status } } : prev));
      setSaving(queue.current.length ? "pending" : "idle");
      return true;
    } catch (err) {
      setSaving("error");
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "No se pudieron guardar los cambios." });
      return false;
    }
  }, [designId]);

  function onChange(next: DesignV2Data, edit: DesignV2Edit) {
    setLoaded((prev) => (prev ? { ...prev, data: next } : prev));
    // Los encuadres se mandan en ráfagas: solo importa el último de cada hueco.
    if (edit.kind === "set-crop") {
      queue.current = queue.current.filter((e) => !(e.kind === "set-crop" && e.blockId === edit.blockId));
    }
    queue.current.push(edit.kind === "reset" ? { kind: "reset", slots: [] } : edit);
    setSaving("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (queue.current.length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function approve() {
    if (!loaded) return;
    const empty = emptySlotIds(loaded.data).length;
    if (empty > 0 && !window.confirm(`Hay ${empty} hueco(s) sin foto: van a salir vacíos. ¿Aprobar igual?`)) return;
    setBusy("approve");
    setMessage(null);
    try {
      if (!(await flush())) return;
      const res = await fetch(`/api/fotografo/disenos/${designId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo aprobar.");
      setLoaded((prev) => (prev ? { ...prev, data: body.data, design: { ...prev.design, status: body.status } } : prev));
      setMessage(
        body.status === "EXPORTED"
          ? { tone: "ok", text: "Diseño aprobado. Le avisamos al cliente y ya puede descargarlo." }
          : { tone: "error", text: `Quedó aprobado pero no se pudo generar el archivo: ${body.error}. Probá de nuevo.` },
      );
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "No se pudo aprobar." });
    } finally {
      setBusy(null);
    }
  }

  async function requestChanges() {
    const note = changesNote.trim();
    if (!note) return;
    setBusy("changes");
    setMessage(null);
    try {
      if (!(await flush())) return;
      const res = await fetch(`/api/fotografo/disenos/${designId}/request-changes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo enviar el pedido.");
      setLoaded((prev) =>
        prev ? { ...prev, design: { ...prev.design, status: "NEEDS_ADJUSTMENT", reviewNote: note } } : prev,
      );
      setChangesOpen(false);
      setChangesNote("");
      setMessage({ tone: "ok", text: "Le escribimos al cliente con tu pedido. Cuando te responda, corregí el diseño y aprobalo." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "No se pudo enviar el pedido." });
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!(await flush())) return;
    window.location.href = `/api/fotografo/disenos/${designId}/pdf`;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-5 py-8">
        <Card className="p-6">
          <p className="text-sm text-[#6b7280]">{loadError}</p>
          <Link href="/fotografo/disenos" className="mt-3 inline-block text-sm font-medium text-[#c27b3d] underline">
            Volver a Diseños
          </Link>
        </Card>
      </div>
    );
  }
  if (!loaded) {
    return <div className="mx-auto w-full max-w-screen-xl px-5 py-8 text-sm text-[#6b7280]">Cargando diseño…</div>;
  }

  const { design, data, template, photos } = loaded;
  const who = design.buyer.student || design.buyer.name || design.buyer.email || "Cliente";
  const exported = design.status === "EXPORTED" && data.export;

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-5 py-6 sm:px-8">
      <Link href="/fotografo/disenos" className="text-sm text-[#6b7280] hover:text-[#111827]">
        ← Diseños
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">
            {who} · {template.name}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            {design.album?.title ?? "Álbum"}
            {design.buyer.email ? ` · ${design.buyer.email}` : ""}
            {design.orderId ? ` · Pedido #${design.orderId}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                DESIGN_STATUS_TONES[design.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
              }`}
            >
              {designStatusLabel(design.status)}
            </span>
            <span className="text-xs text-[#9ca3af]">
              {saving === "pending" || saving === "saving"
                ? "Guardando…"
                : saving === "error"
                  ? "Sin guardar"
                  : "Cambios guardados"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void downloadPdf()} disabled={busy !== null}>
            Descargar PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setChangesOpen((v) => !v)} disabled={busy !== null}>
            Pedir cambios al cliente
          </Button>
          <Button variant="primary" size="sm" onClick={() => void approve()} disabled={busy !== null}>
            {busy === "approve"
              ? "Generando archivos…"
              : design.status === "APPROVED_FOR_EXPORT"
                ? "Reintentar generar archivos"
                : exported
                  ? "Aprobar de nuevo"
                  : "Aprobar y enviar al cliente"}
          </Button>
        </div>
      </div>

      {design.status === "NEEDS_ADJUSTMENT" && design.reviewNote ? (
        <Card className="mt-4 border-sky-200 bg-sky-50 p-3">
          <p className="text-sm text-sky-900">
            <span className="font-semibold">Le pediste al cliente:</span> {design.reviewNote}
          </p>
        </Card>
      ) : null}

      {design.status === "APPROVED_FOR_EXPORT" && !message ? (
        <Card className="mt-4 border-rose-200 bg-rose-50 p-3">
          <p className="text-sm text-rose-900">
            Quedó aprobado pero no se pudieron generar los archivos para el cliente
            {data.exportError ? `: ${data.exportError}` : ""}. Tocá “Reintentar generar archivos”.
          </p>
        </Card>
      ) : null}

      {changesOpen ? (
        <Card className="mt-4 p-4">
          <label className="block text-sm font-medium text-[#111827]" htmlFor="changes-note">
            ¿Qué necesitás que haga el cliente?
          </label>
          <p className="mt-1 text-xs text-[#6b7280]">
            Le llega por correo con tu dirección para que te responda. Por ejemplo: “La foto de la tapa salió con
            los ojos cerrados, ¿me elegís otra?”.
          </p>
          <textarea
            id="changes-note"
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-2 w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#c27b3d] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/20"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void requestChanges()} disabled={!changesNote.trim() || busy !== null}>
              {busy === "changes" ? "Enviando…" : "Enviar al cliente"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setChangesOpen(false)} disabled={busy !== null}>
              Cancelar
            </Button>
          </div>
        </Card>
      ) : null}

      {message ? (
        <Card
          className={`mt-4 p-3 ${message.tone === "ok" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
        >
          <p className={`text-sm ${message.tone === "ok" ? "text-emerald-800" : "text-red-700"}`}>{message.text}</p>
        </Card>
      ) : null}

      {exported && data.export ? (
        <Card className="mt-4 p-4">
          <p className="text-sm font-semibold text-[#111827]">Archivos entregados</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {data.export.pdfUrl ? (
              <a href={data.export.pdfUrl} target="_blank" rel="noreferrer" className="font-medium text-[#c27b3d] underline">
                PDF para imprimir
              </a>
            ) : null}
            {data.export.jpgUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="font-medium text-[#c27b3d] underline">
                JPG {template.pageLabels[i]?.trim() || `cara ${i + 1}`}
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-6">
        <DesignEditor template={template} photos={photos} data={data} onChange={onChange} />
      </div>
    </div>
  );
}
