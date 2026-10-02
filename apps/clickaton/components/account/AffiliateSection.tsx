import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { refreshMyAffiliateConsentAction } from "@/lib/affiliates/account/actions";
import type { MyAffiliateView } from "@/lib/affiliates/account/queries";
import {
  COMMISSION_STATUS_LABELS,
  consentStatusLabel,
  formatCommissionBps,
} from "@/lib/affiliates/domain/labels";
import {
  COMMISSION_STATUS_ORDER,
  affiliateNeedsMpAction,
  consentBadgeVariant,
  formatArsMinor,
  safeInviteUrl,
} from "@/lib/affiliates/ui/presentation";

type Props = {
  afiliado: MyAffiliateView;
  ok?: string | null;
  error?: string | null;
};

/** Mi cuenta del fotógrafo con código: códigos, comisiones y Mercado Pago. */
export function AffiliateSection({ afiliado, ok, error }: Props) {
  const needsMp = affiliateNeedsMpAction(afiliado.consentStatus);
  const inviteUrl = safeInviteUrl(afiliado.inviteUrl);

  return (
    <section id="mis-codigos" className="space-y-4" aria-labelledby="mis-codigos-title">
      <h2 id="mis-codigos-title" className="ck-heading-md">
        Mis códigos de fotógrafo
      </h2>

      {error ? (
        <Card variant="outlined" className="p-4 text-sm text-ck-text" role="alert">
          {error.slice(0, 300)}
        </Card>
      ) : ok ? (
        <Card variant="outlined" className="p-4 text-sm text-ck-text" role="status">
          {ok.slice(0, 300)}
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-5 p-6">
        {afiliado.codes.length === 0 ? (
          <p className="text-sm text-ck-text-secondary">
            Todavía no tenés un código asignado. Cuando Clickatón te lo cree, lo vas a ver acá.
          </p>
        ) : (
          <ul className="space-y-2">
            {afiliado.codes.map((c) => (
              <li
                key={c.code}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-3"
              >
                <span className="font-mono text-lg font-semibold tracking-wide text-ck-yellow">
                  {c.code}
                </span>
                <span className="text-sm text-ck-text-secondary">
                  Tu comisión: {formatCommissionBps(c.commissionBps)} ·{" "}
                  {c.uses === 1 ? "1 uso" : `${c.uses} usos`}
                  {!c.isActive ? " · desactivado" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {COMMISSION_STATUS_ORDER.map((s) => (
            <div key={s} className="flex items-baseline justify-between gap-3">
              <dt className="text-ck-text-secondary">
                {COMMISSION_STATUS_LABELS[s]} ({afiliado.totals[s].count})
              </dt>
              <dd className="font-semibold text-ck-text">
                {formatArsMinor(afiliado.totals[s].netAmount)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ck-text-muted">
          Montos netos: ya descontada tu parte de la comisión de Mercado Pago.
        </p>

        <div className="space-y-3 border-t border-ck-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-ck-text-secondary">Mercado Pago:</p>
            <Badge variant={consentBadgeVariant(afiliado.consentStatus)}>
              {consentStatusLabel(afiliado.consentStatus)}
            </Badge>
          </div>
          {needsMp ? (
            <>
              <p className="text-sm leading-relaxed text-ck-text-secondary">
                Para cobrar automáticamente tu comisión, aceptá la invitación de Mercado Pago.
                Mientras tanto, tus comisiones se anotan igual y te las transferimos a mano.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {inviteUrl ? (
                  <Button
                    href={inviteUrl}
                    variant="primary"
                    className="min-h-11 w-full sm:w-auto"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir la invitación de Mercado Pago
                  </Button>
                ) : null}
                {afiliado.hasReceiver ? (
                  <form action={refreshMyAffiliateConsentAction} className="w-full sm:w-auto">
                    <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
                      Ya acepté
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-ck-text-muted">
                    Todavía no te enviamos la invitación. Te va a llegar un email de Mercado
                    Pago.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-ck-text-secondary">
              Tu cuenta de Mercado Pago está vinculada: la comisión se te acredita en el mismo
              pago de cada inscripción. Si alguna no se puede repartir así, te la transferimos a
              mano.
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}
