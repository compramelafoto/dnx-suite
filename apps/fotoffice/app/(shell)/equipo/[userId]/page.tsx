import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { InputMoneda } from "@/components/campos/input-moneda";
import { Diferencias, EntradaSalida, EstadoJornada, textoHorario } from "@/components/equipo/jornada-celdas";
import { requireEquipo } from "@/lib/equipo/acceso";
import { formatMinorArs } from "@/lib/membership/money";
import { diaDeSemana, duracionLegible, fechaLegible, horaLegible, horaParaCampo, hoyArgentina, NOMBRES_DIAS, sumarDias } from "@/lib/equipo/fechas";
import { datosFaltantes, FRANJAS_POR_DIA, valorVigente } from "@/lib/equipo/ficha";
import { horarioDelDia, MOTIVOS_CAMBIO } from "@/lib/equipo/horario";
import { datosDeJornadas, diasDelRango, fichaHorario, jornadasDeFicha, leerTolerancia, miembroDe } from "@/lib/equipo/repositorio";
import {
  agregarValorJornadaAction,
  borrarCambioAction,
  corregirJornadaAction,
  crearFichaAction,
  guardarCambioAction,
  guardarFichaAction,
} from "../actions";

export const dynamic = "force-dynamic";

/** Cuántos días de jornada se muestran en la ficha. */
const DIAS_RECIENTES = 14;

const capital = (t: string) => t[0].toUpperCase() + t.slice(1);

