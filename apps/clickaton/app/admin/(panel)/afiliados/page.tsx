import { ActionResultMessage } from "@/components/admin/affiliates/ActionResultMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import {
  createAffiliateAction,
  inviteAffiliateAction,
  refreshAffiliateConsentAdminAction,
  setAffiliateActiveAction,
} from "@/lib/affiliates/admin/actions";
import { listAffiliatesForAdmin } from "@/lib/affiliates/admin/queries";
import {
  consentStatusLabel,
  formatCommissionBps,
  normalizeAffiliateConsentStatus,
} from "@/lib/affiliates/domain/labels";
import { consentBadgeVariant, safeInviteUrl } from "@/lib/affiliates/ui/presentation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

function fecha(value: Date | null): string {
  if (!value) return "nunca";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(value);
}

export default async function AdminAffiliatesPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const flash = await searchParams;

  const result = await withClickatonDb(async () => listAffiliatesForAdmin());

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Fotógrafos con código"
        description="Fotógrafos que comparten un código de descuento y cobran una comisión por cada inscripción que traen."
        breadcrumbs={[{ label: "Fotógrafos con código" }]}
      />

      <ActionResultMessage ok={flash.ok} error={flash.error} />

      <Card variant="outlined" className="space-y-2 p-5 text-sm text-ck-text-muted">
        <p>
          <strong className="text-ck-text">Cómo funciona:</strong> 1) das de alta al fotógrafo
          acá; 2) le enviás la invitación de Mercado Pago y él la acepta desde su cuenta; 3) en{" "}
          <a className="underline" href={adminRoutes.promotions}>
            Códigos promocionales
          </a>{" "}
          creás su código y le ponés la comisión.
        </p>
        <p>
          Mientras no acepte la invitación, la comisión se anota igual y queda &quot;A
          transferir&quot; en{" "}
          <a className="underline" href={adminRoutes.commissions}>
            Comisiones de fotógrafos
          </a>
          : se le paga a mano.
        </p>
      </Card>

      {!result.ok ? (
        <AdminMigrationNotice message={result.message} />
      ) : (
        <Card variant="outlined" className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-ck-text">Fotógrafos</h2>
          {result.data.length === 0 ? (
            <p className="text-sm text-ck-text-muted">Todavía no hay fotógrafos dados de alta.</p>
          ) : (
            <ul className="space-y-4">
              {result.data.map((a) => {
                const consent = normalizeAffiliateConsentStatus(a.consentStatus);
                const inviteUrl = safeInviteUrl(a.consentInviteUrl);
                return (
                  <li
                    key={a.id}
                    className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-ck-text">
                          {a.displayName}
                          {!a.isActive ? (
                            <Badge variant="neutral" className="ml-2">
                              Desactivado
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-sm text-ck-text-secondary">
                          Cuenta DNX: {a.dnxEmail ?? "sin cuenta vinculada"}
                        </p>
                        <p className="text-sm text-ck-text-secondary">
                          Mercado Pago: {a.mpSellerEmail}
                        </p>
                        {a.notes ? <p className="text-sm text-ck-text-muted">{a.notes}</p> : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={consentBadgeVariant(a.consentStatus)}>
                          {consentStatusLabel(a.consentStatus)}
                        </Badge>
                        <span className="text-xs text-ck-text-muted">
                          Consultado: {fecha(a.consentCheckedAt)}
                        </span>
                      </div>
                    </div>

                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Códigos ({a.codes.length})
                        </dt>
                        {a.codes.length === 0 ? (
                          <dd className="text-ck-text-muted">Todavía no tiene código.</dd>
                        ) : (
                          a.codes.map((c) => (
                            <dd key={c.code}>
                              <span className="font-mono">{c.code}</span> ·{" "}
                              {formatCommissionBps(c.bps)}
                              {!c.isActive ? " · desactivado" : ""}
                            </dd>
                          ))
                        )}
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Link de la invitación
                        </dt>
                        {inviteUrl ? (
                          <dd className="break-all">
                            <a
                              className="text-ck-yellow underline"
                              href={inviteUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {inviteUrl}
                            </a>
                          </dd>
                        ) : (
                          <dd className="text-ck-text-muted">—</dd>
                        )}
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-3 border-t border-ck-border pt-4">
                      {a.isActive && consent !== "ACTIVE" ? (
                        <form action={inviteAffiliateAction}>
                          <input type="hidden" name="affiliateId" value={a.id} />
                          <ConfirmSubmitButton
                            variant="primary"
                            className="min-h-11"
                            confirmMessage={`¿Enviar la invitación de Mercado Pago a ${a.mpSellerEmail}? Mercado Pago le manda un email para que acepte cobrar su comisión en el mismo pago.`}
                          >
                            {consent === "NONE"
                              ? "Enviar invitación de Mercado Pago"
                              : "Reenviar invitación de Mercado Pago"}
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                      {a.consentReceiverId ? (
                        <form action={refreshAffiliateConsentAdminAction}>
                          <input type="hidden" name="affiliateId" value={a.id} />
                          <Button type="submit" variant="secondary" className="min-h-11">
                            Actualizar estado
                          </Button>
                        </form>
                      ) : null}
                      <form action={setAffiliateActiveAction}>
                        <input type="hidden" name="affiliateId" value={a.id} />
                        <input type="hidden" name="isActive" value={a.isActive ? "false" : "true"} />
                        <ConfirmSubmitButton
                          variant="outline"
                          className="min-h-11"
                          confirmMessage={
                            a.isActive
                              ? `¿Desactivar a ${a.displayName}? Sus códigos siguen dando descuento, pero las inscripciones nuevas no le generan comisión. Lo ya anotado no cambia.`
                              : `¿Volver a activar a ${a.displayName}?`
                          }
                        >
                          {a.isActive ? "Desactivar" : "Activar"}
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Card variant="outlined" className="p-5">
        <h2 className="mb-2 text-lg font-semibold text-ck-text">Dar de alta un fotógrafo</h2>
        <p className="mb-6 text-sm text-ck-text-muted">
          El fotógrafo necesita una cuenta en Clickatón (DNX). Si no la tiene, pedile que la cree
          en <span className="font-mono">/crear-cuenta</span> y después volvé acá.
        </p>
        <form action={createAffiliateAction} className="grid gap-6 md:grid-cols-2">
          <Field id="displayName" label="Nombre" required>
            <Input name="displayName" placeholder="Ana Pérez Fotografía" className="min-h-11" />
          </Field>
          <Field
            id="dnxEmail"
            label="Email de su cuenta DNX"
            required
            hint="El mismo con el que entra a Clickatón: ahí va a ver sus códigos y comisiones"
          >
            <Input name="dnxEmail" type="email" autoComplete="off" className="min-h-11" />
          </Field>
          <Field
            id="mpSellerEmail"
            label="Email de su cuenta de Mercado Pago"
            required
            hint="A este email le llega la invitación para cobrar en el mismo pago"
          >
            <Input name="mpSellerEmail" type="email" autoComplete="off" className="min-h-11" />
          </Field>
          <Field id="notes" label="Notas internas">
            <Textarea name="notes" rows={2} />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" className="min-h-11">
              Dar de alta
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
