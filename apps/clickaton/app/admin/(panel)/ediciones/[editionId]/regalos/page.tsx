import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  cancelGiftVoucherAction,
  listEditionGiftVouchersAction,
  reissueGiftVoucherAction,
  resendGiftVoucherAction,
} from "@/lib/gift-vouchers/admin";
import { GIFT_RECIPIENT_EMAIL_MAX_SENDS } from "@/lib/gift-vouchers/notifications/notify-gift-lifecycle";
import {
  canManageGiftVoucher,
  giftToneToBadgeVariant,
  presentGiftStatus,
} from "@/lib/gift-vouchers/ui/gift-status-presentation";

type Props = {
  params: Promise<{ editionId: string }>;
};

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Cordoba",
  }).format(value);
}

export default async function EditionGiftVouchersAdminPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, giftVouchersEnabled: true },
  });
  if (!edition) notFound();

  const { rows, summary } = await listEditionGiftVouchersAction(editionId);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Regalos"
        description="Inscripciones que alguien compró para otra persona. El cupo queda guardado desde que se acredita el pago."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Regalos" },
        ]}
      />

      {!edition.giftVouchersEnabled ? (
        <Card className="border-[var(--ck-warning)] p-5">
          <p className="font-semibold">Los regalos están apagados en esta edición.</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Nadie puede comprar un regalo hasta que se encienda. Los que ya estén
            vendidos se pueden activar igual.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="ck-label text-ck-text-secondary">Cobrados</p>
          <p className="mt-1 text-2xl font-bold">{summary.vendidos}</p>
          <p className="mt-1 text-sm text-ck-text-secondary">
            {formatAmount(summary.recaudadoMinor, "ARS")} entraron
          </p>
        </Card>
        <Card className="p-5">
          <p className="ck-label text-ck-text-secondary">Sin activar</p>
          <p className="mt-1 text-2xl font-bold">{summary.sinActivar}</p>
          <p className="mt-1 text-sm text-ck-text-secondary">
            Ocupan cupo esperando a quien los recibe
          </p>
        </Card>
        <Card className="p-5">
          <p className="ck-label text-ck-text-secondary">Activados</p>
          <p className="mt-1 text-2xl font-bold">{summary.activados}</p>
          <p className="mt-1 text-sm text-ck-text-secondary">Ya son participantes</p>
        </Card>
        <Card className="p-5">
          <p className="ck-label text-ck-text-secondary">Anulados</p>
          <p className="mt-1 text-2xl font-bold">{summary.anulados}</p>
          <p className="mt-1 text-sm text-ck-text-secondary">
            El cupo volvió a la venta
          </p>
        </Card>
      </section>

      {summary.esperandoPago > 0 ? (
        <p className="text-sm text-ck-text-secondary" role="status">
          Hay {summary.esperandoPago}{" "}
          {summary.esperandoPago === 1 ? "compra empezada" : "compras empezadas"} sin
          pagar. Si el pago no llega, se cancelan solas y no ocupan cupo.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ck-text-secondary">
            Todavía no compró nadie un regalo para esta edición.
          </p>
        </Card>
      ) : (
        <section className="space-y-4">
          {rows.map((row) => {
            const estado = presentGiftStatus(row.status);
            const acciones = canManageGiftVoucher(row.status);
            const sinEnviosDisponibles =
              row.recipientEmailCount >= GIFT_RECIPIENT_EMAIL_MAX_SENDS;

            return (
              <Card key={row.code} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-lg font-bold tracking-wider">
                      {row.code}
                    </p>
                    <p className="text-sm text-ck-text-secondary">{estado.hint}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={giftToneToBadgeVariant(estado.tone)}>
                      {estado.label}
                    </Badge>
                    <span className="text-sm font-semibold">
                      {formatAmount(row.amountMinor, row.currency)}
                    </span>
                  </div>
                </div>

                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="ck-label text-ck-text-secondary">Lo regaló</dt>
                    <dd>{row.buyerName}</dd>
                    <dd className="text-ck-text-secondary">{row.buyerEmail}</dd>
                  </div>
                  <div>
                    <dt className="ck-label text-ck-text-secondary">Para</dt>
                    <dd>{row.recipientName ?? "Sin nombre"}</dd>
                    <dd className="text-ck-text-secondary">
                      {row.recipientEmail ?? "Se comparte por link"}
                    </dd>
                  </div>
                  <div>
                    <dt className="ck-label text-ck-text-secondary">Pago</dt>
                    <dd>{formatDate(row.paidAt)}</dd>
                    {row.redeemableUntil && row.status === "ACTIVE" ? (
                      <dd className="text-ck-text-secondary">
                        Para activar hasta {formatDate(row.redeemableUntil)}
                      </dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="ck-label text-ck-text-secondary">
                      {row.participantName ? "Participante" : "Activación"}
                    </dt>
                    <dd>{row.participantName ?? "Sin activar"}</dd>
                    {row.visibleCode ? (
                      <dd className="font-mono text-ck-text-secondary">
                        {row.visibleCode}
                      </dd>
                    ) : null}
                  </div>
                </dl>

                {row.reissueCount > 0 || row.recipientEmailCount > 0 ? (
                  <p className="text-xs text-ck-text-secondary">
                    {row.reissueCount > 0
                      ? `Código reemitido ${row.reissueCount} ${row.reissueCount === 1 ? "vez" : "veces"}. `
                      : ""}
                    {row.recipientEmailCount > 0
                      ? `Invitación enviada ${row.recipientEmailCount} de ${GIFT_RECIPIENT_EMAIL_MAX_SENDS} veces.`
                      : ""}
                  </p>
                ) : null}

                {acciones.anular || acciones.reemitir || acciones.reenviar ? (
                  <div className="flex flex-wrap items-end gap-3 border-t border-ck-border pt-4">
                    {acciones.reenviar ? (
                      <form action={resendGiftVoucherAction} className="flex items-end gap-2">
                        <input type="hidden" name="code" value={row.code} />
                        <input type="hidden" name="editionId" value={editionId} />
                        <div>
                          <label
                            htmlFor={`email-${row.code}`}
                            className="ck-label text-ck-text-secondary"
                          >
                            Reenviar a
                          </label>
                          <input
                            id={`email-${row.code}`}
                            name="recipientEmail"
                            type="email"
                            defaultValue={row.recipientEmail ?? ""}
                            placeholder="email de quien lo recibe"
                            className="mt-1 min-h-11 w-64 rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 py-2 text-sm"
                          />
                        </div>
                        <ConfirmSubmitButton
                          variant="secondary"
                          size="sm"
                          disabled={sinEnviosDisponibles}
                          confirmMessage={`¿Enviar la invitación de ${row.code}?`}
                        >
                          {sinEnviosDisponibles ? "Sin envíos disponibles" : "Enviar"}
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}

                    {acciones.reemitir ? (
                      <form action={reissueGiftVoucherAction}>
                        <input type="hidden" name="code" value={row.code} />
                        <input type="hidden" name="editionId" value={editionId} />
                        <ConfirmSubmitButton
                          variant="outline"
                          size="sm"
                          confirmMessage={`Se genera un código nuevo y ${row.code} deja de funcionar. Hay que pasarle el nuevo a quien lo recibe. ¿Seguir?`}
                        >
                          Reemitir código
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}

                    {acciones.anular ? (
                      <>
                        <form action={cancelGiftVoucherAction}>
                          <input type="hidden" name="code" value={row.code} />
                          <input type="hidden" name="editionId" value={editionId} />
                          <input type="hidden" name="refunded" value="false" />
                          <ConfirmSubmitButton
                            variant="outline"
                            size="sm"
                            confirmMessage={`Anular ${row.code}: el cupo vuelve a la venta y el código deja de servir. Esto NO devuelve la plata. ¿Seguir?`}
                          >
                            Anular
                          </ConfirmSubmitButton>
                        </form>
                        {row.paidAt ? (
                          <form action={cancelGiftVoucherAction}>
                            <input type="hidden" name="code" value={row.code} />
                            <input type="hidden" name="editionId" value={editionId} />
                            <input type="hidden" name="refunded" value="true" />
                            <ConfirmSubmitButton
                              variant="outline"
                              size="sm"
                              confirmMessage={`Marcar ${row.code} como devuelto: el cupo vuelve a la venta. La devolución del dinero se hace aparte, en Mercado Pago. ¿Seguir?`}
                            >
                              Marcar devuelto
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
