"use client";

import { useActionState, useState, type MouseEvent } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ETIQUETA_TIPO_CAMPO, MAX_NOMBRE_CAMPO, TIPOS_CAMPO, type TipoCampo } from "@/lib/campos/constantes";
import { Mensaje } from "../ficha/mensaje";
import {
  archivarCampoAction,
  archivarOpcionAction,
  borrarCampoAction,
  crearCampoAction,
  crearOpcionAction,
  desarchivarCampoAction,
  editarCampoAction,
  renombrarOpcionAction,
  reordenarCamposAction,
  reordenarOpcionesAction,
  type EstadoCampos,
} from "./actions";

export type CampoFila = {
  id: string;
  name: string;
  type: TipoCampo;
  required: boolean;
  showInList: boolean;
  archivado: boolean;
  /** Valores guardados: con datos no se borra ni cambia de tipo. */
  valores: number;
  /** Opciones activas, en orden (sólo Lista). */
  opciones: { id: string; label: string }[];
};

const INICIAL: EstadoCampos = { error: null };

/** `ids` con el elemento `i` movido `delta` lugares (el orden nuevo completo). */
function mover(ids: string[], i: number, delta: number): string[] {
  const otro = i + delta;
  if (otro < 0 || otro >= ids.length) return ids;
  const copia = [...ids];
  [copia[i], copia[otro]] = [copia[otro]!, copia[i]!];
  return copia;
}

function textoValores(n: number): string {
  if (n === 0) return "Sin datos guardados";
  return n === 1 ? "1 dato guardado" : `${n} datos guardados`;
}

/** Pide confirmación antes de enviar un botón que borra. */
function confirmarBorrado(nombre: string) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(`¿Borrar el campo "${nombre}"? No se puede deshacer.`)) e.preventDefault();
  };
}

