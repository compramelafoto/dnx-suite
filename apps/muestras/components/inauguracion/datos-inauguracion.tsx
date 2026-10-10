import { googleCalendarUrl, openingWhenText, type OpeningEvent } from "@repo/muestras";
import type { InvitacionPublica } from "@/lib/inauguracion/consultas";
import { MapaInauguracion } from "./mapa-inauguracion";

const enlace = "underline underline-offset-4";

/** Día y hora, sede, mapa, nota y "Agendar". Lo comparten la invitación y el enlace personal. */
export function DatosInauguracion({ a, evento }: { a: InvitacionPublica; evento: OpeningEvent | null }) {
  const hayPunto = a.latitude != null && a.longitude != null;
  const comoLlegar = hayPunto
    ? `https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}`
    : a.address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent([a.address, a.city, a.province].filter(Boolean).join(", "))}` : null;
  return (
    <div className="space-y-5">
      {a.openingAt ? <p className="mf-titulo text-[clamp(1.6rem,4vw,2.2rem)] leading-tight">{openingWhenText(a.openingAt, a.openingEndsAt)}</p> : null}
      <div className="space-y-1">
        <p>{a.venueName ? <strong className="font-medium">{a.venueName}</strong> : null}</p>
        <p>{[a.address, a.city, a.province].filter(Boolean).join(", ")}</p>
        {comoLlegar ? <p><a href={comoLlegar} className={enlace} target="_blank" rel="noreferrer">Cómo llegar</a></p> : null}
      </div>
      {hayPunto ? <MapaInauguracion latitude={a.latitude!} longitude={a.longitude!} /> : null}
      {a.openingNote ? <p className="whitespace-pre-line text-[var(--mf-muted)]">{a.openingNote}</p> : null}
      {evento ? (
        <p className="flex flex-wrap gap-x-5 gap-y-2">
          <span className="text-[var(--mf-muted)]">Agendar:</span>
          <a href={`/m/${a.slug}/inauguracion/evento.ics`} className={enlace}>En tu calendario (.ics)</a>
          <a href={googleCalendarUrl(evento)} className={enlace} target="_blank" rel="noreferrer">En Google Calendar</a>
        </p>
      ) : null}
    </div>
  );
}
