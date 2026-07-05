"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import type {
  AlbumDiagnosticsResult,
  DiagnosticItem,
  DiagnosticSeverity,
} from "@/lib/album-diagnostics-types";
import { formatDiagnosticsForCopy } from "@/lib/album-diagnostics-types";

type Props = {
  albumId: number;
  albumTitle: string;
  publicSlug: string | null;
  open: boolean;
  onClose: () => void;
};

function severityStyles(s: DiagnosticSeverity): string {
  switch (s) {
    case "ok":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "error":
      return "bg-red-50 text-red-800 border-red-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function SeverityBadge({ severity }: { severity: DiagnosticSeverity }) {
  const label =
    severity === "ok"
      ? "OK"
      : severity === "warning"
        ? "Atención"
        : severity === "error"
          ? "Bloqueo"
          : "Info";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${severityStyles(severity)}`}
    >
      {label}
    </span>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

function ItemRow({ item }: { item: DiagnosticItem }) {
  return (
    <div className={`rounded-md border p-2.5 ${severityStyles(item.severity)}`}>
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <p className="text-sm font-medium leading-snug pr-2">{item.title}</p>
        <SeverityBadge severity={item.severity} />
      </div>
      {item.detail && <p className="text-xs mt-1.5 opacity-90 leading-relaxed">{item.detail}</p>}
    </div>
  );
}

function statusBannerClass(status: AlbumDiagnosticsResult["summary"]["status"]): string {
  switch (status) {
    case "READY":
      return "from-emerald-50 to-white border-emerald-200";
    case "READY_WITH_WARNINGS":
      return "from-amber-50 to-white border-amber-200";
    case "SUBALBUM_EVENT_CONTEXT":
      return "from-blue-50 to-white border-blue-200";
    case "BLOCKED":
      return "from-red-50 to-white border-red-200";
    default:
      return "from-slate-50 to-white border-slate-200";
  }
}

export default function AlbumDiagnosticsModal({
  albumId,
  albumTitle,
  publicSlug,
  open,
  onClose,
}: Props) {
  const [data, setData] = useState<AlbumDiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/albums/${albumId}/diagnostics`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Error ${res.status}`);
      }
      const json = (await res.json()) as AlbumDiagnosticsResult;
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Error al cargar diagnóstico");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  function copyAll() {
    if (!data) return;
    const text = formatDiagnosticsForCopy(data);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!open) return null;

  if (typeof document === "undefined") return null;

  const panelWidth: CSSProperties = {
    width: "min(calc(100vw - 2rem), 48rem)",
    maxWidth: "calc(100vw - 2rem)",
  };

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-diagnostics-title"
        className="absolute left-1/2 top-[max(1rem,5vh)] z-[1] flex min-h-0 max-h-[min(90vh,900px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        style={panelWidth}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-4 py-3 border-b bg-gradient-to-r flex flex-wrap items-start justify-between gap-3 ${data ? statusBannerClass(data.summary.status) : "border-gray-200"}`}
        >
          <div className="min-w-0 flex-1">
            <h2 id="album-diagnostics-title" className="text-lg font-semibold text-gray-900">
              Diagnóstico de configuración
            </h2>
            <p className="text-sm text-gray-600">
              #{albumId} · {albumTitle}
              {publicSlug ? ` · /${publicSlug}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={load} disabled={loading}>
              {loading ? "Ejecutando…" : "Re-ejecutar test"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={copyAll} disabled={!data}>
              {copied ? "Copiado" : "Copiar diagnóstico"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && !data && (
            <p className="text-sm text-gray-500">Analizando álbum y reglas del sistema…</p>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {data && (
            <>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  7. Resumen ejecutivo
                </p>
                <p className="text-base font-semibold text-gray-900">{data.summary.headline}</p>
                <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>
                    <span className="font-medium">Listo para vender (checkout estándar):</span>{" "}
                    {data.summary.canSellStandardCheckout ? "Sí" : "No"}
                  </li>
                  <li>
                    <span className="font-medium">Aparece en directorio público de álbumes:</span>{" "}
                    {data.summary.canAppearInPublicDirectory ? "Sí" : "No"}
                  </li>
                  <li>
                    <span className="font-medium">Visitante puede pasar “puerta” pública:</span>{" "}
                    {data.summary.anonymousCanPassPublicGate ? "Sí" : "No"}
                  </li>
                </ul>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Motivos:</span> {data.summary.primaryReasons.join(" · ")}
                </p>
              </div>

              <SectionBlock title={data.sections.general.title}>
                {data.sections.general.items.map((it) => (
                  <ItemRow key={it.id} item={it} />
                ))}
              </SectionBlock>

              <SectionBlock title={data.sections.publication.title}>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">Resultado esperado</p>
                  <p className="text-slate-700 mt-1">{data.sections.publication.expectationLabel}</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    ({data.sections.publication.expectation})
                  </p>
                </div>
                {data.sections.publication.items.map((it) => (
                  <ItemRow key={it.id} item={it} />
                ))}
              </SectionBlock>

              <SectionBlock title={data.sections.commercial.title}>
                {data.sections.commercial.items.map((it) => (
                  <ItemRow key={it.id} item={it} />
                ))}
              </SectionBlock>

              <SectionBlock title={data.sections.terms.title}>
                {data.sections.terms.items.map((it) => (
                  <ItemRow key={it.id} item={it} />
                ))}
              </SectionBlock>

              <SectionBlock title={data.sections.payments.title}>
                {data.sections.payments.items.map((it) => (
                  <ItemRow key={it.id} item={it} />
                ))}
              </SectionBlock>

              <SectionBlock title={data.sections.collaborative.title}>
                {data.sections.collaborative.items.map((it) => (
                  <ItemRow key={it.id} item={it} />
                ))}
              </SectionBlock>

              <div className="flex flex-wrap gap-2">
                {publicSlug && (
                  <a
                    href={`/album/${encodeURIComponent(publicSlug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Ver página pública /album/{publicSlug}
                  </a>
                )}
                <a
                  href={`/admin/usuarios/${data.technicalDetail.owner.id}`}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Usuario dueño (admin)
                </a>
              </div>

              <div>
                <button
                  type="button"
                  className="text-sm text-[#c27b3d] hover:underline"
                  onClick={() => setShowTechnical((v) => !v)}
                >
                  {showTechnical ? "Ocultar detalle técnico" : "Ver detalle técnico (JSON seguro)"}
                </button>
                {showTechnical && (
                  <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto max-h-64">
                    {JSON.stringify(data.technicalDetail, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
