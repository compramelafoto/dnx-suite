import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../lib/fotorank/access/super-admin";
import { estadoDeLaConexionConClickaton } from "../../../lib/fotorank/access/conexionConClickaton";
import { COLA_DE_REVISION_HREF } from "../../../components/shell/menuDeLaCuenta";
import { fechaExacta } from "../../../lib/fotorank/judges/ui/tiempoRelativo";

function Estado({ ok, si, no }: { ok: boolean; si: string; no: string }) {
  return (
    <span className={ok ? "text-emerald-300" : "text-amber-300"}>
      {ok ? "● " : "○ "}
      {ok ? si : no}
    </span>
  );
}

/**
 * La conexión con Clickatón, en una sola pantalla.
 *
 * Hasta el 2026-09-24 no se veía desde ningún lado: eran variables de Vercel y
 * scripts. Esta pantalla dice si la conexión anda y, sobre todo, **dónde se
 * administra cada parte**, porque el trabajo está repartido entre las dos
 * plataformas y no es obvio cuál hace qué.
 */
export default async function ConexionConClickatonPage() {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) redirect("/mi-actividad");

  const estado = await estadoDeLaConexionConClickaton();
  const panelDeClickaton = estado.direccionPublica
    ? `${estado.direccionPublica.replace(/\/$/, "")}/admin/ediciones`
    : null;

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <p className="fr-eyebrow text-gold">Super administración</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight md:text-4xl">
          Conexión con Clickatón
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-fr-muted">
          Los jurados de las maratones de Clickatón califican en FotoRank. El padrón de jurados
          vive acá; las fotos, las asignaciones y las notas viven en la base de Clickatón.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Estado</h2>
        <ul className="fr-recuadro space-y-3 border border-fr-border bg-fr-card text-sm">
          <li className="flex flex-wrap justify-between gap-2">
            <span>Base de datos de Clickatón</span>
            <Estado
              ok={estado.base.configurada}
              si={`Configurada (${estado.base.host ?? "—"})`}
              no={estado.base.motivo ?? "Sin configurar"}
            />
          </li>
          <li className="flex flex-wrap justify-between gap-2">
            <span>Respuesta en vivo</span>
            {estado.enVivo === null ? (
              <Estado ok={false} si="" no="No se consultó" />
            ) : estado.enVivo.ok ? (
              <Estado ok si="Responde" no="" />
            ) : (
              <Estado ok={false} si="" no={estado.enVivo.error} />
            )}
          </li>
          <li className="flex flex-wrap justify-between gap-2">
            <span>Secreto compartido de fotos</span>
            <Estado
              ok={estado.secretoDeFotos}
              si="Cargado"
              no="Falta: el jurado no ve ninguna foto"
            />
          </li>
          <li className="flex flex-wrap justify-between gap-2">
            <span>Dirección pública de Clickatón</span>
            <Estado
              ok={Boolean(estado.direccionPublica)}
              si={estado.direccionPublica ?? ""}
              no="Falta"
            />
          </li>
        </ul>
        <p className="text-xs text-fr-muted">
          Las variables se cargan en Vercel: <code>CLICKATON_JURY_DATABASE_URL</code>,{" "}
          <code>CLICKATON_JURY_MEDIA_SECRET</code> y <code>CLICKATON_PUBLIC_BASE_URL</code> en
          FotoRank; <code>JURY_DIRECTORY_DATABASE_URL</code> y el mismo{" "}
          <code>CLICKATON_JURY_MEDIA_SECRET</code> en Clickatón. El secreto tiene que ser
          idéntico en las dos.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Maratones con juzgamiento</h2>
        {estado.enVivo?.ok && estado.enVivo.maratones.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-fr-muted">
                <tr>
                  <th className="py-2 pr-4">Maratón</th>
                  <th className="py-2 pr-4">Obras congeladas</th>
                  <th className="py-2 pr-4">Jurados sentados</th>
                  <th className="py-2 pr-4">Calificaciones enviadas</th>
                  <th className="py-2">Congelada</th>
                </tr>
              </thead>
              <tbody>
                {estado.enVivo.maratones.map((m) => (
                  <tr key={m.contestId} className="border-t border-fr-border">
                    <td className="py-3 pr-4 font-medium text-fr-primary">
                      <Link
                        href={`/super-admin/clickaton/${m.contestId}`}
                        className="hover:text-gold"
                      >
                        {m.titulo} →
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{m.obrasCongeladas}</td>
                    <td className="py-3 pr-4">{m.jurados}</td>
                    <td className="py-3 pr-4">{m.evaluacionesEnviadas}</td>
                    <td className="py-3 text-fr-muted">
                      {m.congeladoEl ? fechaExacta(m.congeladoEl) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-fr-muted">
            {estado.enVivo?.ok
              ? "Ninguna maratón tiene las obras congeladas todavía."
              : "Sin conexión no se pueden listar."}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Dónde se hace cada cosa</h2>
        <ol className="space-y-3 text-sm">
          <li className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="font-semibold text-fr-primary">1. Aprobar a los jurados — FotoRank</p>
            <p className="mt-1 text-fr-muted">
              Quien se postula como jurado entra al padrón cuando lo aprobás en{" "}
              <Link href={COLA_DE_REVISION_HREF} className="text-gold hover:text-gold-hover">
                Jurados por revisar
              </Link>
              .
            </p>
          </li>
          <li className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="font-semibold text-fr-primary">
              2. Declarar vacantes y sentar jurados — Clickatón
            </p>
            <p className="mt-1 text-fr-muted">
              En el panel de Clickatón, Ediciones → la edición → Jurados. Ahí se elige cuántos
              jurados habrá y quién ocupa cada lugar.
              {panelDeClickaton ? (
                <>
                  {" "}
                  <a href={panelDeClickaton} className="text-gold hover:text-gold-hover">
                    Abrir el panel de Clickatón →
                  </a>
                </>
              ) : null}
            </p>
          </li>
          <li className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="font-semibold text-fr-primary">
              3. Congelar las obras y abrir el juzgamiento — hoy, por script
            </p>
            <p className="mt-1 text-fr-muted">
              Todavía no tiene pantalla: se hace con los scripts <code>cerrar-y-congelar-lote</code>{" "}
              (Clickatón) y <code>abrir-juzgamiento</code> (FotoRank).
            </p>
          </li>
          <li className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="font-semibold text-fr-primary">4. Calificar — FotoRank</p>
            <p className="mt-1 text-fr-muted">
              Cada jurado entra con su cuenta a FotoRank → Como jurado → Concursos a calificar.
            </p>
          </li>
          <li className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="font-semibold text-fr-primary">5. Cerrar y sacar el ranking — FotoRank</p>
            <p className="mt-1 text-fr-muted">
              Tocá la maratón en la tabla de arriba: ahí ves el avance de cada jurado, cerrás la
              evaluación, generás el ranking por consigna y lo finalizás.
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}
