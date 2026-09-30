"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { asignarResponsableAction, cambiarVencimientoAction, cerrarAction, moverAction } from "@/app/actions/circuitos";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { finDelDiaElegido } from "@/lib/circuitos/ficha-vista";
import type { RecorridoFicha } from "@/lib/circuitos/ficha";
import { claseDeColorEtiqueta, fechaBA, fechaHoraBA } from "@/lib/ficha/formato";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { DialogoGanada } from "./dialogo-ganada";
import { DialogoPerdida } from "./dialogo-perdida";

/** Lo que responde el motor cuando alguien cambió el recorrido entre que se cargó y se guardó. */
const MENSAJE_CAMBIO = "Esta consulta cambió mientras tanto.";
const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";
const NOTA_MAX = 2000;

type Operacion =
  | { tipo: "mover"; destinoId: string; nombre: string; nota: string }
  | { tipo: "ganar" }
  | { tipo: "perder"; lossReasonId: string; nota: string };

type Aviso = { mensaje: string; pendientes?: string[]; op?: Operacion };

/**
 * El recorrido de la consulta en la ficha: barra de etapas (clic en otra = mover, con nota
 * opcional), responsable, vencimiento de la etapa (editable con nota) y los botones de cierre.
 * Ganar pide confirmación siempre; perder pide motivo. Cada cambio manda `esperado` (la entrada
 * a la etapa que se cargó): si otra persona lo movió, el motor lo rechaza y se recarga.
 */
