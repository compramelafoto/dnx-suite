import { randomUUID } from "node:crypto";
import type { ProjectMoney } from "@/lib/governance/money-server";
import { deviationPercent, isQuoteExpired } from "@/lib/governance/money";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { fecha, tamanioArchivo } from "@/lib/governance/labels";
import type { CashAccountRow, CashCategoryRow } from "@/lib/cash/repository";
import { QuoteForm } from "./quote-form";
import {
  addReservationAction,
  recordProjectMovementAction,
  saveOpeningAction,
  setQuoteStatusAction,
  setStageEstimateAction,
} from "@/app/(shell)/gobierno/dinero-actions";

const pesos = (m: number) => formatMinorArs(m);
const aMinor = (d: { toString(): string } | null) => (d ? decimalArsToMinor(d) : 0);

/**
 * La sección Dinero de la ficha del proyecto: los cuatro números, cotizaciones por etapa,
 * reservas y los movimientos de Caja del proyecto (diseño §8).
 */
export function ProjectMoneySection({
  projectId,
  money,
  canManage,
  canEditQuotes,
  cashOn,
  canHandleMoney,
  acceptsMoney,
  accounts,
  categories,
}: {
  projectId: string;
  money: ProjectMoney;
  canManage: boolean;
  canEditQuotes: boolean;
  cashOn: boolean;
  canHandleMoney: boolean;
  acceptsMoney: boolean;
  accounts: CashAccountRow[];
  categories: CashCategoryRow[];
}) {
  const { necesario, numeros } = money;
  const ahora = new Date();
  const puedeMover = cashOn && canHandleMoney && acceptsMoney;
  const detalle = [
    necesario.detail.chosen ? `${necesario.detail.chosen} elegida${necesario.detail.chosen > 1 ? "s" : ""}` : null,
    necesario.detail.ranged ? `${necesario.detail.ranged} en rango` : null,
    necesario.detail.estimated ? `${necesario.detail.estimated} estimada${necesario.detail.estimated > 1 ? "s" : ""}` : null,
    necesario.detail.empty ? `${necesario.detail.empty} sin datos` : null,
  ].filter(Boolean);
  const pagadoPorCotizacion = new Map<string, number>();
  for (const m of money.movimientos) {
    if (m.quoteId && m.kind === "EGRESO" && !m.reversed) {
      pagadoPorCotizacion.set(m.quoteId, (pagadoPorCotizacion.get(m.quoteId) ?? 0) + m.amountMinor);
    }
  }

  return (
    <section id="dinero" className="space-y-4">
      <h2 className="text-lg font-semibold">Dinero</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Necesario" valor={pesos(numeros.neededMinor)} nota={
          necesario.fromManual
            ? "Costo aproximado del proyecto"
            : necesario.minMinor !== necesario.maxMinor
              ? `Entre ${pesos(necesario.minMinor)} y ${pesos(necesario.maxMinor)}`
              : detalle.join(", ") || "Sin cotizaciones ni estimados"
        } />
        {cashOn ? (
          <>
            <Numero rotulo="Asignado" valor={pesos(numeros.assignedMinor)} nota={numeros.missingMinor > 0 ? `Falta conseguir ${pesos(numeros.missingMinor)}` : "Cubre lo necesario"} />
            <Numero rotulo="Gastado" valor={pesos(numeros.spentMinor)} />
            <Numero rotulo="Restante" valor={pesos(numeros.remainingMinor)} alerta={numeros.overspent} nota={numeros.overspent ? "Se gastó más de lo asignado" : undefined} />
          </>
        ) : (
          <p className="fo-card p-4 text-sm text-[var(--fo-muted)] sm:col-span-1 lg:col-span-3">
            Con Caja encendida se ven acá lo asignado, lo gastado y lo que queda.
          </p>
        )}
      </div>

      {/* Cotizaciones por etapa */}
      <div className="fo-card space-y-4 p-5">
        <h3 className="font-semibold">Cotizaciones</h3>
        {money.stages.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Primero armá las etapas.</p> : null}
        {money.stages.map((s) => (
          <div key={s.id} className="space-y-2 border-t border-[var(--fo-border-muted)] pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{s.title}</p>
              {canEditQuotes ? (
                <form action={setStageEstimateAction} className="flex items-center gap-2">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="stageId" value={s.id} />
                  <input
                    name="amount"
                    className="fo-input w-36 text-sm"
                    inputMode="decimal"
                    placeholder="Estimado"
                    aria-label={`Costo estimado de ${s.title}`}
                    defaultValue={s.estimatedCostArs ? String(s.estimatedCostArs).replace(".", ",") : ""}
                  />
                  <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                    Guardar
                  </button>
                </form>
              ) : s.estimatedCostArs ? (
                <span className="text-xs text-[var(--fo-muted)]">Estimado: {pesos(aMinor(s.estimatedCostArs))}</span>
              ) : null}
            </div>
            {s.quotes.length === 0 ? (
              <p className="text-xs text-[var(--fo-muted)]">Sin cotizaciones.</p>
            ) : (
              <ul className="space-y-2">
                {s.quotes.map((q) => {
                  const monto = aMinor(q.amountArs);
                  const pagado = pagadoPorCotizacion.get(q.id);
                  const desvio = pagado !== undefined ? deviationPercent(monto, pagado) : null;
                  return (
                    <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                      <div className={q.status === "DISCARDED" ? "opacity-60" : ""}>
                        <p>
                          <span className="font-medium">{q.supplier}</span> · {pesos(monto)}
                          {q.status === "CHOSEN" ? <span className="ml-2 text-xs font-medium text-[var(--fo-success)]">Elegida</span> : null}
                          {q.status === "DISCARDED" ? <span className="ml-2 text-xs">Descartada{q.discardReason ? `: ${q.discardReason}` : ""}</span> : null}
                          {isQuoteExpired(q.validUntil, ahora) && q.status !== "DISCARDED" ? (
                            <span className="ml-2 text-xs font-medium text-[var(--fo-warning)]">Vencida</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-[var(--fo-muted)]">
                          {fecha(q.quotedAt)}
                          {q.validUntil ? ` · válida hasta ${fecha(q.validUntil)}` : ""}
                          {q.note ? ` · ${q.note}` : ""}
                        </p>
                        {pagado !== undefined ? (
                          <p className="text-xs">
                            Cotizado {pesos(monto)}, pagado {pesos(pagado)}
                            {desvio !== null && desvio !== 0 ? ` (${desvio > 0 ? "+" : ""}${desvio}%)` : ""}
                          </p>
                        ) : null}
                        {q.attachments.map((a) => (
                          <a key={a.id} href={`/api/gobierno/archivos/${a.id}`} className="block text-xs hover:underline">
                            {a.filename} ({tamanioArchivo(a.sizeBytes)})
                          </a>
                        ))}
                      </div>
                      {canEditQuotes ? (
                        <div className="flex flex-wrap gap-1">
                          {q.status !== "CHOSEN" && q.status !== "DISCARDED" ? (
                            <EstadoCotizacion projectId={projectId} quoteId={q.id} status="CHOSEN" label="Elegir" />
                          ) : null}
                          {q.status !== "DISCARDED" ? (
                            <EstadoCotizacion projectId={projectId} quoteId={q.id} status="DISCARDED" label="Descartar" />
                          ) : (
                            <EstadoCotizacion projectId={projectId} quoteId={q.id} status="RECEIVED" label="Volver a considerar" />
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
        {canEditQuotes && money.stages.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">+ Cargar una cotización</summary>
            <div className="mt-3">
              <QuoteForm projectId={projectId} stages={money.stages.map((s) => ({ id: s.id, title: s.title }))} />
            </div>
          </details>
        ) : null}
      </div>

      {cashOn ? (
        <div className="fo-card space-y-4 p-5">
          <h3 className="font-semibold">Movimientos y reservas</h3>
          {!acceptsMoney ? (
            <p className="text-sm text-[var(--fo-muted)]">Se reserva y se registra plata cuando el proyecto está aprobado o en ejecución.</p>
          ) : !canHandleMoney ? (
            <p className="text-sm text-[var(--fo-muted)]">Mover plata lo hace quien tiene Caja con «Plata de proyectos» (Tesorería).</p>
          ) : null}

          {money.movimientos.length === 0 && money.reservations.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Todavía no hay reservas ni movimientos.</p>
          ) : (
            <ul className="divide-y divide-[var(--fo-border-muted)] text-sm">
              {money.reservations.map((r) => {
                const m = aMinor(r.amountArs);
                return (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {m >= 0 ? "Reserva" : "Liberación"} · {r.reason}
                      <span className="block text-xs text-[var(--fo-muted)]">
                        {r.actorLabel} · {fecha(r.createdAt)}
                      </span>
                    </span>
                    <span className="tabular-nums">{m >= 0 ? "+" : "−"} {pesos(Math.abs(m))}</span>
                  </li>
                );
              })}
              {money.movimientos.map((m) => (
                <li key={m.linkId} className={`flex flex-wrap justify-between gap-2 py-2 ${m.reversed ? "line-through opacity-60" : ""}`}>
                  <span>
                    {m.kind === "EGRESO" ? "Gasto" : "Ingreso"} · {m.description}
                    <span className="block text-xs text-[var(--fo-muted)]">
                      {m.accountName} · {fecha(m.occurredAt)}
                      {m.reversed ? " · anulado en Caja" : ""}
                    </span>
                  </span>
                  <span className="tabular-nums">{m.kind === "EGRESO" ? "−" : "+"} {pesos(m.amountMinor)}</span>
                </li>
              ))}
            </ul>
          )}

          {puedeMover ? (
            <div className="space-y-3">
              <details>
                <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Reservar o liberar plata</summary>
                <form action={addReservationAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="projectId" value={projectId} />
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="res-amount">
                      Monto
                    </label>
                    <input id="res-amount" name="amount" className="fo-input" required inputMode="decimal" />
                  </div>
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="res-kind">
                      Qué hacer
                    </label>
                    <select id="res-kind" name="release" className="fo-input" defaultValue="0">
                      <option value="0">Reservar para el proyecto</option>
                      <option value="1">Liberar lo reservado</option>
                    </select>
                  </div>
                  <div className="fo-field-stack sm:col-span-2">
                    <label className="fo-label" htmlFor="res-reason">
                      Motivo
                    </label>
                    <input id="res-reason" name="reason" className="fo-input" required maxLength={1000} placeholder="Ej.: Aprobado en la reunión del 8/10" />
                  </div>
                  <p className="fo-helper sm:col-span-2">Reservar no mueve la plata de su cuenta: la aparta, y Caja la descuenta del saldo libre.</p>
                  <div className="sm:col-span-2">
                    <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                      Guardar
                    </button>
                  </div>
                </form>
              </details>
              {(["EGRESO", "INGRESO"] as const).map((kind) => (
                <details key={kind}>
                  <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">
                    {kind === "EGRESO" ? "Registrar un gasto" : "Registrar un ingreso"}
                  </summary>
                  <form action={recordProjectMovementAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="token" value={randomUUID()} />
                    <div className="fo-field-stack">
                      <label className="fo-label" htmlFor={`mv-acc-${kind}`}>
                        Cuenta
                      </label>
                      <select id={`mv-acc-${kind}`} name="accountId" className="fo-input" required defaultValue={accounts.find((a) => a.isDefault)?.id ?? ""}>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fo-field-stack">
                      <label className="fo-label" htmlFor={`mv-amt-${kind}`}>
                        Monto
                      </label>
                      <input id={`mv-amt-${kind}`} name="amountArs" className="fo-input" required inputMode="decimal" />
                    </div>
                    <div className="fo-field-stack">
                      <label className="fo-label" htmlFor={`mv-cat-${kind}`}>
                        Categoría
                      </label>
                      <select id={`mv-cat-${kind}`} name="categoryId" className="fo-input" defaultValue="">
                        <option value="">Sin categoría</option>
                        {categories.filter((c) => c.kind === kind).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fo-field-stack">
                      <label className="fo-label" htmlFor={`mv-pm-${kind}`}>
                        Medio
                      </label>
                      <select id={`mv-pm-${kind}`} name="paymentMethod" className="fo-input" defaultValue="TRANSFERENCIA">
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                        <option value="MERCADO_PAGO">Mercado Pago</option>
                        <option value="TARJETA">Tarjeta</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                    <div className="fo-field-stack">
                      <label className="fo-label" htmlFor={`mv-stage-${kind}`}>
                        Etapa (opcional)
                      </label>
                      <select id={`mv-stage-${kind}`} name="stageId" className="fo-input" defaultValue="">
                        <option value="">—</option>
                        {money.stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    {kind === "EGRESO" ? (
                      <div className="fo-field-stack">
                        <label className="fo-label" htmlFor="mv-quote">
                          Paga la cotización (opcional)
                        </label>
                        <select id="mv-quote" name="quoteId" className="fo-input" defaultValue="">
                          <option value="">—</option>
                          {money.stages.flatMap((s) =>
                            s.quotes
                              .filter((q) => q.status !== "DISCARDED")
                              .map((q) => (
                                <option key={q.id} value={q.id}>
                                  {s.title}: {q.supplier} ({pesos(aMinor(q.amountArs))})
                                </option>
                              )),
                          )}
                        </select>
                      </div>
                    ) : null}
                    <div className="fo-field-stack sm:col-span-2">
                      <label className="fo-label" htmlFor={`mv-desc-${kind}`}>
                        Detalle
                      </label>
                      <input id={`mv-desc-${kind}`} name="description" className="fo-input" required maxLength={300} placeholder={kind === "EGRESO" ? "Ej.: Impresión de 20 obras, factura 0001-234" : "Ej.: Aporte del sponsor"} />
                    </div>
                    <p className="fo-helper sm:col-span-2">Queda en el libro de Caja con la fecha de hoy. Si hay un error, se anula desde Caja.</p>
                    <div className="sm:col-span-2">
                      <button type="submit" className="fo-btn fo-btn-primary text-sm">
                        {kind === "EGRESO" ? "Registrar el gasto" : "Registrar el ingreso"}
                      </button>
                    </div>
                  </form>
                </details>
              ))}
            </div>
          ) : null}

          {canManage && canHandleMoney ? (
            <details>
              <summary className="cursor-pointer text-sm text-[var(--fo-muted)]">Plata de antes de usar el sistema y costo aproximado</summary>
              <form action={saveOpeningAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="op-assigned">
                    Ya asignado
                  </label>
                  <input id="op-assigned" name="assigned" className="fo-input" inputMode="decimal" defaultValue={money.opening.openingAssignedArs ? String(money.opening.openingAssignedArs).replace(".", ",") : ""} />
                </div>
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="op-spent">
                    Ya gastado
                  </label>
                  <input id="op-spent" name="spent" className="fo-input" inputMode="decimal" defaultValue={money.opening.openingSpentArs ? String(money.opening.openingSpentArs).replace(".", ",") : ""} />
                </div>
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="op-manual">
                    Costo aproximado del proyecto
                  </label>
                  <input id="op-manual" name="manualNeeded" className="fo-input" inputMode="decimal" defaultValue={money.opening.manualNeededArs ? String(money.opening.manualNeededArs).replace(".", ",") : ""} />
                </div>
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="op-at">
                    A la fecha
                  </label>
                  <input id="op-at" name="at" type="date" className="fo-input" />
                </div>
                <p className="fo-helper sm:col-span-2">Para los proyectos que ya venían en marcha. No genera movimientos en Caja.</p>
                <div className="sm:col-span-2">
                  <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                    Guardar
                  </button>
                </div>
              </form>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Numero({ rotulo, valor, nota, alerta }: { rotulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className={`fo-card space-y-1 p-4 ${alerta ? "border-[var(--fo-danger-border)]" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">{rotulo}</p>
      <p className={`text-xl font-semibold tabular-nums ${alerta ? "text-[var(--fo-danger)]" : ""}`}>{valor}</p>
      {nota ? <p className={`text-xs ${alerta ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}>{nota}</p> : null}
    </div>
  );
}

function EstadoCotizacion({ projectId, quoteId, status, label }: { projectId: string; quoteId: string; status: string; label: string }) {
  return (
    <form action={setQuoteStatusAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="fo-btn fo-btn-ghost text-xs">
        {label}
      </button>
    </form>
  );
}
