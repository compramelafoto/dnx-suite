"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { DsCatalogShell, DsDashboardInner, DsInfoPanel, DsPageShell, DsTabPanel } from "@/components/ui/DsLayout";
import { CAMERA_UPLOAD_LOG_STATUS } from "@/lib/camera-connection/camera-connection-types";
import CameraUnassignedInbox from "@/components/dashboard/camera-connection/CameraUnassignedInbox";

type AssignmentMode = "MANUAL" | "ALBUM_EVENT_TIME";

type SettingsView = {
  enabled: boolean;
  paused: boolean;
  activeAlbumId: number | null;
  assignmentMode?: AssignmentMode;
  autoPublish: boolean;
  lastUploadAt: string | null;
  host: string;
  port: number;
  username: string | null;
  hasPassword: boolean;
  ftpServerLive?: boolean;
  remoteDirectoryRecommended?: string;
  remoteDirectoryTechnical?: string | null;
  credentialLimits?: { maxUsernameLength: number; passwordLength: number };
};

type UploadLogView = {
  id: number;
  albumId: number | null;
  albumTitle: string | null;
  filename: string;
  filesize: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

type AlbumOption = {
  id: number;
  title: string;
  userId: number;
  isPublic?: boolean;
  isHidden?: boolean;
  deletedAt?: string | null;
};

type ConnectionStatusLabel = "inactive" | "active" | "paused";

const LOG_STATUS_LABELS: Record<string, string> = {
  [CAMERA_UPLOAD_LOG_STATUS.RECEIVED]: "Recibida",
  [CAMERA_UPLOAD_LOG_STATUS.PROCESSING]: "Procesando",
  [CAMERA_UPLOAD_LOG_STATUS.SUCCESS]: "Éxito",
  [CAMERA_UPLOAD_LOG_STATUS.FAILED]: "Error",
  [CAMERA_UPLOAD_LOG_STATUS.REJECTED]: "Rechazada",
  [CAMERA_UPLOAD_LOG_STATUS.NO_ACTIVE_ALBUM]: "Sin álbum activo",
  [CAMERA_UPLOAD_LOG_STATUS.UNASSIGNED]: "Sin asignar",
  [CAMERA_UPLOAD_LOG_STATUS.AMBIGUOUS_ALBUM_TIME_MATCH]: "Horario ambiguo",
  [CAMERA_UPLOAD_LOG_STATUS.PAUSED]: "Pausada",
  [CAMERA_UPLOAD_LOG_STATUS.DISABLED]: "Deshabilitada",
};

const TRANSFER_METHODS = [
  { id: "ftp", label: "FTP Directo", badge: "En preparación" },
  { id: "lightroom", label: "Lightroom Classic", badge: "Próximamente" },
  { id: "capture-one", label: "Capture One", badge: "Próximamente" },
  { id: "mobile", label: "App móvil", badge: "Próximamente" },
] as const;

function resolveConnectionStatus(settings: SettingsView | null): ConnectionStatusLabel {
  if (!settings?.enabled) return "inactive";
  if (settings.paused) return "paused";
  return "active";
}

function statusBadgeClass(status: ConnectionStatusLabel): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "paused":
      return "bg-amber-50 text-amber-900 border-amber-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function statusLabelText(status: ConnectionStatusLabel): string {
  switch (status) {
    case "active":
      return "Activa";
    case "paused":
      return "Pausada";
    default:
      return "Desactivada";
  }
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isAlbumSelectableForCamera(album: AlbumOption, currentUserId: number): boolean {
  if (album.deletedAt) return false;
  if (album.userId === currentUserId) return true;
  return Boolean(album.isPublic && !album.isHidden);
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export default function CameraConnectionPage() {
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [logs, setLogs] = useState<UploadLogView[]>([]);
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [userId, setUserId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [plainPassword, setPlainPassword] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const connectionStatus = resolveConnectionStatus(settings);

  const selectableAlbums = useMemo(() => {
    if (userId == null) return [];
    return albums
      .filter((a) => isAlbumSelectableForCamera(a, userId))
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [albums, userId]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [meRes, settingsRes, logsRes, albumsRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include", cache: "no-store" }),
        fetch("/api/dashboard/camera-connection/settings", { cache: "no-store" }),
        fetch("/api/dashboard/camera-connection/logs", { cache: "no-store" }),
        fetch("/api/dashboard/albums", { cache: "no-store" }),
      ]);

      if (meRes.ok) {
        const me = (await meRes.json()) as { user?: { id?: number } };
        if (typeof me.user?.id === "number") setUserId(me.user.id);
      }

      if (!settingsRes.ok) {
        throw new Error(await parseApiError(settingsRes, "No se pudo cargar la configuración."));
      }
      const settingsData = (await settingsRes.json()) as SettingsView;
      setSettings(settingsData);

      if (logsRes.ok) {
        const logsData = (await logsRes.json()) as { logs?: UploadLogView[] };
        setLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
      } else {
        setLogs([]);
      }

      if (albumsRes.ok) {
        const albumsData = (await albumsRes.json()) as { albums?: AlbumOption[] } | AlbumOption[];
        const list = Array.isArray(albumsData)
          ? albumsData
          : Array.isArray(albumsData.albums)
            ? albumsData.albums
            : [];
        setAlbums(
          list.map((a) => ({
            id: a.id,
            title: a.title,
            userId: a.userId,
            isPublic: a.isPublic,
            isHidden: a.isHidden,
            deletedAt: a.deletedAt ?? null,
          }))
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar Conexión de Cámara.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function runAction(
    key: string,
    url: string,
    options?: { method?: string; body?: unknown; onSuccess?: (data: unknown) => void }
  ) {
    setActionLoading(key);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(url, {
        method: options?.method ?? "POST",
        headers: options?.body ? { "Content-Type": "application/json" } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "No se pudo completar la acción."
        );
      }
      options?.onSuccess?.(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setActionLoading(null);
    }
  }

  function applySettingsFromResponse(data: { settings?: SettingsView } | SettingsView) {
    const next = "settings" in data && data.settings ? data.settings : (data as SettingsView);
    if (next && typeof next.enabled === "boolean") setSettings(next);
  }

  async function handleEnable() {
    await runAction("enable", "/api/dashboard/camera-connection/enable", {
      onSuccess: (data) => {
        const payload = data as { settings?: SettingsView; plainPassword?: string };
        applySettingsFromResponse(payload);
        if (payload.plainPassword) setPlainPassword(payload.plainPassword);
        setInfo(
          "La configuración quedó preparada. El envío real de fotos dependerá de que el servidor FTP esté operativo."
        );
      },
    });
  }

  async function handleDisable() {
    await runAction("disable", "/api/dashboard/camera-connection/disable", {
      onSuccess: (data) => {
        applySettingsFromResponse(data as { settings: SettingsView });
        setPlainPassword(null);
      },
    });
  }

  async function handlePauseResume() {
    const paused = settings?.paused;
    const url = paused
      ? "/api/dashboard/camera-connection/resume"
      : "/api/dashboard/camera-connection/pause";
    await runAction(paused ? "resume" : "pause", url, {
      onSuccess: (data) => applySettingsFromResponse(data as { settings: SettingsView }),
    });
  }

  async function handleRegeneratePassword() {
    await runAction("regenerate-password", "/api/dashboard/camera-connection/regenerate-password", {
      onSuccess: (data) => {
        const payload = data as { settings?: SettingsView; plainPassword?: string };
        applySettingsFromResponse(payload);
        if (payload.plainPassword) setPlainPassword(payload.plainPassword);
      },
    });
  }

  async function handleSelectAlbum(albumId: number) {
    if (!albumId) return;
    await runAction("select-album", "/api/dashboard/camera-connection/select-album", {
      body: { albumId },
      onSuccess: (data) => applySettingsFromResponse(data as { settings: SettingsView }),
    });
  }

  async function handleAutoPublishChange(autoPublish: boolean) {
    await runAction("auto-publish", "/api/dashboard/camera-connection/settings", {
      method: "PATCH",
      body: { autoPublish },
      onSuccess: (data) => applySettingsFromResponse(data as SettingsView),
    });
  }

  async function handleAssignmentModeChange(assignmentMode: AssignmentMode) {
    await runAction("assignment-mode", "/api/dashboard/camera-connection/settings", {
      method: "PATCH",
      body: { assignmentMode },
      onSuccess: (data) => applySettingsFromResponse(data as SettingsView),
    });
  }

  const assignmentMode: AssignmentMode =
    settings?.assignmentMode === "ALBUM_EVENT_TIME" ? "ALBUM_EVENT_TIME" : "MANUAL";

  if (loading) {
    return (
      <DsPageShell className="py-8 md:py-10">
        <DsDashboardInner>
          <p className="text-sm text-[#6b7280]">Cargando Conexión de Cámara…</p>
        </DsDashboardInner>
      </DsPageShell>
    );
  }

  return (
    <DsPageShell className="py-8 md:py-10">
      <DsCatalogShell>
        <DsDashboardInner>
          <DsTabPanel density="relaxed">
            <header className="ds-content-container">
              <h1 className="ds-catalog-title text-xl md:text-2xl font-bold text-[#111827]">
                Conexión de Cámara
              </h1>
              <p className="ds-readable-text mt-2 text-sm text-[#6b7280] max-w-3xl">
                Conectá tu cámara directamente con ComprameLaFoto para enviar fotografías a tus
                álbumes de forma automática.
              </p>
            </header>

            <DsInfoPanel title="Importante" className="bg-amber-50/90 border-amber-200/80">
              <p className="ds-readable-text text-sm text-[#78350f]">
                Esta función no está disponible en todas las cámaras. Requiere que tu cámara permita
                subida por FTP mediante WiFi, transmisor externo o una aplicación compatible. El
                teléfono móvil puede usarse como conexión a internet compartiendo datos por hotspot.
              </p>
            </DsInfoPanel>

            {settings?.ftpServerLive === false && (
              <DsInfoPanel title="Servidor FTP aún no disponible" className="bg-red-50/90 border-red-200/80">
                <p className="ds-readable-text text-sm text-[#991b1b]">
                  El panel ya guarda tu configuración (usuario, contraseña y álbum activo), pero{" "}
                  <strong>todavía no hay un servidor FTP escuchando</strong> en{" "}
                  {settings.host}:{settings.port}. Por eso la cámara muestra errores como
                  “comprobá la configuración de destino” o no conecta: no es un fallo de tus datos,
                  sino que el envío real se habilitará en una próxima etapa (FTP Gateway).
                </p>
              </DsInfoPanel>
            )}

            {error && (
              <Card className="border-[#ef4444] bg-[#ef4444]/10 p-4">
                <p className="text-sm text-[#ef4444]">{error}</p>
              </Card>
            )}

            {info && (
              <Card className="border-[#c27b3d]/30 bg-[#c27b3d]/10 p-4">
                <p className="text-sm text-[#92400e]">{info}</p>
              </Card>
            )}

            {/* A. Estado */}
            <Card className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#1a1a1a]">Estado</h2>
                  <p className="mt-1 text-sm text-[#6b7280]">
                    Última subida: {formatDateTime(settings?.lastUploadAt ?? null)}
                  </p>
                </div>
                <span
                  className={`inline-flex self-start items-center rounded-full border px-3 py-1 text-sm font-medium ${statusBadgeClass(connectionStatus)}`}
                >
                  {statusLabelText(connectionStatus)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!settings?.enabled ? (
                  <Button
                    variant="primary"
                    onClick={() => void handleEnable()}
                    disabled={actionLoading != null}
                  >
                    {actionLoading === "enable" ? "Activando…" : "Activar conexión"}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => void handleDisable()}
                    disabled={actionLoading != null}
                  >
                    {actionLoading === "disable" ? "Desactivando…" : "Desactivar conexión"}
                  </Button>
                )}
                {settings?.enabled && (
                  <Button
                    variant="secondary"
                    onClick={() => void handlePauseResume()}
                    disabled={actionLoading != null}
                  >
                    {actionLoading === "pause" || actionLoading === "resume"
                      ? "Guardando…"
                      : settings.paused
                        ? "Reanudar"
                        : "Pausar"}
                  </Button>
                )}
              </div>

              {settings?.enabled && (
                <p className="mt-4 text-sm text-[#6b7280] ds-readable-text">
                  La conexión está configurada en la plataforma. El envío real desde tu cámara
                  funcionará cuando el servidor FTP esté disponible (actualmente en preparación).
                </p>
              )}
            </Card>

            {/* B. Configuración FTP */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Configuración FTP</h2>
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-[#6b7280]">Servidor (host)</dt>
                  <dd className="font-mono text-[#1a1a1a] mt-0.5">{settings?.host ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#6b7280]">Puerto</dt>
                  <dd className="font-mono text-[#1a1a1a] mt-0.5">{settings?.port ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#6b7280]">Usuario</dt>
                  <dd className="font-mono text-[#1a1a1a] mt-0.5 break-all">
                    {settings?.username ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6b7280]">Contraseña</dt>
                  <dd className="font-mono text-[#1a1a1a] mt-0.5 break-all">
                    {plainPassword
                      ? plainPassword
                      : settings?.hasPassword
                        ? "••••••••"
                        : "Sin configurar"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[#6b7280]">Carpeta destino en la cámara</dt>
                  <dd className="font-mono text-[#1a1a1a] mt-0.5 break-all">
                    {assignmentMode === "ALBUM_EVENT_TIME"
                      ? settings?.remoteDirectoryRecommended ?? "/"
                      : settings?.activeAlbumId == null
                        ? "Elegí un álbum activo primero"
                        : settings.remoteDirectoryRecommended ?? "/"}
                  </dd>
                  {assignmentMode === "MANUAL" &&
                  settings?.activeAlbumId != null &&
                  settings.remoteDirectoryTechnical ? (
                    <p className="mt-2 text-xs text-[#6b7280] ds-readable-text">
                      Muchas cámaras piden “directorio” o “carpeta destino”. Probá primero con{" "}
                      <span className="font-mono">{settings.remoteDirectoryRecommended}</span>{" "}
                      (raíz). Si tu modelo exige una ruta completa, usá{" "}
                      <span className="font-mono">{settings.remoteDirectoryTechnical}</span>. El
                      álbum lo definís en el panel; la cámara no tiene que elegir la carpeta del
                      álbum manualmente si el servidor usa tu álbum activo.
                    </p>
                  ) : null}
                </div>
              </dl>

              {settings?.credentialLimits && (
                <p className="mt-3 text-xs text-[#6b7280]">
                  Credenciales cortas para compatibilidad con cámaras: usuario hasta{" "}
                  {settings.credentialLimits.maxUsernameLength} caracteres, contraseña de{" "}
                  {settings.credentialLimits.passwordLength} caracteres. Si tenés un usuario largo
                  anterior, desactivá y volvé a activar la conexión, o regenerá la contraseña.
                </p>
              )}

              {plainPassword && (
                <DsInfoPanel title="Guardá esta contraseña ahora" className="mt-4 bg-sky-50/90 border-sky-200/80">
                  <p className="ds-readable-text text-sm text-[#0c4a6e]">
                    Por seguridad no volveremos a mostrarla. Copiala y configurá tu cámara antes de
                    cerrar esta pantalla.
                  </p>
                </DsInfoPanel>
              )}

              <div className="mt-4">
                <Button
                  variant="secondary"
                  onClick={() => void handleRegeneratePassword()}
                  disabled={actionLoading != null || !settings?.enabled}
                >
                  {actionLoading === "regenerate-password"
                    ? "Regenerando…"
                    : "Regenerar contraseña"}
                </Button>
                {!settings?.enabled && (
                  <p className="mt-2 text-xs text-[#6b7280]">
                    Activá la conexión para generar o rotar credenciales FTP.
                  </p>
                )}
              </div>
            </Card>

            {/* C. Modo de asignación */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">Modo de asignación</h2>
              <p className="text-sm text-[#6b7280] mb-4 ds-readable-text">
                ComprameLaFoto utilizará los horarios configurados en tus álbumes para determinar
                automáticamente dónde guardar cada fotografía recibida por FTP.
              </p>
              <div className="ds-form-stack max-w-xl gap-3">
                <label className="flex items-start gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 cursor-pointer">
                  <input
                    type="radio"
                    name="assignmentMode"
                    className="mt-1 shrink-0"
                    checked={assignmentMode === "MANUAL"}
                    onChange={() => void handleAssignmentModeChange("MANUAL")}
                    disabled={actionLoading === "assignment-mode"}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#1a1a1a]">Manual</span>
                    <span className="mt-0.5 block text-xs text-[#6b7280] leading-relaxed">
                      Todas las fotos van al álbum activo que elijas abajo.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 cursor-pointer">
                  <input
                    type="radio"
                    name="assignmentMode"
                    className="mt-1 shrink-0"
                    checked={assignmentMode === "ALBUM_EVENT_TIME"}
                    onChange={() => void handleAssignmentModeChange("ALBUM_EVENT_TIME")}
                    disabled={actionLoading === "assignment-mode"}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#1a1a1a]">
                      Automático por horario del álbum{" "}
                      <span className="text-[#c27b3d]">(recomendado)</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6b7280] leading-relaxed">
                      Cada foto se asigna según la fecha y hora del evento configuradas en tus
                      álbumes.
                    </span>
                  </span>
                </label>
              </div>
            </Card>

            {/* D. Álbum activo */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">Álbum activo</h2>
              <p className="text-sm text-[#6b7280] mb-4 ds-readable-text">
                {assignmentMode === "MANUAL"
                  ? "Antes de comenzar una cobertura, verificá que el álbum activo sea el correcto."
                  : "Solo se usa en modo manual. En asignación automática, el destino se resuelve por horario del álbum."}
              </p>

              {selectableAlbums.length === 0 ? (
                <p className="text-sm text-[#6b7280]">
                  No tenés álbumes disponibles para seleccionar. Creá un álbum o pedí acceso a uno
                  colaborativo público.
                </p>
              ) : (
                <div className="ds-form-stack max-w-xl">
                  <Select
                    className="w-full"
                    value={settings?.activeAlbumId ?? ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      if (Number.isFinite(id) && id > 0) void handleSelectAlbum(id);
                    }}
                    disabled={
                      actionLoading === "select-album" ||
                      assignmentMode === "ALBUM_EVENT_TIME"
                    }
                  >
                    <option value="">Seleccionar álbum…</option>
                    {selectableAlbums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.title}
                      </option>
                    ))}
                  </Select>
                  {actionLoading === "select-album" && (
                    <p className="text-xs text-[#6b7280]">Guardando álbum activo…</p>
                  )}
                </div>
              )}
            </Card>

            <CameraUnassignedInbox
              albums={selectableAlbums.map((album) => ({
                id: album.id,
                title: album.title,
              }))}
            />

            {/* E. Modo de publicación */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">Modo de publicación</h2>
              <p className="text-sm text-[#6b7280] mb-4 ds-readable-text">
                Recomendamos dejar las fotos en revisión hasta confirmar la cobertura.
              </p>
              <div className="ds-form-stack max-w-xl">
                <Select
                  className="w-full"
                  value={settings?.autoPublish ? "auto" : "review"}
                  onChange={(e) => {
                    const autoPublish = e.target.value === "auto";
                    void handleAutoPublishChange(autoPublish);
                  }}
                  disabled={actionLoading === "auto-publish"}
                >
                  <option value="review">Dejar en revisión (recomendado)</option>
                  <option value="auto">Publicar automáticamente</option>
                </Select>
              </div>
            </Card>

            {/* F. Historial */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Historial</h2>
              {logs.length === 0 ? (
                <p className="text-sm text-[#6b7280] ds-readable-text">
                  Todavía no recibimos fotografías desde tu cámara.
                </p>
              ) : (
                <div className="ds-table-scroll overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm text-left">
                    <thead>
                      <tr className="border-b border-gray-200 text-[#6b7280]">
                        <th className="py-2 pr-3 font-medium">Fecha</th>
                        <th className="py-2 pr-3 font-medium">Archivo</th>
                        <th className="py-2 pr-3 font-medium">Álbum</th>
                        <th className="py-2 pr-3 font-medium">Estado</th>
                        <th className="py-2 font-medium">Tamaño</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-100">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td className="py-2 pr-3 max-w-[12rem] truncate" title={log.filename}>
                            {log.filename}
                          </td>
                          <td className="py-2 pr-3 max-w-[10rem] truncate">
                            {log.albumTitle ?? "—"}
                          </td>
                          <td className="py-2 pr-3">
                            {LOG_STATUS_LABELS[log.status] ?? log.status}
                            {log.errorMessage ? (
                              <span
                                className="block text-xs text-[#ef4444] truncate max-w-[14rem]"
                                title={log.errorMessage}
                              >
                                {log.errorMessage}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {formatFileSize(log.filesize)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* F. Métodos disponibles */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Métodos disponibles</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {TRANSFER_METHODS.map((method) => (
                  <li
                    key={method.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-[#1a1a1a]">{method.label}</span>
                    <span className="shrink-0 rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs text-[#6b7280]">
                      {method.badge}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </DsTabPanel>
        </DsDashboardInner>
      </DsCatalogShell>
    </DsPageShell>
  );
}
