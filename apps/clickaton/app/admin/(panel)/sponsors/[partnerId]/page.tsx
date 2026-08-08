import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPLICATION_LABELS,
  AUDIENCE_TYPE_LABELS,
  BENEFIT_STATUS_LABELS,
  BENEFIT_TYPE_LABELS,
  CONTEXT_TYPE_LABELS,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  DNX_PARTNER_APPLICATIONS,
  DNX_PARTNER_AUDIENCE_TYPES,
  DNX_PARTNER_BENEFIT_TYPES,
  DNX_PARTNER_CONTEXT_TYPES,
  DNX_PARTNER_CONTRIBUTION_TYPES,
  DNX_PARTNER_PARTICIPATION_TYPES,
  DNX_PARTNER_REDEMPTION_METHODS,
  DNX_PARTNER_STATUSES,
  DNX_PARTNER_TYPES,
  OUTBOUND_LINK_STATUS_LABELS,
  PARTICIPATION_STATUS_LABELS,
  PARTICIPATION_TYPE_LABELS,
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  PAYMENT_MODE_LABELS,
  REDEMPTION_METHOD_LABELS,
  resolveOnboardingAdminStatus,
  resolvePartnerLogoAdminState,
  resolvePartnerPrimaryLogo,
  resolvePartnerPublicationAdminState,
} from "@repo/partners";
import { AdminScrollStability } from "@/components/admin/AdminScrollStability";
import { AdminPartnerLogoLibrary } from "@/components/admin/partners/AdminPartnerLogoLibrary";
import { DeleteContributionButton } from "@/components/admin/partners/DeleteContributionButton";
import { PartnerOnboardingInvitePanel } from "@/components/admin/partners/PartnerOnboardingInvitePanel";
import { PartnerOnboardingReviewPanel } from "@/components/admin/partners/PartnerOnboardingReviewPanel";
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
  approvePartnerLogoFormAction,
  archivePartnerFormAction,
  archivePartnerLogoFormAction,
  createBenefitFormAction,
  createContactFormAction,
  createContributionFormAction,
  createParticipationFormAction,
  deleteContributionFormAction,
  publishParticipationFormAction,
  unpublishParticipationFormAction,
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
    const [participations, benefits, contacts, traffic, outboundLinks, brandAssets, invitations] =
      await Promise.all([
        svc.listParticipations(actor, partnerId),
        svc.listBenefits(actor, partnerId),
        svc.listContacts(actor, partnerId),
        svc.getPartnerTrafficSummary(actor, partnerId),
        svc.listPartnerOutboundLinks(actor, partnerId),
        svc.listPartnerAssets(actor, partnerId),
        svc.listOnboardingInvitations(actor, partnerId),
      ]);
    const contributionsByParticipation = await Promise.all(
      participations.map(async (p) => ({
        participationId: p.id,
        items: await svc.listContributions(actor, p.id),
      })),
    );
    const onboardingAdminStatus = resolveOnboardingAdminStatus(invitations);
    return {
      partner,
      participations,
      benefits,
      contacts,
      contributionsByParticipation,
      traffic,
      outboundLinks,
      brandAssets,
      invitations,
      onboardingAdminStatus,
    };
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

  const {
    partner,
    participations,
    benefits,
    contacts,
    contributionsByParticipation,
    traffic,
    outboundLinks,
    brandAssets,
    invitations,
    onboardingAdminStatus,
  } = loaded.data;
  if (!partner) notFound();

  const contributionMap = new Map(
    contributionsByParticipation.map((c) => [c.participationId, c.items]),
  );
  const clicksByParticipation = traffic.byParticipation;
  const primaryLogo = resolvePartnerPrimaryLogo({
    assets: brandAssets,
    logoUrl: partner.logoUrl,
  });
  const latestLogoAsset =
    brandAssets.find((a) => a.type === "LOGO_PRIMARY" && !a.archivedAt) ??
    brandAssets.find((a) => !a.archivedAt) ??
    null;
  const hasUploadedLogo = brandAssets.some(
    (a) => !a.archivedAt && Boolean(a.fileUrl || a.storageKey),
  );
  const logoState = resolvePartnerLogoAdminState({
    hasUsableApprovedLogo: primaryLogo.source === "brand_asset",
    hasUploadedLogo,
  });
  const logoStateLabel =
    logoState === "APPROVED" ? "Aprobado" : logoState === "UPLOADED" ? "Cargado" : "Pendiente";

  return (
    <AdminScrollStability>
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
                      {PARTNER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="status" label="Estado">
                <Select name="status" defaultValue={partner.status}>
                  {DNX_PARTNER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PARTNER_STATUS_LABELS[s]}
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
              <Field id="taxId" label="CUIT / identificación fiscal">
                <Input name="taxId" defaultValue={partner.taxId ?? ""} />
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
        <h2 className="text-xl font-semibold text-ck-text">Onboarding</h2>
        <PartnerOnboardingInvitePanel
          partnerId={partner.id}
          invitations={invitations.map((inv) => ({
            id: inv.id,
            status: inv.status,
            reviewStatus: inv.reviewStatus,
            expiresAt: inv.expiresAt,
            openedAt: inv.openedAt,
            submittedAt: inv.submittedAt,
            createdAt: inv.createdAt,
          }))}
          adminStatus={onboardingAdminStatus}
        />
        {invitations
          .filter((inv) => inv.status === "SUBMITTED" && inv.submissionJson)
          .slice(0, 1)
          .map((inv) => (
            <PartnerOnboardingReviewPanel
              key={inv.id}
              partnerId={partner.id}
              partner={{
                name: partner.name,
                legalName: partner.legalName,
                description: partner.description,
                websiteUrl: partner.websiteUrl,
                instagram: partner.instagram,
                facebookUrl: partner.facebookUrl,
                linkedinUrl: partner.linkedinUrl,
                address: partner.address,
                city: partner.city,
                provinceOrState: partner.provinceOrState,
                country: partner.country,
                postalCode: partner.postalCode,
                taxId: partner.taxId,
                status: partner.status,
              }}
              invitation={{
                id: inv.id,
                status: inv.status,
                reviewStatus: inv.reviewStatus,
                reviewNotes: inv.reviewNotes,
                submissionJson: inv.submissionJson,
                submittedAt: inv.submittedAt,
              }}
            />
          ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Logos de marca</h2>
        <p className="text-sm text-ck-text-secondary">
          Estado resumen: {logoStateLabel}. Cada casilla es un archivo distinto (Color / Positivo /
          Negativo, o Fondo claro / Fondo oscuro). Aprobar un logo no publica al partner.
        </p>
        <AdminPartnerLogoLibrary
          partnerId={partner.id}
          assets={brandAssets
            .filter((a) => !a.archivedAt)
            .map((a) => ({
              type: a.type,
              backgroundType: a.backgroundType,
              assetId: a.id,
              fileUrl: a.fileUrl,
              storageKey: a.storageKey,
              mimeType: a.mimeType,
              width: a.width,
              height: a.height,
              approvalStatus: a.approvalStatus,
              reusedFromGeneral: Boolean(
                a.metadata &&
                  typeof a.metadata === "object" &&
                  (a.metadata as { reusedFromGeneral?: unknown }).reusedFromGeneral === true,
              ),
            }))}
          showLegacyJpegWarning={brandAssets.some(
            (a) =>
              !a.archivedAt &&
              (a.mimeType === "image/jpeg" || a.mimeType === "image/jpg"),
          )}
          approveAction={approvePartnerLogoFormAction}
          archiveAction={archivePartnerLogoFormAction}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Tráfico</h2>
        <Card variant="outlined" className="space-y-6 p-6">
          <p className="text-sm text-ck-text-muted">
            Clicks outbound hacia el partner. Un click no equivale a una persona ni a una venta.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ck-text-muted">Clicks totales</p>
              <p className="mt-2 text-2xl font-semibold text-ck-text">{traffic.totalClicks}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ck-text-muted">Últimos 7 días</p>
              <p className="mt-2 text-2xl font-semibold text-ck-text">{traffic.last7Days}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ck-text-muted">Últimos 30 días</p>
              <p className="mt-2 text-2xl font-semibold text-ck-text">{traffic.last30Days}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-ck-text">Por plataforma</p>
            <ul className="mt-2 space-y-1 text-sm text-ck-text-secondary">
              {Object.keys(traffic.byApplication).length === 0 ? (
                <li className="text-ck-text-muted">Sin clicks todavía.</li>
              ) : (
                Object.entries(traffic.byApplication)
                  .sort((a, b) => b[1] - a[1])
                  .map(([app, count]) => (
                    <li key={app}>
                      {APPLICATION_LABELS[app as keyof typeof APPLICATION_LABELS] ?? app}:{" "}
                      {count}
                    </li>
                  ))
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-ck-text">Por participación</p>
            <ul className="mt-2 space-y-1 text-sm text-ck-text-secondary">
              {Object.keys(traffic.byParticipation).length === 0 ? (
                <li className="text-ck-text-muted">Sin clicks por participación.</li>
              ) : (
                Object.entries(traffic.byParticipation)
                  .sort((a, b) => b[1] - a[1])
                  .map(([participationId, count]) => {
                    const p = participations.find((x) => x.id === participationId);
                    const label =
                      p?.title ||
                      (p ? PARTICIPATION_TYPE_LABELS[p.participationType] : null) ||
                      participationId.slice(0, 10);
                    return (
                      <li key={participationId}>
                        {label}: {count}
                      </li>
                    );
                  })
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-ck-text">Sitio web global</p>
            <p className="mt-1 text-sm text-ck-text-secondary">
              {partner.websiteUrl || "Sin sitio web"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-ck-text">Enlaces con seguimiento</p>
            {outboundLinks.length === 0 ? (
              <p className="mt-2 text-sm text-ck-text-muted">
                Ninguno. Se crean al guardar una participación con destino y seguimiento activo.
              </p>
            ) : (
              <ul className="mt-2 space-y-3 text-sm text-ck-text-secondary">
                {outboundLinks.map((link) => (
                  <li key={link.id} className="rounded-lg border border-ck-border p-3">
                    <p className="font-medium text-ck-text">/r/{link.trackingKey}</p>
                    <p className="mt-1 break-all">{link.destinationUrl}</p>
                    <p className="mt-1">
                      {APPLICATION_LABELS[link.application] ?? link.application} ·{" "}
                      {CONTEXT_TYPE_LABELS[
                        link.contextType as keyof typeof CONTEXT_TYPE_LABELS
                      ] ?? link.contextType}
                      {link.contextId ? ` · ${link.contextId}` : ""} ·{" "}
                      {OUTBOUND_LINK_STATUS_LABELS[link.status] ?? link.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                      {p.title || PARTICIPATION_TYPE_LABELS[p.participationType]}
                    </span>
                    <Badge variant="neutral">
                      {APPLICATION_LABELS[p.application] ?? p.application}
                    </Badge>
                    <Badge variant="neutral">
                      {PARTICIPATION_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                    <Badge variant="neutral">
                      {p.requiresPayment
                        ? `Pago: ${PAYMENT_MODE_LABELS[p.paymentMode] ?? p.paymentMode}`
                        : "Sin pago"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-ck-text-secondary">
                    {CONTEXT_TYPE_LABELS[p.contextType] ?? p.contextType}
                    {p.contextId ? ` · ${p.contextId}` : ""}
                    {p.organizationId ? ` · organización ${p.organizationId}` : ""}
                    {" · "}
                    Clicks: {clicksByParticipation[p.id] ?? 0}
                    {" · "}
                    Publicación:{" "}
                    {
                      {
                        HIDDEN: "Oculto",
                        READY: "Listo para publicar",
                        PUBLISHED: "Publicado",
                      }[
                        resolvePartnerPublicationAdminState({
                          publicVisibility: p.publicVisibility,
                          participationStatus: p.status,
                          logoState,
                          partnerType: partner.type,
                        })
                      ]
                    }
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.publicVisibility !== "PUBLIC" ? (
                      <form action={publishParticipationFormAction}>
                        <input type="hidden" name="partnerId" value={partner.id} />
                        <input type="hidden" name="participationId" value={p.id} />
                        <Button type="submit" variant="secondary">
                          Publicar en landing
                        </Button>
                      </form>
                    ) : (
                      <form action={unpublishParticipationFormAction}>
                        <input type="hidden" name="partnerId" value={partner.id} />
                        <input type="hidden" name="participationId" value={p.id} />
                        <Button type="submit" variant="secondary">
                          Ocultar de landing
                        </Button>
                      </form>
                    )}
                  </div>
                  {p.publicVisibility !== "PUBLIC" && logoState !== "APPROVED" ? (
                    <p className="mt-2 text-xs text-amber-200">
                      Para publicar necesitás un logo aprobado (arriba: Subir logo → Aprobar logo).
                      Solo admin Clickaton puede publicarlo; no el partner.
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="font-medium text-ck-text">Aportes</p>
                    {(contributionMap.get(p.id) ?? []).length === 0 ? (
                      <p className="text-ck-text-muted">Ninguno</p>
                    ) : (
                      <ul className="space-y-2">
                        {(contributionMap.get(p.id) ?? []).map((c) => (
                          <li
                            key={c.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-ck-border/70 px-3 py-2"
                          >
                            <span className="text-ck-text-secondary">
                              [{CONTRIBUTION_TYPE_LABELS[c.type] ?? c.type}] {c.title} —{" "}
                              {CONTRIBUTION_STATUS_LABELS[c.status] ?? c.status}
                            </span>
                            <DeleteContributionButton
                              action={deleteContributionFormAction}
                              partnerId={partner.id}
                              contributionId={c.id}
                            />
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
                      {APPLICATION_LABELS[a]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="participationType" label="Tipo de participación">
                <Select name="participationType" defaultValue="SPONSOR">
                  {DNX_PARTNER_PARTICIPATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PARTICIPATION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="contextType" label="Tipo de contexto">
                <Select name="contextType" defaultValue="GLOBAL">
                  {DNX_PARTNER_CONTEXT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CONTEXT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="contextId" label="ID de contexto (opcional)">
                <Input name="contextId" placeholder="ID de edición / concurso…" />
              </Field>
              <Field id="organizationId" label="ID de organización (opcional)">
                <Input name="organizationId" placeholder="sfpr / id de organización…" />
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
                      {p.title || PARTICIPATION_TYPE_LABELS[p.participationType]} (
                      {APPLICATION_LABELS[p.application]})
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="type" label="Tipo">
                  <Select name="type" defaultValue="SERVICE">
                    {DNX_PARTNER_CONTRIBUTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CONTRIBUTION_TYPE_LABELS[t]}
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
                <Field id="estimatedTotalValueMinor" label="Valor estimado (centavos, opcional)">
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
                    <Badge variant="neutral">
                      {BENEFIT_STATUS_LABELS[b.status] ?? b.status}
                    </Badge>
                    <Badge variant="neutral">
                      {BENEFIT_TYPE_LABELS[b.benefitType] ?? b.benefitType}
                    </Badge>
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
                    {p.title || PARTICIPATION_TYPE_LABELS[p.participationType]}
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
                      {BENEFIT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="redemptionMethod" label="Método de uso">
                <Select name="redemptionMethod" defaultValue="CONTACT_PARTNER">
                  {DNX_PARTNER_REDEMPTION_METHODS.map((t) => (
                    <option key={t} value={t}>
                      {REDEMPTION_METHOD_LABELS[t]}
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
                      {AUDIENCE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="audienceOrganizationId" label="ID organización audiencia (opcional)">
                <Input name="audienceOrganizationId" placeholder="sfpr" />
              </Field>
              <Field id="audienceContextType" label="Tipo de contexto de audiencia">
                <Select name="audienceContextType" defaultValue="">
                  <option value="">—</option>
                  {DNX_PARTNER_CONTEXT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CONTEXT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="audienceContextId" label="ID de contexto de audiencia">
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
    </AdminScrollStability>
  );
}
