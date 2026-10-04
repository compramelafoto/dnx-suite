import { readEligibilityRule } from "@repo/promotions";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import {
  createPromotionFormAction,
  setPromotionActiveAction,
} from "@/lib/admin/promotions/mutations";
import {
  COMMERCIAL_REVIEW_NOTE,
  commercialToneToBadgeVariant,
  formatCommercialDateTime,
  presentPromotionDiscount,
  presentPromotionOperationalStatus,
  presentPromotionUsage,
} from "@/lib/admin/pricing/ui/commercial-status-presentation";
import {
  countPromotionRedemptions,
  listClickatonPromotions,
} from "@/lib/promotions/prisma-promotions-adapter";
import { withClickatonDb } from "@/lib/admin/db";
import { ActionResultMessage } from "@/components/admin/affiliates/ActionResultMessage";
import { setCouponAffiliateAction } from "@/lib/affiliates/admin/actions";
import { listAffiliateNames } from "@/lib/affiliates/admin/queries";
import { readCouponAffiliate } from "@/lib/affiliates/domain/coupon-affiliate";
import { formatCommissionBps } from "@/lib/affiliates/domain/labels";

type Props = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function AdminPromotionsPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const flash = await searchParams;

  const listResult = await withClickatonDb(async () => listClickatonPromotions());
  if (!listResult.ok) {
    return (
      <div className="space-y-6">
        <AdminMigrationNotice message={listResult.message} />
      </div>
    );
  }

  const editions = await listEditionOptions();
  const editionOptions = editions.ok ? editions.data : [];
  const editionNameById = new Map(editionOptions.map((e) => [e.id, e.name]));

  // Best-effort: si la tabla de afiliados no está, los cupones se siguen viendo.
  const affiliatesResult = await withClickatonDb(async () => listAffiliateNames());
  const affiliates = affiliatesResult.ok ? affiliatesResult.data : [];
  const activeAffiliates = affiliates.filter((a) => a.isActive);
  const affiliateNameById = new Map(affiliates.map((a) => [a.id, a.displayName]));

  const rows = await Promise.all(
    listResult.data.map(async (p) => ({
      promo: p,
      usage: await countPromotionRedemptions(p.id),
    })),
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Códigos promocionales"
        description="Creá descuentos para campañas, sponsors, invitados o acciones especiales."
        breadcrumbs={[{ label: "Códigos promocionales" }]}
      />

      <ActionResultMessage ok={flash.ok} error={flash.error} />

      <Card variant="outlined" className="space-y-2 p-5 text-sm text-ck-text-muted">
        <p>
          El descuento se calcula en el servidor al momento de usarlo. No se crean códigos de
          producción automáticamente.
        </p>
        <p>{COMMERCIAL_REVIEW_NOTE}</p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="text-lg font-semibold text-ck-text">Códigos existentes</h2>
        {rows.length === 0 ? (
          <div className="space-y-2">
            <p className="font-medium text-ck-text">Aún no hay códigos promocionales</p>
            <p className="text-sm text-ck-text-muted">
              Creá uno cuando necesites ofrecer un descuento especial.
            </p>
          </div>
        ) : (
          <ul className="space-y-6">
            {rows.map(({ promo, usage }) => {
              const status = presentPromotionOperationalStatus({
                isActive: promo.isActive,
                startsAt: promo.startsAt,
                endsAt: promo.endsAt,
                totalUsageLimit: promo.totalUsageLimit,
                activeUses: usage.active,
              });
              const discount = presentPromotionDiscount(
                promo.discountType,
                promo.discountValue,
              );
              const usageLabels = presentPromotionUsage({
                activeUses: usage.active,
                totalUses: usage.total,
                totalUsageLimit: promo.totalUsageLimit,
              });
              const editionLabel = promo.editionId
                ? (editionNameById.get(promo.editionId) ?? "Edición específica")
                : "Todas las ediciones Clickatón";
              const eligibilityRule = readEligibilityRule(
                promo.metadata as Record<string, unknown> | null,
              );
              const conditionLabel = eligibilityRule
                ? `${eligibilityRule.requireCheckIn ? "Acreditados" : "Inscriptos"} en ${eligibilityRule.editionIds
                    .map((id) => editionNameById.get(id) ?? "otra edición")
                    .join(", ")}`
                : "Abierto a cualquiera";
              const couponAffiliate = readCouponAffiliate(promo.metadata);
              const affiliateLabel = couponAffiliate
                ? `${affiliateNameById.get(couponAffiliate.affiliateId) ?? "fotógrafo desconocido"} · ${formatCommissionBps(couponAffiliate.commissionBps)}`
                : null;

              return (
                <li
                  key={promo.id}
                  className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-lg font-semibold tracking-wide text-ck-text">
                          {promo.code}
                        </p>
                        <Badge variant={commercialToneToBadgeVariant(status.tone)}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-ck-text-muted">
                        Código que utilizará el participante
                      </p>
                      <p className="font-medium text-ck-text">{promo.name}</p>
                      <p className="text-sm text-ck-text">{discount.label}</p>
                      <p className="text-xs text-ck-text-muted">{discount.description}</p>
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                            Comienza
                          </dt>
                          <dd>{formatCommercialDateTime(promo.startsAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                            Finaliza
                          </dt>
                          <dd>{formatCommercialDateTime(promo.endsAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                            Usos
                          </dt>
                          <dd>{usageLabels.summary}</dd>
                          <dd className="text-xs text-ck-text-muted">
                            {usageLabels.remainingLabel}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                            Edición
                          </dt>
                          <dd>{editionLabel}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                            Quién puede usarlo
                          </dt>
                          <dd>{conditionLabel}</dd>
                        </div>
                        {affiliateLabel ? (
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                              Código de fotógrafo
                            </dt>
                            <dd>Fotógrafo: {affiliateLabel}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await setPromotionActiveAction(promo.id, !promo.isActive);
                      }}
                    >
                      <ConfirmSubmitButton
                        variant="secondary"
                        className="min-h-11 w-full sm:w-auto"
                        confirmMessage={
                          promo.isActive
                            ? "¿Desactivar este código? Los participantes ya no podrán utilizarlo en nuevas inscripciones. No afecta pagos ya realizados."
                            : "¿Volver a habilitar este código? Podrá usarse según su vigencia y límites."
                        }
                      >
                        {promo.isActive ? "Desactivar código" : "Volver a habilitar"}
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                  {affiliatesResult.ok ? (
                    <details className="rounded-[var(--ck-radius-card)] border border-ck-border px-3 py-2 text-sm">
                      <summary className="cursor-pointer text-ck-text-secondary">
                        {couponAffiliate
                          ? "Cambiar o quitar el fotógrafo de este código"
                          : "Convertir en código de fotógrafo"}
                      </summary>
                      <p className="mt-2 text-xs text-ck-text-muted">
                        Afecta sólo a las inscripciones nuevas. Las comisiones ya anotadas no
                        cambian.
                      </p>
                      <form
                        action={setCouponAffiliateAction}
                        className="mt-3 flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="promotionId" value={promo.id} />
                        <label className="text-sm">
                          <span className="ck-label text-ck-text-secondary">Fotógrafo</span>
                          <Select
                            name="affiliateId"
                            defaultValue={couponAffiliate?.affiliateId ?? ""}
                            className="mt-1 min-h-11"
                          >
                            <option value="">—</option>
                            {activeAffiliates.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.displayName}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="text-sm">
                          <span className="ck-label text-ck-text-secondary">Comisión (%)</span>
                          <Input
                            name="commissionPercent"
                            inputMode="decimal"
                            defaultValue={
                              couponAffiliate
                                ? String(couponAffiliate.commissionBps / 100).replace(".", ",")
                                : ""
                            }
                            placeholder="10"
                            className="mt-1 min-h-11 w-28"
                          />
                        </label>
                        <Button type="submit" variant="secondary" className="min-h-11">
                          Guardar
                        </Button>
                      </form>
                      {couponAffiliate ? (
                        <form action={setCouponAffiliateAction} className="mt-3">
                          <input type="hidden" name="promotionId" value={promo.id} />
                          <input type="hidden" name="remove" value="true" />
                          <ConfirmSubmitButton
                            variant="text"
                            className="min-h-11"
                            confirmMessage="¿Quitar el fotógrafo de este código? Sigue funcionando como descuento, pero las inscripciones nuevas no le generan comisión."
                          >
                            Quitar fotógrafo
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </details>
                  ) : null}
                  <AdminTechnicalInfo
                    title="Información técnica del código"
                    rows={[
                      {
                        label: "ID de promoción",
                        value: promo.id,
                        mono: true,
                        copyText: promo.id,
                      },
                      {
                        label: "Tipo de descuento interno",
                        value: promo.discountType,
                        mono: true,
                      },
                      {
                        label: "Valor interno",
                        value: String(promo.discountValue),
                        mono: true,
                      },
                      {
                        label: "Usos totales registrados",
                        value: String(usage.total),
                        mono: true,
                      },
                      {
                        label: "ID de edición",
                        value: promo.editionId ?? "—",
                        mono: true,
                      },
                      {
                        label: "Inicio ISO",
                        value: promo.startsAt.toISOString(),
                        mono: true,
                      },
                      {
                        label: "Fin ISO",
                        value: promo.endsAt.toISOString(),
                        mono: true,
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card variant="outlined" className="p-5">
        <h2 className="mb-2 text-lg font-semibold text-ck-text">Crear código</h2>
        <p className="mb-6 text-sm text-ck-text-muted">
          Completá el código visible para el participante y las reglas de descuento.
        </p>
        <form action={createPromotionFormAction} className="grid gap-6 md:grid-cols-2">
          <Field
            id="code"
            label="Código que utilizará el participante"
            required
            hint="Se normaliza a mayúsculas"
          >
            <Input name="code" placeholder="CLICK50" autoComplete="off" className="min-h-11" />
          </Field>
          <Field id="name" label="Nombre interno" required>
            <Input name="name" placeholder="50 % campaña Clickatón" className="min-h-11" />
          </Field>
          <Field id="discountType" label="Tipo de descuento">
            <Select name="discountType" defaultValue="PERCENTAGE" className="min-h-11">
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="FIXED_AMOUNT">Importe fijo</option>
            </Select>
          </Field>
          <Field
            id="discountValue"
            label="Valor del descuento"
            required
            hint="Porcentaje 1–100, o pesos enteros si es importe fijo"
          >
            <Input name="discountValue" inputMode="numeric" placeholder="50" className="min-h-11" />
          </Field>
          <Field id="startsAt" label="Fecha de inicio" required>
            <Input type="datetime-local" name="startsAt" className="min-h-11" />
          </Field>
          <Field id="endsAt" label="Fecha de finalización" required>
            <Input type="datetime-local" name="endsAt" className="min-h-11" />
          </Field>
          <Field id="minimumPurchaseAmountPesos" label="Compra mínima (pesos)">
            <Input name="minimumPurchaseAmountPesos" inputMode="numeric" className="min-h-11" />
          </Field>
          <Field id="maxDiscountAmountPesos" label="Tope de descuento (pesos)">
            <Input name="maxDiscountAmountPesos" inputMode="numeric" className="min-h-11" />
          </Field>
          <Field
            id="totalUsageLimit"
            label="Límite total de usos"
            hint="Vacío = sin límite configurado"
          >
            <Input name="totalUsageLimit" inputMode="numeric" className="min-h-11" />
          </Field>
          <Field id="perUserUsageLimit" label="Límite por persona" hint="Por defecto 1">
            <Input
              name="perUserUsageLimit"
              inputMode="numeric"
              defaultValue="1"
              className="min-h-11"
            />
          </Field>
          <Field id="editionId" label="Edición">
            <Select name="editionId" defaultValue="" className="min-h-11">
              <option value="">Todas las ediciones Clickatón</option>
              {editionOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="eligibilityKind"
            label="¿Quién puede usarlo?"
            hint="Restringe el cupón a participantes de una edición anterior"
          >
            <Select name="eligibilityKind" defaultValue="" className="min-h-11">
              <option value="">Cualquiera</option>
              <option value="PARTICIPATED_IN_EDITION">
                Sólo quienes participaron de…
              </option>
            </Select>
          </Field>
          <Field id="eligibilityEditionId" label="…de esta edición">
            <Select name="eligibilityEditionId" defaultValue="" className="min-h-11">
              <option value="">—</option>
              {editionOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ck-text md:col-span-2">
            <input
              type="checkbox"
              name="eligibilityRequireCheckIn"
              className="size-4 rounded border-ck-border"
            />
            Sólo quienes además se acreditaron el día del evento
          </label>
          {affiliatesResult.ok ? (
            <fieldset className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-4 md:col-span-2">
              <legend className="px-1 text-sm font-semibold text-ck-text">
                Código de fotógrafo (opcional)
              </legend>
              <p className="text-sm text-ck-text-muted">
                Si este código lo comparte un fotógrafo, elegilo y poné su comisión. La comisión
                se calcula sobre el precio de la inscripción antes del descuento (sin el envío
                del kit). Dejá los dos vacíos si es un código común.{" "}
                {activeAffiliates.length === 0 ? (
                  <>
                    Todavía no hay fotógrafos activos: dalos de alta en{" "}
                    <a className="underline" href={adminRoutes.affiliates}>
                      Fotógrafos con código
                    </a>
                    .
                  </>
                ) : null}
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <Field id="affiliateId" label="Fotógrafo">
                  <Select name="affiliateId" defaultValue="" className="min-h-11">
                    <option value="">Ninguno (código común)</option>
                    {activeAffiliates.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  id="affiliateCommissionPercent"
                  label="Comisión para el fotógrafo (%)"
                  hint="Admite decimales, por ejemplo 7,5"
                >
                  <Input
                    name="affiliateCommissionPercent"
                    inputMode="decimal"
                    placeholder="10"
                    className="min-h-11"
                  />
                </Field>
              </div>
            </fieldset>
          ) : null}
          <label className="flex min-h-11 items-center gap-2 text-sm text-ck-text md:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="size-4 rounded border-ck-border"
            />
            Disponible al crear
          </label>
          <div className="md:col-span-2">
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={2} />
            </Field>
          </div>
          <div className="md:col-span-2 space-y-3">
            <Button type="submit" variant="primary" className="min-h-11">
              Crear código
            </Button>
            <p className="text-xs text-ck-text-muted">
              En ambientes de prueba podés usar códigos como CLICKATON50 o BIENVENIDA5000. No se
              siembran automáticamente en producción. Ver{" "}
              <a className="underline" href={adminRoutes.integrations}>
                Integraciones
              </a>
              .
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
