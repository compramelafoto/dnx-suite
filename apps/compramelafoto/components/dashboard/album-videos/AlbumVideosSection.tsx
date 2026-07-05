"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import EventFolderAlbumTreePicker from "@/components/dashboard/EventFolderAlbumTreePicker";
import AlbumVideoEditModal from "@/components/dashboard/album-videos/AlbumVideoEditModal";
import { formatARS } from "@/lib/lab/helpers";
import { isVideoMvpEnabledClient } from "@/lib/videos/video-feature-flag";
import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABELS,
  VIDEO_DEFAULT_PRICE_CENTS,
  VIDEO_MIN_PRICE_CENTS_BY_CATEGORY,
  type VideoCategoryId,
} from "@/lib/videos/video-validation";
import type { VideoAssetDto } from "@/lib/videos/video-dto";
import type { VideoProcessingStatus } from "@/lib/prisma";
import {
  formatQueueStatusLabel,
  formatVideoFileSize,
  newUploadQueueItem,
  partitionVideoFilesForUpload,
  queueCategoryLabel,
  titleFromFilename,
  uploadFileWithProgress,
  VIDEO_PROCESSING_POLL_MS,
  VIDEO_UPLOAD_KEEP_TAB_NOTICE,
  videoNeedsProcessingPoll,
  type BatchUploadDefaults,
  type UploadQueueItem,
  type UploadQueueStatus,
} from "@/lib/videos/video-upload-ui";
import { AlertTriangle, Film, Loader2, Pencil, RotateCcw, Trash2, X } from "lucide-react";

type Props = {
  albumId: number;
  mpConnected: boolean | null;
  eventId?: number | null;
};

const PROCESSING_LABELS: Record<VideoProcessingStatus, string> = {
  PENDING: "Pendiente",
  UPLOADED: "Pendiente de procesamiento",
  PROCESSING: "Procesando",
  READY: "Listo",
  FAILED: "Error",
  EXPIRED: "Expirado",
};

const PROCESSING_BADGE_CLASS: Record<VideoProcessingStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  UPLOADED: "bg-blue-50 text-blue-800",
  PROCESSING: "bg-amber-50 text-amber-800",
  READY: "bg-green-50 text-green-800",
  FAILED: "bg-red-50 text-red-800",
  EXPIRED: "bg-gray-200 text-gray-600",
};

const QUEUE_BADGE_CLASS: Record<UploadQueueStatus, string> = {
  queued: "bg-gray-100 text-gray-700",
  uploading: "bg-amber-50 text-amber-800",
  completing: "bg-blue-50 text-blue-800",
  pending_processing: "bg-blue-50 text-blue-800",
  error: "bg-red-50 text-red-800",
};

function centsToPesosInput(cents: number): string {
  return String(Math.round(cents / 100));
}

function pesosInputToCents(pesos: string): number {
  const n = Number(pesos.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return VIDEO_DEFAULT_PRICE_CENTS;
  return Math.round(n * 100);
}

function defaultPriceForCategory(category: VideoCategoryId): number {
  return Math.max(
    VIDEO_DEFAULT_PRICE_CENTS,
    VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[category]
  );
}

function ProcessingBadge({ status }: { status: VideoProcessingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${PROCESSING_BADGE_CLASS[status]}`}
    >
      {PROCESSING_LABELS[status]}
    </span>
  );
}

function QueueBadge({
  status,
  progressPercent,
}: {
  status: UploadQueueStatus;
  progressPercent: number | null;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${QUEUE_BADGE_CLASS[status]}`}
    >
      {formatQueueStatusLabel(status, progressPercent)}
    </span>
  );
}

function QueueProgressBar({
  status,
  progressPercent,
}: {
  status: UploadQueueStatus;
  progressPercent: number | null;
}) {
  const showBar = status === "uploading" || status === "completing";
  if (!showBar) return null;

  const indeterminate = progressPercent == null;
  const width =
    progressPercent != null ? `${Math.min(100, Math.max(0, progressPercent))}%` : "40%";

  return (
    <div className="w-full min-w-0 space-y-1" aria-hidden={!showBar}>
      <div className="h-2 w-full rounded-full bg-[#e5e7eb] overflow-hidden">
        {indeterminate ? (
          <div className="h-full w-[40%] rounded-full bg-[#c27b3d] animate-pulse" />
        ) : (
          <div
            className="h-full rounded-full bg-[#c27b3d] transition-[width] duration-200 ease-out"
            style={{ width }}
          />
        )}
      </div>
      {progressPercent != null && status === "uploading" ? (
        <p className="text-xs text-[#6b7280] m-0 tabular-nums">{progressPercent}%</p>
      ) : null}
    </div>
  );
}

