"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Copy, Plus, Star } from "lucide-react";
import type { CircuitoConfig } from "@/lib/circuitos/configuracion";
import {
  activarCircuitoAction,
  clonarCircuitoAction,
  crearCircuitoAction,
  marcarPredeterminadoAction,
  renombrarCircuitoAction,
  type EstadoCircuitos,
} from "./actions";
import { Mensaje } from "../ficha/mensaje";

const INICIAL: EstadoCircuitos = { error: null };

const GRUPOS = [
  { clase: "VENTA", titulo: "Circuitos de venta", ayuda: "Por dónde pasa una consulta hasta que se gana o se pierde." },
  { clase: "TRABAJO", titulo: "Circuitos de trabajo", ayuda: "Por dónde pasa un trabajo vendido hasta que se termina." },
] as const;

/** Un solo estado por circuito: el botón que envía dice qué hacer (`_accion`). */
async function despachar(prev: EstadoCircuitos, fd: FormData): Promise<EstadoCircuitos> {
  switch (fd.get("_accion")) {
    case "renombrar":
      return renombrarCircuitoAction(prev, fd);
    case "clonar":
      return clonarCircuitoAction(prev, fd);
    case "activar":
      fd.set("activo", "1");
      return activarCircuitoAction(prev, fd);
    case "desactivar":
      fd.set("activo", "0");
      return activarCircuitoAction(prev, fd);
    case "predeterminado":
      return marcarPredeterminadoAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

function Fila({ c, elegido }: { c: CircuitoConfig; elegido: boolean }) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  const [copiando, setCopiando] = useState(false);
  const activas = c.etapas.filter((e) => !e.archivada).length;
  return (
    <li className={`space-y-2 py-3 ${elegido ? "rounded-lg bg-[var(--fo-surface)] px-3" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <form action={enviar} className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="id" value={c.id} />
          <label className="sr-only" htmlFor={`circ-${c.id}`}>
            Nombre del circuito
          </label>
          <input
            id={`circ-${c.id}`}
            name="nombre"
            defaultValue={c.name}
            maxLength={60}
            required
            className={`fo-input min-w-0 flex-1 ${c.isActive ? "" : "text-[var(--fo-muted)]"}`}
          />
          <button type="submit" name="_accion" value="renombrar" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
            Guardar
          </button>
        </form>
        <form action={enviar} className="flex flex-wrap items-center gap-1">
          <input type="hidden" name="id" value={c.id} />
          {c.isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              <Star className="size-3" aria-hidden />
              Predeterminado
            </span>
          ) : c.isActive ? (
            <button type="submit" name="_accion" value="predeterminado" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente}>
              Hacer predeterminado
            </button>
          ) : null}
          {c.isActive ? (
            <button
              type="submit"
              name="_accion"
              value="desactivar"
              className="fo-btn fo-btn-ghost text-xs"
              disabled={pendiente || c.isDefault}
              title={c.isDefault ? "Marcá otro como predeterminado antes de desactivarlo" : undefined}
            >
              Desactivar
            </button>
          ) : (
            <button type="submit" name="_accion" value="activar" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente}>
              Volver a activar
            </button>
          )}
          <button
            type="button"
            className="fo-btn fo-btn-ghost text-xs"
            onClick={() => setCopiando((v) => !v)}
            aria-expanded={copiando}
          >
            <Copy className="size-3.5" aria-hidden />
            Copiar
          </button>
          <Link
            href={`/workspace/configuracion/circuitos?circuito=${encodeURIComponent(c.id)}#etapas`}
            className="fo-btn fo-btn-secondary text-xs"
            aria-current={elegido ? "true" : undefined}
          >
            Editar etapas
          </Link>
        </form>
      </div>
      {copiando ? (
        <form action={enviar} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={c.id} />
          <div className="fo-field-stack min-w-0 flex-1">
            <label className="fo-label" htmlFor={`copia-${c.id}`}>
              Nombre de la copia
            </label>
            <input id={`copia-${c.id}`} name="nombre" defaultValue={`${c.name} (copia)`} maxLength={60} required className="fo-input" />
          </div>
          <button type="submit" name="_accion" value="clonar" className="fo-btn fo-btn-primary text-xs" disabled={pendiente}>
            Copiar circuito
          </button>
        </form>
      ) : null}
      <p className="text-xs text-[var(--fo-muted)]">
        {c.isActive ? "Activo" : "Desactivado: no se ofrece para registros nuevos"} ·{" "}
        {activas === 1 ? "1 etapa" : `${activas} etapas`}
      </p>
      <Mensaje estado={estado} />
    </li>
  );
}

export function CircuitosLista({ circuitos, elegidoId }: { circuitos: CircuitoConfig[]; elegidoId: string | null }) {
  const [estado, crear, creando] = useActionState(crearCircuitoAction, INICIAL);
  return (
    <section className="fo-card space-y-6 p-5" aria-labelledby="circ-titulo">
      <div className="space-y-1">
        <h2 id="circ-titulo" className="text-base font-semibold">
          Circuitos
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          El predeterminado de cada clase es donde arrancan los registros nuevos. Una copia trae las etapas, tareas y
          avances automáticos, pero ningún registro.
        </p>
      </div>
      {GRUPOS.map((g) => {
        const lista = circuitos.filter((c) => c.kind === g.clase);
        return (
          <div key={g.clase} className="space-y-1">
            <h3 className="text-sm font-semibold">{g.titulo}</h3>
            <p className="text-xs text-[var(--fo-muted)]">{g.ayuda}</p>
            {lista.length ? (
              <ul className="divide-y divide-[var(--fo-border)]">
                {lista.map((c) => (
                  <Fila key={c.id} c={c} elegido={c.id === elegidoId} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-[var(--fo-muted)]">Todavía no hay ninguno.</p>
            )}
          </div>
        );
      })}
      <form action={crear} className="flex flex-wrap items-end gap-2">
        <div className="fo-field-stack min-w-0 flex-1">
          <label className="fo-label" htmlFor="circ-nuevo">
            Nuevo circuito
          </label>
          <input id="circ-nuevo" name="nombre" maxLength={60} required className="fo-input" placeholder="Por ejemplo: Bodas" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="circ-clase">
            Clase
          </label>
          <select id="circ-clase" name="clase" defaultValue="VENTA" className="fo-input">
            <option value="VENTA">Venta</option>
            <option value="TRABAJO">Trabajo</option>
          </select>
        </div>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={creando}>
          <Plus className="size-4" aria-hidden />
          Crear
        </button>
      </form>
      <Mensaje estado={estado} />
    </section>
  );
}
