"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsEmptyTableCell } from "@/components/ui/DsEmptyTableCell";
import EquipmentDetailModal from "@/components/admin/photographic-equipment/EquipmentDetailModal";
import type {
  PhotographicEquipmentBodyListItem,
  PhotographicEquipmentEquipmentDetail,
  PhotographicEquipmentSummary,
} from "@/lib/photographic-equipment/admin-queries";

const DEVICE_TYPE_LABELS: Record<string, string> = {
  CAMERA: "Cámara",
  PHONE: "Celular",
  DRONE: "Drone",
  UNKNOWN: "Desconocido",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function TextSummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "info" | "warn" | "ok" | "danger";
}) {
  const tones = {
    neutral: "text-gray-900",
    info: "text-blue-700",
    warn: "text-amber-700",
    ok: "text-emerald-700",
    danger: "text-red-700",
  };
  return (
    <Card className="p-4 min-w-0">
      <p className="text-sm text-gray-600 m-0">{label}</p>
      <p className={`text-lg font-bold mt-1 m-0 leading-snug ${tones[tone]}`}>{value}</p>
    </Card>
  );
}
function SummaryCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "info" | "warn" | "ok" | "danger";
  hint?: string;
}) {
  const tones = {
    neutral: "text-gray-900",
    info: "text-blue-700",
    warn: "text-amber-700",
    ok: "text-emerald-700",
    danger: "text-red-700",
  };
  return (
    <Card className="p-4 min-w-0">
      <p className="text-sm text-gray-600 m-0">{label}</p>
      <p className={`text-2xl font-bold mt-1 m-0 ${tones[tone]}`}>
        {value.toLocaleString("es-AR")}
      </p>
      {hint ? <p className="text-xs text-gray-500 mt-1 m-0">{hint}</p> : null}
    </Card>
  );
}

function DeviceTypeBadge({ deviceType }: { deviceType: string }) {
  const styles: Record<string, string> = {
    CAMERA: "bg-indigo-100 text-indigo-800",
    PHONE: "bg-sky-100 text-sky-800",
    DRONE: "bg-violet-100 text-violet-800",
    UNKNOWN: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[deviceType] ?? styles.UNKNOWN}`}
    >
      {DEVICE_TYPE_LABELS[deviceType] ?? deviceType}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-emerald-100 text-emerald-800",
    MEDIUM: "bg-amber-100 text-amber-800",
    LOW: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[confidence] ?? styles.LOW}`}
    >
      {CONFIDENCE_LABELS[confidence] ?? confidence}
    </span>
  );
}

