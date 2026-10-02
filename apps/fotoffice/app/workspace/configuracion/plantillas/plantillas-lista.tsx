"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type MouseEvent, type Ref } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { ETIQUETA_CANAL, MAX_NOMBRE_PLANTILLA, type Canal, type TipoPlantilla } from "@/lib/plantillas/constantes";
import { Mensaje } from "../ficha/mensaje";
import {
  archivarPlantillaAction,
  borrarPlantillaAction,
  crearPlantillaAction,
  desarchivarPlantillaAction,
  duplicarPlantillaAction,
  editarPlantillaAction,
  reordenarPlantillasAction,
  type EstadoPlantillas,
} from "./actions";
import { EditorTexto, type CamposPorTipo, type OpcionTipo } from "./editor-texto";

export type PlantillaFila = {
  id: string;
  name: string;
  entityType: TipoPlantilla;
  subject: string | null;
  body: string;
  archivado: boolean;
  /** Mensajes registrados con esta plantilla: usada no se borra, se archiva. */
  usos: number;
  /** Última vez que se guardó (ISO): si cambia, el editor muestra lo guardado. */
  actualizada: string;
};

const INICIAL: EstadoPlantillas = { error: null };

/** `ids` con el elemento `i` movido `delta` lugares (el orden nuevo completo). */
function mover(ids: string[], i: number, delta: number): string[] {
  const otro = i + delta;
  if (otro < 0 || otro >= ids.length) return ids;
  const copia = [...ids];
  [copia[i], copia[otro]] = [copia[otro]!, copia[i]!];
  return copia;
}

function textoUsos(n: number): string {
  if (n === 0) return "Sin usar";
  return n === 1 ? "Usada 1 vez" : `Usada ${n} veces`;
}

/** Pide confirmación antes de enviar un botón que borra. */
function confirmarBorrado(nombre: string) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(`¿Borrar la plantilla "${nombre}"? No se puede deshacer.`)) e.preventDefault();
  };
}

