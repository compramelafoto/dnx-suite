import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DNX_PARTNER_APPLICATIONS,
  DNX_PARTNER_AUDIENCE_TYPES,
  DNX_PARTNER_BENEFIT_TYPES,
  DNX_PARTNER_CONTEXT_TYPES,
  DNX_PARTNER_CONTRIBUTION_TYPES,
  DNX_PARTNER_PARTICIPATION_TYPES,
  DNX_PARTNER_REDEMPTION_METHODS,
  DNX_PARTNER_STATUSES,
  DNX_PARTNER_TYPES,
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
  archivePartnerFormAction,
  createBenefitFormAction,
  createContactFormAction,
  createContributionFormAction,
  createParticipationFormAction,
  updatePartnerFormAction,
} from "@/lib/admin/partners/mutations";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

export default async function AdminPartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { partnerId } = await params;
  const sp = (await searchParams) ?? {};

  const loaded = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    const partner = await svc.getPartner(actor, partnerId);
    const [participations, benefits, contacts] = await Promise.all([
      svc.listParticipations(actor, partnerId),
      svc.listBenefits(actor, partnerId),
      svc.listContacts(actor, partnerId),
    ]);
    const contributionsByParticipation = await Promise.all(
      participations.map(async (p) => ({
        participationId: p.id,
        items: await svc.listContributions(actor, p.id),
      })),
    );
    return { partner, participations, benefits, contacts, contributionsByParticipation };
  });

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Partner"
          breadcrumbs={[
            { label: "Sponsors y beneficios", href: adminRoutes.sponsors },
            { label: "Ficha" },
          ]}
        />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }

  const { partner, participations, benefits, contacts, contributionsByParticipation } =
    loaded.data;
  if (!partner) notFound();

  const contributionMap = new Map(
    contributionsByParticipation.map((c) => [c.participationId, c.items]),
  );

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title={partner.name}
        description="Ficha del partner · participaciones, aportes y beneficios. Sin cobros automáticos."
        breadcrumbs={[
          { label: "Sponsors y beneficios", href: adminRoutes.sponsors },
          { label: partner.name },
        ]}
        actions={
          <form action={archivePartnerFormAction}>
            <input type="hidden" name="partnerId" value={partner.id} />
            <Button type="submit" variant="secondary">
              Archivar
            </Button>
          </form>
        }
      />

      {sp.error ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {sp.error}
        </Card>
      ) : null}
      {sp.ok ? (
        <Card variant="outlined" className="border-emerald-500/30 p-4 text-sm text-ck-text-secondary">
          Guardado correctamente ({sp.ok}).
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Resumen / edición</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          <form action={updatePartnerFormAction} className="space-y-6">
            <input type="hidden" name="partnerId" value={partner.id} />
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="name" label="Nombre" required>
                <Input name="name" defaultValue={partner.name} />
              </Field>
              <Field id="slug" label="Slug">
                <Input name="slug" defaultValue={partner.slug} />
              </Field>
              <Field id="legalName" label="Razón social">
                <Input name="legalName" defaultValue={partner.legalName ?? ""} />
              </Field>
              <Field id="type" label="Tipo">
                <Select name="type" defaultValue={partner.type}>
                  {DNX_PARTNER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="status" label="Estado">
                <Select name="status" defaultValue={partner.status}>
                  {DNX_PARTNER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="websiteUrl" label="Sitio web">
                <Input name="websiteUrl" defaultValue={partner.websiteUrl ?? ""} />
              </Field>
              <Field id="instagram" label="Instagram">
                <Input name="instagram" defaultValue={partner.instagram ?? ""} />
              </Field>
              <Field id="email" label="Email">
                <Input name="email" defaultValue={partner.email ?? ""} />
              </Field>
              <Field id="phone" label="Teléfono">
                <Input name="phone" defaultValue={partner.phone ?? ""} />
              </Field>
              <Field id="taxId" label="Tax id">
                <Input name="taxId" defaultValue={partner.taxId ?? ""} />
              </Field>
              <Field id="logoUrl" label="Logo URL">
                <Input name="logoUrl" defaultValue={partner.logoUrl ?? ""} />
              </Field>
            </div>
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={3} defaultValue={partner.description ?? ""} />
            </Field>
            <Field id="notes" label="Notas">
              <Textarea name="notes" rows={3} defaultValue={partner.notes ?? ""} />
            </Field>
            <Button type="submit">Guardar cambios</Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Participaciones</h2>
        <Card variant="outlined" className="space-y-4 p-5">
          {participations.length === 0 ? (
            <p className="text-sm text-ck-text-muted">Sin participaciones todavía.</p>
          ) : (
            <ul className="space-y-4">
              {participations.map((p) => (
                <li key={p.id} className="rounded-lg border border-ck-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ck-text">
                      {p.title || p.participationType}
                    </span>
                    <Badge variant="neutral">{p.application}</Badge>
                    <Badge variant="neutral">{p.status}</Badge>
                    <Badge variant="neutral">
                      {p.requiresPayment ? `Pago: ${p.paymentMode}` : "Sin pago"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-ck-text-secondary">
                    {p.contextType}
                    {p.contextId ? ` · ${p.contextId}` : ""}
                    {p.organizationId ? ` · org ${p.organizationId}` : ""}
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="font-medium text-ck-text">Aportes</p>
                    {(contributionMap.get(p.id) ?? []).length === 0 ? (
                      <p className="text-ck-text-muted">Ninguno</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5 text-ck-text-secondary">
                        {(contributionMap.get(p.id) ?? []).map((c) => (
                          <li key={c.id}>
                            [{c.type}] {c.title} — {c.status}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card variant="outlined" className="space-y-4 p-6">
          <h3 className="font-semibold text-ck-text">Alta de participación</h3>
          <form action={createParticipationFormAction} className="space-y-4">
            <input type="hidden" name="partnerId" value={partner.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="application" label="Aplicación">
                <Select name="application" defaultValue="CLICKATON">
                  {DNX_PARTNER_APPLICATIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="participationType" label="Tipo de participación">
                <Select name="participationType" defaultValue="SPONSOR">
                  {DNX_PARTNER_PARTICIPATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="contextType" label="Tipo de contexto">
                <Select name="contextType" defaultValue="GLOBAL">
                  {DNX_PARTNER_CONTEXT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="contextId" label="Context ID (opcional)">
                <Input name="contextId" placeholder="editionId / contestId…" />
              </Field>
              <Field id="organizationId" label="Organization ID (opaco, opcional)">
                <Input name="organizationId" placeholder="sfpr / org cuid…" />
              </Field>
              <Field id="title" label="Título">
                <Input name="title" />
              </Field>
            </div>
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={2} />
            </Field>
            <RequiresPaymentFields />
            <Button type="submit">Crear participación</Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Alta de aporte</h2>
        <Card variant="outlined" className="space-y-4 p-6">
          {participations.length === 0 ? (
            <p className="text-sm text-ck-text-muted">
              Primero creá una participación para poder cargar aportes.
            </p>
          ) : (
            <form action={createContributionFormAction} className="space-y-4">
              <input type="hidden" name="partnerId" value={partner.id} />
              <Field id="participationId" label="Participación">
                <Select name="participationId" required>
                  {participations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.participationType} ({p.application})
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="type" label="Tipo">
                  <Select name="type" defaultValue="SERVICE">
                    {DNX_PARTNER_CONTRIBUTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="title" label="Título" required>
                  <Input name="title" placeholder="Descuento en limpiezas" />
                </Field>
                <Field id="quantity" label="Cantidad (opcional)">
                  <Input name="quantity" type="number" min={0} />
                </Field>
                <Field id="estimatedTotalValueMinor" label="Valor estimado (minor, opcional)">
                  <Input name="estimatedTotalValueMinor" type="number" min={0} />
                </Field>
              </div>
              <Field id="description" label="Descripción">
                <Textarea name="description" rows={2} />
              </Field>
              <Button type="submit">Crear aporte</Button>
            </form>
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Beneficios</h2>
        <Card variant="outlined" className="space-y-4 p-5">
          {benefits.length === 0 ? (
            <p className="text-sm text-ck-text-muted">Sin beneficios.</p>
          ) : (
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b.id} className="rounded-lg border border-ck-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ck-text">{b.title}</span>
                    <Badge variant="neutral">{b.status}</Badge>
                    <Badge variant="neutral">{b.benefitType}</Badge>
                    {b.promoCode ? <Badge variant="neutral">Código {b.promoCode}</Badge> : null}
                  </div>
                  {b.description ? (
                    <p className="mt-2 text-sm text-ck-text-secondary">{b.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card variant="outlined" className="space-y-4 p-6">
          <h3 className="font-semibold text-ck-text">Alta de beneficio</h3>
          <form action={createBenefitFormAction} className="space-y-4">
            <input type="hidden" name="partnerId" value={partner.id} />
            <Field id="participationIdBenefit" label="Participación (opcional)">
              <Select name="participationId" defaultValue="">
                <option value="">— Sin vincular —</option>
                {participations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || p.participationType}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="benefitTitle" label="Título" required>
                <Input name="title" />
              </Field>
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
                  {DNX_PARTNER_REDEMPTION_METHODS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="promoCode" label="Código (opcional)">
                <Input name="promoCode" />
              </Field>
              <Field id="discountPercentage" label="% descuento (opcional)">
                <Input name="discountPercentage" type="number" min={0} max={100} />
              </Field>
              <Field id="audienceType" label="Audiencia">
                <Select name="audienceType" defaultValue="ORGANIZATION_MEMBERS">
                  {DNX_PARTNER_AUDIENCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="audienceOrganizationId" label="Org ID audiencia (opcional)">
                <Input name="audienceOrganizationId" placeholder="sfpr" />
              </Field>
              <Field id="audienceContextType" label="Context type audiencia">
                <Select name="audienceContextType" defaultValue="">
                  <option value="">—</option>
                  {DNX_PARTNER_CONTEXT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="audienceContextId" label="Context ID audiencia">
                <Input name="audienceContextId" />
              </Field>
            </div>
            <Field id="benefitDescription" label="Descripción" required>
              <Textarea name="description" rows={2} />
            </Field>
            <Field id="redemptionInstructions" label="Instrucciones de uso">
              <Textarea name="redemptionInstructions" rows={2} />
            </Field>
            <Field id="terms" label="Condiciones (resumen)">
              <Textarea name="terms" rows={2} />
            </Field>
            <Button type="submit">Crear beneficio (borrador)</Button>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Contactos</h2>
        <Card variant="outlined" className="space-y-4 p-5">
          {contacts.length === 0 ? (
            <p className="text-sm text-ck-text-muted">Sin contactos.</p>
          ) : (
            <ul className="space-y-2 text-sm text-ck-text-secondary">
              {contacts.map((c) => (
                <li key={c.id}>
                  {c.firstName} {c.lastName ?? ""}
                  {c.roleTitle ? ` · ${c.roleTitle}` : ""}
                  {c.email ? ` · ${c.email}` : ""}
                  {c.isPrimary ? " · principal" : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card variant="outlined" className="space-y-4 p-6">
          <form action={createContactFormAction} className="space-y-4">
            <input type="hidden" name="partnerId" value={partner.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="firstName" label="Nombre" required>
                <Input name="firstName" />
              </Field>
              <Field id="lastName" label="Apellido">
                <Input name="lastName" />
              </Field>
              <Field id="roleTitle" label="Cargo">
                <Input name="roleTitle" />
              </Field>
              <Field id="contactEmail" label="Email">
                <Input name="email" type="email" />
              </Field>
              <Field id="contactPhone" label="Teléfono">
                <Input name="phone" />
              </Field>
              <Field id="whatsapp" label="WhatsApp">
                <Input name="whatsapp" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ck-text">
              <input type="checkbox" name="isPrimary" /> Contacto principal
            </label>
            <Button type="submit">Agregar contacto</Button>
          </form>
        </Card>
      </section>

      <p className="text-sm text-ck-text-muted">
        <Link href={adminRoutes.sponsors} className="underline">
          Volver al listado
        </Link>
        {" · "}
        Los partners de cobro MP viven en{" "}
        <Link href={adminRoutes.financePartner} className="underline">
          Finanzas · mi cuenta
        </Link>
        .
      </p>
    </div>
  );
}