export function Recorrido({
  recorrido,
  titulo,
  motivos,
  responsables,
  puedePasarIgual,
}: {
  recorrido: RecorridoFicha;
  titulo: string;
  motivos: { id: string; nombre: string }[];
  responsables: { id: number; nombre: string }[];
  /** El rol puede `configurar`: ofrece "Pasar igual" ante tareas obligatorias pendientes. */
  puedePasarIgual: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [estado, setEstado] = useState("");
  const [destino, setDestino] = useState<{ id: string; nombre: string } | null>(null);
  const [notaMover, setNotaMover] = useState("");
  const [editandoVence, setEditandoVence] = useState(false);
  const [fechaVence, setFechaVence] = useState(recorrido.stageDueAt ? hoyEnBuenosAires(new Date(recorrido.stageDueAt)) : "");
  const [sinVence, setSinVence] = useState(recorrido.stageDueAt === null);
  const [notaVence, setNotaVence] = useState("");
  const [ganando, setGanando] = useState(false);
  const [perdiendo, setPerdiendo] = useState(false);

  const { abierto, salidas } = recorrido;
  const esperado = recorrido.enteredStageAt;

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string; pendientes?: string[] }>, exito: string, op?: Operacion) {
    setAviso(null);
    setEstado("");
    iniciar(async () => {
      try {
        const r = await accion();
        if (r.ok) {
          setEstado(exito);
          setDestino(null);
          setNotaMover("");
          setEditandoVence(false);
          setNotaVence("");
          router.refresh();
          return;
        }
        setAviso({ mensaje: r.error, pendientes: r.pendientes, op });
        if (r.error === MENSAJE_CAMBIO) router.refresh();
      } catch {
        setAviso({ mensaje: MENSAJE_FALLA });
      }
    });
  }

  function ejecutar(op: Operacion, forzar = false) {
    const base = { journeyId: recorrido.id, esperado, ...(forzar ? { forzar: true } : {}) };
    if (op.tipo === "mover") {
      correr(() => moverAction({ ...base, destinoId: op.destinoId, nota: op.nota || undefined }), `Pasó a ${op.nombre}.`, op);
    } else if (op.tipo === "ganar") {
      correr(() => cerrarAction({ ...base, salida: salidas.exito }), `Quedó como ${ETIQUETA_SALIDA[salidas.exito] ?? salidas.exito}.`, op);
    } else {
      correr(
        () => cerrarAction({ ...base, salida: salidas.fracaso, lossReasonId: op.lossReasonId, nota: op.nota || undefined }),
        `Quedó como ${ETIQUETA_SALIDA[salidas.fracaso] ?? salidas.fracaso}.`,
        op,
      );
    }
  }

  function guardarVencimiento() {
    const dueAt = sinVence ? null : finDelDiaElegido(fechaVence);
    if (!sinVence && !dueAt) {
      setAviso({ mensaje: "Elegí una fecha válida." });
      return;
    }
    correr(
      () => cambiarVencimientoAction({ journeyId: recorrido.id, dueAt: dueAt ? dueAt.toISOString() : null, nota: notaVence.trim() || undefined, esperado }),
      "Vencimiento guardado.",
    );
  }

  const puedeForzar = puedePasarIgual && !!aviso?.op && !!aviso.pendientes && aviso.pendientes.length > 0;

  return (
    <section aria-labelledby="recorrido-titulo" className="fo-card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recorrido-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Recorrido
        </h2>
        <span className="text-sm text-[var(--fo-muted)]">{recorrido.circuito.nombre}</span>
      </div>

      <ol aria-label="Etapas del circuito" className="flex flex-wrap gap-1.5">
        {recorrido.etapas.map((e) => {
          const actual = e.id === recorrido.etapaActualId;
          const elegible = abierto && !actual && !e.archivada;
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-current={actual ? "step" : undefined}
                disabled={!elegible || pendiente}
                onClick={() => {
                  setAviso(null);
                  setDestino({ id: e.id, nombre: e.nombre });
                }}
                title={elegible ? `Mover a ${e.nombre}` : undefined}
                className={`rounded px-2.5 py-1 text-xs font-medium ${claseDeColorEtiqueta(e.color)} ${
                  actual ? "ring-2 ring-[var(--fo-accent)] ring-offset-1" : abierto ? "opacity-70 hover:opacity-100" : "opacity-60"
                } disabled:cursor-default`}
              >
                {e.nombre}
                {e.archivada ? " (archivada)" : ""}
              </button>
            </li>
          );
        })}
      </ol>

      {destino ? (
        <form
          className="space-y-2 rounded border border-[var(--fo-border)] p-3 text-sm"
          onSubmit={(ev) => {
            ev.preventDefault();
            ejecutar({ tipo: "mover", destinoId: destino.id, nombre: destino.nombre, nota: notaMover.trim() });
          }}
        >
          <p className="font-medium text-[var(--fo-text)]">Mover a {destino.nombre}</p>
          <label className="fo-field-stack">
            <span className="fo-label">Nota (opcional)</span>
            <textarea className="fo-input" rows={2} maxLength={NOTA_MAX} value={notaMover} onChange={(ev) => setNotaMover(ev.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              Mover
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setDestino(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {abierto ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="fo-label">Responsable</dt>
            <dd>
              <select
                className="fo-input"
                aria-label="Responsable"
                value={recorrido.responsableId ?? ""}
                disabled={pendiente}
                onChange={(ev) => {
                  const userId = ev.target.value ? Number(ev.target.value) : null;
                  correr(() => asignarResponsableAction({ journeyId: recorrido.id, userId }), "Responsable guardado.");
                }}
              >
                <option value="">Sin responsable</option>
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="fo-label">Vencimiento de la etapa</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className={recorrido.vencida ? "font-medium text-[var(--fo-danger)]" : "text-[var(--fo-text)]"}>
                {recorrido.stageDueAt ? fechaBA(recorrido.stageDueAt) : "Sin vencimiento"}
                {recorrido.vencida ? " · Vencida" : ""}
              </span>
              {!editandoVence ? (
                <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setEditandoVence(true)}>
                  Cambiar
                </button>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-[var(--fo-text)]">
          <span className="font-medium">{recorrido.outcome ? (ETIQUETA_SALIDA[recorrido.outcome] ?? recorrido.outcome) : "Cerrada"}</span>
          {recorrido.motivo ? ` · Motivo: ${recorrido.motivo}` : ""}
          {recorrido.closedAt ? <span className="text-[var(--fo-muted)]"> · {fechaHoraBA(recorrido.closedAt)}</span> : null}
        </p>
      )}

      {abierto && editandoVence ? (
        <form
          className="space-y-2 rounded border border-[var(--fo-border)] p-3 text-sm"
          onSubmit={(ev) => {
            ev.preventDefault();
            guardarVencimiento();
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="fo-field-stack">
              <span className="fo-label">Vence el</span>
              <input type="date" className="fo-input" value={fechaVence} disabled={sinVence} onChange={(ev) => setFechaVence(ev.target.value)} />
            </label>
            <label className="flex h-10 items-center gap-2">
              <input type="checkbox" checked={sinVence} onChange={(ev) => setSinVence(ev.target.checked)} />
              Sin vencimiento
            </label>
          </div>
          <label className="fo-field-stack">
            <span className="fo-label">Nota (opcional)</span>
            <textarea className="fo-input" rows={2} maxLength={NOTA_MAX} value={notaVence} onChange={(ev) => setNotaVence(ev.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              Guardar
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setEditandoVence(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {abierto ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => setGanando(true)}>
            {ETIQUETA_SALIDA[salidas.exito] ?? salidas.exito}
          </button>
          <button type="button" className="fo-btn fo-btn-danger text-sm" disabled={pendiente} onClick={() => setPerdiendo(true)}>
            {ETIQUETA_SALIDA[salidas.fracaso] ?? salidas.fracaso}
          </button>
        </div>
      ) : null}

      {aviso ? (
        <div role="alert" className="space-y-1 rounded border border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] p-3 text-sm text-[var(--fo-danger)]">
          <p>{aviso.mensaje}</p>
          {aviso.pendientes && aviso.pendientes.length > 0 ? (
            <ul className="list-disc pl-5">
              {aviso.pendientes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2 pt-1">
            {puedeForzar ? (
              <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={() => aviso.op && ejecutar(aviso.op, true)}>
                Pasar igual
              </button>
            ) : null}
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setAviso(null)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {pendiente ? "Guardando…" : estado}
      </p>

      <DialogoGanada
        titulo={ganando ? titulo : null}
        onCancelar={() => setGanando(false)}
        onConfirmar={() => {
          setGanando(false);
          ejecutar({ tipo: "ganar" });
        }}
      />
      <DialogoPerdida
        titulo={perdiendo ? titulo : null}
        motivos={motivos}
        onCancelar={() => setPerdiendo(false)}
        onConfirmar={(motivoId, nota) => {
          setPerdiendo(false);
          ejecutar({ tipo: "perder", lossReasonId: motivoId, nota });
        }}
      />
    </section>
  );
}
