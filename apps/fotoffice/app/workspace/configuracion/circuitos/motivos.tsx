"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import type { MotivoConfig } from "@/lib/circuitos/configuracion";
import {
  activarMotivoAction,
  crearMotivoAction,
  ordenarMotivosAction,
  renombrarMotivoAction,
  type EstadoCircuitos,
} from "./actions";
import { Mensaje } from "../ficha/mensaje";

const INICIAL: EstadoCircuitos = { error: null };

async function despachar(prev: EstadoCircuitos, fd: FormData): Promise<EstadoCircuitos> {
  switch (fd.get("_accion")) {
    case "renombrar":
      return renombrarMotivoAction(prev, fd);
    case "activar":
      fd.set("activo", "1");
      return activarMotivoAction(prev, fd);
    case "desactivar":
      fd.set("activo", "0");
      return activarMotivoAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

function Fila({
  m,
  primero,
  ultimo,
  unicoActivo,
  ocupado,
  mover,
}: {
  m: MotivoConfig;
  primero: boolean;
  ultimo: boolean;
  unicoActivo: boolean;
  ocupado: boolean;
  mover: (hacia: -1 | 1) => void;
}) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={enviar} className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="id" value={m.id} />
          <label className="sr-only" htmlFor={`mot-${m.id}`}>
            Motivo
          </label>
          <input
            id={`mot-${m.id}`}
            name="nombre"
            defaultValue={m.name}
            maxLength={60}
            required
            className={`fo-input min-w-0 flex-1 ${m.isActive ? "" : "text-[var(--fo-muted)]"}`}
          />
          <button type="submit" name="_accion" value="renombrar" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
            Guardar
          </button>
        </form>
        <form action={enviar} className="flex items-center gap-1">
          <input type="hidden" name="id" value={m.id} />
          {m.isActive ? (
            <>
              <button
                type="button"
                className="fo-icon-btn"
                disabled={ocupado || primero}
                onClick={() => mover(-1)}
                aria-label={`Subir ${m.name}`}
                title="Subir"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                className="fo-icon-btn"
                disabled={ocupado || ultimo}
                onClick={() => mover(1)}
                aria-label={`Bajar ${m.name}`}
                title="Bajar"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="submit"
                name="_accion"
                value="desactivar"
                className="fo-btn fo-btn-ghost text-xs"
                disabled={pendiente || unicoActivo}
                title={unicoActivo ? "Tiene que quedar al menos uno activo" : undefined}
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
      {m.isActive ? null : <p className="text-xs text-[var(--fo-muted)]">Desactivado: no se ofrece al cerrar como perdido.</p>}
      <Mensaje estado={estado} />
    </li>
  );
}

export function Motivos({ motivos }: { motivos: MotivoConfig[] }) {
  const [estado, crear, creando] = useActionState(crearMotivoAction, INICIAL);
  const activosIds = motivos.filter((m) => m.isActive).map((m) => m.id);
  const [orden, setOrden] = useOptimistic(activosIds);
  const [estadoOrden, setEstadoOrden] = useState<EstadoCircuitos>(INICIAL);
  const [ordenando, startTransition] = useTransition();
  const porId = new Map(motivos.map((m) => [m.id, m]));
  const inactivos = motivos.filter((m) => !m.isActive);

  function mover(i: number, hacia: -1 | 1) {
    const j = i + hacia;
    if (j < 0 || j >= orden.length) return;
    const nuevo = [...orden];
    [nuevo[i], nuevo[j]] = [nuevo[j]!, nuevo[i]!];
    startTransition(async () => {
      setOrden(nuevo);
      const fd = new FormData();
      for (const id of nuevo) fd.append("motivo", id);
      setEstadoOrden(await ordenarMotivosAction(undefined, fd));
    });
  }

  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="mot-titulo">
      <div className="space-y-1">
        <h2 id="mot-titulo" className="text-base font-semibold">
          Motivos de pérdida
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Se eligen al cerrar una venta como perdida o cancelar un trabajo. Desactivar uno no cambia los registros que ya lo usan.
        </p>
      </div>
      <ul className="divide-y divide-[var(--fo-border)]" aria-busy={ordenando}>
        {orden.map((id, i) => {
          const m = porId.get(id);
          if (!m) return null;
          return (
            <Fila
              key={id}
              m={m}
              primero={i === 0}
              ultimo={i === orden.length - 1}
              unicoActivo={orden.length === 1}
              ocupado={ordenando}
              mover={(h) => mover(i, h)}
            />
          );
        })}
        {inactivos.map((m) => (
          <Fila key={m.id} m={m} primero ultimo unicoActivo={false} ocupado={ordenando} mover={() => {}} />
        ))}
      </ul>
      <Mensaje estado={estadoOrden} />
      <form action={crear} className="flex flex-wrap items-end gap-2">
        <div className="fo-field-stack min-w-0 flex-1">
          <label className="fo-label" htmlFor="mot-nuevo">
            Nuevo motivo
          </label>
          <input id="mot-nuevo" name="nombre" maxLength={60} required className="fo-input" placeholder="Por ejemplo: Eligió otro fotógrafo" />
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