/** Un solo estado por campo: el botón que envía dice qué hacer (`_accion`). */
async function despacharCampo(prev: EstadoCampos, fd: FormData): Promise<EstadoCampos> {
  switch (fd.get("_accion")) {
    case "editar":
      return editarCampoAction(prev, fd);
    case "mover":
      return reordenarCamposAction(prev, fd);
    case "archivar":
      return archivarCampoAction(prev, fd);
    case "desarchivar":
      return desarchivarCampoAction(prev, fd);
    case "borrar":
      return borrarCampoAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

async function despacharOpcion(prev: EstadoCampos, fd: FormData): Promise<EstadoCampos> {
  switch (fd.get("_accion")) {
    case "renombrar":
      return renombrarOpcionAction(prev, fd);
    case "mover":
      return reordenarOpcionesAction(prev, fd);
    case "archivar":
      return archivarOpcionAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

/** Botón subir/bajar: manda el orden nuevo completo. */
function BotonMover({
  enviar,
  orden,
  extra,
  direccion,
  nombre,
  deshabilitado,
}: {
  enviar: (fd: FormData) => void;
  orden: string[];
  extra: Record<string, string>;
  direccion: "subir" | "bajar";
  nombre: string;
  deshabilitado: boolean;
}) {
  const Icono = direccion === "subir" ? ArrowUp : ArrowDown;
  return (
    <form action={enviar}>
      <input type="hidden" name="_accion" value="mover" />
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {orden.map((id) => (
        <input key={id} type="hidden" name="orden" value={id} />
      ))}
      <button
        type="submit"
        className="fo-icon-btn"
        disabled={deshabilitado}
        aria-label={`${direccion === "subir" ? "Subir" : "Bajar"} ${nombre}`}
        title={direccion === "subir" ? "Subir" : "Bajar"}
      >
        <Icono className="size-4" />
      </button>
    </form>
  );
}

// ─── Opciones de una Lista ───────────────────────────────────────────────────

function FilaOpcion({
  campoId,
  opcion,
  ids,
  i,
}: {
  campoId: string;
  opcion: { id: string; label: string };
  ids: string[];
  i: number;
}) {
  const [estado, enviar, pendiente] = useActionState(despacharOpcion, INICIAL);
  return (
    <li className="space-y-1 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={enviar} className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="id" value={opcion.id} />
          <label className="sr-only" htmlFor={`op-${opcion.id}`}>
            Nombre de la opción
          </label>
          <input
            id={`op-${opcion.id}`}
            name="etiqueta"
            defaultValue={opcion.label}
            maxLength={MAX_NOMBRE_CAMPO}
            required
            className="fo-input min-w-0 flex-1 text-sm"
          />
          <button type="submit" name="_accion" value="renombrar" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
            Guardar
          </button>
        </form>
        <BotonMover
          enviar={enviar}
          orden={mover(ids, i, -1)}
          extra={{ campoId }}
          direccion="subir"
          nombre={opcion.label}
          deshabilitado={pendiente || i === 0}
        />
        <BotonMover
          enviar={enviar}
          orden={mover(ids, i, 1)}
          extra={{ campoId }}
          direccion="bajar"
          nombre={opcion.label}
          deshabilitado={pendiente || i === ids.length - 1}
        />
        <form action={enviar}>
          <input type="hidden" name="id" value={opcion.id} />
          <button
            type="submit"
            name="_accion"
            value="archivar"
            className="fo-icon-btn"
            disabled={pendiente}
            aria-label={`Archivar la opción ${opcion.label}`}
            title="Archivar: deja de ofrecerse; los datos que la usan la siguen mostrando"
          >
            <Archive className="size-4" />
          </button>
        </form>
      </div>
      <Mensaje estado={estado} />
    </li>
  );
}

function OpcionesEditor({ campoId, nombre, opciones }: { campoId: string; nombre: string; opciones: { id: string; label: string }[] }) {
  const [estado, crear, creando] = useActionState(crearOpcionAction, INICIAL);
  const ids = opciones.map((o) => o.id);
  return (
    <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
      <p className="text-xs font-medium text-[var(--fo-muted)]">Opciones de {nombre}</p>
      {opciones.length === 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">Todavía no tiene opciones.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)]">
          {opciones.map((o, i) => (
            <FilaOpcion key={o.id} campoId={campoId} opcion={o} ids={ids} i={i} />
          ))}
        </ul>
      )}
      <form action={crear} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="campoId" value={campoId} />
        <label className="sr-only" htmlFor={`op-nueva-${campoId}`}>
          Nueva opción
        </label>
        <input
          id={`op-nueva-${campoId}`}
          name="etiqueta"
          maxLength={MAX_NOMBRE_CAMPO}
          required
          className="fo-input min-w-0 flex-1 text-sm"
          placeholder="Nueva opción"
        />
        <button type="submit" className="fo-btn fo-btn-secondary text-xs" disabled={creando}>
          <Plus className="size-4" aria-hidden />
          Agregar opción
        </button>
      </form>
      <Mensaje estado={estado} />
    </div>
  );
}

// ─── Campos ──────────────────────────────────────────────────────────────────

function FilaCampo({
  entityType,
  c,
  ids,
  i,
}: {
  entityType: string;
  c: CampoFila;
  ids: string[];
  i: number;
}) {
  const [estado, enviar, pendiente] = useActionState(despacharCampo, INICIAL);
  return (
    <li className="space-y-2 py-4">
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={c.id} />
        <div className="fo-field-stack min-w-[12rem] flex-1">
          <label className="fo-label" htmlFor={`campo-${c.id}`}>
            Nombre
          </label>
          <input
            id={`campo-${c.id}`}
            name="nombre"
            defaultValue={c.name}
            maxLength={MAX_NOMBRE_CAMPO}
            required
            className="fo-input"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`tipo-${c.id}`}>
            Tipo
          </label>
          <select id={`tipo-${c.id}`} name="tipo" defaultValue={c.type} className="fo-input">
            {TIPOS_CAMPO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_CAMPO[t]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="obligatorio" value="1" defaultChecked={c.required} />
          Obligatorio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enListado" value="1" defaultChecked={c.showInList} />
          Mostrar en el listado
        </label>
        <button type="submit" name="_accion" value="editar" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
          Guardar
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-2 text-xs text-[var(--fo-muted)]">
          {ETIQUETA_TIPO_CAMPO[c.type]} · {textoValores(c.valores)}
          {c.valores > 0 ? " (no se le puede cambiar el tipo)" : ""}
        </span>
        <BotonMover
          enviar={enviar}
          orden={mover(ids, i, -1)}
          extra={{ entityType }}
          direccion="subir"
          nombre={c.name}
          deshabilitado={pendiente || i === 0}
        />
        <BotonMover
          enviar={enviar}
          orden={mover(ids, i, 1)}
          extra={{ entityType }}
          direccion="bajar"
          nombre={c.name}
          deshabilitado={pendiente || i === ids.length - 1}
        />
        <form action={enviar}>
          <input type="hidden" name="id" value={c.id} />
          <button
            type="submit"
            name="_accion"
            value="archivar"
            className="fo-btn fo-btn-ghost text-xs"
            disabled={pendiente}
            title="Deja de verse en fichas y listados; los datos quedan guardados"
          >
            <Archive className="size-4" aria-hidden />
            Archivar
          </button>
        </form>
        {c.valores === 0 ? (
          <form action={enviar}>
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              name="_accion"
              value="borrar"
              className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]"
              disabled={pendiente}
              onClick={confirmarBorrado(c.name)}
            >
              <Trash2 className="size-4" aria-hidden />
              Borrar
            </button>
          </form>
        ) : null}
      </div>
      <Mensaje estado={estado} />
      {c.type === "LISTA" ? <OpcionesEditor campoId={c.id} nombre={c.name} opciones={c.opciones} /> : null}
    </li>
  );
}

function FilaArchivada({ c }: { c: CampoFila }) {
  const [estado, enviar, pendiente] = useActionState(despacharCampo, INICIAL);
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-[var(--fo-muted)]">
          {c.name} · {ETIQUETA_TIPO_CAMPO[c.type]} · {textoValores(c.valores)}
        </span>
        <form action={enviar}>
          <input type="hidden" name="id" value={c.id} />
          <button type="submit" name="_accion" value="desarchivar" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente}>
            <ArchiveRestore className="size-4" aria-hidden />
            Desarchivar
          </button>
        </form>
        {c.valores === 0 ? (
          <form action={enviar}>
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              name="_accion"
              value="borrar"
              className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]"
              disabled={pendiente}
              onClick={confirmarBorrado(c.name)}
            >
              <Trash2 className="size-4" aria-hidden />
              Borrar
            </button>
          </form>
        ) : null}
      </div>
      <Mensaje estado={estado} />
    </li>
  );
}

