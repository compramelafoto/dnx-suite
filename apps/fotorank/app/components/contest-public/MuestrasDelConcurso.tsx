import { muestrasDelConcurso } from "../../lib/fotorank/external/muestras";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

function fechas(desde: Date, hasta: Date): string {
  const a = fecha.format(desde);
  const b = fecha.format(hasta);
  return a === b ? a : `Del ${a} al ${b}`;
}

/**
 * "Muestras del concurso" (etapa 7 de Muestras Fotográficas): las muestras **publicadas** que se
 * armaron con las obras de este concurso, con su lugar, fechas y el enlace. Sólo lectura. Si no hay
 * ninguna, o si algo falla al leerlas, no muestra nada: la página del concurso queda igual que siempre.
 */
export async function MuestrasDelConcurso({ contestId, className }: { contestId: string | null | undefined; className?: string }) {
  if (!contestId) return null;
  const muestras = await muestrasDelConcurso(contestId);
  if (muestras.length === 0) return null;
  return (
    <div className={className}>
      <section className="fr-recuadro space-y-4 border border-fr-border bg-fr-card" aria-labelledby="muestras-del-concurso">
        <h2 id="muestras-del-concurso" className="text-xl font-semibold text-fr-primary">Muestras del concurso</h2>
        <ul className="space-y-5">
          {muestras.map((m) => {
            const lugar = [m.venue, m.city].filter(Boolean).join(", ");
            return (
              <li key={m.url} className="space-y-1">
                <p className="font-semibold text-fr-primary">{m.title}</p>
                {lugar ? <p className="text-sm text-fr-muted">{lugar}</p> : null}
                <p className="text-sm text-fr-muted">{fechas(m.startsAt, m.endsAt)}</p>
                <p className="pt-1">
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold underline underline-offset-4">
                    Ver la muestra en la sala
                  </a>
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
