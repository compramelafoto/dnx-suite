"use client";

import { useActionState, type MouseEvent } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ETIQUETA_GRUPO, GRUPOS_CONSULTA, type GrupoConsulta } from "@/lib/consultas/constantes";
import {
  archivarItemAction,
  borrarItemAction,
  crearItemAction,
  desarchivarItemAction,
  editarItemAction,
  reordenarAction,
  type EstadoConsultasConfig,
} from "./actions";

/** Tope de largo del nombre (el mismo de `MAX_NOMBRE_CATALOGO`; el servidor lo vuelve a mirar). */
const MAX_NOMBRE = 80;

export type CatalogoClave = "categorias" | "origenes" | "roles";

export type ItemFila = {
  id: string;
  name: string;
  archivado: boolean;
  /** Consultas (o participantes) que lo usan: con usos no se borra y, en categorías, el grupo queda fijo. */
  usos: number;
  /** Sólo en categorías. */
  grupo: GrupoConsulta | null;
};

const INICIAL: EstadoConsultasConfig = { error: null };

function Mensaje({ estado }: { estado: EstadoConsultasConfig | undefined }) {
  if (estado?.error) {
    return (
      <p role="alert" className="text-sm text-[var(--fo-danger)]">
        {estado.error}
      </p>
    );
  }
  if (estado?.ok) {
    return (
      <p role="status" className="text-sm text-[var(--fo-success)]">
        {estado.ok}
      </p>
    );
  }
  return null;
}

/** `ids` con el elemento `i` movido `delta` lugares (el orden nuevo completo). */
function mover(ids: string[], i: number, delta: number): string[] {
  const otro = i + delta;
  if (otro < 0 || otro >= ids.length) return ids;
  const copia = [...ids];
  [copia[i], copia[otro]] = [copia[otro]!, copia[i]!];
  return copia;
}

function textoUsos(catalogo: CatalogoClave, n: number): string {
  const cosa = catalogo === "roles" ? ["participante", "participantes"] : ["consulta", "consultas"];
  if (n === 0) return `Sin ${cosa[1]}`;
  return n === 1 ? `1 ${cosa[0]}` : `${n} ${cosa[1]}`;
}

function confirmarBorrado(nombre: string) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(`¿Borrar «${nombre}»? No se puede deshacer.`)) e.preventDefault();
  };
}

