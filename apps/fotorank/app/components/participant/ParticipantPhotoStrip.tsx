import { ImageIcon, Plus } from "lucide-react";
import type { ParticipantPhotoThumb } from "../../lib/fotorank/participant-experience";

type Props = {
  photos: ParticipantPhotoThumb[];
  maxFiles: number;
  /** Enlace para sumar fotos en los lugares vacíos (sólo con la carga abierta). */
  addHref?: string | null;
  size?: "sm" | "lg";
};

function photoStatusLabel(status: string): { label: string; tone: string } | null {
  if (status === "REJECTED") return { label: "No admitida", tone: "danger" };
  if (status === "CONFIRMED") return { label: "Enviada", tone: "success" };
  if (status === "READY_TO_CONFIRM") return { label: "Sin confirmar", tone: "warning" };
  if (status === "REQUIRES_REVIEW") return { label: "En revisión", tone: "warning" };
  if (status === "DRAFT" || status === "UPLOADED" || status === "PROCESSING")
    return { label: "Procesando", tone: "neutral" };
  return null;
}

/**
 * Las fotos enviadas y los lugares que quedan libres en el cupo.
 * Los lugares vacíos se dibujan punteados para que se entienda cuántas faltan.
 */
export function ParticipantPhotoStrip({ photos, maxFiles, addHref, size = "sm" }: Props) {
  const total = Math.max(maxFiles, photos.length);
  const empty = Math.max(0, total - photos.length);
  // En la tarjeta no se dibujan más de 6 lugares; el resto se resume.
  const visibleEmpty = size === "sm" ? Math.min(empty, Math.max(0, 6 - photos.length)) : empty;
  const visiblePhotos = size === "sm" ? photos.slice(0, 6) : photos;
  const hidden = photos.length - visiblePhotos.length + (empty - visibleEmpty);

  return (
    <div className={`fr-pp-photos fr-pp-photos--${size}`}>
      <p className="fr-pp-photos__count">
        <span>{size === "lg" ? "Cargadas" : "Tus fotos"}</span>
        <strong>
          {photos.length} de {total}
        </strong>
      </p>
      <ul className="fr-pp-photos__grid">
        {visiblePhotos.map((p, i) => {
          const status = photoStatusLabel(p.status);
          return (
            <li key={p.entryId} className="fr-pp-photo">
              {p.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- enlace firmado y temporal del almacenamiento privado
                <img src={p.thumbUrl} alt={`Tu foto ${i + 1}`} loading="lazy" className="fr-pp-photo__img" />
              ) : (
                <span className="fr-pp-photo__placeholder" aria-label={`Foto ${i + 1} sin vista previa`}>
                  <ImageIcon width={18} height={18} aria-hidden />
                </span>
              )}
              {status && size === "lg" ? (
                <span className={`fr-pp-photo__badge fr-pp-photo__badge--${status.tone}`}>{status.label}</span>
              ) : status?.tone === "danger" || status?.tone === "warning" ? (
                <span className={`fr-pp-photo__dot fr-pp-photo__dot--${status.tone}`} title={status.label} />
              ) : null}
            </li>
          );
        })}
        {Array.from({ length: visibleEmpty }).map((_, i) =>
          addHref ? (
            <li key={`empty-${i}`} className="fr-pp-photo fr-pp-photo--empty">
              <a href={addHref} className="fr-pp-photo__add" aria-label="Subir una foto">
                <Plus width={18} height={18} aria-hidden />
              </a>
            </li>
          ) : (
            <li key={`empty-${i}`} className="fr-pp-photo fr-pp-photo--empty" aria-label="Lugar libre" />
          ),
        )}
        {hidden > 0 ? (
          <li className="fr-pp-photo fr-pp-photo--more" aria-label={`${hidden} más`}>
            +{hidden}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
