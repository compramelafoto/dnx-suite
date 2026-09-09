import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireRafflesStaff } from "@/lib/raffles/access";
import { listPendingAwards } from "@/lib/raffles/delivery";
import { fechaCorta, prizeStatusLabel } from "@/lib/raffles/labels";
import { advanceAwardAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireRafflesStaff();
  const params = await searchParams;
  const pendientes = await listPendingAwards(workspace.id);
  const ahora = new Date();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Premios por entregar"
        description="Lo que vence primero, arriba. Cada paso queda anotado con quién lo hizo: es lo que se pregunta meses después."
        actions={
          <Link href="/sorteos" className="fo-btn fo-btn-ghost text-sm">
            Volver a sorteos
          </Link>
        }
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-alert-success p-4 text-sm">Listo, quedó anotado.</p> : null}

      {pendientes.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <PackageCheck className="size-7" aria-hidden />
          </div>
          <p className="text-base font-semibold">No hay premios pendientes</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {pendientes.map((a) => {
            const vencido =
              a.prize.pickupDeadline !== null && a.prize.pickupDeadline.getTime() < ahora.getTime();
            return (
              <li key={a.id} className="fo-card space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{a.prize.title}</p>
                    <p className="text-sm text-[var(--fo-muted)]">
                      {a.raffle.title}
                      {a.prize.partnerNameSnapshot ? ` · dona ${a.prize.partnerNameSnapshot}` : ""}
                    </p>
                    <p className="text-sm">
                      Ganó el socio {a.member.memberNumber} ·{" "}
                      {`${a.member.firstName} ${a.member.lastName}`.trim()}
                    </p>
                    <p className="text-sm text-[var(--fo-muted)]">
                      {a.member.email ?? "sin correo"}
                      {a.member.phone ? ` · ${a.member.phone}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{prizeStatusLabel(a.status)}</p>
                    {a.prize.pickupDeadline ? (
                      <p className={vencido ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}>
                        {vencido ? "Venció el " : "Retira hasta el "}
                        {fechaCorta(a.prize.pickupDeadline)}
                      </p>
                    ) : (
                      <p className="text-[var(--fo-muted)]">Sin plazo</p>
                    )}
                  </div>
                </div>

                {a.prize.pickupInstructions ? (
                  <p className="text-sm text-[var(--fo-muted)]">{a.prize.pickupInstructions}</p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {a.status === "GANADO" ? (
                    <form action={advanceAwardAction}>
                      <input type="hidden" name="awardId" value={a.id} />
                      <input type="hidden" name="to" value="NOTIFICADO" />
                      <button className="fo-btn fo-btn-secondary text-sm">Ya le avisamos</button>
                    </form>
                  ) : null}

                  <form action={advanceAwardAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="awardId" value={a.id} />
                    <input type="hidden" name="to" value="RETIRADO" />
                    <input
                      name="note"
                      className="fo-input w-56 text-sm"
                      placeholder="Nota de la entrega"
                    />
                    <button className="fo-btn fo-btn-primary text-sm">Lo retiró</button>
                  </form>

                  {vencido ? (
                    <form action={advanceAwardAction}>
                      <input type="hidden" name="awardId" value={a.id} />
                      <input type="hidden" name="to" value="NO_RETIRADO" />
                      <button className="fo-btn fo-btn-secondary text-sm">No lo retiró</button>
                    </form>
                  ) : null}

                  <form action={advanceAwardAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="awardId" value={a.id} />
                    <input type="hidden" name="to" value="ANULADO" />
                    <input
                      name="note"
                      className="fo-input w-56 text-sm"
                      placeholder="Motivo de la anulación"
                      required
                    />
                    <button className="fo-btn fo-btn-danger-outline text-sm">Anular</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
