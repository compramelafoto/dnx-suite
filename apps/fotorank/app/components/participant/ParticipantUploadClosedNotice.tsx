import { Lock } from "lucide-react";
import {
  formatParticipantDate,
  type UploadWindowView,
} from "../../lib/fotorank/participant-experience";

type Props = {
  upload: UploadWindowView;
  maxFiles: number;
  timezone?: string | null;
};

/** Bloque informativo (no error) cuando la carga no está habilitada. */
export function ParticipantUploadClosedNotice({ upload, maxFiles, timezone }: Props) {
  const openLabel = formatParticipantDate(upload.opensAt, {
    includeTime: true,
    timeZone: timezone,
  });
  const maxLabel = maxFiles === 1 ? "1 fotografía" : `${maxFiles} fotografías`;

  let title = "Carga de fotografías no habilitada";
  let message = "Todavía no podés subir archivos en este concurso.";
  if (upload.phase === "closed") {
    title = "La ventana de carga cerró";
    message = "Ya no se admiten nuevas fotografías en este período.";
  } else if (upload.phase === "contest_closed") {
    title = "Concurso cerrado para cargas";
    message = "Este concurso ya no admite carga de fotografías.";
  } else if (upload.phase === "not_yet_open") {
    title = "La carga todavía no está habilitada";
    message = "Tu inscripción está confirmada. No tenés que hacer nada por ahora.";
  }

  return (
    <section className="fr-participant-upload-closed" data-testid="upload-closed-notice">
      <div className="fr-participant-upload-closed__icon" aria-hidden>
        <Lock width={20} height={20} strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="fr-participant-upload-closed__title">{title}</h2>
        <p className="fr-participant-upload-closed__message">{message}</p>
        <dl className="fr-participant-upload-closed__facts">
          <div>
            <dt>Máximo de obras</dt>
            <dd>{maxLabel}</dd>
          </div>
          {openLabel && upload.phase === "not_yet_open" ? (
            <div>
              <dt>Apertura prevista</dt>
              <dd>{openLabel}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