/** La ficha de una persona: datos, horario semanal, valor de la jornada, cambios puntuales y jornadas recientes. */
export default async function FichaEquipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await requireEquipo();
  const { userId: idTexto } = await params;
  const sp = await searchParams;
  const userId = Number(idTexto);
  if (!Number.isInteger(userId) || userId <= 0) notFound();
  const miembro = await miembroDe(ctx.workspaceId, userId);
  if (!miembro) notFound();
  const ficha = miembro.ficha;

  if (!ficha) {
    return (
      <div className="space-y-6">
        <PageHeader title={miembro.nombre} description="Todavía no tiene ficha en Equipo." />
        <form action={crearFichaAction}>
          <input type="hidden" name="userId" value={userId} />
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Crear ficha
          </button>
        </form>
      </div>
    );
  }

  const hoy = hoyArgentina();
  const desde = sumarDias(hoy, -(DIAS_RECIENTES - 1));
  const [tolerancia, datos] = await Promise.all([leerTolerancia(ctx.workspaceId), datosDeJornadas(ctx.workspaceId, [userId], desde, hoy)]);
  const dias = diasDelRango(desde, hoy);
  const jornadas = jornadasDeFicha(ficha, datos, dias, tolerancia);
  const horario = fichaHorario(ficha);
  const faltan = datosFaltantes(ficha);
  const vigente = valorVigente(ficha.valores, hoy);
  const franjasDe = (d: number) => ficha.franjas.filter((f) => f.diaSemana === d);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/equipo" className="text-sm text-[var(--fo-muted)] hover:underline">
          ← Jornadas
        </Link>
        <PageHeader title={miembro.nombre} description={miembro.email} />
      </div>

      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Guardado.</p> : null}
      {faltan.length > 0 ? (
        <p className="fo-card p-4 text-sm">Falta cargar {faltan.join(", ")}.</p>
      ) : null}

      <form action={guardarFichaAction} className="fo-card space-y-6 p-5">
        <input type="hidden" name="userId" value={userId} />
        <h2 className="text-base font-semibold">Datos y horario fijo</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="apodo">
              Cómo la saludan los mensajes
            </label>
            <input id="apodo" name="apodo" className="fo-input" defaultValue={ficha.apodo ?? ""} placeholder="Ej.: Cami" maxLength={40} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="fechaNacimiento">
              Fecha de nacimiento
            </label>
            <input id="fechaNacimiento" name="fechaNacimiento" type="date" className="fo-input" defaultValue={ficha.fechaNacimiento ?? ""} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="jornadaHoras">
              Jornada de referencia (horas)
            </label>
            <input
              id="jornadaHoras"
              name="jornadaHoras"
              inputMode="decimal"
              className="fo-input"
              defaultValue={String(ficha.jornadaMinutos / 60).replace(".", ",")}
            />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="fo-label">Horario semanal (dejá vacío el día que no trabaja)</legend>
          <div className="space-y-2">
            {NOMBRES_DIAS.map((nombre, d) => (
              <div key={nombre} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 font-medium">{capital(nombre)}</span>
                {Array.from({ length: FRANJAS_POR_DIA }, (_, i) => {
                  const f = franjasDe(d)[i];
                  return (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 ? <span className="text-[var(--fo-muted)]">y</span> : null}
                      <input
                        type="time"
                        aria-label={`${capital(nombre)}, entrada ${i + 1}`}
                        name={`f-${d}-${i + 1}-inicio`}
                        defaultValue={f ? horaParaCampo(f.inicioMin) : ""}
                        className="fo-input w-28"
                      />
                      <span className="text-[var(--fo-muted)]">a</span>
                      <input
                        type="time"
                        aria-label={`${capital(nombre)}, salida ${i + 1}`}
                        name={`f-${d}-${i + 1}-fin`}
                        defaultValue={f ? horaParaCampo(f.finMin) : ""}
                        className="fo-input w-28"
                      />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sabadosAlternados" defaultChecked={ficha.sabadosAlternados} />
            Los sábados van alternados (uno sí, uno no)
          </label>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="sabadoReferencia">
              Un sábado que le toca trabajar
            </label>
            <input id="sabadoReferencia" name="sabadoReferencia" type="date" className="fo-input" defaultValue={ficha.sabadoReferencia ?? ""} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activa" defaultChecked={ficha.activa} />
          Ficha activa (el módulo la cuenta y le muestra los mensajes)
        </label>

        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          Guardar ficha
        </button>
      </form>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Valor de la jornada</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {vigente ? (
            <>
              Hoy rige <strong>{formatMinorArs(vigente.valorMinor)}</strong> por jornada de {duracionLegible(ficha.jornadaMinutos)}, desde el{" "}
              {fechaLegible(vigente.desde)}. Un día con menos horas en el horario fijo vale la parte proporcional.
            </>
          ) : (
            "Todavía no tiene valor de jornada."
          )}
        </p>
        {ficha.valores.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {ficha.valores.map((v) => (
              <li key={v.id} className="tabular-nums">
                Desde el {fechaLegible(v.desde)}: {formatMinorArs(v.valorMinor)}
              </li>
            ))}
          </ul>
        ) : null}
        <form action={agregarValorJornadaAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="userId" value={userId} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="valorArs">
              Nuevo valor
            </label>
            <InputMoneda id="valorArs" name="valorArs" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="desde">
              Rige desde
            </label>
            <input id="desde" name="desde" type="date" className="fo-input" defaultValue={hoy} required />
          </div>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm">
            Agregar valor
          </button>
        </form>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Cambios puntuales</h2>
        <p className="text-sm text-[var(--fo-muted)]">Para un día que cambió el turno, faltó con aviso o está de vacaciones.</p>
        {ficha.cambios.length > 0 ? (
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {ficha.cambios.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {fechaLegible(c.fecha)} · {MOTIVOS_CAMBIO[c.motivo]} ·{" "}
                  {c.tipo === "TRABAJA" && c.inicioMin !== null && c.finMin !== null
                    ? `trabaja de ${horaLegible(c.inicioMin)} a ${horaLegible(c.finMin)}`
                    : "no trabaja"}
                  {c.nota ? ` · ${c.nota}` : ""}
                </span>
                <form action={borrarCambioAction}>
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="cambioId" value={c.id} />
                  <button type="submit" className="fo-btn fo-btn-ghost text-sm">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={guardarCambioAction} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="userId" value={userId} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cambio-fecha">
              Fecha
            </label>
            <input id="cambio-fecha" name="fecha" type="date" className="fo-input" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cambio-motivo">
              Motivo
            </label>
            <select id="cambio-motivo" name="motivo" className="fo-input" defaultValue="CAMBIO_TURNO">
              {Object.entries(MOTIVOS_CAMBIO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cambio-tipo">
              Ese día
            </label>
            <select id="cambio-tipo" name="tipo" className="fo-input" defaultValue="NO_TRABAJA">
              <option value="NO_TRABAJA">No trabaja</option>
              <option value="TRABAJA">Trabaja en este horario</option>
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cambio-inicio">
              Entrada (si trabaja)
            </label>
            <input id="cambio-inicio" name="inicio" type="time" className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cambio-fin">
              Salida (si trabaja)
            </label>
            <input id="cambio-fin" name="fin" type="time" className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cambio-nota">
              Nota
            </label>
            <input id="cambio-nota" name="nota" className="fo-input" maxLength={300} />
          </div>
          <div>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Guardar cambio
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Últimos {DIAS_RECIENTES} días</h2>
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Día</th>
                <th className="px-4 py-3 font-semibold">Horario fijo</th>
                <th className="px-4 py-3 font-semibold">Entrada → salida</th>
                <th className="px-4 py-3 font-semibold">Frente al horario</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Corregir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {jornadas.map((j) => (
                <tr key={j.fecha} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {capital(NOMBRES_DIAS[diaDeSemana(j.fecha)])} {fechaLegible(j.fecha).slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">{textoHorario(horarioDelDia(horario, ficha.cambios, j.fecha))}</td>
                  <td className="px-4 py-3">
                    <EntradaSalida j={j} />
                  </td>
                  <td className="px-4 py-3">
                    <Diferencias j={j} />
                  </td>
                  <td className="px-4 py-3">
                    <EstadoJornada j={j} />
                    {j.nota ? <p className="text-xs text-[var(--fo-muted)]">{j.nota}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-[var(--fo-muted)]">Corregir</summary>
                      <form action={corregirJornadaAction} className="mt-2 space-y-2">
                        <input type="hidden" name="userId" value={userId} />
                        <input type="hidden" name="fecha" value={j.fecha} />
                        <div className="flex gap-2">
                          <input type="time" name="entrada" aria-label="Entrada" className="fo-input w-28" />
                          <input type="time" name="salida" aria-label="Salida" className="fo-input w-28" />
                        </div>
                        <input name="nota" required className="fo-input" placeholder="Por qué se corrige" maxLength={300} />
                        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                          Guardar corrección
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
