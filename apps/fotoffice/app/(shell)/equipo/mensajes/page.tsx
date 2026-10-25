import { PageHeader } from "@/components/page-header";
import { requireEquipo } from "@/lib/equipo/acceso";
import {
  ETIQUETA_MOMENTO,
  ETIQUETA_OCASION,
  ETIQUETA_PARTE,
  LARGO_MAXIMO_PIEZA,
  MOMENTOS,
  OCASIONES,
  PARTES,
  VARIABLES,
  type MomentoPieza,
  type Pieza,
} from "@/lib/equipo/mensajes";
import { piezasDelEspacio } from "@/lib/equipo/mensajes-servidor";
import { cargarRepertorioAction, crearPiezaAction, guardarPiezaAction } from "../actions";

export const dynamic = "force-dynamic";

const MOMENTOS_PIEZA: MomentoPieza[] = [...MOMENTOS, "CUALQUIERA"];

function titulo(p: Pick<Pieza, "momento" | "parte" | "ocasion">): string {
  const base = `${ETIQUETA_MOMENTO[p.momento]} · ${ETIQUETA_PARTE[p.parte]}`;
  return p.ocasion ? `${ETIQUETA_OCASION[p.ocasion]} · ${ETIQUETA_PARTE[p.parte]}` : base;
}

/**
 * El repertorio de mensajes: cada mensaje combina un saludo, una frase del medio y un cierre.
 * El dueño edita, apaga o agrega piezas. Nunca se le repite la misma combinación a la misma
 * persona en 30 días.
 */
export default async function MensajesEquipoPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const ctx = await requireEquipo();
  const sp = await searchParams;
  const piezas = await piezasDelEspacio(ctx.workspaceId);

  const grupos = new Map<string, Pieza[]>();
  for (const p of piezas) {
    const k = titulo(p);
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mensajes al equipo"
        description="Los saludos al abrir la caja, el aviso 5 minutos antes de la salida y el saludo al cerrar. Se arman combinando una pieza de cada parte."
      />
      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Guardado.</p> : null}

      <p className="text-sm text-[var(--fo-muted)]">
        Podés usar {VARIABLES.join(", ")}: el nombre, el día de la semana, las ventas que cargó ese día (la frase sólo sale si hubo
        alguna) y el nombre del feriado. En los cumpleaños, feriados, vísperas, fines de semana y fin de mes se usan las piezas de
        esa ocasión; si las apagás todas, salen las de todos los días.
      </p>

      {piezas.length === 0 ? (
        <form action={cargarRepertorioAction} className="fo-card space-y-3 p-5">
          <p className="text-sm">Todavía no hay mensajes cargados. Se cargan solos con el primer saludo, o podés cargarlos ahora para revisarlos.</p>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Cargar el repertorio inicial
          </button>
        </form>
      ) : null}

      {[...grupos.entries()].map(([nombre, lista]) => (
        <details key={nombre} className="fo-card p-5">
          <summary className="cursor-pointer text-base font-semibold">
            {nombre} <span className="text-sm font-normal text-[var(--fo-muted)]">({lista.filter((p) => p.activa).length} de {lista.length} encendidas)</span>
          </summary>
          <ul className="mt-4 space-y-2">
            {lista.map((p) => (
              <li key={p.id} id={`pieza-${p.id}`}>
                <form action={guardarPiezaAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="piezaId" value={p.id} />
                  <input
                    name="texto"
                    defaultValue={p.texto}
                    maxLength={LARGO_MAXIMO_PIEZA}
                    aria-label="Texto de la pieza"
                    className="fo-input min-w-0 flex-1"
                  />
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="activa" defaultChecked={p.activa} />
                    Encendida
                  </label>
                  <button type="submit" className="fo-btn fo-btn-ghost text-sm">
                    Guardar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ))}

      <form action={crearPiezaAction} className="fo-card grid gap-3 p-5 sm:grid-cols-3">
        <h2 className="text-base font-semibold sm:col-span-3">Agregar una pieza</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="nueva-momento">
            Momento
          </label>
          <select id="nueva-momento" name="momento" className="fo-input" defaultValue="APERTURA">
            {MOMENTOS_PIEZA.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_MOMENTO[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="nueva-parte">
            Parte
          </label>
          <select id="nueva-parte" name="parte" className="fo-input" defaultValue="MEDIO">
            {PARTES.map((p) => (
              <option key={p} value={p}>
                {ETIQUETA_PARTE[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="nueva-ocasion">
            Ocasión
          </label>
          <select id="nueva-ocasion" name="ocasion" className="fo-input" defaultValue="">
            <option value="">Todos los días</option>
            {OCASIONES.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_OCASION[o]}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack sm:col-span-3">
          <label className="fo-label" htmlFor="nueva-texto">
            Texto
          </label>
          <input id="nueva-texto" name="texto" required maxLength={LARGO_MAXIMO_PIEZA} className="fo-input" placeholder="Ej.: ¡Gracias por la buena onda, {nombre}!" />
        </div>
        <div>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm">
            Agregar
          </button>
        </div>
      </form>
    </div>
  );
}
