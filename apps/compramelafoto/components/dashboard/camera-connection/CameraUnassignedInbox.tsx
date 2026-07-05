"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { CAMERA_UPLOAD_LOG_STATUS } from "@/lib/camera-connection/camera-connection-types";

type UnassignedItem = {
  id: number;
  filename: string;
  filesize: number | null;
  status: string;
  reason: string | null;
  receivedAt: string;
  hasRawFile: boolean;
  previewUrl: string | null;
};

type AlbumOption = {
  id: number;
  title: string;
};

const REASON_LABELS: Record<string, string> = {
  [CAMERA_UPLOAD_LOG_STATUS.UNASSIGNED]: "Sin álbum coincidente",
  [CAMERA_UPLOAD_LOG_STATUS.AMBIGUOUS_ALBUM_TIME_MATCH]: "Varios álbumes coinciden",
};

function formatFileSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  albums: AlbumOption[];
};

export default function CameraUnassignedInbox({ albums }: Props) {
  const [items, setItems] = useState<UnassignedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlbumByLog, setSelectedAlbumByLog] = useState<Record<number, string>>({});
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard/camera-connection/unassigned", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: UnassignedItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar la bandeja.");
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar fotos sin asignar.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const albumOptions = useMemo(
    () => [...albums].sort((a, b) => a.title.localeCompare(b.title, "es")),
    [albums]
  );

  async function handleAssign(item: UnassignedItem) {
    const albumId = Number(selectedAlbumByLog[item.id]);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      setError("Seleccioná un álbum destino.");
      return;
    }

    setAssigningId(item.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/dashboard/camera-connection/unassigned/${item.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albumId }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo asignar la foto.");
      }

      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setSuccessMessage(`"${item.filename}" encolada para procesamiento en el álbum seleccionado.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al asignar.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Fotos sin asignar</h2>
          <p className="text-sm text-[#6b7280] mt-1 mb-0 ds-readable-text max-w-2xl">
            Fotografías recibidas por FTP que no pudieron asignarse automáticamente. Elegí el álbum
            destino para encolarlas en el pipeline habitual de ingesta.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadItems()} disabled={loading}>
          Actualizar
        </Button>
      </div>

      {successMessage ? (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 m-0">
          {successMessage}
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 m-0">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando bandeja…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#6b7280] ds-readable-text m-0">
          No hay fotos pendientes de asignación.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:flex-row sm:items-start"
            >
              <div className="shrink-0 w-28 h-28 rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] overflow-hidden flex items-center justify-center">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[#9ca3af] px-2 text-center">Sin vista previa</span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium text-[#1a1a1a] m-0 truncate" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="text-xs text-[#6b7280] m-0 mt-1">
                    Recibida: {formatDateTime(item.receivedAt)} · {formatFileSize(item.filesize)}
                  </p>
                </div>
                <p className="text-xs text-[#374151] m-0">
                  <span className="font-medium">Motivo:</span>{" "}
                  {REASON_LABELS[item.status] ?? item.status}
                  {item.reason ? ` — ${item.reason}` : ""}
                </p>
                {!item.hasRawFile ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 m-0">
                    Archivo no disponible (subida anterior sin almacenamiento). No se puede reasignar.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:max-w-xl">
                    <Select
                      className="w-full flex-1"
                      value={selectedAlbumByLog[item.id] ?? ""}
                      onChange={(e) =>
                        setSelectedAlbumByLog((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      disabled={assigningId === item.id}
                    >
                      <option value="">Elegir álbum destino…</option>
                      {albumOptions.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.title}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="primary"
                      size="md"
                      className="whitespace-nowrap shrink-0"
                      disabled={assigningId === item.id || albumOptions.length === 0}
                      onClick={() => void handleAssign(item)}
                    >
                      {assigningId === item.id ? "Asignando…" : "Mover a álbum"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
