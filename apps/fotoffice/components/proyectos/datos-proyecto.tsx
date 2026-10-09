"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editarProyectoAction, reanudarProyectoAction, suspenderProyectoAction } from "@/app/actions/proyectos";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { fechaCorta } from "@/lib/pedidos/pantalla";
import { COLOR_ESTADO, ETIQUETA_ESTADO, type EstadoDeProyecto } from "@/lib/proyectos/ficha-vista";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

export type DatosDelProyecto = {
  id: string;
  numero: string;
  nombre: string;
  descripcion: string | null;
  contacto: { id: string; nombre: string };
  pedido: { id: string; numero: string } | null;
  producto: string | null;
  flujo: string;
  eventDate: string | null;
  baseDate: string;
  finalDueDate: string | null;
  responsableId: number | null;
  delegadoId: number | null;
  suspension: { desde: string; motivo: string | null } | null;
  estado: EstadoDeProyecto;
  atraso: number;
  etapaActual: string | null;
};

/**
 * Cabecera de la ficha del proyecto: estado (con suspendido y atraso), fecha final, responsable,
 * delegado y pedido vinculado. Con "Gestionar" en Proyectos se editan los datos y se suspende o
 * reanuda. El servidor vuelve a decidir cada cambio.
 */
export function DatosProyecto({
  datos,
  equipo,
  nombres,
  puedeEditar,
}: {
  datos: DatosDelProyecto;
  /** Quiénes pueden ser responsables o delegados. */
  equipo: { id: number; nombre: string }[];
  /** Nombre de cada persona que ya figura en el proyecto (aunque ya no esté en `equipo`). */
  nombres: Record<string, string>;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [suspendiendo, setSuspendiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(datos.nombre);
  const [responsable, setResponsable] = useState(datos.responsableId !== null ? String(datos.responsableId) : "");
  const [delegado, setDelegado] = useState(datos.delegadoId !== null ? String(datos.delegadoId) : "");
  const [fechaFinal, setFechaFinal] = useState(datos.finalDueDate ?? "");
  const [descripcion, setDescripcion] = useState(datos.descripcion ?? "");
  const [motivo, setMotivo] = useState("");

  // Los actuales siempre figuran en la lista, aunque ya no puedan ser responsables.
  const opciones = [...equipo];
  for (const id of [datos.responsableId, datos.delegadoId]) {
    if (id !== null && !opciones.some((o) => o.id === id)) opciones.push({ id, nombre: nombres[String(id)] ?? `Usuario ${id}` });
  }
  const nombreDe = (id: number | null) => (id === null ? "—" : (nombres[String(id)] ?? `Usuario ${id}`));

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, alTerminar: () => void) {
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          setError(r.error);
          return;
        }
        alTerminar();
        router.refresh();
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  function guardar() {
    correr(
      () =>
        editarProyectoAction(datos.id, {
          name: nombre,
          ownerUserId: responsable === "" ? null : Number(responsable),
          delegateUserId: delegado === "" ? null : Number(delegado),
          finalDueDate: fechaFinal === "" ? null : fechaFinal,
          description: descripcion,
        }),
      () => setEditando(false),
    );
  }

  return (
    <section aria-labelledby="datos-proyecto-titulo" className="fo-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="datos-proyecto-titulo" className="text-base font-semibold text-[var(--fo-text)]">
            Datos del proyecto
          </h2>
          <p className="text-xs text-[var(--fo-muted)]">N° {datos.numero}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[datos.estado]}`}>{ETIQUETA_ESTADO[datos.estado]}</span>
          {datos.atraso > 0 ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Atraso: {datos.atraso} {datos.atraso === 1 ? "día" : "días"}
            </span>
          ) : null}
        </div>
      </div>

      {datos.suspension ? (
        <div role="note" className="fo-alert-warning space-y-1 rounded p-3 text-sm">
          <p className="font-medium">Suspendido desde el {fechaHoraBA(datos.suspension.desde)}</p>
          {datos.suspension.motivo ? <p className="whitespace-pre-line break-words">Motivo: {datos.suspension.motivo}</p> : null}
          <p className="text-xs">Mientras está suspendido no cuenta como vencido ni aparece en «Mis tareas».</p>
        </div>
      ) : null}

      {editando ? (
        <form
          className="space-y-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <fieldset className="space-y-3" disabled={pendiente}>
            <label className="fo-field-stack">
              <span className="fo-label">Nombre</span>
              <input className="fo-input" maxLength={200} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="fo-field-stack">
                <span className="fo-label">Responsable</span>
                <select className="fo-input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                  <option value="">Sin responsable</option>
                  {opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fo-field-stack">
                <span className="fo-label">Delegado</span>
                <select className="fo-input" value={delegado} onChange={(e) => setDelegado(e.target.value)}>
                  <option value="">Sin delegado</option>
                  {opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fo-field-stack">
                <span className="fo-label">Fecha final</span>
                <input type="date" className="fo-input" value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} />
              </label>
            </div>
            <label className="fo-field-stack">
              <span className="fo-label">Descripción</span>
              <textarea className="fo-input" rows={3} maxLength={5000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="fo-btn fo-btn-primary text-sm">
                {pendiente ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setEditando(false)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Dato termino="Contacto">
            <Link href={`/clientes/${encodeURIComponent(datos.contacto.id)}`} className="text-[var(--fo-accent)] hover:underline">
              {datos.contacto.nombre}
            </Link>
          </Dato>
          <Dato termino="Pedido">
            {datos.pedido ? (
              <Link href={`/pedidos/${encodeURIComponent(datos.pedido.id)}`} className="text-[var(--fo-accent)] hover:underline">
                N° {datos.pedido.numero}
              </Link>
            ) : (
              "Sin pedido"
            )}
          </Dato>
          <Dato termino="Producto">{datos.producto ?? "—"}</Dato>
          <Dato termino="Flujo">{datos.flujo}</Dato>
          <Dato termino="Etapa actual">{datos.etapaActual ?? "—"}</Dato>
          <Dato termino="Fecha final">{fechaCorta(datos.finalDueDate)}</Dato>
          <Dato termino="Día del evento">{fechaCorta(datos.eventDate)}</Dato>
          <Dato termino="Fecha base">{fechaCorta(datos.baseDate)}</Dato>
          <Dato termino="Responsable">{nombreDe(datos.responsableId)}</Dato>
          <Dato termino="Delegado">{nombreDe(datos.delegadoId)}</Dato>
          {datos.descripcion ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--fo-muted)]">Descripción</dt>
              <dd className="whitespace-pre-line break-words text-[var(--fo-text)]">{datos.descripcion}</dd>
            </div>
          ) : null}
        </dl>
      )}

      {puedeEditar && !editando ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--fo-border)] pt-3">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setEditando(true)} disabled={pendiente}>
            Editar datos
          </button>
          {datos.suspension ? (
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-sm"
              disabled={pendiente}
              onClick={() => correr(() => reanudarProyectoAction(datos.id), () => undefined)}
            >
              Reanudar
            </button>
          ) : datos.estado === "EN_CURSO" && !suspendiendo ? (
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setSuspendiendo(true)} disabled={pendiente}>
              Suspender
            </button>
          ) : null}
        </div>
      ) : null}

      {puedeEditar && suspendiendo ? (
        <form
          className="space-y-2 rounded border border-[var(--fo-border)] p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            correr(
              () => suspenderProyectoAction(datos.id, motivo),
              () => {
                setSuspendiendo(false);
                setMotivo("");
              },
            );
          }}
        >
          <label className="fo-field-stack">
            <span className="fo-label">Motivo de la suspensión</span>
            <textarea className="fo-input" rows={2} maxLength={1000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || motivo.trim() === ""}>
              Suspender el proyecto
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setSuspendiendo(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--fo-muted)]">{termino}</dt>
      <dd className="break-words text-[var(--fo-text)]">{children}</dd>
    </div>
  );
}