export default function AdminEquiposFotograficosPage() {
  const [summary, setSummary] = useState<PhotographicEquipmentSummary | null>(null);
  const [bodies, setBodies] = useState<PhotographicEquipmentBodyListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<PhotographicEquipmentEquipmentDetail | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [runningScan, setRunningScan] = useState(false);
  const [releasingLock, setReleasingLock] = useState(false);
  const [scanMessage, setScanMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "30");
      if (search) params.set("search", search);

      const [summaryRes, bodiesRes] = await Promise.all([
        fetch("/api/admin/photographic-equipment/summary", { credentials: "include" }),
        fetch(`/api/admin/photographic-equipment/bodies?${params}`, { credentials: "include" }),
      ]);

      if (!summaryRes.ok || !bodiesRes.ok) {
        throw new Error("No se pudieron cargar los datos");
      }

      setSummary((await summaryRes.json()) as PhotographicEquipmentSummary);
      const bodiesData = await bodiesRes.json();
      setBodies(bodiesData.bodies ?? []);
      setPagination(bodiesData.pagination ?? { page: 1, pageSize: 30, total: 0, totalPages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function openEquipmentDetail(item: PhotographicEquipmentBodyListItem) {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedDetail(null);
    try {
      const sourceQuery = item.source === "legacy" ? "?source=legacy" : "";
      const res = await fetch(
        `/api/admin/photographic-equipment/bodies/${item.id}${sourceQuery}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("No se pudo cargar el detalle");
      setSelectedDetail((await res.json()) as PhotographicEquipmentEquipmentDetail);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelectedDetail(null);
  }

  async function handleRunScan(mode: "now" | "multi" = "now") {
    setRunningScan(true);
    setScanMessage(null);
    try {
      const url =
        mode === "multi"
          ? "/api/admin/photographic-equipment/jobs/run?mode=multi"
          : "/api/admin/photographic-equipment/jobs/run?mode=now";
      const res = await fetch(url, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          [data?.error, data?.detail, data?.message].filter(Boolean).join(" — ") ||
            "No se pudo ejecutar el escaneo"
        );
      }
      if (data.ok === false) {
        setScanMessage({
          type: "info",
          text: data.message || "El escaneo no pudo iniciarse.",
        });
        return;
      }
      const multiDetail =
        mode === "multi" && Array.isArray(data.messages) && data.messages.length > 0
          ? ` ${data.messages.join(" · ")}`
          : "";
      setScanMessage({
        type: data.skipped && mode === "now" ? "info" : "success",
        text: (data.message || "Lote ejecutado.") + multiDetail,
      });
      await loadData();
    } catch (err: unknown) {
      setScanMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setRunningScan(false);
    }
  }

  async function handleReleaseLock() {
    setReleasingLock(true);
    setScanMessage(null);
    try {
      const res = await fetch("/api/admin/photographic-equipment/jobs/release-lock", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo liberar el bloqueo");
      setScanMessage({
        type: "success",
        text: data.message || "Bloqueo liberado. Ya podés procesar un lote.",
      });
      await loadData();
    } catch (err: unknown) {
      setScanMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setReleasingLock(false);
    }
  }

  const scan = summary?.scan;
  const isBackfillMode = scan?.mode === "BACKFILL" && !scan?.isBackfillComplete;
  const showDailyPendingAlert =
    scan?.mode === "DAILY" && (summary?.photos.pending ?? 0) > 0 && !scan?.inWindow;

  return (
    <div className="space-y-6 ds-dashboard-inner mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 m-0">Equipos fotográficos</h1>
          <p className="text-gray-600 mt-1 m-0">
            Bodies, lentes y combinaciones detectadas por EXIF. Cámara y lente son equipos físicos
            distintos.
          </p>
          {summary?.generatedAt ? (
            <p className="text-xs text-gray-500 mt-2 m-0">
              Actualizado: {formatDateTime(summary.generatedAt)}
              {summary.scan.enabled ? (
                <span className="ml-2">
                  · Modo {summary.scan.mode}
                  {summary.scan.mode === "DAILY" ? (
                    <>
                      {" "}
                      · Ventana nocturna{" "}
                      {summary.scan.inWindow ? "activa (02:00–05:00 AR)" : "inactiva"}
                    </>
                  ) : (
                    <> · Backfill histórico en curso</>
                  )}
                </span>
              ) : (
                <span className="ml-2 text-amber-700">
                  · Cron deshabilitado (EXIF_DEVICE_SCAN_ENABLED)
                </span>
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={runningScan}
            onClick={() => void handleRunScan("now")}
          >
            {runningScan ? "Procesando…" : "Procesar ahora"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={runningScan}
            onClick={() => void handleRunScan("multi")}
          >
            Procesar varios lotes
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={releasingLock || runningScan}
            onClick={() => void handleReleaseLock()}
          >
            {releasingLock ? "Liberando…" : "Liberar bloqueo"}
          </Button>
        </div>
      </div>

      {scanMessage ? (
        <Card
          className={`p-4 min-w-0 ${
            scanMessage.type === "error"
              ? "border-red-200 bg-red-50"
              : scanMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
          }`}
        >
          <p className="text-sm m-0">{scanMessage.text}</p>
        </Card>
      ) : null}

      {isBackfillMode ? (
        <Card className="p-4 min-w-0 border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-900 m-0">
            Se está escaneando el histórico de fotos. El proceso continuará por lotes hasta llegar a
            cero pendientes. El cron corre cada 10 minutos sin restricción horaria.
          </p>
        </Card>
      ) : scan?.isBackfillComplete ? (
        <Card className="p-4 min-w-0 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900 m-0">
            <strong>Backfill completo.</strong> El escaneo histórico ya terminó. Ahora se procesan
            fotos nuevas todos los días entre las 02:00 y las 05:00 (hora Argentina).
            {scan.lastCompletedAt ? (
              <> Completado: {formatDateTime(scan.lastCompletedAt)}.</>
            ) : null}
          </p>
        </Card>
      ) : null}

      {showDailyPendingAlert ? (
        <Card className="p-4 min-w-0 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900 m-0">
            Hay {(summary?.photos.pending ?? 0).toLocaleString("es-AR")} fotos pendientes que se
            procesarán en la próxima ventana nocturna (02:00–05:00 AR).
          </p>
        </Card>
      ) : null}

      <div>
        <h2 className="text-sm font-semibold text-gray-900 m-0 mb-3">Estado del escaneo EXIF</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Fotos pendientes de análisis"
            value={summary?.photos.pending ?? 0}
            tone="warn"
          />
          <TextSummaryCard
            label="Backfill histórico"
            value={scan?.isBackfillComplete ? "Completo" : "En progreso"}
            tone={scan?.isBackfillComplete ? "ok" : "info"}
          />
          <TextSummaryCard
            label="Modo actual"
            value={scan?.mode ?? "—"}
            tone={scan?.mode === "BACKFILL" ? "info" : "neutral"}
          />
          <TextSummaryCard
            label="Última ejecución"
            value={scan?.lastRunAt ? formatDateTime(scan.lastRunAt) : "—"}
          />
          <SummaryCard
            label="Último lote procesado"
            value={scan?.lastBatchProcessed ?? 0}
            hint={
              scan?.lastBatchAt
                ? `${scan.lastBatchAnalyzed} con equipo · ${formatDateTime(scan.lastBatchAt)}`
                : undefined
            }
          />
          <SummaryCard label="Fotos analizadas" value={summary?.photos.analyzed ?? 0} tone="ok" />
          <SummaryCard label="Sin EXIF" value={summary?.photos.noExif ?? 0} />
          <SummaryCard label="Fallidas" value={summary?.photos.failed ?? 0} tone="danger" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 m-0 mb-3">Equipos detectados</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SummaryCard label="Cámaras únicas (bodies)" value={summary?.gear.uniqueBodies ?? 0} tone="info" />
          <SummaryCard label="Lentes únicos" value={summary?.gear.uniqueLenses ?? 0} tone="info" />
          <SummaryCard
            label="Combinaciones body+lente"
            value={summary?.gear.combinations ?? 0}
            tone="info"
          />
          <SummaryCard
            label="Equipos físicos"
            value={summary?.gear.physicalEquipment ?? 0}
            hint="Bodies + lentes"
          />
          <SummaryCard label="Observaciones" value={summary?.photos.observations ?? 0} tone="ok" />
          <SummaryCard
            label="Omitidas (vencidas)"
            value={summary?.photos.skippedExpired ?? 0}
            tone="warn"
          />
          <SummaryCard
            label="Shutter count disponible"
            value={summary?.gear.bodiesWithShutterCount ?? 0}
            hint="Cámaras con máximo registrado"
          />
        </div>
      </div>

      <Card className="p-4 min-w-0">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row gap-3 mb-4"
        >
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Buscar fotógrafo, marca, modelo o serie
            </label>
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ej: Canon, fotografo@email.com"
              className="w-full"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Button type="submit" variant="primary" size="md">
              Buscar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              Limpiar
            </Button>
          </div>
        </form>

        <div className="ds-table-scroll overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="py-2 pr-3 font-medium">Fotógrafo</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Equipo (body)</th>
                <th className="py-2 pr-3 font-medium">Serie</th>
                <th className="py-2 pr-3 font-medium">Lente principal</th>
                <th className="py-2 pr-3 font-medium">Fotos</th>
                <th className="py-2 pr-3 font-medium">Confianza</th>
                <th className="py-2 pr-3 font-medium">Último uso</th>
                <th className="py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <DsEmptyTableCell colSpan={9}>Cargando equipos…</DsEmptyTableCell>
                </tr>
              ) : bodies.length === 0 ? (
                <tr>
                  <DsEmptyTableCell colSpan={9}>
                    No hay equipos detectados con los filtros actuales.
                  </DsEmptyTableCell>
                </tr>
              ) : (
                bodies.map((item) => (
                  <tr key={`${item.source}-${item.id}`} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="py-3 pr-3 align-top min-w-[10rem]">
                      <div className="font-medium text-gray-900">
                        {item.photographer.name || item.photographer.email}
                      </div>
                      {item.photographer.name ? (
                        <div className="text-xs text-gray-500">{item.photographer.email}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <DeviceTypeBadge deviceType={item.deviceType} />
                    </td>
                    <td className="py-3 pr-3 align-top font-medium text-gray-900">
                      {item.equipmentLabel}
                    </td>
                    <td className="py-3 pr-3 align-top text-gray-600">
                      {item.serialNumber?.trim() ? item.serialNumber : "—"}
                    </td>
                    <td className="py-3 pr-3 align-top text-gray-600 max-w-[12rem] truncate" title={item.primaryLensLabel ?? undefined}>
                      {item.primaryLensLabel ?? "—"}
                    </td>
                    <td className="py-3 pr-3 align-top">{item.photosCount.toLocaleString("es-AR")}</td>
                    <td className="py-3 pr-3 align-top">
                      <ConfidenceBadge confidence={String(item.confidence)} />
                    </td>
                    <td className="py-3 pr-3 align-top whitespace-nowrap text-gray-600">
                      {formatDateTime(item.lastSeenAt)}
                    </td>
                    <td className="py-3 align-top">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => void openEquipmentDetail(item)}
                      >
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600 m-0">
              {pagination.total.toLocaleString("es-AR")} equipos · página {pagination.page} de{" "}
              {pagination.totalPages}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <EquipmentDetailModal
        open={detailOpen}
        onClose={closeDetail}
        loading={detailLoading}
        detail={selectedDetail}
      />
    </div>
  );
}
