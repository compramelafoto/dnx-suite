import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRafflesStaff } from "@/lib/raffles/access";
import { loadRaffle } from "@/lib/raffles/repository";
import { fechaCorta, fechaHora, prizeStatusLabel, raffleStatusLabel } from "@/lib/raffles/labels";
import { canCancel, canDraw, canEditPrizes, canSeal } from "@/lib/raffles/lifecycle";
import { formatMinorArs } from "@/lib/membership/money";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import type { RaffleStatus } from "@/lib/raffles/constants";
import {
  announceRaffleAction,
  cancelRaffleAction,
  deletePrizeAction,
  resolveRaffleAction,
  sealRaffleAction,
} from "../actions";
import { PremioForm } from "./premio-form";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  guardado: "Se guardó.",
  premio: "Se guardó el premio.",
  "premio-borrado": "Se sacó el premio.",
  anunciado: "Sorteo anunciado. La tanda de drand quedó fijada.",
  sellado: "Padrón sellado. La huella ya se puede publicar.",
  sorteado: "Sorteo resuelto.",
};

const EVENTOS: Record<string, string> = {
  CREADO: "Se creó el sorteo",
  ANUNCIADO: "Se anunció",
  PADRON_SELLADO: "Se selló el padrón",
  SORTEADO: "Se resolvió el sorteo",
  PREMIO_NOTIFICADO: "Se avisó al ganador",
  PREMIO_ENTREGADO: "Se entregó el premio",
  PREMIO_NO_RETIRADO: "Venció el plazo de retiro",
  PREMIO_ANULADO: "Se anuló un premio",
  CANCELADO: "Se canceló",
};

