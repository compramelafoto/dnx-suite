"use client";

import AppModal from "@/components/ui/AppModal";
import Card from "@/components/ui/Card";
import type { PhotographicEquipmentEquipmentDetail } from "@/lib/photographic-equipment/admin-queries";

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

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "info" | "success" | "indigo";
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    info: "bg-sky-100 text-sky-800",
    success: "bg-emerald-100 text-emerald-800",
    indigo: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#ebe8e4] bg-[#faf9f7] px-4 py-3 min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 m-0">{label}</p>
      <div className="text-sm font-medium text-gray-900 mt-1 break-words">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 m-0 mb-3">
      {children}
    </h3>
  );
}

type EquipmentDetailModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  detail: PhotographicEquipmentEquipmentDetail | null;
};

export default function EquipmentDetailModal({
  open,
  onClose,
  loading,
  detail,
}: EquipmentDetailModalProps) {
  const maxUsage = Math.max(1, ...(detail?.usageTimeline.map((u) => u.photoCount) ?? [1]));

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      title="Detalle del equipo"
      description="Registro técnico interno. No se usa para bloqueo ni denuncias automáticas."
      contentClassName="ds-modal-scroll--padded"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-gray-500 m-0">Cargando detalle…</p>
        </div>
      ) : !detail ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-gray-500 m-0">No se pudo cargar el detalle.</p>
        </div>
      ) : (
        <div className="space-y-8 min-w-0 pb-2">
          <div className="rounded-2xl border border-[#ebe8e4] bg-gradient-to-br from-[#faf9f7] to-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 m-0">Fotógrafo</p>
                <p className="text-base font-semibold text-gray-900 m-0 mt-1 truncate">
                  {detail.photographer.name || detail.photographer.email}
                </p>
                {detail.photographer.name ? (
                  <p className="text-sm text-gray-500 m-0 mt-0.5 truncate">
                    {detail.photographer.email}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 lg:text-right">
                <p className="text-xs font-medium text-gray-500 m-0 lg:text-right">Equipo (body)</p>
                <p className="text-lg font-semibold text-gray-900 m-0 mt-1 leading-snug">
                  {detail.equipmentLabel}
                </p>
                <div className="flex flex-wrap gap-2 mt-2 lg:justify-end">
                  <Badge tone="indigo">
                    {DEVICE_TYPE_LABELS[detail.deviceType] ?? detail.deviceType}
                  </Badge>
                  <Badge tone="success">
                    Confianza {CONFIDENCE_LABELS[detail.confidence] ?? detail.confidence}
                  </Badge>
                  {detail.source === "legacy" ? (
                    <Badge tone="neutral">Índice legacy</Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#ebe8e4]">
              <div className="text-center sm:text-left">
                <p className="text-2xl font-bold text-gray-900 m-0">
                  {detail.photosCount.toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-gray-500 m-0 mt-0.5">Fotos</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-2xl font-bold text-gray-900 m-0">{detail.albums.length}</p>
                <p className="text-xs text-gray-500 m-0 mt-0.5">Álbumes</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-2xl font-bold text-gray-900 m-0">{detail.lensesUsed.length}</p>
                <p className="text-xs text-gray-500 m-0 mt-0.5">Lentes</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold text-gray-900 m-0 leading-tight">
                  {formatDateTime(detail.firstSeenAt)}
                </p>
                <p className="text-xs text-gray-500 m-0 mt-0.5">Primer uso</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoTile
              label="Número de serie"
              value={detail.serialNumber?.trim() || "No disponible"}
            />
            <InfoTile label="Último uso" value={formatDateTime(detail.lastSeenAt)} />
            <InfoTile
              label="Disparos (shutter count)"
              value={
                detail.maxShutterCount != null ? (
                  <span>
                    {detail.maxShutterCount.toLocaleString("es-AR")}
                    {detail.maxShutterCountSourceField ? (
                      <span className="block text-xs font-normal text-gray-500 mt-1">
                        Campo: {detail.maxShutterCountSourceField}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  "No disponible en EXIF"
                )
              }
            />
          </div>

          {detail.lensesUsed.length > 0 ? (
            <section>
              <SectionTitle>Lentes usados con este body</SectionTitle>
              <Card className="overflow-hidden border border-[#ebe8e4] p-0">
                <div className="ds-table-scroll overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#faf9f7] text-left text-gray-600 border-b border-[#ebe8e4]">
                        <th className="py-3 px-4 font-medium">Lente</th>
                        <th className="py-3 px-4 font-medium w-20">Fotos</th>
                        <th className="py-3 px-4 font-medium whitespace-nowrap">Primera</th>
                        <th className="py-3 px-4 font-medium whitespace-nowrap">Última</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lensesUsed.map((lens, idx) => (
                        <tr
                          key={`${lens.lensId ?? "none"}-${idx}`}
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="py-3 px-4 text-gray-900">{lens.lensLabel}</td>
                          <td className="py-3 px-4 text-gray-700">{lens.photosCount}</td>
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">
                            {formatDateTime(lens.firstSeenAt)}
                          </td>
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">
                            {formatDateTime(lens.lastSeenAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ) : null}

          {detail.usageTimeline.length > 0 ? (
            <section>
              <SectionTitle>Evolución de uso</SectionTitle>
              <Card className="p-4 border border-[#ebe8e4]">
                <div className="space-y-3">
                  {detail.usageTimeline.map((point) => (
                    <div key={point.month} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 shrink-0">
                        {formatMonthLabel(point.month)}
                      </span>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden min-w-0">
                        <div
                          className="h-full rounded-full bg-[#c27b3d] transition-all"
                          style={{
                            width: `${Math.max(4, Math.round((point.photoCount / maxUsage) * 100))}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 text-right">
                        {point.photoCount}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          ) : null}

          {detail.albums.length > 0 ? (
            <section>
              <SectionTitle>Álbumes / eventos ({detail.albums.length})</SectionTitle>
              <Card className="overflow-hidden border border-[#ebe8e4] p-0">
                <div className="ds-table-scroll overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#faf9f7] text-left text-gray-600 border-b border-[#ebe8e4]">
                        <th className="py-3 px-4 font-medium">Álbum</th>
                        <th className="py-3 px-4 font-medium">Evento</th>
                        <th className="py-3 px-4 font-medium w-16">Fotos</th>
                        <th className="py-3 px-4 font-medium whitespace-nowrap">Primera</th>
                        <th className="py-3 px-4 font-medium whitespace-nowrap">Última</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.albums.map((album) => (
                        <tr key={album.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 px-4 text-gray-900 max-w-[14rem] truncate" title={album.title}>
                            {album.title}
                          </td>
                          <td className="py-3 px-4 text-gray-600 max-w-[10rem] truncate">
                            {album.eventTitle ?? "—"}
                          </td>
                          <td className="py-3 px-4 text-gray-700">{album.photoCount}</td>
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">
                            {formatDateTime(album.firstSeenAt)}
                          </td>
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">
                            {formatDateTime(album.lastSeenAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ) : null}

          {detail.recentPhotos.length > 0 ? (
            <section>
              <SectionTitle>Fotos recientes</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {detail.recentPhotos.map((photo) => (
                  <figure key={photo.id} className="m-0 min-w-0 group">
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-[#ebe8e4] shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.previewUrl}
                        alt={`Foto ${photo.id}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                    <figcaption className="mt-1.5 min-w-0">
                      <p
                        className="text-[11px] text-gray-500 m-0 truncate"
                        title={photo.albumTitle}
                      >
                        {photo.albumTitle}
                      </p>
                      {photo.takenAt ? (
                        <p className="text-[10px] text-gray-400 m-0 mt-0.5">
                          {formatDateTime(photo.takenAt)}
                        </p>
                      ) : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppModal>
  );
}