function NuevoCampo({ entityType }: { entityType: string }) {
  const [estado, crear, creando] = useActionState(crearCampoAction, INICIAL);
  const [tipo, setTipo] = useState<TipoCampo>("TEXTO");
  return (
    <form action={crear} onReset={() => setTipo("TEXTO")} className="space-y-3 border-t border-[var(--fo-border)] pt-4">
      <input type="hidden" name="entityType" value={entityType} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="fo-field-stack min-w-[12rem] flex-1">
          <label className="fo-label" htmlFor={`nuevo-${entityType}`}>
            Nuevo campo
          </label>
          <input
            id={`nuevo-${entityType}`}
            name="nombre"
            maxLength={MAX_NOMBRE_CAMPO}
            required
            className="fo-input"
            placeholder="Por ejemplo: Fecha del evento"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`nuevo-tipo-${entityType}`}>
            Tipo
          </label>
          <select
            id={`nuevo-tipo-${entityType}`}
            name="tipo"
            defaultValue="TEXTO"
            onChange={(e) => setTipo(e.target.value as TipoCampo)}
            className="fo-input"
          >
            {TIPOS_CAMPO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_CAMPO[t]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="obligatorio" value="1" />
          Obligatorio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enListado" value="1" />
          Mostrar en el listado
        </label>
      </div>
      {tipo === "LISTA" ? (
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`nuevo-opciones-${entityType}`}>
            Opciones (una por renglón; se pueden agregar después)
          </label>
          <textarea id={`nuevo-opciones-${entityType}`} name="opciones" rows={4} className="fo-input" />
        </div>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={creando}>
        <Plus className="size-4" aria-hidden />
        Agregar campo
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function CamposLista({ entityType, titulo, campos }: { entityType: string; titulo: string; campos: CampoFila[] }) {
  const activos = campos.filter((c) => !c.archivado);
  const archivados = campos.filter((c) => c.archivado);
  const ids = activos.map((c) => c.id);
  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="campos-titulo">
      <div className="space-y-1">
        <h2 id="campos-titulo" className="text-base font-semibold">
          Campos de {titulo}
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Aparecen en este orden en la tarjeta &quot;Más datos&quot; de la ficha. Un campo con datos no se borra: se archiva y
          sus datos quedan guardados.
        </p>
      </div>
      {activos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay campos.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)]">
          {activos.map((c, i) => (
            <FilaCampo key={c.id} entityType={entityType} c={c} ids={ids} i={i} />
          ))}
        </ul>
      )}
      <NuevoCampo entityType={entityType} />
      {archivados.length > 0 ? (
        <details className="border-t border-[var(--fo-border)] pt-3">
          <summary className="cursor-pointer text-sm font-medium">Archivados ({archivados.length})</summary>
          <ul className="divide-y divide-[var(--fo-border)]">
            {archivados.map((c) => (
              <FilaArchivada key={c.id} c={c} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
