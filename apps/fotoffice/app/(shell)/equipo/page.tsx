import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Diferencias, EntradaSalida, EstadoJornada, textoHorario } from "@/components/equipo/jornada-celdas";
import { requireEquipo } from "@/lib/equipo/acceso";
import { esFechaValida, fechaLegible, hoyArgentina, NOMBRES_DIAS, diaDeSemana, sumarDias } from "@/lib/equipo/fechas";
import { datosFaltantes } from "@/lib/equipo/ficha";
import { horarioDelDia } from "@/lib/equipo/horario";
import { datosDeJornadas, fichaHorario, jornadasDeFicha, leerTolerancia, listarMiembros } from "@/lib/equipo/repositorio";
import { crearFichaAction } from "./actions";

export const dynamic = "force-dynamic";

const ROLES: Record<string, string> = {
  WORKSPACE_OWNER: "Dueño",
  WORKSPACE_ADMIN: "Administrador",
  STAFF: "Equipo",
};

/**
 * Jornadas del día: quién trabajó y de qué hora a qué hora, según la apertura y el cierre de
 * caja, frente a su horario fijo. Abajo, las personas del espacio y sus fichas.
 */
export default async function EquipoPage({ searchParams }: { searchParams: Promise<{ dia?: string; error?: string }> }) {
  const ctx = await requireEquipo();
  const params = await searchParams;
  const hoy = hoyArgentina();
  const dia = params.dia && esFechaValida(params.dia) ? params.dia : hoy;

  const [miembros, tolerancia] = await Promise.all([listarMiembros(ctx.workspaceId), leerTolerancia(ctx.workspaceId)]);
  const conFicha = miembros.filter((m) => m.ficha?.activa);
  const datos = await datosDeJornadas(ctx.workspaceId, conFicha.map((m) => m.userId), dia, dia);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Jornadas del equipo"
        description="De qué hora a qué hora trabajó cada persona, tomando la apertura y el cierre de caja, frente a su horario fijo."
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="dia">
            Día
          </label>
          <input id="dia" name="dia" type="date" defaultValue={dia} max={hoy} className="fo-input" />
        </div>
        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
          Ver
        </button>
        <Link href={`/equipo?dia=${sumarDias(dia, -1)}`} className="fo-btn fo-btn-ghost text-sm">
          Día anterior
        </Link>
        {dia < hoy ? (
          <Link href={`/equipo?dia=${sumarDias(dia, 1)}`} className="fo-btn fo-btn-ghost text-sm">
            Día siguiente
          </Link>
        ) : null}
      </form>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          {NOMBRES_DIAS[diaDeSemana(dia)][0].toUpperCase() + NOMBRES_DIAS[diaDeSemana(dia)].slice(1)} {fechaLegible(dia)}
          {dia === hoy ? " (hoy)" : ""}
        </h2>
        {conFicha.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay fichas activas. Creá la de cada persona en la lista de abajo.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Persona</th>
                  <th className="px-4 py-3 font-semibold">Horario fijo</th>
                  <th className="px-4 py-3 font-semibold">Entrada → salida</th>
                  <th className="px-4 py-3 font-semibold">Frente al horario</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                {conFicha.map((m) => {
                  const ficha = m.ficha!;
                  const [j] = jornadasDeFicha(ficha, datos, [dia], tolerancia);
                  const h = horarioDelDia(fichaHorario(ficha), ficha.cambios, dia);
                  return (
                    <tr key={m.userId}>
                      <td className="px-4 py-3">
                        <Link href={`/equipo/${m.userId}`} className="font-medium underline-offset-2 hover:underline">
                          {m.nombre}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{textoHorario(h)}</td>
                      <td className="px-4 py-3">
                        <EntradaSalida j={j} />
                      </td>
                      <td className="px-4 py-3">
                        <Diferencias j={j} />
                      </td>
                      <td className="px-4 py-3">
                        <EstadoJornada j={j} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[var(--fo-muted-soft)]">
          Tolerancia: {tolerancia} minutos. Lo que la supera se ve en negrita. Se paga según el horario fijo: esto mide y avisa,
          no cambia el sueldo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Personas del espacio</h2>
        <ul className="divide-y divide-[var(--fo-border)] rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)]">
          {miembros.map((m) => {
            const faltan = m.ficha ? datosFaltantes(m.ficha) : [];
            return (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{m.nombre}</p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {ROLES[m.role] ?? m.role}
                    {m.ficha ? (m.ficha.activa ? " · Ficha activa" : " · Ficha inactiva") : " · Sin ficha"}
                    {faltan.length > 0 ? ` · Falta cargar ${faltan.join(", ")}` : ""}
                  </p>
                </div>
                {m.ficha ? (
                  <Link href={`/equipo/${m.userId}`} className="fo-btn fo-btn-secondary text-sm">
                    Ver ficha
                  </Link>
                ) : (
                  <form action={crearFichaAction}>
                    <input type="hidden" name="userId" value={m.userId} />
                    <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                      Crear ficha
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
