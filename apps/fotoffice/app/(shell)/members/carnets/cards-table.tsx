"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  advanceCardFulfillmentAction,
  advanceCardsFulfillmentAction,
} from "@/app/actions/card-fulfillment";
import { commonTransitions, transitionActionLabel } from "@/lib/carnet/board-actions";
import { stateLabel, type FulfillmentCapability, type FulfillmentState } from "@/lib/carnet/fulfillment";

/**
 * El tablero de carnets.
 *
 * Una fila por carnet y no una tarjeta: quien imprime recibe la tanda entera de la imprenta y
 * necesita ver cuarenta de una vez, no tres. Todo lo que depende de la hora o de los permisos
 * —cuánto hace que espera, qué pasos puede dar— llega ya resuelto desde el servidor: calcularlo
 * acá haría que la primera pintura del navegador no coincidiera con la del servidor.
 */

export type TimelineEntry = {
  kind: "PASO" | "DESCARGA";
  label: string;
  actor: string | null;
  note: string | null;
  when: string;
};

export type CardRowView = {
  id: string;
  cardNumber: string;
  memberId: string;
  memberNumber: string;
  fullName: string;
  avatarUrl: string | null;
  state: FulfillmentState;
  waitingLabel: string;
  lastActorLabel: string | null;
  lastNote: string | null;
  noticeError: string | null;
  canPdf: boolean;
  actions: FulfillmentState[];
  timeline: TimelineEntry[];
};

/** El color dice en qué punto está sin tener que leer. */
const PILL: Record<FulfillmentState, string> = {
  PENDIENTE_PAGO:
    "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)] border-[var(--fo-warning-border)]",
  EN_COLA: "bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)] border-[var(--fo-accent-muted)]",
  IMPRESO:
    "bg-[var(--fo-surface-muted)] text-[var(--fo-text-secondary)] border-[var(--fo-border-strong)]",
  LISTO_PARA_RETIRAR:
    "bg-[var(--fo-success-soft)] text-[var(--fo-success)] border-[var(--fo-success-border)]",
  ENVIADO:
    "bg-[var(--fo-success-soft)] text-[var(--fo-success)] border-[var(--fo-success-border)]",
  ENTREGADO:
    "bg-[var(--fo-success-soft)] text-[var(--fo-success)] border-[var(--fo-success-border)]",
  ANULADO:
    "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)] border-[var(--fo-danger-border)]",
};

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function pideNota(destino: FulfillmentState): boolean {
  return destino === "ANULADO" || destino === "ENVIADO";
}

function Avatar({ url, nombre }: { url: string | null; nombre: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- la foto vive en R2, fuera del build
      <img
        src={url}
        alt=""
        className="size-8 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--fo-surface-muted)] text-[11px] font-semibold text-[var(--fo-muted)]">
      {iniciales(nombre)}
    </span>
  );
}