/** Un solo estado por fila: el botón que envía dice qué hacer (`_accion`). */
async function despachar(prev: EstadoPlantillas, fd: FormData): Promise<EstadoPlantillas> {
  switch (fd.get("_accion")) {
    case "mover":
      return reordenarPlantillasAction(prev, fd);
    case "duplicar":
      return duplicarPlantillaAction(prev, fd);
    case "archivar":
      return archivarPlantillaAction(prev, fd);
    case "desarchivar":
      return desarchivarPlantillaAction(prev, fd);
    case "borrar":
      return borrarPlantillaAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

/** Botón subir/bajar: manda el orden nuevo completo del canal. */
function BotonMover({
  enviar,
  canal,
  orden,
  direccion,
  nombre,
  deshabilitado,
  botonRef,
  onMover,
}: {
  enviar: (fd: FormData) => void;
  canal: Canal;
  orden: string[];
  direccion: "subir" | "bajar";
  nombre: string;
  deshabilitado: boolean;
  botonRef: Ref<HTMLButtonElement>;
  onMover: () => void;
}) {
  const Icono = direccion === "subir" ? ArrowUp : ArrowDown;
  return (
    <form action={enviar}>
      <input type="hidden" name="_accion" value="mover" />
      <input type="hidden" name="canal" value={canal} />
      {orden.map((id) => (
        <input key={id} type="hidden" name="orden" value={id} />
      ))}
      <button
        ref={botonRef}
        type="submit"
        className="fo-icon-btn"
        disabled={deshabilitado}
        onClick={onMover}
        aria-label={`${direccion === "subir" ? "Subir" : "Bajar"} ${nombre}`}
        title={direccion === "subir" ? "Subir" : "Bajar"}
      >
        <Icono className="size-4" />
      </button>
    </form>
  );
}

/** Formulario de una sola acción sobre la plantilla (duplicar, archivar, borrar…). */
function BotonAccion({
  enviar,
  id,
  accion,
  children,
  peligro,
  pendiente,
  onClick,
  title,
}: {
  enviar: (fd: FormData) => void;
  id: string;
  accion: string;
  children: React.ReactNode;
  peligro?: boolean;
  pendiente: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}) {
  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        name="_accion"
        value={accion}
        className={`fo-btn fo-btn-ghost text-xs${peligro ? " text-[var(--fo-danger)]" : ""}`}
        disabled={pendiente}
        onClick={onClick}
        title={title}
      >
        {children}
      </button>
    </form>
  );
}

// ─── Editor (nueva o existente) ──────────────────────────────────────────────

function EditorPlantilla({
  canal,
  plantilla,
  tipos,
  etiquetas,
  campos,
  onCerrar,
  onCreada,
}: {
  canal: Canal;
  /** null: plantilla nueva. */
  plantilla: PlantillaFila | null;
  tipos: OpcionTipo[];
  etiquetas: Record<TipoPlantilla, string>;
  campos: CamposPorTipo;
  onCerrar: () => void;
  /** Sólo para la nueva: se cierra el editor y la lista muestra la confirmación. */
  onCreada?: (mensaje: string) => void;
}) {
  const idBase = plantilla ? `pl-${plantilla.id}` : `pl-nueva-${canal}`;
  const [nombre, setNombre] = useState(plantilla?.name ?? "");
  const [tipo, setTipo] = useState<TipoPlantilla>(plantilla?.entityType ?? "GENERAL");
  const [asunto, setAsunto] = useState(plantilla?.subject ?? "");
  const [cuerpo, setCuerpo] = useState(plantilla?.body ?? "");
  // Al guardar, la página se revalida: el editor pasa a mostrar lo que quedó guardado (recortado).
  const [version, setVersion] = useState(plantilla?.actualizada);
  if (plantilla && version !== plantilla.actualizada) {
    setVersion(plantilla.actualizada);
    setNombre(plantilla.name);
    setTipo(plantilla.entityType);
    setAsunto(plantilla.subject ?? "");
    setCuerpo(plantilla.body);
  }
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoPlantillas, fd: FormData) => {
    if (!plantilla) {
      const r = await crearPlantillaAction(prev, fd);
      // La nueva aparece en la lista (la página se revalida): se cierra el editor y la lista confirma.
      if (!r.error) onCreada?.(r.ok ?? "Plantilla agregada.");
      return r;
    }
    return editarPlantillaAction(prev, fd);
  }, INICIAL);

  // Un tipo con el módulo apagado se muestra igual para no cambiarlo sin querer.
  const opciones = tipos.some((t) => t.valor === tipo) ? tipos : [...tipos, { valor: tipo, etiqueta: `${etiquetas[tipo]} (módulo apagado)` }];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Controlado: sin el reseteo automático del formulario de React.
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => enviar(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-[var(--fo-border)] bg-[var(--fo-surface)] p-4">
      {plantilla ? <input type="hidden" name="id" value={plantilla.id} /> : <input type="hidden" name="canal" value={canal} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="fo-field-stack min-w-[14rem] flex-1">
          <label className="fo-label" htmlFor={`${idBase}-nombre`}>
            Nombre
          </label>
          <input
            id={`${idBase}-nombre`}
            name="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={MAX_NOMBRE_PLANTILLA}
            required
            className="fo-input"
            placeholder="Por ejemplo: Envío de presupuesto"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`${idBase}-tipo`}>
            Para qué ficha
          </label>
          <select
            id={`${idBase}-tipo`}
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPlantilla)}
            className="fo-input"
          >
            {opciones.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.valor === "GENERAL" ? "General (todas las fichas)" : t.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>
      <EditorTexto
        idBase={idBase}
        canal={canal}
        tipo={tipo}
        campos={campos[tipo]}
        asunto={asunto}
        setAsunto={setAsunto}
        cuerpo={cuerpo}
        setCuerpo={setCuerpo}
        errores={estado.errores}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {plantilla ? "Guardar cambios" : "Agregar plantilla"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={onCerrar}>
          <X className="size-4" aria-hidden />
          Cerrar
        </button>
      </div>
      {estado.errores?.length ? null : <Mensaje estado={estado} />}
    </form>
  );
}

// ─── Filas ───────────────────────────────────────────────────────────────────

function FilaPlantilla({
  canal,
  p,
  ids,
  i,
  etiqueta,
  abierta,
  onAbrir,
  editor,
}: {
  canal: Canal;
  p: PlantillaFila;
  ids: string[];
  i: number;
  etiqueta: string;
  abierta: boolean;
  onAbrir: () => void;
  editor: React.ReactNode;
}) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  const subirRef = useRef<HTMLButtonElement>(null);
  const bajarRef = useRef<HTMLButtonElement>(null);
  // Tras subir/bajar el foco vuelve al mismo botón de la fila (o al otro si quedó deshabilitado).
  const movida = useRef<"subir" | "bajar" | null>(null);
  const primera = i === 0;
  const ultima = i === ids.length - 1;
  useEffect(() => {
    if (pendiente || !movida.current) return;
    const quiere = movida.current;
    movida.current = null;
    const usarSubir = quiere === "subir" ? !primera : ultima;
    (usarSubir ? subirRef : bajarRef).current?.focus();
  }, [estado, pendiente, primera, ultima]);
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1">
          <p className="text-sm font-medium text-[var(--fo-text)]">{p.name}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            Para {etiqueta} · {textoUsos(p.usos)}
          </p>
        </div>
        <BotonMover
          enviar={enviar}
          canal={canal}
          orden={mover(ids, i, -1)}
          direccion="subir"
          nombre={p.name}
          deshabilitado={pendiente || primera}
          botonRef={subirRef}
          onMover={() => (movida.current = "subir")}
        />
        <BotonMover
          enviar={enviar}
          canal={canal}
          orden={mover(ids, i, 1)}
          direccion="bajar"
          nombre={p.name}
          deshabilitado={pendiente || ultima}
          botonRef={bajarRef}
          onMover={() => (movida.current = "bajar")}
        />
        <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={onAbrir} aria-expanded={abierta}>
          <Pencil className="size-4" aria-hidden />
          {abierta ? "Editando" : "Editar"}
        </button>
        <BotonAccion enviar={enviar} id={p.id} accion="duplicar" pendiente={pendiente}>
          <Copy className="size-4" aria-hidden />
          Duplicar
        </BotonAccion>
        {p.usos === 0 ? (
          <BotonAccion enviar={enviar} id={p.id} accion="borrar" peligro pendiente={pendiente} onClick={confirmarBorrado(p.name)}>
            <Trash2 className="size-4" aria-hidden />
            Borrar
          </BotonAccion>
        ) : (
          <BotonAccion
            enviar={enviar}
            id={p.id}
            accion="archivar"
            pendiente={pendiente}
            title="Ya se usó: deja de ofrecerse y los mensajes enviados quedan en el registro"
          >
            <Archive className="size-4" aria-hidden />
            Archivar
          </BotonAccion>
        )}
      </div>
      <Mensaje estado={estado} />
      {abierta ? editor : null}
    </li>
  );
}

