import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BENEFIT_STATUS_LABELS,
  CLICKATON_AUDIENCE_OPTIONS,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  DNX_PARTNER_BENEFIT_TYPES,
  DNX_PARTNER_CONTRIBUTION_TYPES,
  DNX_PARTNER_PARTICIPATION_STATUSES,
  DNX_PARTNER_REDEMPTION_METHODS,
  PARTICIPATION_STATUS_LABELS,
  PARTICIPATION_TYPE_LABELS,
} from "@repo/partners";
import { RequiresPaymentFields } from "@/components/admin/partners/RequiresPaymentFields";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import {
  activateEditionBenefitFormAction,
  archiveEditionBenefitFormAction,
  archiveEditionParticipationFormAction,
  createEditionBenefitFormAction,
  createEditionContributionFormAction,
  grantEditionBenefitAccessFormAction,
  linkEditionContributionPrizeFormAction,
  markEditionContributionDeliveredFormAction,
  pauseEditionBenefitFormAction,
  revokeEditionBenefitAccessFormAction,
  updateEditionParticipationFormAction,
} from "@/lib/admin/edition-partners/mutations";
import { listEditionPrizeBundles } from "@/lib/admin/edition-partners/service";
import { getEditionById } from "@/lib/admin/editions/queries";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";
import { prisma } from "@repo/db";

