import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireRafflesStaff } from "@/lib/raffles/access";
import { listAwardsMissingReceipt, listPendingAwards } from "@/lib/raffles/delivery";
import { fechaCorta, prizeStatusLabel } from "@/lib/raffles/labels";
import { advanceAwardAction, registerReceiptAction, retryNoticesAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireRafflesStaff();
  const params = await searchParams;
  const [pendientes, sinComprobante] = await Promise.all([
    listPendingAwards(workspace.id),
    listAwardsMissingReceipt(workspace.id),
  ]);
  const ahora = new Date();
  const avisosFallados = pendientes.filter((a) => a.noticeError || a.sponsorNoticeError);

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

      {avisosFallados.length > 0 ? (
        <div className="fo-alert-warning space-y-3 p-4 text-sm">
          <p className="font-medium">
            {avisosFallados.length === 1
              ? "Hay un aviso que no salió."
              : `Hay ${avisosFallados.length} avisos que no salieron.`}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {avisosFallados.map((a) => (
              <li key={a.id}>
                {a.prize.title} — {a.noticeError ?? a.sponsorNoticeError}
              </li>
            ))}
          </ul>
          <form action={retryNoticesAction}>
            <button className="fo-btn fo-btn-secondary text-sm">Reintentar los avisos</button>
          </form>
          <p className="text-xs">
            La tarea programada reintenta sola cada quince minutos. Este botón es para cuando
            acabás de corregir un correo y no querés esperar.
          </p>
        </div>
      ) : null}

      {sinComprobante.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Premios entregados sin comprobante</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            El aliado tiene que mandar una foto o un PDF del remito, o una factura por $0 con la
            leyenda «Sin valor comercial — Destinado a sorteo entre asociados». Es el respaldo de
            cómo llegó el premio a la institución.
          </p>
          <ul className="space-y-3">
            {sinComprobante.map((a) => (
              <li key={a.id} className="fo-card space-y-3 p-5">
                <div>
                  <p className="font-medium">{a.prize.title}</p>
                  <p className="text-sm text-[var(--fo-muted)]">
                    {a.raffle.title} · lo entregó {a.prize.partnerNameSnapshot ?? "la institución"}
                    {a.prize.partnerEmailSnapshot ? ` (${a.prize.partnerEmailSnapshot})` : ""}
                  </p>
                  <p className="text-sm">
                    Lo retiró el socio {a.member.memberNumber} ·{" "}
                    {`${a.member.firstName} ${a.member.lastName}`.trim()}
                    {a.deliveredAt ? ` el ${fechaCorta(a.deliveredAt)}` : ""}
                  </p>
                </div>
                <form action={registerReceiptAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="awardId" value={a.id} />
                  <input
                    name="fileUrl"
                    className="fo-input w-72 text-sm"
                    placeholder="Enlace al remito (PDF o foto)"
                  />
                  <input name="note" className="fo-input w-56 text-sm" placeholder="Nota" />
                  <button className="fo-btn fo-btn-primary text-sm">Registrar el comprobante</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

                {a.prize.partnerAddressSnapshot ? (
                  <p className="text-sm text-[var(--fo-muted)]">
                    Retira en {a.prize.partnerNameSnapshot} — {a.prize.partnerAddressSnapshot}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--fo-muted)]">
                  <span>
                    Aviso al socio:{" "}
                    {a.notifiedAt ? (
                      <span className="text-[var(--fo-success)]">enviado</span>
                    ) : (
                      <span className="text-[var(--fo-danger)]">{a.noticeError ?? "pendiente"}</span>
                    )}
                  </span>
                  <span>
                    Aviso al aliado:{" "}
                    {a.sponsorNotifiedAt ? (
                      <span className="text-[var(--fo-success)]">enviado</span>
                    ) : (
                      <span className="text-[var(--fo-danger)]">
                        {a.sponsorNoticeError ?? "pendiente"}
                      </span>
                    )}
                  </span>
                </div>

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