export default async function SorteoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, role } = await requireRafflesStaff();
  const { id } = await params;
  const q = await searchParams;

  const sorteo = await loadRaffle(workspace.id, id);
  if (!sorteo) notFound();

  const admin = canManageWorkspaceSettings(role);
  const ahora = new Date();
  const estado = sorteo.status as RaffleStatus;
  const editable = canEditPrizes(estado);

  const puedeAnunciar = admin && estado === "BORRADOR" && sorteo.prizes.length > 0;
  const puedeSellar =
    admin &&
    canSeal({
      status: estado,
      entriesCloseAt: sorteo.entriesCloseAt,
      now: ahora,
      // El sellado real recuenta; acá alcanza con saber que la fecha ya pasó.
      entrantCount: sorteo.prizes.length,
      prizeCount: sorteo.prizes.length,
    }).ok;
  const puedeSortear = admin && canDraw({ status: estado, drawsAt: sorteo.drawsAt, now: ahora }).ok;
  const puedeCancelar = admin && canCancel(estado).ok;

  return (
    <div className="space-y-8">
      <PageHeader
        title={sorteo.title}
        description={sorteo.description ?? undefined}
        actions={
          <Link href="/sorteos" className="fo-btn fo-btn-ghost text-sm">
            Volver
          </Link>
        }
      />

      {q.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {q.error}
        </p>
      ) : null}
      {q.ok ? <p className="fo-alert-success p-4 text-sm">{AVISOS[q.ok] ?? "Listo."}</p> : null}

      {/* ── Estado y fechas ── */}
      <section className="fo-card grid gap-4 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">Estado</p>
          <p className="mt-1 font-medium">{raffleStatusLabel(sorteo.status)}</p>
          {sorteo.cancelReason ? (
            <p className="mt-1 text-sm text-[var(--fo-muted)]">{sorteo.cancelReason}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">
            Cierra el padrón
          </p>
          <p className="mt-1 font-medium">{fechaHora(sorteo.entriesCloseAt)}</p>
          {sorteo.entrantsCount !== null ? (
            <p className="mt-1 text-sm text-[var(--fo-muted)]">
              {sorteo.entrantsCount} participantes
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">El acto</p>
          <p className="mt-1 font-medium">{fechaHora(sorteo.drawsAt)}</p>
          {sorteo.drandRound !== null ? (
            <p className="mt-1 text-sm text-[var(--fo-muted)]">Tanda de drand {sorteo.drandRound}</p>
          ) : null}
        </div>
      </section>

      {/* ── La prueba, cuando ya existe ── */}
      {sorteo.entrantsHash ? (
        <section className="fo-card space-y-3 p-6">
          <h2 className="text-lg font-semibold">La prueba</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--fo-muted)]">Huella del padrón</dt>
              <dd className="break-all font-mono text-xs">{sorteo.entrantsHash}</dd>
            </div>
            <div>
              <dt className="text-[var(--fo-muted)]">Cadena de drand</dt>
              <dd className="break-all font-mono text-xs">{sorteo.drandChainHash}</dd>
            </div>
            {sorteo.drandRandomness ? (
              <div>
                <dt className="text-[var(--fo-muted)]">Número de la tanda {sorteo.drandRound}</dt>
                <dd className="break-all font-mono text-xs">{sorteo.drandRandomness}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-sm">
            <Link href={`/portal/sorteos/${sorteo.id}/verificacion`} className="underline">
              Ver la pantalla de verificación, tal como la ve el socio
            </Link>
          </p>
        </section>
      ) : null}

      {/* ── Premios ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Premios</h2>

        {sorteo.prizes.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
            Todavía no hay premios. Un sorteo no se puede anunciar sin al menos uno.
          </p>
        ) : (
          <div className="fo-card overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="text-left text-[var(--fo-muted)]">
                <tr className="border-b border-[var(--fo-border)]">
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Premio</th>
                  <th className="px-4 py-3 font-medium">Aliado</th>
                  <th className="px-4 py-3 font-medium">Retiro hasta</th>
                  <th className="px-4 py-3 font-medium">Ganador</th>
                  {editable && admin ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {sorteo.prizes.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--fo-border-muted)] last:border-0">
                    <td className="px-4 py-3 tabular-nums">{p.order}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.title}</p>
                      {p.description ? (
                        <p className="text-xs text-[var(--fo-muted)]">{p.description}</p>
                      ) : null}
                      {p.estimatedValueMinor !== null ? (
                        <p className="text-xs text-[var(--fo-muted)]">
                          Valor estimado {formatMinorArs(p.estimatedValueMinor)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{p.partnerNameSnapshot ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.pickupDeadline ? fechaCorta(p.pickupDeadline) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.award ? (
                        <>
                          <p className="font-medium">
                            {p.award.member.memberNumber} ·{" "}
                            {`${p.award.member.firstName} ${p.award.member.lastName}`.trim()}
                          </p>
                          <p className="text-xs text-[var(--fo-muted)]">
                            {prizeStatusLabel(p.award.status)}
                          </p>
                        </>
                      ) : (
                        <span className="text-[var(--fo-muted)]">—</span>
                      )}
                    </td>
                    {editable && admin ? (
                      <td className="px-4 py-3 text-right">
                        <form action={deletePrizeAction}>
                          <input type="hidden" name="raffleId" value={sorteo.id} />
                          <input type="hidden" name="prizeId" value={p.id} />
                          <button className="fo-btn fo-btn-danger-outline text-xs">Sacar</button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editable && admin ? (
          <PremioForm raffleId={sorteo.id} siguienteOrden={sorteo.prizes.length + 1} />
        ) : null}
      </section>

      {/* ── Acciones ── */}
      {admin && (puedeAnunciar || puedeSellar || puedeSortear || puedeCancelar) ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Qué se puede hacer ahora</h2>

          {puedeAnunciar ? (
            <form action={announceRaffleAction} className="fo-card space-y-3 p-6">
              <input type="hidden" name="raffleId" value={sorteo.id} />
              <p className="text-sm">
                <strong>Anunciar.</strong> Fija la tanda de drand de la que va a salir el
                número. Después de esto no se tocan ni las fechas ni los premios: cambiarlos
                cambiaría el cálculo del ganador.
              </p>
              <button className="fo-btn fo-btn-primary text-sm">Anunciar el sorteo</button>
            </form>
          ) : null}

          {puedeSellar ? (
            <form action={sealRaffleAction} className="fo-card space-y-3 p-6">
              <input type="hidden" name="raffleId" value={sorteo.id} />
              <p className="text-sm">
                <strong>Sellar el padrón.</strong> Congela la lista de los socios que estaban
                al día al cierre y publica su huella. Ocurre antes de que exista el número, y
                eso es lo que impide acomodar la lista sabiendo el resultado.
              </p>
              <button className="fo-btn fo-btn-primary text-sm">Sellar el padrón</button>
            </form>
          ) : null}

          {puedeSortear ? (
            <form action={resolveRaffleAction} className="fo-card space-y-3 p-6">
              <input type="hidden" name="raffleId" value={sorteo.id} />
              <p className="text-sm">
                <strong>Sortear.</strong> Lee el número de la tanda {sorteo.drandRound} y
                resuelve los premios. Si drand todavía no lo publicó, se avisa y se reintenta
                solo: el resultado ya está determinado.
              </p>
              <button className="fo-btn fo-btn-primary text-sm">Sortear ahora</button>
            </form>
          ) : null}

          {puedeCancelar ? (
            <form action={cancelRaffleAction} className="fo-card space-y-3 p-6">
              <input type="hidden" name="raffleId" value={sorteo.id} />
              <label className="fo-label" htmlFor="cancelReason">
                Cancelar el sorteo
              </label>
              <input
                id="cancelReason"
                name="cancelReason"
                className="fo-input"
                required
                placeholder="Por qué se cancela"
              />
              <p className="fo-helper">
                El motivo queda en la historia y se le puede mostrar al socio. Un sorteo con el
                padrón ya sellado no se cancela desde acá.
              </p>
              <button className="fo-btn fo-btn-danger text-sm">Cancelar el sorteo</button>
            </form>
          ) : null}
        </section>
      ) : null}

      {/* ── Historia ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Historia</h2>
        <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
          {sorteo.events.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <p>
                <span className="font-medium">{EVENTOS[e.type] ?? e.type}</span>{" "}
                <span className="text-[var(--fo-muted)]">
                  · {fechaHora(e.createdAt)}
                  {e.actorLabel ? ` · ${e.actorLabel}` : " · el sistema"}
                </span>
              </p>
              {e.note ? (
                <p className="mt-1 break-all text-xs text-[var(--fo-muted)]">{e.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