type Props = {
  params: Promise<{ editionId: string; participationId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
};

export default async function EditionParticipationDetailPage({
  params,
  searchParams,
}: Props) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { editionId, participationId } = await params;
  const flash = await searchParams;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;
  const base = `${adminRoutes.editions}/${editionId}/sponsors`;

  const loaded = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    const participation = await prisma.dnxPartnerParticipation.findUnique({
      where: { id: participationId },
    });
    if (
      !participation ||
      participation.application !== "CLICKATON" ||
      (participation.contextType === "EDITION" && participation.contextId !== editionId)
    ) {
      return null;
    }
    const partner = await svc.getPartner(actor, participation.partnerId);
    const [contributions, allBenefits, prizes, audits] = await Promise.all([
      svc.listContributions(actor, participationId),
      svc.listBenefits(actor, participation.partnerId),
      listEditionPrizeBundles(editionId),
      prisma.dnxPartnerAuditEvent.findMany({
        where: {
          OR: [
            { entityId: participationId },
            { partnerId: participation.partnerId, action: { startsWith: "benefit" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
    const benefits = allBenefits.filter((b) => b.participationId === participationId);
    const audiencesByBenefit = await Promise.all(
      benefits.map(async (b) => ({
        benefitId: b.id,
        audiences: await svc.listAudiences(actor, b.id),
        access: await svc.listBenefitAccess(actor, b.id),
      })),
    );
    return {
      participation,
      partner,
      contributions,
      benefits,
      prizes,
      audits,
      audiencesByBenefit,
    };
  });

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Participación" />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }
  if (!loaded.data) notFound();

  const {
    participation,
    partner,
    contributions,
    benefits,
    prizes,
    audits,
    audiencesByBenefit,
  } = loaded.data;
  const audienceMap = new Map(audiencesByBenefit.map((a) => [a.benefitId, a]));

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title={partner.name}
        description={`${PARTICIPATION_TYPE_LABELS[participation.participationType]} · ${PARTICIPATION_STATUS_LABELS[participation.status]}`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Sponsors y beneficios", href: base },
          { label: partner.name },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href={`${adminRoutes.sponsors}/${partner.id}`} variant="secondary">
              Ficha partner
            </Button>
            <form action={archiveEditionParticipationFormAction}>
              <input type="hidden" name="editionId" value={editionId} />
              <input type="hidden" name="participationId" value={participationId} />
              <Button type="submit" variant="outline">
                Archivar participación
              </Button>
            </form>
          </div>
        }
      />

      {flash.error ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {flash.error}
        </Card>
      ) : null}
      {flash.ok ? (
        <Card variant="outlined" className="border-emerald-500/30 p-4 text-sm text-ck-text-secondary">
          Guardado ({flash.ok}).
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Partner</h2>
        <Card variant="outlined" className="space-y-3 p-6">
          <div className="flex items-center gap-4">
            {partner.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-ck-surface text-xs text-ck-text-muted">
                Logo
              </div>
            )}
            <div>
              <p className="font-semibold text-ck-text">{partner.name}</p>
              <p className="text-sm text-ck-text-muted">{partner.slug}</p>
              {partner.websiteUrl ? (
                <Link href={partner.websiteUrl} className="text-sm text-ck-accent">
                  {partner.websiteUrl}
                </Link>
              ) : null}
            </div>
          </div>
          <p className="text-sm text-ck-text-secondary">
            Assets de marca multiplataforma: pendiente Etapa 01 Imp. 02. Mientras tanto se usa{" "}
            <code>logoUrl</code>.
          </p>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Participación</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          <form action={updateEditionParticipationFormAction} className="space-y-6">
            <input type="hidden" name="editionId" value={editionId} />
            <input type="hidden" name="participationId" value={participationId} />
            <Field id="title" label="Título">
              <Input name="title" defaultValue={participation.title ?? ""} />
            </Field>
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={3} defaultValue={participation.description ?? ""} />
            </Field>
            <Field id="status" label="Estado">
              <Select name="status" defaultValue={participation.status}>
                {DNX_PARTNER_PARTICIPATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PARTICIPATION_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="startsAt" label="Inicio">
                <Input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={
                    participation.startsAt
                      ? participation.startsAt.toISOString().slice(0, 16)
                      : ""
                  }
                />
              </Field>
              <Field id="endsAt" label="Fin">
                <Input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={
                    participation.endsAt ? participation.endsAt.toISOString().slice(0, 16) : ""
                  }
                />
              </Field>
            </div>
            <Field id="notes" label="Notas">
              <Textarea name="notes" rows={2} defaultValue={participation.notes ?? ""} />
            </Field>
            <RequiresPaymentFields />
            <p className="text-sm text-ck-text-muted">
              Actual: requiere pago = {participation.requiresPayment ? "sí" : "no"}
              {participation.requiresPayment
                ? ` · ${participation.paymentMode} · ${participation.paymentAmountMinor ?? "—"} ${participation.paymentCurrency ?? ""}`
                : ""}
              . Cambiar el select de pago sobrescribe estos campos.
            </p>
            <Button type="submit" variant="primary">
              Guardar participación
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Aportes</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          {contributions.length === 0 ? (
            <p className="text-sm text-ck-text-secondary">Sin aportes todavía.</p>
          ) : (
            <ul className="space-y-4">
              {contributions.map((c) => (
                <li key={c.id} className="rounded-lg border border-ck-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ck-text">{c.title}</p>
                      <p className="text-sm text-ck-text-muted">
                        {CONTRIBUTION_TYPE_LABELS[c.type]} ·{" "}
                        {CONTRIBUTION_STATUS_LABELS[c.status]}
                        {c.prizeBundleId ? ` · Premio ${c.prizeBundleId}` : ""}
                      </p>
                      {c.description ? (
                        <p className="mt-2 text-sm text-ck-text-secondary">{c.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.status !== "DELIVERED" ? (
                        <form action={markEditionContributionDeliveredFormAction}>
                          <input type="hidden" name="editionId" value={editionId} />
                          <input type="hidden" name="participationId" value={participationId} />
                          <input type="hidden" name="contributionId" value={c.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Marcar entregado
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  {!c.prizeBundleId &&
                  ["PRIZE", "PRODUCT", "VOUCHER", "SERVICE"].includes(c.type) ? (
                    <form
                      action={linkEditionContributionPrizeFormAction}
                      className="mt-4 flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="editionId" value={editionId} />
                      <input type="hidden" name="participationId" value={participationId} />
                      <input type="hidden" name="contributionId" value={c.id} />
                      <Field id={`prize-${c.id}`} label="Vincular premio Clickatón">
                        <Select name="prizeBundleId" defaultValue="">
                          <option value="">Seleccionar…</option>
                          {prizes.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.slot} {p.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button type="submit" size="sm" variant="outline">
                        Asociar
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <form action={createEditionContributionFormAction} className="space-y-6 border-t border-ck-border pt-8">
            <h3 className="text-lg font-semibold text-ck-text">Nuevo aporte</h3>
            <input type="hidden" name="editionId" value={editionId} />
            <input type="hidden" name="participationId" value={participationId} />
            <Field id="type" label="Tipo" required>
              <Select name="type" defaultValue="PRIZE">
                {DNX_PARTNER_CONTRIBUTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTRIBUTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="title" label="Título" required>
              <Input name="title" required />
            </Field>
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={2} />
            </Field>
            <div className="grid gap-6 md:grid-cols-3">
              <Field id="quantity" label="Cantidad">
                <Input name="quantity" type="number" min={0} />
              </Field>
              <Field id="estimatedUnitValueMinor" label="Valor unit. (centavos)">
                <Input name="estimatedUnitValueMinor" type="number" min={0} />
              </Field>
              <Field id="estimatedTotalValueMinor" label="Valor total (centavos)">
                <Input name="estimatedTotalValueMinor" type="number" min={0} />
              </Field>
            </div>
            <Field id="prizeBundleId" label="Premio Clickatón (opcional)">
              <Select name="prizeBundleId" defaultValue="">
                <option value="">Sin vincular</option>
                {prizes.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.slot} {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="deliveryDate" label="Fecha estimada de entrega">
              <Input name="deliveryDate" type="datetime-local" />
            </Field>
            <Field id="notes" label="Notas">
              <Textarea name="notes" rows={2} />
            </Field>
            <Button type="submit" variant="primary">
              Agregar aporte
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Beneficios</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          {benefits.length === 0 ? (
            <p className="text-sm text-ck-text-secondary">Sin beneficios en esta participación.</p>
          ) : (
            <ul className="space-y-6">
              {benefits.map((b) => {
                const meta = audienceMap.get(b.id);
                return (
                  <li key={b.id} className="space-y-4 rounded-lg border border-ck-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ck-text">{b.title}</p>
                        <p className="text-sm text-ck-text-muted">
                          {b.benefitType} · {BENEFIT_STATUS_LABELS[b.status]}
                          {b.promoCode ? ` · Código ${b.promoCode}` : ""}
                        </p>
                        {b.description ? (
                          <p className="mt-2 text-sm text-ck-text-secondary">{b.description}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-ck-text-muted">
                          Audiencia:{" "}
                          {meta?.audiences.map((a) => a.label ?? a.audienceType).join(", ") ||
                            "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {b.status !== "ACTIVE" ? (
                          <form action={activateEditionBenefitFormAction}>
                            <input type="hidden" name="editionId" value={editionId} />
                            <input type="hidden" name="participationId" value={participationId} />
                            <input type="hidden" name="benefitId" value={b.id} />
                            <Button type="submit" size="sm" variant="primary">
                              Activar
                            </Button>
                          </form>
                        ) : null}
                        {b.status === "ACTIVE" ? (
                          <form action={pauseEditionBenefitFormAction}>
                            <input type="hidden" name="editionId" value={editionId} />
                            <input type="hidden" name="participationId" value={participationId} />
                            <input type="hidden" name="benefitId" value={b.id} />
                            <Button type="submit" size="sm" variant="secondary">
                              Pausar
                            </Button>
                          </form>
                        ) : null}
                        {b.status !== "ARCHIVED" ? (
                          <form action={archiveEditionBenefitFormAction}>
                            <input type="hidden" name="editionId" value={editionId} />
                            <input type="hidden" name="participationId" value={participationId} />
                            <input type="hidden" name="benefitId" value={b.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Archivar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-ck-border/60 pt-4">
                      <p className="text-sm font-medium text-ck-text">Accesos manuales</p>
                      {(meta?.access ?? []).filter((a) => a.status === "ACTIVE").length === 0 ? (
                        <p className="text-xs text-ck-text-muted">Sin grants manuales activos.</p>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {(meta?.access ?? [])
                            .filter((a) => a.status === "ACTIVE")
                            .map((a) => (
                              <li key={a.id} className="flex items-center justify-between gap-2">
                                <span>userId {a.userId}</span>
                                <form action={revokeEditionBenefitAccessFormAction}>
                                  <input type="hidden" name="editionId" value={editionId} />
                                  <input
                                    type="hidden"
                                    name="participationId"
                                    value={participationId}
                                  />
                                  <input type="hidden" name="benefitId" value={b.id} />
                                  <input type="hidden" name="userId" value={a.userId} />
                                  <Button type="submit" size="sm" variant="outline">
                                    Revocar
                                  </Button>
                                </form>
                              </li>
                            ))}
                        </ul>
                      )}
                      <form
                        action={grantEditionBenefitAccessFormAction}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="editionId" value={editionId} />
                        <input type="hidden" name="participationId" value={participationId} />
                        <input type="hidden" name="benefitId" value={b.id} />
                        <Field id={`grant-${b.id}`} label="userId DNX">
                          <Input name="userId" type="number" min={1} required />
                        </Field>
                        <Field id={`grant-notes-${b.id}`} label="Notas">
                          <Input name="notes" />
                        </Field>
                        <Button type="submit" size="sm" variant="secondary">
                          Otorgar acceso
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={createEditionBenefitFormAction} className="space-y-6 border-t border-ck-border pt-8">
            <h3 className="text-lg font-semibold text-ck-text">Nuevo beneficio (borrador)</h3>
            <input type="hidden" name="editionId" value={editionId} />
            <input type="hidden" name="participationId" value={participationId} />
            <input type="hidden" name="partnerId" value={partner.id} />
            <Field id="title" label="Título" required>
              <Input name="title" required />
            </Field>
            <Field id="description" label="Descripción" required>
              <Textarea name="description" rows={3} required />
            </Field>
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="benefitType" label="Tipo">
                <Select name="benefitType" defaultValue="PERCENTAGE_DISCOUNT">
                  {DNX_PARTNER_BENEFIT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="redemptionMethod" label="Método de uso">
                <Select name="redemptionMethod" defaultValue="CONTACT_PARTNER">
                  {DNX_PARTNER_REDEMPTION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <Field id="promoCode" label="Código (opcional)">
                <Input name="promoCode" />
              </Field>
              <Field id="discountPercentage" label="% descuento">
                <Input name="discountPercentage" type="number" min={0} max={100} />
              </Field>
              <Field id="discountAmountMinor" label="Monto (centavos)">
                <Input name="discountAmountMinor" type="number" min={0} />
              </Field>
            </div>
            <Field id="audienceKey" label="Audiencia">
              <Select name="audienceKey" defaultValue="EDITION_PARTICIPANTS">
                {CLICKATON_AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="categoryId" label="ID categoría (si aplica)">
              <Input name="categoryId" />
            </Field>
            <Field id="redemptionInstructions" label="Instrucciones">
              <Textarea name="redemptionInstructions" rows={2} />
            </Field>
            <Field id="terms" label="Condiciones">
              <Textarea name="terms" rows={2} />
            </Field>
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="startsAt" label="Vigencia desde">
                <Input name="startsAt" type="datetime-local" />
              </Field>
              <Field id="endsAt" label="Vigencia hasta">
                <Input name="endsAt" type="datetime-local" />
              </Field>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="totalRedemptionLimit" label="Límite total">
                <Input name="totalRedemptionLimit" type="number" min={0} />
              </Field>
              <Field id="perUserRedemptionLimit" label="Límite por persona">
                <Input name="perUserRedemptionLimit" type="number" min={0} />
              </Field>
            </div>
            <Button type="submit" variant="primary">
              Crear beneficio en borrador
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Historial (auditoría)</h2>
        <Card variant="outlined" className="space-y-3 p-6">
          {audits.length === 0 ? (
            <p className="text-sm text-ck-text-secondary">Sin eventos.</p>
          ) : (
            <ul className="space-y-2 text-sm text-ck-text-secondary">
              {audits.map((a) => (
                <li key={a.id}>
                  <Badge variant="neutral">{a.action}</Badge>{" "}
                  <span className="text-ck-text-muted">
                    {a.createdAt.toLocaleString("es-AR")}
                  </span>
                  {a.summary ? ` — ${a.summary}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
