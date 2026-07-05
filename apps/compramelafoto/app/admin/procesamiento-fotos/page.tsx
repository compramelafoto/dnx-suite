"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { PhotoProcessingDashboardSnapshot } from "@/lib/admin/photo-processing-status";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR");
  } catch {
    return iso;
  }
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "warn" | "info" | "ok" | "danger";
}) {
  const tones = {
    neutral: "text-gray-900",
    warn: "text-amber-700",
    info: "text-blue-700",
    ok: "text-emerald-700",
    danger: "text-red-700",
  };
  return (
    <Card className="p-4 min-w-0">
      <p className="text-sm text-gray-600 m-0">{label}</p>
      <p className={`text-2xl font-bold mt-1 m-0 ${tones[tone]}`}>{value.toLocaleString("es-AR")}</p>
    </Card>
  );
}

function ProgressBar({ percent, tone = "blue" }: { percent: number; tone?: "blue" | "emerald" }) {
  const bar = tone === "emerald" ? "bg-emerald-600" : "bg-blue-600";
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
      <div
        className={`${bar} h-2.5 rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export default function AdminPhotoProcessingPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<PhotoProcessingDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningIngest, setRunningIngest] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/photo-processing/status", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cargar el estado");
      }
      setSnapshot(data as PhotoProcessingDashboardSnapshot);
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Error de conexión";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void loadStatus();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, loadStatus]);

  async function handleRunIngest(drain = false) {
    setRunningIngest(true);
    setMessage(null);
    try {
      const url = drain
        ? "/api/admin/photo-processing/run-ingest?mode=drain"
        : "/api/admin/photo-processing/run-ingest";
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo procesar la cola");
      }
      setMessage({
        type: "success",
        text: data.message || "Lote de ingesta ejecutado.",
      });
      await loadStatus();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setRunningIngest(false);
    }
  }

  const ingest = snapshot?.ingest;
  const analysis = snapshot?.analysis;
  const ingestActive = (ingest?.backlogTotal ?? 0) > 0;
  const ingestCompleted = ingest?.byStatus.COMPLETED ?? 0;
  const ingestTotal =
    (ingest?.byStatus.PENDING ?? 0) +
    (ingest?.byStatus.PROCESSING ?? 0) +
    (ingest?.byStatus.COMPLETED ?? 0) +
    (ingest?.byStatus.FAILED ?? 0);
  const ingestProgress =
    ingestTotal > 0 ? Math.round((ingestCompleted / ingestTotal) * 100) : 100;

  return (
    <div className="space-y-6 ds-dashboard-inner mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 m-0">Procesamiento de fotos</h1>
          <p className="text-gray-600 mt-1 m-0">
            Cola de subida (ingesta) y análisis IA (OCR / reconocimiento facial).
          </p>
          {snapshot?.generatedAt ? (
            <p className="text-xs text-gray-500 mt-2 m-0">
              Actualizado: {formatDateTime(snapshot.generatedAt)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 min-h-11 px-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh (10s)
          </label>
          <Button variant="secondary" size="md" onClick={() => void loadStatus()} disabled={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      {message ? (
        <Card
          className={`p-4 border-l-4 ${
            message.type === "success"
              ? "border-green-500 bg-green-50"
              : message.type === "error"
                ? "border-red-500 bg-red-50"
                : "border-blue-500 bg-blue-50"
          }`}
        >
          <p
            className={`text-sm m-0 ${
              message.type === "success"
                ? "text-green-800"
                : message.type === "error"
                  ? "text-red-800"
                  : "text-blue-800"
            }`}
          >
            {message.text}
          </p>
        </Card>
      ) : null}

      {snapshot?.config.asyncIngestServer || snapshot?.config.asyncIngestClient ? (
        <Card className="p-4 border-l-4 border-sky-500 bg-sky-50">
          <p className="text-sm text-sky-900 m-0">
            <strong>Ingesta async activa</strong> (servidor:{" "}
            {snapshot.config.asyncIngestServer ? "sí" : "no"}, cliente:{" "}
            {snapshot.config.asyncIngestClient ? "sí" : "no"}). Las subidas encolan{" "}
            <code className="text-xs">CameraIngestJob</code> hasta que el cron o el worker las
            procesen.
          </p>
        </Card>
      ) : null}

      {ingestActive ? (
        <Card className="p-4 border-l-4 border-amber-500 bg-amber-50">
          <p className="text-sm text-amber-900 m-0">
            Hay <strong>{ingest?.backlogTotal.toLocaleString("es-AR")}</strong> foto(s) en cola de
            ingesta. Los fotógrafos pueden ver &quot;Procesando…&quot; hasta que terminen.
            {ingest?.oldestPending ? (
              <>
                {" "}
                La más antigua lleva <strong>{ingest.oldestPending.waitMinutes} min</strong> (
                {ingest.oldestPending.albumTitle}).
              </>
            ) : null}
          </p>
        </Card>
      ) : null}

      {ingest && ingest.stalledProcessing > 0 ? (
        <Card className="p-4 border-l-4 border-red-500 bg-red-50">
          <p className="text-sm text-red-900 m-0">
            <strong>{ingest.stalledProcessing}</strong> trabajo(s) en PROCESSING con lock vencido
            (&gt;30 min). Revisá el worker o ejecutá un lote manual.
          </p>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 m-0">1. Ingesta de subida</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">
              Raw en R2 → miniatura + registro <code className="text-xs">Photo</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleRunIngest(true)}
              disabled={runningIngest || loading}
            >
              {runningIngest ? "Drenando cola…" : "Drenar cola (hasta 4 min)"}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void handleRunIngest(false)}
              disabled={runningIngest || loading}
            >
              Un lote
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusPill label="Pendientes" value={ingest?.byStatus.PENDING ?? 0} tone="warn" />
          <StatusPill label="Procesando" value={ingest?.byStatus.PROCESSING ?? 0} tone="info" />
          <StatusPill label="Completadas" value={ingest?.byStatus.COMPLETED ?? 0} tone="ok" />
          <StatusPill label="Fallidas" value={ingest?.byStatus.FAILED ?? 0} tone="danger" />
        </div>

        <Card className="p-4">
          <p className="text-sm text-gray-600 m-0">Progreso global de ingesta</p>
          <p className="text-xl font-semibold text-gray-900 m-0 mt-1">{ingestProgress}% completadas</p>
          <ProgressBar percent={ingestProgress} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            {Object.entries(ingest?.bySource ?? {}).map(([source, count]) => (
              <span key={source}>
                {source}: {count.toLocaleString("es-AR")}
              </span>
            ))}
          </div>
        </Card>

        {ingest && ingest.albumBacklog.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 m-0">Álbumes con cola activa</h3>
            </div>
            <div className="ds-table-scroll overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Álbum</th>
                    <th className="px-4 py-3 font-medium">Fotógrafo</th>
                    <th className="px-4 py-3 font-medium">Pend.</th>
                    <th className="px-4 py-3 font-medium">Proc.</th>
                    <th className="px-4 py-3 font-medium">Fall.</th>
                    <th className="px-4 py-3 font-medium">Más antiguo</th>
                  </tr>
                </thead>
                <tbody>
                  {ingest.albumBacklog.map((row) => (
                    <tr key={row.albumId} className="border-t border-gray-100">
                      <td className="px-4 py-3 min-w-[12rem]">
                        <div className="font-medium text-gray-900">{row.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">ID {row.albumId}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.photographerName ?? "—"}</td>
                      <td className="px-4 py-3 text-amber-700 font-medium">{row.pending}</td>
                      <td className="px-4 py-3 text-blue-700 font-medium">{row.processing}</td>
                      <td className="px-4 py-3 text-red-700 font-medium">{row.failed}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateTime(row.oldestPendingAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {ingest && ingest.recentFailed.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 m-0">Últimas ingesta fallidas</h3>
            </div>
            <div className="ds-table-scroll overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Álbum</th>
                    <th className="px-4 py-3 font-medium">Archivo</th>
                    <th className="px-4 py-3 font-medium">Intentos</th>
                    <th className="px-4 py-3 font-medium">Error</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {ingest.recentFailed.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{row.albumTitle}</div>
                        <div className="text-xs text-gray-500">{row.source}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[10rem] truncate">
                        {row.originalFilename ?? row.id}
                      </td>
                      <td className="px-4 py-3">{row.attempts}</td>
                      <td className="px-4 py-3 text-red-700 max-w-md break-words">
                        {row.lastError ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateTime(row.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 m-0">2. Análisis IA</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">
              OCR y caras para búsqueda / álbumes ocultos
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={() => router.push("/admin/ia")}
          >
            Panel IA completo
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusPill label="Fotos totales" value={analysis?.totalPhotos ?? 0} tone="neutral" />
          <StatusPill
            label="Análisis pendiente"
            value={analysis?.jobsByStatus.PENDING ?? 0}
            tone="warn"
          />
          <StatusPill
            label="Análisis procesando"
            value={analysis?.jobsByStatus.PROCESSING ?? 0}
            tone="info"
          />
          <StatusPill label="Análisis con error" value={analysis?.jobsByStatus.ERROR ?? 0} tone="danger" />
        </div>

        <Card className="p-4">
          <p className="text-sm text-gray-600 m-0">Fotos con análisis completado</p>
          <p className="text-xl font-semibold text-gray-900 m-0 mt-1">
            {analysis?.progressPercent ?? 0}%
          </p>
          <ProgressBar percent={analysis?.progressPercent ?? 0} tone="emerald" />
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
            <span>PENDING: {analysis?.photosByStatus.PENDING ?? 0}</span>
            <span>PROCESSING: {analysis?.photosByStatus.PROCESSING ?? 0}</span>
            <span>DONE: {analysis?.photosByStatus.DONE ?? 0}</span>
            <span>ERROR: {analysis?.photosByStatus.ERROR ?? 0}</span>
          </div>
          {(analysis?.photosWithoutJob ?? 0) > 0 ? (
            <p className="text-sm text-amber-800 mt-3 m-0">
              {analysis?.photosWithoutJob} foto(s) sin job de análisis asociado.
            </p>
          ) : null}
        </Card>
      </section>

      {loading && !snapshot ? (
        <p className="text-sm text-gray-500">Cargando estado…</p>
      ) : null}
    </div>
  );
}
