import Link from "next/link";
import type { ResumenRondaAlbum } from "@/lib/galerias/revision-album";

const TOPE_LAMINAS = 30;

/**
 * Resumen de la prueba de álbum para el estudio: por ronda, cuántos clientes aprobaron, pidieron cambios o todavía
 * no decidieron, y la lista rápida de láminas con comentarios (cada cliente lleva directo a su revisión de esa
 * lámina). Es sólo presentación: los datos los arma `resumenDeAlbum`, acotado al workspace.
 */
export function ResumenAlbum({ galeriaId, rondas }: { galeriaId: string; rondas: ResumenRondaAlbum[] }) {
  if (rondas.length === 0) return null;
  return (
    <section aria-labelledby="resumen-album-titulo" className="fo-card space-y-4 p-4">
      <h2 id="resumen-album-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Resumen por ronda
      </h2>
      {[...rondas].reverse().map((r) => (
        <div key={r.numero} className="space-y-2">
          <p className="text-sm font-medium">
            Ronda {r.numero}
            {r.estado === "CERRADA" ? <span className="ml-2 text-xs font-normal text-[var(--fo-muted)]">cerrada</span> : null}
          </p>
          <ul className="flex flex-wrap gap-2 text-xs" aria-label={`Decisiones de la ronda ${r.numero}`}>
            <li className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">{r.aprobaron.toLocaleString("es-AR")} {r.aprobaron === 1 ? "aprobó" : "aprobaron"}</li>
            <li className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{r.pidieronCambios.toLocaleString("es-AR")} {r.pidieronCambios === 1 ? "pidió cambios" : "pidieron cambios"}</li>
            <li className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">{r.pendientes.toLocaleString("es-AR")} {r.pendientes === 1 ? "pendiente" : "pendientes"}</li>
          </ul>
          {r.laminasConComentarios.length > 0 ? (
            <div>
              <p className="text-xs text-[var(--fo-muted)]">Láminas con comentarios ({r.laminasConComentarios.length.toLocaleString("es-AR")})</p>
              <ul className="mt-1 space-y-1 text-sm">
                {r.laminasConComentarios.slice(0, TOPE_LAMINAS).map((l) => (
                  <li key={l.id} className="break-all">
                    <span className="font-medium">{l.fileName}</span>
                    <span className="text-[var(--fo-muted)]"> · {l.comentarios.toLocaleString("es-AR")} {l.comentarios === 1 ? "comentario" : "comentarios"} · </span>
                    {l.clientes.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 ? ", " : ""}
                        <Link
                          href={`/galerias/${encodeURIComponent(galeriaId)}/clientes/${encodeURIComponent(c.id)}?ronda=${r.numero}&lamina=${encodeURIComponent(l.id)}`}
                          className="text-[var(--fo-accent)] hover:underline"
                        >
                          {c.nombre}
                        </Link>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              {r.laminasConComentarios.length > TOPE_LAMINAS ? (
                <p className="mt-1 text-xs text-[var(--fo-muted)]">Se muestran las {TOPE_LAMINAS} con más comentarios.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--fo-muted)]">Ninguna lámina tiene comentarios todavía.</p>
          )}
        </div>
      ))}
    </section>
  );
}