function canRemoveQueueItem(item: UploadQueueItem, isProcessingQueue: boolean): boolean {
  if (item.status === "uploading" || item.status === "completing") return false;
  if (isProcessingQueue && item.status === "queued") return false;
  return true;
}

export default function AlbumVideosSection({
  albumId,
  mpConnected,
  eventId,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const queueRef = useRef<UploadQueueItem[]>([]);

  const [videos, setVideos] = useState<VideoAssetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const [batchCategory, setBatchCategory] = useState<VideoCategoryId>("OTHER");
  const [batchDescription, setBatchDescription] = useState("");
  const [batchPricePesos, setBatchPricePesos] = useState(() =>
    centsToPesosInput(defaultPriceForCategory("OTHER"))
  );
  const [batchEventFolderId, setBatchEventFolderId] = useState("");

  const [editingVideo, setEditingVideo] = useState<VideoAssetDto | null>(null);

  const refreshVideos = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/videos`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar los videos");
      }
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (e: unknown) {
      if (!opts?.silent) {
        const msg = e instanceof Error ? e.message : "Error cargando videos";
        setError(msg);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    void refreshVideos();
  }, [refreshVideos]);

  useEffect(() => {
    setBatchPricePesos(centsToPesosInput(defaultPriceForCategory(batchCategory)));
  }, [batchCategory]);

  const needsProcessingPoll = videoNeedsProcessingPoll(videos);

  useEffect(() => {
    if (!needsProcessingPoll) return;
    const timer = window.setInterval(() => {
      void refreshVideos({ silent: true });
    }, VIDEO_PROCESSING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [needsProcessingPoll, refreshVideos]);

  const getBatchDefaults = useCallback((): BatchUploadDefaults => {
    return {
      category: batchCategory,
      description: batchDescription.trim(),
      priceCents: pesosInputToCents(batchPricePesos),
      eventFolderId: batchEventFolderId,
    };
  }, [batchCategory, batchDescription, batchPricePesos, batchEventFolderId]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const updateQueueItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      queueRef.current = next;
      return next;
    });
  }, []);

  const uploadOneFile = useCallback(
    async (
      item: UploadQueueItem,
      defaults: BatchUploadDefaults,
      onPatch: (patch: Partial<UploadQueueItem>) => void
    ) => {
      if (mpConnected === false) {
        throw new Error("Debés conectar Mercado Pago para subir videos.");
      }

      const file = item.file;
      const contentType = file.type || "application/octet-stream";

      onPatch({ status: "uploading", progressPercent: null, error: undefined });

      const initRes = await fetch(
        `/api/dashboard/albums/${albumId}/videos/direct-upload/init`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType,
            sizeBytes: file.size,
            category: defaults.category,
          }),
        }
      );
      const initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        throw new Error(initData?.error || "No se pudo iniciar la subida");
      }

      await uploadFileWithProgress(initData.uploadUrl, file, contentType, (percent) => {
        onPatch({ progressPercent: percent });
      });

      onPatch({ status: "completing", progressPercent: null });

      const autoTitle = titleFromFilename(file.name);
      const completeRes = await fetch(
        `/api/dashboard/albums/${albumId}/videos/direct-upload/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalKey: initData.key,
            filename: file.name,
            contentType,
            sizeBytes: file.size,
            category: defaults.category,
            title: autoTitle,
            description: defaults.description || undefined,
            priceCents: defaults.priceCents,
            ...(defaults.eventFolderId ? { eventFolderId: Number(defaults.eventFolderId) } : {}),
          }),
        }
      );
      const completeData = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        throw new Error(completeData?.error || "Error registrando el video");
      }

      onPatch({ status: "pending_processing", progressPercent: 100, error: undefined });
    },
    [albumId, mpConnected]
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessingQueue(true);
    const defaults = getBatchDefaults();

    try {
      while (true) {
        const item = queueRef.current.find((i) => i.status === "queued");
        if (!item) break;

        try {
          await uploadOneFile(item, defaults, (patch) => updateQueueItem(item.id, patch));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Error subiendo";
          updateQueueItem(item.id, { status: "error", error: msg, progressPercent: null });
        }
      }
    } finally {
      processingRef.current = false;
      setIsProcessingQueue(false);
      await refreshVideos({ silent: true });
    }
  }, [getBatchDefaults, refreshVideos, updateQueueItem, uploadOneFile]);

  const startQueueProcessing = useCallback(() => {
    if (mpConnected === false || processingRef.current) return;
    if (!queueRef.current.some((i) => i.status === "queued")) return;
    void processQueue();
  }, [mpConnected, processQueue]);

  useEffect(() => {
    const hasPending = queue.some((i) => i.status === "queued");
    if (!hasPending || processingRef.current || mpConnected === false) return;

    const timer = window.setTimeout(() => startQueueProcessing(), 0);
    return () => window.clearTimeout(timer);
  }, [queue, mpConnected, startQueueProcessing]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;

    if (!fileList?.length) {
      setError(
        "No se detectaron archivos. Usá MP4, MOV o WebM, o probá desde otra carpeta."
      );
      return;
    }

    const raw = Array.from(fileList);
    const { accepted, rejected } = partitionVideoFilesForUpload(raw);

    if (accepted.length === 0) {
      setError("Formato no soportado. Solo MP4, MOV o WebM.");
      e.target.value = "";
      return;
    }

    if (rejected.length > 0) {
      setError(
        `Se agregaron ${accepted.length} video(s). Se omitieron ${rejected.length} con formato no soportado.`
      );
    } else {
      setError(null);
    }

    const newItems = accepted.map((f) => newUploadQueueItem(f, batchCategory));
    setQueue((prev) => {
      const next = [...prev, ...newItems];
      queueRef.current = next;
      return next;
    });

    e.target.value = "";
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => {
      const next = prev.filter((i) => i.id !== id);
      queueRef.current = next;
      return next;
    });
  }

  function retryQueueItem(id: string) {
    updateQueueItem(id, {
      status: "queued",
      error: undefined,
      progressPercent: null,
    });
    void processQueue();
  }

  async function handleRemove(videoId: number) {
    if (!confirm("¿Eliminar este video del álbum?")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/albums/${albumId}/videos/${videoId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo eliminar");
      }
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error eliminando video");
    }
  }

  function handleVideoSaved(updated: VideoAssetDto) {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }

  if (!isVideoMvpEnabledClient()) {
    return null;
  }

  const categoryOptions = VIDEO_CATEGORIES.map((c) => ({
    value: c,
    label: VIDEO_CATEGORY_LABELS[c],
  }));

  const queueActive = queue.length > 0;
  const pickFilesDisabled = isProcessingQueue;
  const batchFormDisabled = mpConnected === false || isProcessingQueue;
  const uploadInProgress = queue.some(
    (i) => i.status === "uploading" || i.status === "completing"
  );

  return (
    <div className="ds-tab-panel w-full min-w-0">
      <Card className="ds-card ds-fill-width w-full min-w-0 p-5 sm:p-6">
        <div className="ds-form-stack w-full gap-6">
          <div className="ds-content-container w-full space-y-2">
            <h2 className="text-lg font-medium text-[#1a1a1a] m-0 flex items-center gap-2">
              <Film className="h-5 w-5 shrink-0" aria-hidden />
              Videos del álbum
            </h2>
            <p className="ds-readable-text ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
              Subí uno o varios videos (MP4, MOV o WebM). Cada archivo se procesa por separado.
              Podés editar título, precio y categoría después de subirlos.
            </p>
          </div>

          {error ? (
            <p className="ds-readable-text w-full text-sm text-red-600 m-0" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ds-form-stack w-full gap-4 border border-[#e5e7eb] rounded-lg p-4 sm:p-5 bg-[#fafafa]">
            <h3 className="text-sm font-semibold text-[#1a1a1a] m-0">Subir videos</h3>

            <div
              className="ds-info-panel w-full rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
              role="note"
            >
              <p className="m-0 flex items-start gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                <span>Importante durante la subida</span>
              </p>
              <p className="ds-readable-text ds-readable-text--fluid text-sm m-0 mt-2 text-amber-900">
                {VIDEO_UPLOAD_KEEP_TAB_NOTICE}
              </p>
            </div>

            <p className="ds-readable-text text-xs text-[#6b7280] m-0">
              Configuración del lote (se aplica a todos los archivos seleccionados). El título se
              genera desde el nombre del archivo; podés cambiarlo al editar cada video.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <label className="block w-full min-w-0 sm:col-span-2">
                <span className="block text-sm font-medium text-[#374151] mb-1">
                  Categoría por defecto
                </span>
                <Select
                  value={batchCategory}
                  onChange={(e) => setBatchCategory(e.target.value as VideoCategoryId)}
                  className="w-full"
                  disabled={batchFormDisabled}
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block w-full min-w-0">
                <span className="block text-sm font-medium text-[#374151] mb-1">
                  Precio por defecto (ARS). Mín.{" "}
                  {formatARS(VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[batchCategory] / 100)}
                </span>
                <Input
                  type="number"
                  min={VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[batchCategory] / 100}
                  value={batchPricePesos}
                  onChange={(e) => setBatchPricePesos(e.target.value)}
                  className="w-full"
                  disabled={batchFormDisabled}
                />
              </label>

              <label className="block w-full min-w-0 sm:col-span-2">
                <span className="block text-sm font-medium text-[#374151] mb-1">
                  Descripción común (opcional)
                </span>
                <Textarea
                  value={batchDescription}
                  onChange={(e) => setBatchDescription(e.target.value)}
                  rows={2}
                  placeholder="Misma descripción para todos los videos del lote"
                  disabled={batchFormDisabled}
                />
              </label>
            </div>

            {eventId != null && eventId > 0 ? (
              <EventFolderAlbumTreePicker
                mode="upload"
                eventId={eventId}
                value={batchEventFolderId}
                onChange={setBatchEventFolderId}
                disabled={batchFormDisabled}
              />
            ) : null}

            <input
              ref={fileRef}
              type="file"
              multiple
              accept="video/mp4,video/quicktime,video/webm,video/*,.mp4,.mov,.webm"
              className="hidden"
              onChange={handleFilesSelected}
            />

            <div className="flex flex-wrap gap-3 w-full items-center">
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pickFilesDisabled}
                className="whitespace-nowrap shrink-0"
              >
                {isProcessingQueue ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline" aria-hidden />
                    Subiendo lote…
                  </>
                ) : (
                  "Elegir videos"
                )}
              </Button>
              {mpConnected === false ? (
                <p className="ds-readable-text text-sm text-amber-700 m-0">
                  Conectá Mercado Pago para iniciar la subida. Podés armar la cola igual.
                </p>
              ) : null}
              {uploadInProgress ? (
                <p className="ds-readable-text text-sm text-amber-800 m-0 font-medium">
                  Subida en curso — no cierres esta pestaña.
                </p>
              ) : null}
            </div>

            {mpConnected === false && queueActive ? (
              <p className="ds-readable-text text-sm text-amber-800 m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                Hay videos en cola, pero la subida arranca cuando conectés Mercado Pago.
              </p>
            ) : null}

            {queueActive ? (
              <div className="w-full min-w-0 space-y-3 pt-2 border-t border-[#e5e7eb]">
                <p className="text-sm font-medium text-[#374151] m-0">Cola de subida</p>
                <ul className="list-none p-0 m-0 space-y-3 w-full">
                  {queue.map((item) => (
                    <li
                      key={item.id}
                      className="ds-card flex flex-col gap-3 border border-[#e5e7eb] rounded-lg p-3 sm:p-4 bg-white w-full min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 w-full min-w-0">
                        <div className="ds-content-container flex-1 min-w-0 space-y-1">
                          <p className="font-medium text-sm text-[#1a1a1a] m-0 truncate">
                            {item.file.name}
                          </p>
                          <p className="ds-readable-text text-xs text-[#6b7280] m-0">
                            {formatVideoFileSize(item.file.size)} ·{" "}
                            {queueCategoryLabel(item.category)}
                          </p>
                          {item.error ? (
                            <p className="ds-readable-text text-xs text-red-600 m-0">{item.error}</p>
                          ) : null}
                          {item.status === "pending_processing" ? (
                            <p className="ds-readable-text text-xs text-blue-800 m-0">
                              El worker generará thumbnail y vista previa cuando esté listo.
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <QueueBadge status={item.status} progressPercent={item.progressPercent} />
                          {item.status === "error" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap shrink-0"
                              onClick={() => retryQueueItem(item.id)}
                              disabled={isProcessingQueue}
                            >
                              <RotateCcw className="h-4 w-4 sm:mr-1" aria-hidden />
                              <span className="hidden sm:inline">Reintentar</span>
                            </Button>
                          ) : null}
                          {canRemoveQueueItem(item, isProcessingQueue) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap shrink-0"
                              onClick={() => removeFromQueue(item.id)}
                              aria-label="Quitar de la cola"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <QueueProgressBar
                        status={item.status}
                        progressPercent={item.progressPercent}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="w-full min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#1a1a1a] m-0">Videos en el álbum</h3>
              {needsProcessingPoll ? (
                <p className="ds-readable-text text-xs text-[#6b7280] m-0 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  Actualizando estado de procesamiento…
                </p>
              ) : null}
            </div>

            {loading ? (
              <p className="ds-readable-text text-sm text-[#6b7280] m-0 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                Cargando…
              </p>
            ) : null}

            {!loading && videos.length === 0 ? (
              <p className="ds-readable-text text-sm text-[#6b7280] m-0">
                Todavía no hay videos en este álbum.
              </p>
            ) : null}

            {!loading && videos.length > 0 ? (
              <ul className="grid gap-3 w-full min-w-0 list-none p-0 m-0">
                {videos.map((video) => {
                  const awaitingWorker =
                    video.processingStatus === "UPLOADED" ||
                    video.processingStatus === "PROCESSING" ||
                    video.processingStatus === "PENDING";

                  return (
                    <li
                      key={video.id}
                      className="ds-card border border-[#e5e7eb] rounded-lg p-4 w-full min-w-0 flex flex-col lg:flex-row gap-4"
                    >
                      <div className="shrink-0 w-full lg:w-40 aspect-video bg-[#f3f4f6] rounded-md overflow-hidden flex items-center justify-center relative">
                        {video.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : awaitingWorker ? (
                          <div className="flex flex-col items-center gap-1 px-2 text-center">
                            <Loader2 className="h-6 w-6 text-amber-600 animate-spin" aria-hidden />
                            <span className="text-[10px] leading-tight text-[#6b7280]">
                              Procesamiento pendiente
                            </span>
                          </div>
                        ) : (
                          <Film className="h-8 w-8 text-[#9ca3af]" aria-hidden />
                        )}
                      </div>
                      <div className="ds-content-container flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[#1a1a1a] m-0 text-base min-w-0 flex-1 truncate">
                            {video.title || video.originalFileName || `Video #${video.id}`}
                          </p>
                          <ProcessingBadge status={video.processingStatus} />
                        </div>
                        <p className="ds-readable-text text-sm text-[#6b7280] m-0">
                          {video.categoryLabel} · {formatARS(video.priceCents / 100)}
                          {video.sellEnabled ? "" : " · No a la venta"}
                        </p>
                        {awaitingWorker ? (
                          <p className="ds-readable-text text-xs text-blue-800 m-0">
                            La vista previa y el thumbnail aparecerán cuando el worker termine de
                            procesar el archivo.
                          </p>
                        ) : null}
                        {video.description ? (
                          <p className="ds-readable-text text-sm text-[#6b7280] m-0 line-clamp-2">
                            {video.description}
                          </p>
                        ) : null}
                        {video.processingError ? (
                          <p className="ds-readable-text text-xs text-red-600 m-0">
                            {video.processingError}
                          </p>
                        ) : null}
                        <p className="ds-readable-text text-xs text-[#9ca3af] m-0">
                          Vence{" "}
                          {new Date(video.expiresAt).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0 self-start lg:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="whitespace-nowrap shrink-0"
                          onClick={() => setEditingVideo(video)}
                        >
                          <Pencil className="h-4 w-4 sm:mr-1.5" aria-hidden />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="whitespace-nowrap shrink-0"
                          onClick={() => void handleRemove(video.id)}
                          aria-label="Eliminar video"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-1.5" aria-hidden />
                          Eliminar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </Card>

      <AlbumVideoEditModal
        open={editingVideo != null}
        albumId={albumId}
        video={editingVideo}
        eventId={eventId}
        onClose={() => setEditingVideo(null)}
        onSaved={handleVideoSaved}
      />
    </div>
  );
}
