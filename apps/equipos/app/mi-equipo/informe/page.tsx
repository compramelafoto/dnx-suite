import Link from "next/link";
import { prisma } from "@repo/db";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { requireLevel } from "@/lib/guards";
import { KIND_LABELS, listItems, STATUS_LABELS } from "@/lib/inventario/equipos";
import { fechaAr, fechaInput } from "@/lib/inventario/formato";
import { listOwnReports } from "@/lib/informe/snapshot";
import { formatMoney } from "@/lib/informe/formato";
import { Aviso, Boton, Campo, Pagina } from "@/app/_ui";
import { generarInforme, guardarPoliza } from "./actions";

export const dynamic = "force-dynamic";

const NO_ASEGURABLES = ["STOLEN", "LOST", "SOLD"];

export default async function InformePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("identidad", "/mi-equipo/informe");
  // Por la URL viajan códigos; el texto sale siempre del mapa fijo (texto libre: sin aviso).
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);
  const [equipos, informes, ajustes] = await Promise.all([
    listItems(user.id),
    listOwnReports(user.id),
    prisma.gearOwnerSettings.findUnique({
      where: { userId: user.id },
      select: { policyRenewalDate: true },
    }),
  ]);

  const elegibles = equipos.filter(
    (e) =>
      !NO_ASEGURABLES.includes(e.status) && e.declaredValueArs != null && e.declaredValueUsd != null,
  );
  const excluidos = equipos.filter((e) => !elegibles.includes(e));

  return (
    <Pagina
      titulo="Informe para aseguradoras"
      bajada="Un documento con tus equipos y sus valores, con código QR para que la aseguradora lo valide."
      volver={{ href: "/mi-equipo", texto: "Mi equipo" }}
    >
      <section className="seccion seccion-primera" aria-labelledby="nuevo">
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        <div className="seccion-cabecera">
          <h2 id="nuevo">Generar un informe nuevo</h2>
          <p className="texto-secundario">
            Elegí los equipos que querés incluir. El informe queda fijo con los datos de hoy y trae un
            código QR para que la aseguradora lo valide. Sólo se pueden incluir equipos con valor en
            pesos y en dólares cargados.
          </p>
        </div>
        {elegibles.length === 0 ? (
          <p>
            Todavía no tenés equipos para incluir. Cargá el valor en pesos y en dólares desde la ficha
            de cada equipo.
          </p>
        ) : (
          <form action={generarInforme} className="superficie formulario">
            <fieldset className="grupo">
              <legend className="solo-lectores">Equipos a incluir</legend>
              <ul className="registro">
                {elegibles.map((e) => (
                  <li key={e.id} className="registro-fila">
                    <label className="opcion">
                      <input type="checkbox" name="itemId" value={e.id} defaultChecked />
                      <span className="registro-principal">
                        <span className="registro-titulo">
                          {e.make} {e.model}
                        </span>
                        <span className="registro-detalle">
                          {KIND_LABELS[e.kind]}, $ {formatMoney(e.declaredValueArs!)} y USD{" "}
                          {formatMoney(e.declaredValueUsd!)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div className="acciones">
              <Boton>Generar informe</Boton>
            </div>
          </form>
        )}
        {excluidos.length > 0 ? (
          <details className="desplegable">
            <summary className="desplegable-titulo">
              Equipos que no se pueden incluir ({excluidos.length})
            </summary>
            <ul className="registro">
              {excluidos.map((e) => (
                <li key={e.id} className="registro-fila">
                  <Link className="registro-titulo" href={`/mi-equipo/${e.id}`}>
                    {e.make} {e.model}
                  </Link>
                  <span className="registro-detalle">
                    {NO_ASEGURABLES.includes(e.status)
                      ? `Figura como ${STATUS_LABELS[e.status].toLowerCase()}`
                      : "Falta el valor en pesos o en dólares"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="seccion" aria-labelledby="emitidos">
        <h2 id="emitidos">Informes emitidos</h2>
        {informes.length === 0 ? (
          <p className="texto-secundario">Todavía no emitiste ningún informe.</p>
        ) : (
          <ul className="registro">
            {informes.map((r) => (
              <li key={r.id} className="registro-fila">
                <div className="registro-principal">
                  <span className="registro-titulo">Emitido el {fechaAr(r.createdAt)}</span>
                  <span className="registro-detalle">
                    Total: $ {formatMoney(r.totalArs)} y USD {formatMoney(r.totalUsd)}
                  </span>
                </div>
                <div className="registro-lado">
                  <a href={`/api/informe/${r.code}/pdf`}>Descargar PDF</a>
                  <Link href={`/informe/${r.code}`}>Ver validación</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="seccion" aria-labelledby="poliza">
        <div className="seccion-cabecera">
          <h2 id="poliza">Renovación de la póliza</h2>
          <p className="texto-secundario">
            Guardá la fecha en que vence o se renueva tu póliza y te avisamos por correo 30 días antes.
          </p>
        </div>
        <form action={guardarPoliza} className="superficie formulario">
          <Campo etiqueta="Fecha de renovación">
            <input
              className="control"
              type="date"
              name="policyRenewalDate"
              defaultValue={fechaInput(ajustes?.policyRenewalDate ?? null)}
            />
          </Campo>
          <div className="acciones">
            <Boton variante="secundario">Guardar la fecha</Boton>
          </div>
        </form>
      </section>
    </Pagina>
  );
}