export function CardsTable({
  rows,
  capabilities,
}: {
  rows: CardRowView[];
  capabilities: FulfillmentCapability[];
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [destinoLote, setDestinoLote] = useState<FulfillmentState | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const seleccionadas = useMemo(
    () => rows.filter((r) => seleccion.has(r.id)),
    [rows, seleccion],
  );

  // Solo los pasos que sirven para TODOS los seleccionados: marcar treinta y nueve y fallar
  // en el cuarenta dejaría la tanda a medias sin que nadie sepa cuál quedó afuera.
  const pasosDelLote = useMemo(
    () => commonTransitions(seleccionadas.map((r) => r.state), capabilities),
    [seleccionadas, capabilities],
  );

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    setDestinoLote(null);
  }

  function alternarTodas() {
    setSeleccion((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
    setDestinoLote(null);
  }

  function limpiar() {
    setSeleccion(new Set());
    setDestinoLote(null);
    setNota("");
  }

  function correrLote(destino: FulfillmentState) {
    setError(null);
    setResumen(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("toState", destino);
      data.set("note", nota);
      for (const r of seleccionadas) data.append("cardId", r.id);

      const salida = await advanceCardsFulfillmentAction(data);
      if (!salida.ok) {
        setError(salida.error);
        return;
      }
      const fallidos = salida.failures.length;
      setResumen(
        fallidos === 0
          ? `Listo: ${salida.moved} ${salida.moved === 1 ? "carnet" : "carnets"}.`
          : `${salida.moved} listos. ${fallidos} quedaron afuera: ${salida.failures
              .map((f) => `${f.cardNumber} (${f.error})`)
              .join("; ")}`,
      );
      limpiar();
    });
  }

  function correrUno(cardId: string, destino: FulfillmentState, notaUno: string) {
    setError(null);
    setResumen(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("cardId", cardId);
      data.set("toState", destino);
      data.set("note", notaUno);
      const salida = await advanceCardFulfillmentAction(data);
      if (!salida.ok) setError(salida.error);
      else setAbierta(null);
    });
  }

  const todasMarcadas = rows.length > 0 && seleccion.size === rows.length;

  return (
    <div className="space-y-3">
      {seleccion.size > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-[var(--fo-radius)] border border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] px-4 py-2.5 shadow-[var(--fo-shadow-sm)]">
          <span className="text-sm font-medium">
            {seleccion.size} {seleccion.size === 1 ? "carnet" : "carnets"}
          </span>
          {pasosDelLote.length === 0 ? (
            <span className="text-xs text-[var(--fo-muted)]">
              No hay un paso que sirva para todos los que elegiste.
            </span>
          ) : (
            pasosDelLote.map((destino) => (
              <button
                key={destino}
                type="button"
                disabled={pendiente}
                onClick={() => {
                  if (pideNota(destino)) {
                    setDestinoLote(destino === destinoLote ? null : destino);
                    return;
                  }
                  correrLote(destino);
                }}
                className={`fo-btn text-xs disabled:opacity-60 ${
                  destino === "ANULADO" ? "fo-btn-danger-outline" : ""
                } ${destinoLote === destino ? "fo-btn-primary" : ""}`}
              >
                {transitionActionLabel(destino)}
              </button>
            ))
          )}
          <button type="button" onClick={limpiar} className="fo-btn fo-btn-ghost ml-auto text-xs">
            Deseleccionar
          </button>

          {destinoLote ? (
            <div className="flex w-full flex-wrap items-start gap-2">
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder={
                  destinoLote === "ANULADO"
                    ? "Por qué se anulan"
                    : "Cómo se despacharon: correo, seguimiento o quién los llevó"
                }
                className="fo-input min-w-[16rem] max-w-xl flex-1 text-xs"
              />
              <button
                type="button"
                disabled={pendiente || !nota.trim()}
                onClick={() => correrLote(destinoLote)}
                className="fo-btn fo-btn-primary text-xs disabled:opacity-60"
              >
                {pendiente ? "Guardando…" : `Confirmar ${seleccion.size}`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="fo-alert-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {resumen ? (
        <p className="fo-alert-success text-sm" role="status">
          {resumen}
        </p>
      ) : null}

      <div className="fo-card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--fo-border)] text-left text-xs text-[var(--fo-muted-soft)]">
              <th className="w-10 py-2.5 pl-4">
                <input
                  type="checkbox"
                  checked={todasMarcadas}
                  onChange={alternarTodas}
                  aria-label="Seleccionar todos"
                  className="size-4 accent-[var(--fo-accent)]"
                />
              </th>
              <th className="py-2.5 pr-3 font-medium">Socio</th>
              <th className="hidden py-2.5 pr-3 font-medium md:table-cell">Carnet</th>
              <th className="py-2.5 pr-3 font-medium">Estado</th>
              <th className="hidden py-2.5 pr-3 font-medium lg:table-cell">Último movimiento</th>
              <th className="py-2.5 pr-4 text-right font-medium">Paso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const marcada = seleccion.has(row.id);
              const principal = row.actions.find((a) => a !== "ANULADO") ?? null;
              const abiertaEsta = abierta === row.id;
              return (
                <RowGroup
                  key={row.id}
                  row={row}
                  marcada={marcada}
                  abierta={abiertaEsta}
                  principal={principal}
                  pendiente={pendiente}
                  onToggle={() => alternar(row.id)}
                  onExpand={() => setAbierta(abiertaEsta ? null : row.id)}
                  onRun={correrUno}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({
  row,
  marcada,
  abierta,
  principal,
  pendiente,
  onToggle,
  onExpand,
  onRun,
}: {
  row: CardRowView;
  marcada: boolean;
  abierta: boolean;
  principal: FulfillmentState | null;
  pendiente: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onRun: (cardId: string, destino: FulfillmentState, nota: string) => void;
}) {
  const [destino, setDestino] = useState<FulfillmentState | null>(null);
  const [nota, setNota] = useState("");

  function pedir(estado: FulfillmentState) {
    if (pideNota(estado)) {
      setDestino(estado === destino ? null : estado);
      return;
    }
    onRun(row.id, estado, "");
  }

  const secundarios = row.actions.filter((a) => a !== principal);

  return (
    <>
      <tr
        className={`border-b border-[var(--fo-border-muted)] transition-colors ${
          marcada ? "bg-[var(--fo-accent-soft)]" : "hover:bg-[var(--fo-surface-hover)]"
        }`}
      >
        <td className="py-2.5 pl-4 align-middle">
          <input
            type="checkbox"
            checked={marcada}
            onChange={onToggle}
            aria-label={`Seleccionar el carnet de ${row.fullName}`}
            className="size-4 accent-[var(--fo-accent)]"
          />
        </td>
        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-2.5">
            <Avatar url={row.avatarUrl} nombre={row.fullName} />
            <div className="min-w-0">
              <Link
                href={`/members/${row.memberId}`}
                className="block truncate font-medium hover:underline"
              >
                {row.fullName}
              </Link>
              <span className="text-xs text-[var(--fo-muted-soft)]">N° {row.memberNumber}</span>
              {/* En pantalla angosta las columnas de carnet y movimiento no entran: lo que
                  dicen se pliega acá abajo en vez de perderse. */}
              <span className="block text-xs text-[var(--fo-muted-soft)] lg:hidden">
                <span className="md:hidden">{row.cardNumber} · </span>
                {row.waitingLabel}
              </span>
            </div>
          </div>
        </td>
        <td className="hidden whitespace-nowrap py-2.5 pr-3 font-mono text-xs tabular-nums text-[var(--fo-muted)] md:table-cell">
          {row.cardNumber}
        </td>
        <td className="py-2.5 pr-3">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PILL[row.state]}`}
          >
            {stateLabel(row.state)}
          </span>
          {row.noticeError ? (
            <span
              className="ml-1.5 text-xs text-[var(--fo-danger)]"
              title="El paso se dio igual; lo que no salió fue el aviso al socio."
            >
              aviso sin enviar
            </span>
          ) : null}
        </td>
        <td className="hidden py-2.5 pr-3 text-xs text-[var(--fo-muted)] lg:table-cell">
          <span>{row.waitingLabel}</span>
          {row.lastActorLabel ? (
            <span className="block text-[var(--fo-muted-soft)]">{row.lastActorLabel}</span>
          ) : null}
        </td>
        <td className="py-2.5 pr-4">
          <div className="flex items-center justify-end gap-1.5">
            {principal ? (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => pedir(principal)}
                className="fo-btn fo-btn-primary text-xs disabled:opacity-60"
              >
                {transitionActionLabel(principal)}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onExpand}
              aria-expanded={abierta}
              className="fo-btn fo-btn-ghost text-xs"
            >
              {abierta ? "Cerrar" : "Detalle"}
            </button>
          </div>
        </td>
      </tr>

      {destino ? (
        <tr className="border-b border-[var(--fo-border-muted)] bg-[var(--fo-surface-hover)]">
          <td />
          <td colSpan={5} className="px-0 py-2.5 pr-4">
            <div className="flex flex-wrap items-start gap-2">
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder={
                  destino === "ANULADO"
                    ? "Por qué se anula"
                    : "Cómo se despachó: correo, número de seguimiento o quién lo llevó"
                }
                className="fo-input min-w-[16rem] flex-1 text-xs"
              />
              <button
                type="button"
                disabled={pendiente || !nota.trim()}
                onClick={() => onRun(row.id, destino, nota)}
                className="fo-btn fo-btn-primary text-xs disabled:opacity-60"
              >
                {pendiente ? "Guardando…" : `Confirmar ${transitionActionLabel(destino).toLowerCase()}`}
              </button>
              <button
                type="button"
                onClick={() => setDestino(null)}
                className="fo-btn fo-btn-ghost text-xs"
              >
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      ) : null}

      {abierta ? (
        <tr className="border-b border-[var(--fo-border-muted)] bg-[var(--fo-surface-hover)]">
          <td />
          <td colSpan={5} className="py-3 pr-4">
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-[16rem] flex-1 space-y-1.5">
                <p className="text-xs font-semibold text-[var(--fo-muted)]">Historia del carnet</p>
                <ol className="space-y-1.5">
                  {row.timeline.map((e, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span
                        aria-hidden
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                          e.kind === "DESCARGA"
                            ? "bg-[var(--fo-muted-soft)]"
                            : "bg-[var(--fo-accent)]"
                        }`}
                      />
                      <span>
                        <span className="font-medium text-[var(--fo-text-secondary)]">
                          {e.label}
                        </span>
                        <span className="text-[var(--fo-muted-soft)]">
                          {" · "}
                          {e.when}
                          {e.actor ? ` · ${e.actor}` : ""}
                        </span>
                        {e.note ? (
                          <span className="block text-[var(--fo-muted)]">{e.note}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {secundarios.map((estado) => (
                  <button
                    key={estado}
                    type="button"
                    disabled={pendiente}
                    onClick={() => pedir(estado)}
                    className={`fo-btn text-xs disabled:opacity-60 ${
                      estado === "ANULADO" ? "fo-btn-danger-outline" : ""
                    }`}
                  >
                    {transitionActionLabel(estado)}
                  </button>
                ))}
                {row.canPdf ? (
                  <a
                    href={`/api/members/carnets/${row.id}/pdf`}
                    className="fo-btn fo-btn-secondary text-xs"
                    target="_blank"
                    rel="noopener"
                  >
                    Descargar PDF
                  </a>
                ) : null}
                {secundarios.length === 0 && !row.canPdf ? (
                  <span className="text-xs text-[var(--fo-muted-soft)]">
                    Este pedido no admite más pasos.
                  </span>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