function FilaArchivada({ p, etiqueta }: { p: PlantillaFila; etiqueta: string }) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-[var(--fo-muted)]">
          {p.name} · Para {etiqueta} · {textoUsos(p.usos)}
        </span>
        <BotonAccion enviar={enviar} id={p.id} accion="desarchivar" pendiente={pendiente}>
          <ArchiveRestore className="size-4" aria-hidden />
          Desarchivar
        </BotonAccion>
        {p.usos === 0 ? (
          <BotonAccion enviar={enviar} id={p.id} accion="borrar" peligro pendiente={pendiente} onClick={confirmarBorrado(p.name)}>
            <Trash2 className="size-4" aria-hidden />
            Borrar
          </BotonAccion>
        ) : null}
      </div>
      <Mensaje estado={estado} />
    </li>
  );
}

// ─── Lista ───────────────────────────────────────────────────────────────────

export function PlantillasLista({
  canal,
  plantillas,
  tipos,
  etiquetas,
  campos,
}: {
  canal: Canal;
  plantillas: PlantillaFila[];
  tipos: OpcionTipo[];
  etiquetas: Record<TipoPlantilla, string>;
  campos: CamposPorTipo;
}) {
  // Qué editor está abierto: una plantilla (su id), "nueva" o ninguno.
  const [abierta, setAbierta] = useState<string | null>(null);
  // Confirmación de la última plantilla creada: queda a la vista con el editor ya cerrado.
  const [aviso, setAviso] = useState<string | null>(null);
  const activas = plantillas.filter((p) => !p.archivado);
  const archivadas = plantillas.filter((p) => p.archivado);
  const ids = activas.map((p) => p.id);
  const etiqueta = (t: TipoPlantilla) => (t === "GENERAL" ? "todas las fichas" : etiquetas[t].toLowerCase());

  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="plantillas-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="plantillas-titulo" className="text-base font-semibold">
            Plantillas de {ETIQUETA_CANAL[canal]}
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Se ofrecen en este orden al mandar un mensaje desde la ficha. Una plantilla que ya se usó no se borra: se
            archiva, y los mensajes enviados quedan en el registro.
          </p>
        </div>
        {abierta !== "nueva" ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => {
              setAviso(null);
              setAbierta("nueva");
            }}>
            <Plus className="size-4" aria-hidden />
            Nueva plantilla
          </button>
        ) : null}
      </div>

      {abierta === "nueva" ? (
        <EditorPlantilla
          canal={canal}
          plantilla={null}
          tipos={tipos}
          etiquetas={etiquetas}
          campos={campos}
          onCerrar={() => setAbierta(null)}
          onCreada={(mensaje) => {
            setAviso(mensaje);
            setAbierta(null);
          }}
        />
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm text-[var(--fo-success)]">
          {aviso}
        </p>
      ) : null}

      {activas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay plantillas de {ETIQUETA_CANAL[canal]}.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)]">
          {activas.map((p, i) => (
            <FilaPlantilla
              key={p.id}
              canal={canal}
              p={p}
              ids={ids}
              i={i}
              etiqueta={etiqueta(p.entityType)}
              abierta={abierta === p.id}
              onAbrir={() => setAbierta(abierta === p.id ? null : p.id)}
              editor={
                <EditorPlantilla
                  canal={canal}
                  plantilla={p}
                  tipos={tipos}
                  etiquetas={etiquetas}
                  campos={campos}
                  onCerrar={() => setAbierta(null)}
                />
              }
            />
          ))}
        </ul>
      )}

      {archivadas.length > 0 ? (
        <details className="border-t border-[var(--fo-border)] pt-3">
          <summary className="cursor-pointer text-sm font-medium">Archivadas ({archivadas.length})</summary>
          <ul className="divide-y divide-[var(--fo-border)]">
            {archivadas.map((p) => (
              <FilaArchivada key={p.id} p={p} etiqueta={etiqueta(p.entityType)} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
