"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AppModal from "@/components/ui/AppModal";
import type { PlatformHealthSnapshot } from "@/lib/admin/platform-health";
import {
  AlertsBanner,
  formatDateTime,
  formatDuration,
  MetricCard,
  MiniBarChart,
  ProgressBar,
  SectionHeader,
  StatusBadge,
  TopList,
} from "@/components/admin/platform-health/PlatformHealthParts";

type ActionId = "cleanup" | "exif" | "zip" | "ftp" | "recalc-stats";

const ACTION_LABELS: Record<ActionId, string> = {
  cleanup: "Ejecutar Cleanup ahora",
  exif: "Ejecutar EXIF ahora",
  zip: "Ejecutar ZIP ahora",
  ftp: "Ejecutar FTP ahora",
  "recalc-stats": "Recalcular estadísticas",
};

export default function PlatformHealthDashboard() {
  const [data, setData] = useState<PlatformHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [pendingAction, setPendingAction] = useState<ActionId | null>(null);
  const [runningAction, setRunningAction] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/platform-health", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo cargar");
      setData(json as PlatformHealthSnapshot);
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  async function runAction(action: ActionId) {
    setRunningAction(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/platform-health/actions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo ejecutar");
      setMessage({ type: "success", text: json.message || "Acción completada." });
      await load();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setRunningAction(false);
      setPendingAction(null);
    }
  }

  const albums = data?.cleanup.albumsByStatus ?? {};

  return (
    <div className="space-y-6 ds-dashboard-inner mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">Salud de la Plataforma</h1>
          <p className="text-gray-600 mt-1 m-0">
            Monitoreo en tiempo real de procesos automáticos críticos.
          </p>
          {data ? (
            <p className="text-xs text-gray-500 mt-2 m-0">
              Actualizado {formatDateTime(data.generatedAt)} · consulta{" "}
              {data.durationMs} ms
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
          <Button
            variant={autoRefresh ? "primary" : "secondary"}
            size="md"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            Auto 30s {autoRefresh ? "ON" : "OFF"}
          </Button>
        </div>
      </div>

      {message ? (
        <Card
          className={`p-4 border-l-4 ${
            message.type === "success" ? "border-emerald-500 bg-emerald-50" : "border-red-500 bg-red-50"
          }`}
        >
          <p className="m-0 text-sm">{message.text}</p>
        </Card>
      ) : null}

      {loading && !data ? (
        <Card className="p-8 text-center text-gray-600">Cargando métricas…</Card>
      ) : null}

      {data ? (
        <>
          <AlertsBanner data={data} />

          {/* Acciones rápidas */}
          <Card className="p-4">
            <SectionHeader title="Acciones rápidas" subtitle="Requieren confirmación" />
            <div className="flex flex-wrap gap-2 mt-4">
              {(Object.keys(ACTION_LABELS) as ActionId[]).map((action) => (
                <Button
                  key={action}
                  variant="secondary"
                  size="md"
                  className="min-h-11"
                  disabled={runningAction}
                  onClick={() => setPendingAction(action)}
                >
                  ▶ {ACTION_LABELS[action]}
                </Button>
              ))}
            </div>
          </Card>

          {/* Limpieza */}
          <section className="space-y-4">
            <SectionHeader
              id="cleanup"
              title="🧹 Limpieza Automática"
              subtitle={`Modo destructivo: ${data.cleanup.config.destructiveDelete ? "activo" : "desactivado"} · dry-run: ${data.cleanup.config.dryRun ? "sí" : "no"}`}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Pendientes"
                value={albums.PENDING ?? 0}
                tone="warn"
                icon="⏳"
                tooltip="Álbumes encolados para purga de storage"
                href={data.links.cleanupAlbums}
              />
              <MetricCard
                label="Procesando"
                value={albums.PROCESSING ?? 0}
                tone="info"
                icon="⚙️"
              />
              <MetricCard
                label="Completados"
                value={albums.COMPLETED ?? 0}
                tone="ok"
                icon="✅"
              />
              <MetricCard
                label="Con referencias"
                value={albums.COMPLETED_WITH_REFERENCES ?? 0}
                tone="neutral"
                icon="🔗"
                tooltip="Purga hecha pero filas conservadas por pedidos o invitaciones"
              />
              <MetricCard
                label="Fallidos"
                value={albums.FAILED ?? 0}
                tone="danger"
                icon="❌"
              />
              <MetricCard
                label="Bloq. impresión"
                value={albums.BLOCKED_PRINT ?? 0}
                tone="warn"
                icon="🖨️"
              />
              <MetricCard
                label="Bloq. referencias"
                value={data.cleanup.blockedByReferences}
                tone="warn"
                icon="🔒"
              />
              <MetricCard
                label="Fotos purgadas"
                value={data.cleanup.photosPurged}
                tone="ok"
                icon="🗑️"
              />
              <MetricCard
                label="Fotos activas"
                value={data.cleanup.photosActive}
                tone="info"
                icon="📷"
              />
              <MetricCard
                label="Última ejecución"
                value={formatDateTime(data.cleanup.lastRunAt)}
                tone="neutral"
                icon="🕐"
              />
              <MetricCard
                label="Tiempo prom."
                value={formatDuration(data.cleanup.avgDurationMs)}
                tone="neutral"
                icon="⏱️"
                tooltip="Promedio últimas 24 h por álbum completado"
              />
            </div>
            <Card className="p-4">
              <ProgressBar
                percent={data.cleanup.progressPercent}
                label="Progreso de limpieza (álbumes completados vs. en cola)"
                tone="amber"
              />
              <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-600">
                {Object.entries(data.cleanup.photosByStorageStatus).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-gray-100 px-2 py-1">
                    {k}: {v.toLocaleString("es-AR")}
                  </span>
                ))}
              </div>
            </Card>
          </section>

          {/* EXIF */}
          <section className="space-y-4">
            <SectionHeader
              id="exif"
              title="📷 Procesamiento EXIF"
              subtitle={
                <Link href={data.links.exifQueue} className="text-[#c27b3d] underline">
                  Ver equipos fotográficos →
                </Link>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard label="Pendientes" value={data.exif.pending} tone="warn" icon="⏳" />
              <MetricCard
                label="Analizadas"
                value={data.exif.byStatus.ANALYZED ?? 0}
                tone="ok"
                icon="✓"
              />
              <MetricCard
                label="Failed"
                value={data.exif.byStatus.FAILED ?? 0}
                tone="danger"
                icon="!"
              />
              <MetricCard
                label="No EXIF"
                value={data.exif.byStatus.NO_EXIF ?? 0}
                tone="neutral"
                icon="—"
              />
              <MetricCard
                label="Skipped vencido"
                value={data.exif.byStatus.SKIPPED_EXPIRED ?? 0}
                tone="info"
                icon="⏭"
              />
              <MetricCard
                label="Velocidad /h"
                value={data.exif.avgPerHour24h ?? "—"}
                tone="info"
                icon="📈"
              />
              <MetricCard
                label="Última ejecución"
                value={formatDateTime(data.exif.lastRunAt)}
                tone="neutral"
                icon="🕐"
              />
            </div>
            <Card className="p-4">
              <ProgressBar percent={data.exif.progressPercent} label="Progreso EXIF global" />
            </Card>
          </section>

          {/* Equipos */}
          <section className="space-y-4">
            <SectionHeader title="🎥 Equipos Fotográficos" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard
                label="Fotos analizadas"
                value={data.equipment.photosAnalyzed}
                tone="ok"
                href={data.links.exifQueue}
              />
              <MetricCard label="Cámaras" value={data.equipment.camerasDetected} tone="info" />
              <MetricCard label="Lentes" value={data.equipment.lensesDetected} tone="info" />
              <MetricCard label="Pendientes" value={data.equipment.pending} tone="warn" />
              <MetricCard
                label="Omitidas vencido"
                value={data.equipment.skippedExpired}
                tone="neutral"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TopList title="Top 10 cámaras" items={data.equipment.topCameras} />
              <TopList title="Top 10 lentes" items={data.equipment.topLenses} />
            </div>
          </section>

          {/* FTP */}
          <section className="space-y-4">
            <SectionHeader
              id="ftp"
              title="📡 FTP / Cámara"
              subtitle={
                <Link href={data.links.ftpIngest} className="text-[#c27b3d] underline">
                  Procesamiento fotos →
                </Link>
              }
            />
            <Card className="p-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-700">Estado del worker:</span>
              <StatusBadge status={data.ftp.workerStatus} />
              <span className="text-xs text-gray-500">
                Heartbeat: {formatDateTime(data.ftp.lastHeartbeatAt)}
              </span>
            </Card>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Conexiones activas"
                value={data.ftp.enabledConnections}
                tone="info"
              />
              <MetricCard label="Recibidas hoy" value={data.ftp.receivedToday} tone="neutral" />
              <MetricCard label="Procesadas hoy" value={data.ftp.processedToday} tone="ok" />
              <MetricCard label="Rechazadas hoy" value={data.ftp.rejectedToday} tone="warn" />
              <MetricCard label="Errores hoy" value={data.ftp.errorsToday} tone="danger" />
              <MetricCard label="Cola pendiente" value={data.ftp.queuePending} tone="warn" />
              <MetricCard label="En proceso" value={data.ftp.queueProcessing} tone="info" />
              <MetricCard label="Cola fallida" value={data.ftp.queueFailed} tone="danger" />
            </div>
          </section>

          {/* ZIP */}
          <section className="space-y-4">
            <SectionHeader id="zip" title="📦 ZIP" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Pendientes" value={data.zip.byStatus.PENDING ?? 0} tone="warn" />
              <MetricCard
                label="Procesando"
                value={data.zip.byStatus.PROCESSING ?? 0}
                tone="info"
              />
              <MetricCard
                label="Completados"
                value={data.zip.byStatus.COMPLETED ?? 0}
                tone="ok"
              />
              <MetricCard label="Fallidos" value={data.zip.byStatus.FAILED ?? 0} tone="danger" />
              <MetricCard
                label="Tiempo prom."
                value={formatDuration(data.zip.avgDurationMs)}
                tone="neutral"
              />
              <MetricCard label="Trabados >1h" value={data.zip.stuckOver1h} tone="danger" />
            </div>
          </section>

          {/* IA */}
          <section className="space-y-4">
            <SectionHeader
              title="🤖 OCR / IA"
              subtitle={
                <Link href={data.links.aiPanel} className="text-[#c27b3d] underline">
                  Panel IA →
                </Link>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="OCR completados" value={data.ai.ocrCompleted} tone="ok" />
              <MetricCard label="OCR pendientes" value={data.ai.ocrPending} tone="warn" />
              <MetricCard label="OCR fallidos" value={data.ai.ocrFailed} tone="danger" />
              <MetricCard
                label="Rostros pendientes"
                value={data.ai.facesPending}
                tone="warn"
              />
              <MetricCard
                label="Rostros completados"
                value={data.ai.facesCompleted}
                tone="ok"
              />
              <MetricCard
                label="Embeddings pend."
                value={data.ai.embeddingsPending}
                tone="warn"
              />
              <MetricCard
                label="Embeddings (rostros idx.)"
                value={data.ai.embeddingsCompleted}
                tone="info"
                tooltip="Total de rostros indexados en Rekognition (proxy)"
              />
            </div>
          </section>

          {/* Storage */}
          <section className="space-y-4">
            <SectionHeader
              title="💾 Storage"
              subtitle={
                <Link href={data.links.r2Storage} className="text-[#c27b3d] underline">
                  Explorador R2 →
                </Link>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Fotos totales (hist.)"
                value={data.storage.photosTotalHistorical}
                tone="neutral"
              />
              <MetricCard label="Fotos activas" value={data.storage.photosActive} tone="info" />
              <MetricCard label="Fotos purgadas" value={data.storage.photosPurged} tone="ok" />
              <MetricCard
                label="Eliminadas (est.)"
                value={data.storage.photosDeletedEstimate}
                tone="neutral"
              />
              <MetricCard
                label="Storage liberado"
                value={`${data.storage.storageFreedGb} GB`}
                tone="ok"
                tooltip="Estimado ~4.5 MB/foto purgada"
              />
              <MetricCard
                label="Storage ocupado (est.)"
                value={`${data.storage.storageOccupiedEstimateGb} GB`}
                tone="info"
              />
              <MetricCard
                label="Archivo faltante"
                value={data.storage.missingFilePhotos}
                tone="danger"
              />
              <MetricCard label="Huérfanas" value={data.storage.orphanPhotos} tone="warn" />
            </div>
          </section>

          {/* Gráficos */}
          <section className="space-y-4">
            <SectionHeader title="📊 Tendencias (30 días)" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <MiniBarChart
                title="Álbumes limpiados / día"
                series={data.charts.albumsCleanedPerDay}
                color="#c27b3d"
              />
              <MiniBarChart
                title="Fotos purgadas / día"
                series={data.charts.photosPurgedPerDay}
                color="#1e3a5f"
              />
              <MiniBarChart
                title="Fotos subidas / día"
                series={data.charts.photosUploadedPerDay}
                color="#059669"
              />
              <MiniBarChart
                title="EXIF procesado / día"
                series={data.charts.exifProcessedPerDay}
                color="#2563eb"
              />
              <MiniBarChart
                title="Errores / día"
                series={data.charts.errorsPerDay}
                color="#dc2626"
              />
            </div>
          </section>
        </>
      ) : null}

      <AppModal
        open={pendingAction != null}
        onClose={() => !runningAction && setPendingAction(null)}
        title="Confirmar acción"
        size="sm"
      >
        <p className="text-sm text-gray-700 m-0">
          ¿Ejecutar <strong>{pendingAction ? ACTION_LABELS[pendingAction] : ""}</strong> ahora?
          Esta operación puede tardar varios minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mt-6">
          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto min-h-11"
            disabled={runningAction || !pendingAction}
            onClick={() => pendingAction && void runAction(pendingAction)}
          >
            {runningAction ? "Ejecutando…" : "Confirmar"}
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="w-full sm:w-auto min-h-11"
            disabled={runningAction}
            onClick={() => setPendingAction(null)}
          >
            Cancelar
          </Button>
        </div>
      </AppModal>
    </div>
  );
}