/** Un solo estado por fila: el botón que envía dice qué hacer (`_accion`). */
async function despachar(prev: EstadoConsultasConfig, fd: FormData): Promise<EstadoConsultasConfig> {
  switch (fd.get("_accion")) {
    case "editar":
      return editarItemAction(prev, fd);
    case "mover":
      return reordenarAction(prev, fd);
    case "archivar":
      return archivarItemAction(prev, fd);
    case "desarchivar":
      return desarchivarItemAction(prev, fd);
    case "borrar":
      return borrarItemAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

function BotonMover({
  enviar,
  catalogo,
  orden,
  direccion,
  nombre,
  deshabilitado,
}: {
  enviar: (fd: FormData) => void;
  catalogo: CatalogoClave;
  orden: string[];
  direccion: "subir" | "bajar";
  nombre: string;
  deshabilitado: boolean;
}) {
  const Icono = direccion === "subir" ? ArrowUp : ArrowDown;
  return (
    <form action={enviar}>
      <input type="hidden" name="_accion" value="mover" />
      <input type="hidden" name="catalogo" value={catalogo} />
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

function SelectorGrupo({ id, valor, bloqueado }: { id: string; valor: GrupoConsulta; bloqueado: boolean }) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={id}>
        Grupo
      </label>
      {/* Bloqueado no se envía: el servidor no cambia el grupo (y lo frena igual si llegara). */}
      <select id={id} name="grupo" defaultValue={valor} disabled={bloqueado} className="fo-input">
        {GRUPOS_CONSULTA.map((g) => (
          <option key={g} value={g}>
            {ETIQUETA_GRUPO[g]}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilaActiva({ catalogo, item, ids, i }: { catalogo: CatalogoClave; item: ItemFila; ids: string[]; i: number }) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  const grupoBloqueado = item.usos > 0;
  return (
    <li className="space-y-2 py-4">
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="catalogo" value={catalogo} />
        <div className="fo-field-stack min-w-[12rem] flex-1">
          <label className="fo-label" htmlFor={`item-${item.id}`}>
            Nombre
          </label>
          <input id={`item-${item.id}`} name="nombre" defaultValue={item.name} maxLength={MAX_NOMBRE} required className="fo-input" />
        </div>
        {catalogo === "categorias" && item.grupo ? (
          <SelectorGrupo id={`grupo-${item.id}`} valor={item.grupo} bloqueado={grupoBloqueado} />
        ) : null}
        <button type="submit" name="_accion" value="editar" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
          Guardar
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-2 text-xs text-[var(--fo-muted)]">
          {textoUsos(catalogo, item.usos)}
          {catalogo === "categorias" && grupoBloqueado ? " · el grupo no se puede cambiar porque ya tiene consultas" : ""}
        </span>
        <BotonMover enviar={enviar} catalogo={catalogo} orden={mover(ids, i, -1)} direccion="subir" nombre={item.name} deshabilitado={pendiente || i === 0} />
        <BotonMover
          enviar={enviar}
          catalogo={catalogo}
          orden={mover(ids, i, 1)}
          direccion="bajar"
          nombre={item.name}
          deshabilitado={pendiente || i === ids.length - 1}
        />
        <form action={enviar}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="catalogo" value={catalogo} />
          <button
            type="submit"
            name="_accion"
            value="archivar"
            className="fo-btn fo-btn-ghost text-xs"
            disabled={pendiente}
            title="Deja de ofrecerse en las altas nuevas; lo ya cargado lo sigue mostrando"
          >
            <Archive className="size-4" aria-hidden />
            Archivar
          </button>
        </form>
        {item.usos === 0 ? (
          <form action={enviar}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="catalogo" value={catalogo} />
            <button
              type="submit"
              name="_accion"
              value="borrar"
              className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]"
              disabled={pendiente}
              onClick={confirmarBorrado(item.name)}
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

function FilaArchivada({ catalogo, item }: { catalogo: CatalogoClave; item: ItemFila }) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-[var(--fo-muted)]">
          {item.name}
          {item.grupo ? ` · ${ETIQUETA_GRUPO[item.grupo]}` : ""} · {textoUsos(catalogo, item.usos)}
        </span>
        <form action={enviar}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="catalogo" value={catalogo} />
          <button type="submit" name="_accion" value="desarchivar" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente}>
            <ArchiveRestore className="size-4" aria-hidden />
            Desarchivar
          </button>
        </form>
        {item.usos === 0 ? (
          <form action={enviar}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="catalogo" value={catalogo} />
            <button
              type="submit"
              name="_accion"
              value="borrar"
              className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]"
              disabled={pendiente}
              onClick={confirmarBorrado(item.name)}
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

function NuevoItem({ catalogo }: { catalogo: CatalogoClave }) {
  const [estado, crear, creando] = useActionState(crearItemAction, INICIAL);
  return (
    <form action={crear} className="space-y-3 border-t border-[var(--fo-border)] pt-4">
      <input type="hidden" name="catalogo" value={catalogo} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="fo-field-stack min-w-[12rem] flex-1">
          <label className="fo-label" htmlFor={`nuevo-${catalogo}`}>
            Agregar
          </label>
          <input id={`nuevo-${catalogo}`} name="nombre" maxLength={MAX_NOMBRE} required className="fo-input" placeholder="Nombre" />
        </div>
        {catalogo === "categorias" ? <SelectorGrupo id="nuevo-grupo" valor="EVENTO" bloqueado={false} /> : null}
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={creando}>
          <Plus className="size-4" aria-hidden />
          Agregar
        </button>
      </div>
      <Mensaje estado={estado} />
    </form>
  );
}

export function CatalogoLista({
  catalogo,
  titulo,
  explicacion,
  items,
}: {
  catalogo: CatalogoClave;
  titulo: string;
  explicacion: string;
  items: ItemFila[];
}) {
  const activos = items.filter((x) => !x.archivado);
  const archivados = items.filter((x) => x.archivado);
  const ids = activos.map((x) => x.id);
  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby={`titulo-${catalogo}`}>
      <div className="space-y-1">
        <h2 id={`titulo-${catalogo}`} className="text-base font-semibold">
          {titulo}
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">{explicacion}</p>
      </div>
      {activos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay ninguno activo.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)]">
          {activos.map((x, i) => (
            <FilaActiva key={x.id} catalogo={catalogo} item={x} ids={ids} i={i} />
          ))}
        </ul>
      )}
      <NuevoItem catalogo={catalogo} />
      {archivados.length > 0 ? (
        <details className="border-t border-[var(--fo-border)] pt-3">
          <summary className="cursor-pointer text-sm font-medium">Archivados ({archivados.length})</summary>
          <ul className="divide-y divide-[var(--fo-border)]">
            {archivados.map((x) => (
              <FilaArchivada key={x.id} catalogo={catalogo} item={x} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
