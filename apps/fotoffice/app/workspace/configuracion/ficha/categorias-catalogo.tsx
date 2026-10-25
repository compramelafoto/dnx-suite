"use client";

import { useActionState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import {
  activarCategoriaAction,
  crearCategoriaAction,
  desactivarCategoriaAction,
  moverCategoriaAction,
  renombrarCategoriaAction,
  type EstadoCatalogo,
} from "./actions";
import { Mensaje } from "./mensaje";

export type CategoriaFila = { id: string; name: string; isActive: boolean; notas: number };

const INICIAL: EstadoCatalogo = { error: null };

/** Un solo estado por fila: el botón que envía dice qué hacer (`_accion`). */
async function despachar(prev: EstadoCatalogo, fd: FormData): Promise<EstadoCatalogo> {
  switch (fd.get("_accion")) {
    case "renombrar":
      return renombrarCategoriaAction(prev, fd);
    case "subir":
    case "bajar":
      fd.set("hacia", String(fd.get("_accion")));
      return moverCategoriaAction(prev, fd);
    case "desactivar":
      return desactivarCategoriaAction(prev, fd);
    case "activar":
      return activarCategoriaAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

function Fila({ c, primera, ultima, unicaActiva }: { c: CategoriaFila; primera: boolean; ultima: boolean; unicaActiva: boolean }) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={enviar} className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="id" value={c.id} />
          <label className="sr-only" htmlFor={`cat-${c.id}`}>
            Nombre de la categoría
          </label>
          <input
            id={`cat-${c.id}`}
            name="nombre"
            defaultValue={c.name}
            maxLength={40}
            required
            className={`fo-input min-w-0 flex-1 ${c.isActive ? "" : "text-[var(--fo-muted)]"}`}
          />
          <button type="submit" name="_accion" value="renombrar" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
            Guardar
          </button>
        </form>
        <form action={enviar} className="flex items-center gap-1">
          <input type="hidden" name="id" value={c.id} />
          {c.isActive ? (
            <>
              <button
                type="submit"
                name="_accion"
                value="subir"
                className="fo-icon-btn"
                disabled={pendiente || primera}
                aria-label={`Subir ${c.name}`}
                title="Subir"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="submit"
                name="_accion"
                value="bajar"
                className="fo-icon-btn"
                disabled={pendiente || ultima}
                aria-label={`Bajar ${c.name}`}
                title="Bajar"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="submit"
                name="_accion"
                value="desactivar"
                className="fo-btn fo-btn-ghost text-xs"
                disabled={pendiente || unicaActiva}
                title={unicaActiva ? "Tiene que quedar al menos una activa" : undefined}
              >
                Desactivar
              </button>
            </>
          ) : (
            <button type="submit" name="_accion" value="activar" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente}>
              Volver a activar
            </button>
          )}
        </form>
      </div>
      <p className="text-xs text-[var(--fo-muted)]">
        {c.isActive ? "Activa" : "Desactivada: no se ofrece para notas nuevas"} · {c.notas === 1 ? "1 nota" : `${c.notas} notas`}
      </p>
      <Mensaje estado={estado} />
    </li>
  );
}

export function CategoriasCatalogo({ categorias }: { categorias: CategoriaFila[] }) {
  const [estado, crear, creando] = useActionState(crearCategoriaAction, INICIAL);
  const activas = categorias.filter((c) => c.isActive);
  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="cat-titulo">
      <div className="space-y-1">
        <h2 id="cat-titulo" className="text-base font-semibold">
          Categorías de notas
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Aparecen en este orden al escribir una nota. Desactivar una no cambia las notas que ya la usan.
        </p>
      </div>
      <ul className="divide-y divide-[var(--fo-border)]">
        {categorias.map((c) => {
          const i = activas.findIndex((a) => a.id === c.id);
          return (
            <Fila
              key={c.id}
              c={c}
              primera={i === 0}
              ultima={i === activas.length - 1}
              unicaActiva={c.isActive && activas.length === 1}
            />
          );
        })}
      </ul>
      <form action={crear} className="flex flex-wrap items-end gap-2">
        <div className="fo-field-stack min-w-0 flex-1">
          <label className="fo-label" htmlFor="cat-nueva">
            Nueva categoría
          </label>
          <input id="cat-nueva" name="nombre" maxLength={40} required className="fo-input" placeholder="Por ejemplo: Presupuesto" />
        </div>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={creando}>
          <Plus className="size-4" aria-hidden />
          Agregar
        </button>
      </form>
      <Mensaje estado={estado} />
    </section>
  );
}
