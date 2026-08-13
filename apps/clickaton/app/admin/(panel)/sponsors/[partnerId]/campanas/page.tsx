import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPLICATION_LABELS,
  CAMPAIGN_CONTEXT_LABELS,
  CREATIVE_FORMAT_LABELS,
  DNX_PARTNER_APPLICATIONS,
  DNX_PARTNER_CAMPAIGN_CONTEXT_CATEGORIES,
  DNX_PARTNER_CAMPAIGN_GEO_SCOPES,
  DNX_PARTNER_CAMPAIGN_STATUSES,
  DNX_PARTNER_CREATIVE_DEVICE_TARGETS,
  DNX_PARTNER_CREATIVE_FORMATS,
  DNX_PARTNER_CREATIVE_STATUSES,
  getWelcomeRuntimeFlagSnapshot,
  listWelcomePlacementsForAdminUi,
  listLogoMarqueePlacementsForAdminUi,
  listAdPlacementCatalogForAdminBinding,
  welcomeAdminCatalogMeta,
  marqueeAdminCatalogMeta,
  WELCOME_GRAPHIC_SLOTS,
  WELCOME_GRAPHIC_SAFE_AREA_COPY,
  WELCOME_GRAPHIC_CTA_COPY,
  DEFAULT_WELCOME_GRAPHIC_LIMITS,
  parseWelcomeGraphicMetadata,
  isWelcomeGraphicAsset,
  buildWelcomeResponsiveMediaSnapshot,
} from "@repo/partners";
import { prisma } from "@repo/db";
import { PartnerAdCreative } from "@repo/design-system/components/partners";
import { AdminScrollStability } from "@/components/admin/AdminScrollStability";
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
  bindCampaignPlacementFormAction,
  createCampaignFormAction,
  createCreativeFormAction,
  pauseResumeCampaignTargetFormAction,
  publishCampaignFormAction,
  retryCampaignPublishFormAction,
  saveCampaignPublishTargetsFormAction,
  saveCampaignTargetingFormAction,
  setCampaignStatusFormAction,
} from "@/lib/admin/partners/campaign-mutations";
import { listCampaignPublicationUi } from "@/lib/admin/partners/campaign-publication";
import {
  bindWelcomePlacementFormAction,
  approvePartnerAssetFormAction,
  registerPartnerAssetUrlFormAction,
  validateWelcomeCampaignFormAction,
} from "@/lib/admin/partners/welcome-admin-mutations";
import { listWelcomeContextConnectionInfos } from "@repo/db/partners-welcome-context-clients";
import { WelcomeInterstitialAdminPreview } from "@/components/admin/partners/WelcomeInterstitialAdminPreview";
import { WelcomeScopeLinkForm } from "@/components/admin/partners/WelcomeScopeLinkForm";

const GEO_LABELS: Record<string, string> = {
  GLOBAL: "Global",
  COUNTRY: "País",
  PROVINCE: "Provincia",
  CITY: "Ciudad",
  MULTI_CITY: "Multi ciudad",
};

export default async function AdminPartnerCampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<{ error?: string; ok?: string }>;
}) {
  await requireClickatonAdmin();
  const { partnerId } = await params;
  const sp = (await searchParams) ?? {};

  const loaded = await withClickatonDb(async () => {
    const partner = await prisma.dnxPartner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true },
    });
    if (!partner) return null;
    const [campaigns, assets] = await Promise.all([
      prisma.dnxPartnerCampaign.findMany({
        where: { partnerId },
        orderBy: { updatedAt: "desc" },
        include: {
          participation: {
            select: {
              id: true,
              application: true,
              contextType: true,
              contextId: true,
              status: true,
              archivedAt: true,
              publicVisibility: true,
              startsAt: true,
              endsAt: true,
            },
          },
          creatives: {
            where: { archivedAt: null },
            include: { asset: { select: { fileUrl: true, type: true, altText: true, approvalStatus: true } } },
            orderBy: { sortOrder: "asc" },
          },
          geoTargets: true,
          contextTargets: true,
          placementBindings: {
            include: { adPlacement: true },
          },
        },
      }),
      prisma.dnxPartnerAsset.findMany({
        where: { partnerId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          partnerId: true,
          type: true,
          fileUrl: true,
          approvalStatus: true,
          status: true,
          archivedAt: true,
          altText: true,
          name: true,
          mimeType: true,
          fileSize: true,
          width: true,
          height: true,
          isPrimary: true,
          metadata: true,
          updatedAt: true,
        },
      }),
    ]);
    const publicationByCampaign = Object.fromEntries(
      await Promise.all(
        campaigns.map(async (c) => [c.id, await listCampaignPublicationUi(c.id)] as const),
      ),
    );
    return { partner, campaigns, assets, publicationByCampaign };
  });

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Campañas" breadcrumbs={[{ label: "Sponsors", href: adminRoutes.sponsors }]} />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }
  if (!loaded.data) notFound();

  const { partner, campaigns, assets, publicationByCampaign } = loaded.data;
  const adApps = DNX_PARTNER_APPLICATIONS.filter(
    (a) => a === "INFO_SPOT" || a === "COMPRAME_LA_FOTO" || a === "CLICKATON" || a === "FOTO_RANK",
  );
  const welcomeMeta = welcomeAdminCatalogMeta();
  const marqueeMeta = marqueeAdminCatalogMeta();
  const welcomePlacements = listWelcomePlacementsForAdminUi();
  const marqueePlacements = listLogoMarqueePlacementsForAdminUi();
  const welcomeFlags = getWelcomeRuntimeFlagSnapshot();
  const adPlacementCatalog = listAdPlacementCatalogForAdminBinding().filter(
    (p) => p.application !== "FOTO_OFFICE",
  );
  const contextDbInfos = listWelcomeContextConnectionInfos();

  return (
    <AdminScrollStability>
      <div className="space-y-10">
        <AdminPageHeader
          title={`Campañas · ${partner.name}`}
          description="Publicidad Partners: campañas, creatives, targeting y placements. Preview sin tracking."
          breadcrumbs={[
            { label: "Sponsors y beneficios", href: adminRoutes.sponsors },
            { label: partner.name, href: `${adminRoutes.sponsors}/${partner.id}` },
            { label: "Campañas" },
          ]}
          actions={
            <div className="flex flex-wrap gap-3">
              <Button href={`${adminRoutes.sponsors}/${partner.id}/analytics`} variant="secondary">
                Analytics
              </Button>
              <Link href={`${adminRoutes.sponsors}/${partner.id}`}>
                <Button type="button" variant="secondary">
                  Volver a ficha
                </Button>
              </Link>
            </div>
          }
        />

        {sp.error ? (
          <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
            {sp.error}
          </Card>
        ) : null}
        {sp.ok ? (
          <Card variant="outlined" className="border-emerald-500/30 p-4 text-sm text-ck-text-secondary">
            Guardado ({sp.ok}).
          </Card>
        ) : null}

        <Card variant="outlined" className="space-y-6 border-[#D4AF37]/35 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-ck-text">{welcomeMeta.formatLabel}</h2>
            <p className="text-sm text-ck-text-secondary">{welcomeMeta.formatDescription}</p>
            <p className="text-xs text-ck-text-secondary">
              Formato: {welcomeMeta.format} · Frecuencia local {welcomeMeta.frequencyHours}h · FotoOffice
              excluido.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {welcomeFlags.map((f) => (
              <div
                key={f.key}
                className="rounded-lg border border-ck-border px-3 py-2 text-sm text-ck-text-secondary"
              >
                <span className="font-medium text-ck-text">{f.label}</span>
                <div className="mt-1 flex items-center gap-2">
                  <Badge>{f.enabled ? "Runtime habilitado" : "Runtime deshabilitado"}</Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-ck-border pt-6">
            <h3 className="text-lg font-semibold">Fuentes canónicas (selectores)</h3>
            <p className="text-xs text-ck-text-secondary">
              Sin fallback silencioso. Si una conexión falta, el selector falla cerrado.
            </p>
            <ul className="space-y-2 text-sm text-ck-text-secondary">
              {contextDbInfos.map((c) => (
                <li key={c.key} className="rounded-lg border border-ck-border px-3 py-2">
                  <span className="font-medium text-ck-text">{c.key}</span> · {c.envName} ·{" "}
                  {c.configured ? (
                    <>
                      OK · {c.hostMasked ?? "host?"} · fp {c.fingerprint ?? "—"}
                    </>
                  ) : (
                    <span className="text-amber-200">{c.reason ?? "No configurada"}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <form action={registerPartnerAssetUrlFormAction} className="space-y-4 border-t border-ck-border pt-6">
            <input type="hidden" name="partnerId" value={partner.id} />
            <h3 className="text-lg font-semibold">Gráfica para ventana destacada</h3>
            <p className="text-sm text-ck-text-secondary">
              Escritorio y celular son opcionales e independientes. El sistema usa fallbacks (cruzados →
              logo). Ambas piezas admiten PNG, WebP, JPG y GIF.
            </p>
            <p className="text-xs text-ck-text-secondary">{WELCOME_GRAPHIC_SAFE_AREA_COPY}</p>
            <p className="text-xs text-ck-text-secondary">{WELCOME_GRAPHIC_CTA_COPY}</p>
            <p className="text-xs text-ck-text-secondary">
              Límites: desktop estático {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.desktopStaticMaxBytes / 1024)}{" "}
              KB · mobile estático {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.mobileStaticMaxBytes / 1024)}{" "}
              KB · desktop GIF {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.desktopGifMaxBytes / 1024)} KB ·
              mobile GIF {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.mobileGifMaxBytes / 1024)} KB. Breakpoint
              desktop ≥768px (DS md).
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="welcome-slot" label="Variante" required>
                <Select name="welcomeSlot" defaultValue="WELCOME_GRAPHIC_DESKTOP" required>
                  {WELCOME_GRAPHIC_SLOTS.map((s) => (
                    <option key={s.slotKey} value={s.slotKey}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="asset-mime" label="MIME">
                <Select name="mimeType" defaultValue="image/png">
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WebP</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/gif">GIF</option>
                </Select>
              </Field>
              <Field id="asset-url" label="URL de imagen" required>
                <Input name="fileUrl" placeholder="https://…" required />
              </Field>
              <Field id="asset-alt" label="Texto alternativo" required>
                <Input name="altText" required placeholder="Descripción de la pieza" />
              </Field>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 text-xs text-ck-text-secondary">
              {WELCOME_GRAPHIC_SLOTS.map((s) => (
                <li key={s.slotKey} className="rounded-lg border border-ck-border px-3 py-2">
                  <span className="font-medium text-ck-text">{s.title}</span>
                  <p className="mt-1">{s.description}</p>
                  <p className="mt-1 opacity-80">{s.recommendation}</p>
                </li>
              ))}
            </ul>
            <Button type="submit">Registrar variante PENDING</Button>
          </form>
          {assets.filter((a) => isWelcomeGraphicAsset(a as never)).length > 0 ? (
            <div className="space-y-3 border-t border-ck-border pt-6">
              <h3 className="text-lg font-semibold">Variantes welcome del sponsor</h3>
              <ul className="space-y-2">
                {assets
                  .filter((a) => isWelcomeGraphicAsset(a as never))
                  .map((a) => {
                    const meta = parseWelcomeGraphicMetadata(a.metadata);
                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ck-border px-3 py-2 text-sm"
                      >
                        <span className="text-ck-text-secondary">
                          {meta?.deviceTarget}/{meta?.motionVariant}
                          {meta?.animated ? " · GIF" : " · estático"} · {a.approvalStatus} ·{" "}
                          {a.mimeType || "mime?"} · {a.altText || "sin alt"} · {a.id.slice(0, 8)}
                        </span>
                        {a.approvalStatus === "PENDING" ? (
                          <form action={approvePartnerAssetFormAction}>
                            <input type="hidden" name="partnerId" value={partner.id} />
                            <input type="hidden" name="assetId" value={a.id} />
                            <Button type="submit" variant="secondary">
                              Aprobar
                            </Button>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}
          {assets.some((a) => a.approvalStatus === "PENDING" && !isWelcomeGraphicAsset(a as never)) ? (
            <div className="space-y-3 border-t border-ck-border pt-6">
              <h3 className="text-lg font-semibold">Aprobar assets pendientes (otros)</h3>
              <ul className="space-y-2">
                {assets
                  .filter((a) => a.approvalStatus === "PENDING" && !isWelcomeGraphicAsset(a as never))
                  .map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ck-border px-3 py-2 text-sm"
                    >
                      <span className="text-ck-text-secondary">
                        {a.name || a.type} · {a.altText || "sin alt"} · {a.id.slice(0, 8)}
                      </span>
                      <form action={approvePartnerAssetFormAction}>
                        <input type="hidden" name="partnerId" value={partner.id} />
                        <input type="hidden" name="assetId" value={a.id} />
                        <Button type="submit" variant="secondary">
                          Aprobar
                        </Button>
                      </form>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card variant="outlined" className="space-y-6 p-6">
          <h2 className="text-xl font-semibold text-ck-text">Nueva campaña</h2>
          <p className="text-sm text-ck-text-secondary">
            Se crea en DRAFT. Activá solo cuando creatives y targeting estén listos. Kill switches de
            InfoSpot/CLF siguen controlando la publicación pública.
          </p>
          <form action={createCampaignFormAction} className="space-y-6">
            <input type="hidden" name="partnerId" value={partner.id} />
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="name" label="Nombre" required>
                <Input name="name" required />
              </Field>
              <Field id="application" label="Aplicación">
                <Select name="application" defaultValue="INFO_SPOT">
                  {adApps.map((a) => (
                    <option key={a} value={a}>
                      {APPLICATION_LABELS[a] ?? a}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="destinationUrl" label="URL destino">
                <Input name="destinationUrl" placeholder="https://" />
              </Field>
              <Field id="priority" label="Prioridad">
                <Input name="priority" type="number" defaultValue={100} />
              </Field>
              <Field id="startsAt" label="Vigencia desde">
                <Input name="startsAt" type="datetime-local" />
              </Field>
              <Field id="endsAt" label="Vigencia hasta">
                <Input name="endsAt" type="datetime-local" />
              </Field>
              <Field id="geoScope" label="Alcance geo">
                <Select name="geoScope" defaultValue="GLOBAL">
                  {DNX_PARTNER_CAMPAIGN_GEO_SCOPES.map((g) => (
                    <option key={g} value={g}>
                      {GEO_LABELS[g] ?? g}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field id="description" label="Descripción">
              <Textarea name="description" rows={3} />
            </Field>
            <Button type="submit">Crear campaña (DRAFT)</Button>
          </form>
        </Card>

        {campaigns.length === 0 ? (
          <Card variant="outlined" className="p-6 text-sm text-ck-text-secondary">
            Todavía no hay campañas para este partner.
          </Card>
        ) : (
          campaigns.map((campaign) => {
            const previewCreative = campaign.creatives[0];
            const previewUrl = previewCreative?.asset.fileUrl ?? null;
            const logoAsset =
              assets.find(
                (a) =>
                  a.type === "LOGO_GENERAL" &&
                  a.approvalStatus === "APPROVED" &&
                  a.status === "ACTIVE" &&
                  !a.archivedAt,
              ) ?? null;
            const welcomeSnap = buildWelcomeResponsiveMediaSnapshot({
              assets: assets as never,
              logoAsset: logoAsset as never,
              legacyImageUrl: previewUrl,
              legacyAlt: previewCreative?.asset.altText ?? previewCreative?.title,
            });
            const resolutionRows = [
              {
                device: "Escritorio",
                piece: welcomeSnap.snapshot.desktop,
              },
              {
                device: "Celular",
                piece: welcomeSnap.snapshot.mobile,
              },
            ] as const;
            return (
              <Card key={campaign.id} variant="outlined" className="space-y-8 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-ck-text">{campaign.name}</h2>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{campaign.status}</Badge>
                      <Badge>{APPLICATION_LABELS[campaign.application] ?? campaign.application}</Badge>
                      <Badge>{GEO_LABELS[campaign.geoScope] ?? campaign.geoScope}</Badge>
                    </div>
                    {campaign.description ? (
                      <p className="text-sm text-ck-text-secondary">{campaign.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DNX_PARTNER_CAMPAIGN_STATUSES.filter((s) => s !== campaign.status).map((status) => (
                      <form key={status} action={setCampaignStatusFormAction}>
                        <input type="hidden" name="partnerId" value={partner.id} />
                        <input type="hidden" name="campaignId" value={campaign.id} />
                        <input type="hidden" name="status" value={status} />
                        <Button type="submit" variant="secondary">
                          {status}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>

                <form action={saveCampaignTargetingFormAction} className="space-y-6 border-t border-ck-border pt-8">
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <h3 className="text-lg font-semibold">Targeting</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field id={`geo-${campaign.id}`} label="Dónde mostrar">
                      <Select name="geoScope" defaultValue={campaign.geoScope}>
                        {DNX_PARTNER_CAMPAIGN_GEO_SCOPES.map((g) => (
                          <option key={g} value={g}>
                            {GEO_LABELS[g] ?? g}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`country-${campaign.id}`} label="País (ISO)">
                      <Input
                        name="countryCode"
                        defaultValue={campaign.geoTargets[0]?.countryCode ?? "AR"}
                        maxLength={2}
                      />
                    </Field>
                    <Field id={`province-${campaign.id}`} label="Provincia">
                      <Input name="province" defaultValue={campaign.geoTargets[0]?.province ?? ""} />
                    </Field>
                    <Field id={`city-${campaign.id}`} label="Ciudad">
                      <Input name="city" defaultValue={campaign.geoTargets[0]?.city ?? ""} />
                    </Field>
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-ck-text">Contexto</legend>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {DNX_PARTNER_CAMPAIGN_CONTEXT_CATEGORIES.map((cat) => {
                        const checked = campaign.contextTargets.some((t) => t.category === cat);
                        return (
                          <label key={cat} className="flex items-center gap-2 text-sm text-ck-text-secondary">
                            <input
                              type="checkbox"
                              name="context"
                              value={cat}
                              defaultChecked={checked}
                            />
                            {CAMPAIGN_CONTEXT_LABELS[cat]}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <Button type="submit">Guardar targeting</Button>
                </form>

                <form action={createCreativeFormAction} className="space-y-6 border-t border-ck-border pt-8">
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <h3 className="text-lg font-semibold">Creative</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field id={`asset-${campaign.id}`} label="Asset" required>
                      <Select name="assetId" required defaultValue="">
                        <option value="" disabled>
                          Seleccionar…
                        </option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.approvalStatus} · {a.name || a.type} · {a.id.slice(0, 8)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`format-${campaign.id}`} label="Formato">
                      <Select name="format" defaultValue="WELCOME_INTERSTITIAL">
                        {DNX_PARTNER_CREATIVE_FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {f === "WELCOME_INTERSTITIAL"
                              ? `${CREATIVE_FORMAT_LABELS[f]} (activación destacada)`
                              : f === "LOGO_MARQUEE"
                                ? `${CREATIVE_FORMAT_LABELS[f]} — ${marqueeMeta.formatDescription}`
                                : CREATIVE_FORMAT_LABELS[f]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`device-${campaign.id}`} label="Device">
                      <Select name="deviceTarget" defaultValue="ALL">
                        {DNX_PARTNER_CREATIVE_DEVICE_TARGETS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`cstatus-${campaign.id}`} label="Estado creative">
                      <Select name="status" defaultValue="DRAFT">
                        {DNX_PARTNER_CREATIVE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`title-${campaign.id}`} label="Título">
                      <Input name="title" />
                    </Field>
                    <Field id={`cta-${campaign.id}`} label="CTA">
                      <Input name="ctaText" placeholder="Conocé más" />
                    </Field>
                    <Field id={`cdest-${campaign.id}`} label="URL (override)">
                      <Input name="destinationUrl" />
                    </Field>
                  </div>
                  <Field id={`body-${campaign.id}`} label="Texto">
                    <Textarea name="body" rows={2} />
                  </Field>
                  <Button type="submit">Agregar creative</Button>
                </form>

                {campaign.creatives.length > 0 ? (
                  <div className="space-y-4 border-t border-ck-border pt-8">
                    <h3 className="text-lg font-semibold">Creatives ({campaign.creatives.length})</h3>
                    <ul className="space-y-2 text-sm text-ck-text-secondary">
                      {campaign.creatives.map((c) => (
                        <li key={c.id}>
                          {CREATIVE_FORMAT_LABELS[c.format]} · {c.deviceTarget} · {c.status}
                          {c.title ? ` · ${c.title}` : ""}
                        </li>
                      ))}
                    </ul>
                    {previewUrl || welcomeSnap.snapshot.imageUrl ? (
                      <div className="space-y-6">
                        <div className="overflow-x-auto rounded-lg border border-ck-border">
                          <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-ck-border text-xs uppercase tracking-wide text-ck-text-secondary">
                              <tr>
                                <th className="px-3 py-2">Dispositivo</th>
                                <th className="px-3 py-2">Pieza seleccionada</th>
                                <th className="px-3 py-2">Fallback reduced motion</th>
                              </tr>
                            </thead>
                            <tbody>
                              {resolutionRows.map((row) => (
                                <tr key={row.device} className="border-b border-ck-border/60">
                                  <td className="px-3 py-2 text-ck-text">{row.device}</td>
                                  <td className="px-3 py-2 text-ck-text-secondary">
                                    {row.piece
                                      ? `${row.piece.source}${row.piece.animated ? " · GIF" : " · estático"}`
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-ck-text-secondary">
                                    {row.piece?.animated
                                      ? row.piece.reducedMotionFallbackUrl
                                        ? "Fallback estático"
                                        : welcomeSnap.snapshot.logoFallback
                                          ? "Logo"
                                          : "Sin fallback"
                                      : "N/A (estática)"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <WelcomeInterstitialAdminPreview
                          partnerName={partner.name}
                          imageUrl={previewUrl}
                          media={welcomeSnap.snapshot}
                          title={previewCreative?.title}
                          body={previewCreative?.body}
                          ctaText={previewCreative?.ctaText}
                          campaignId={campaign.id}
                        />
                        <div className="grid gap-8 md:grid-cols-2">
                          <div className="space-y-3 rounded-xl border border-ck-border p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-secondary">
                              Preview banner (sin tracking)
                            </p>
                            <PartnerAdCreative
                              partnerName={partner.name}
                              imageUrl={previewUrl}
                              href={null}
                              title={previewCreative?.title}
                              body={previewCreative?.body}
                              ctaText={previewCreative?.ctaText}
                              variant="banner"
                            />
                          </div>
                          <div className="mx-auto w-full max-w-xs space-y-3 rounded-xl border border-ck-border p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-secondary">
                              Preview creative welcome (sin tracking)
                            </p>
                            <PartnerAdCreative
                              partnerName={partner.name}
                              imageUrl={previewUrl}
                              media={welcomeSnap.snapshot}
                              href={null}
                              title={previewCreative?.title}
                              body={previewCreative?.body}
                              ctaText={previewCreative?.ctaText}
                              variant="welcome"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <section className="space-y-6 border-t border-ck-border pt-8">
                  <h3 className="text-lg font-semibold">Alcance welcome (participación explícita)</h3>
                  <p className="text-sm text-ck-text-secondary">
                    Global/plataforma o entidad real (evento, concurso, álbum). No uses IDs a mano.
                    {campaign.participation
                      ? ` Actual: ${campaign.participation.contextType}${
                          campaign.participation.contextId
                            ? ` · ${campaign.participation.contextId}`
                            : ""
                        }`
                      : " Sin participación vinculada."}
                  </p>
                  <WelcomeScopeLinkForm
                    partnerId={partner.id}
                    campaignId={campaign.id}
                    application={campaign.application}
                  />
                </section>

                <form action={bindWelcomePlacementFormAction} className="space-y-6 border-t border-ck-border pt-8">
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <input type="hidden" name="application" value={campaign.application} />
                  <h3 className="text-lg font-semibold">Placement welcome</h3>
                  <Field id={`welcome-place-${campaign.id}`} label="Superficie habilitada">
                    <Select name="placementKey" required defaultValue="">
                      <option value="" disabled>
                        Seleccionar…
                      </option>
                      {welcomePlacements
                        .filter((p) => p.application === campaign.application)
                        .map((p) => (
                          <option
                            key={`${p.application}:${p.placementKey}`}
                            value={p.placementKey}
                            disabled={!p.selectable}
                          >
                            {p.selectable
                              ? `${p.name} (${p.placementKey})`
                              : `${p.name} — Superficie todavía no habilitada`}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Button type="submit">Vincular placement welcome</Button>
                </form>

                <form action={validateWelcomeCampaignFormAction} className="space-y-4 border-t border-ck-border pt-8">
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <input
                    type="hidden"
                    name="scopeKind"
                    value={
                      campaign.participation?.contextType === "CONTEST"
                        ? "CONTEST"
                        : campaign.participation?.contextType === "ALBUM"
                          ? "ALBUM"
                          : campaign.participation?.contextType === "EDITION" ||
                              campaign.participation?.contextType === "EVENT"
                            ? "EDITION"
                            : campaign.participation?.contextType === "PLATFORM"
                              ? "PLATFORM"
                              : "GLOBAL"
                    }
                  />
                  <h3 className="text-lg font-semibold">Validar antes de publicar</h3>
                  <p className="text-sm text-ck-text-secondary">
                    Comprueba sponsor, creative, asset, URL, placement montado y alcance explícito. Si el
                    flag está OFF, verás una advertencia (la campaña puede guardarse pero no será visible).
                  </p>
                  <Button type="submit">Ejecutar validación</Button>
                </form>

                <form action={bindCampaignPlacementFormAction} className="space-y-6 border-t border-ck-border pt-8">
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <Field id={`place-app-${campaign.id}`} label="App del placement (legacy / ads)">
                    <Select name="application" defaultValue={campaign.application}>
                      <option value="INFO_SPOT">InfoSpot</option>
                      <option value="COMPRAME_LA_FOTO">ComprameLaFoto</option>
                      <option value="CLICKATON">Clickatón</option>
                      <option value="FOTO_RANK">FotoRank</option>
                    </Select>
                  </Field>
                  <h3 className="text-lg font-semibold">Placement (catálogo ads / slider)</h3>
                  <p className="text-sm text-ck-text-secondary">
                    Slider de marcas: {marqueeMeta.formatLabel}. Superficies{" "}
                    <strong>Disponible</strong> (InfoSpot / CLF) o <strong>Próximamente</strong>{" "}
                    (Clickatón / FotoRank — no publicables todavía).
                  </p>
                  <Field id={`place-${campaign.id}`} label="Superficie">
                    <Select name="placementKey" required defaultValue="">
                      <option value="" disabled>
                        Seleccionar…
                      </option>
                      {adPlacementCatalog.map((p) => {
                        const welcomeOpt = welcomePlacements.find(
                          (w) =>
                            w.application === p.application && w.placementKey === p.placementKey,
                        );
                        const marqueeOpt = marqueePlacements.find(
                          (m) =>
                            m.application === p.application && m.placementKey === p.placementKey,
                        );
                        const disabled = welcomeOpt
                          ? !welcomeOpt.selectable
                          : marqueeOpt
                            ? !marqueeOpt.selectable
                            : false;
                        const soon =
                          marqueeOpt && !marqueeOpt.selectable
                            ? ` · ${marqueeOpt.availabilityLabel}`
                            : disabled
                              ? " · Superficie todavía no habilitada"
                              : marqueeOpt?.selectable
                                ? ` · ${marqueeOpt.availabilityLabel}`
                                : "";
                        return (
                          <option
                            key={`${p.application}:${p.placementKey}`}
                            value={p.placementKey}
                            disabled={disabled}
                          >
                            {APPLICATION_LABELS[p.application]} · {p.name}
                            {soon}
                          </option>
                        );
                      })}
                    </Select>
                  </Field>
                  <Button type="submit">Vincular placement</Button>
                  {campaign.placementBindings.length > 0 ? (
                    <ul className="text-sm text-ck-text-secondary space-y-1">
                      {campaign.placementBindings.map((b) => (
                        <li key={b.id}>
                          {b.adPlacement.application} · {b.adPlacement.placementKey} · prio{" "}
                          {b.priority} · {b.isActive ? "activo" : "inactivo"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </form>

                <section className="space-y-6 border-t border-ck-border pt-8">
                  <h3 className="text-lg font-semibold">Publicación multi-DB</h3>
                  <p className="text-sm text-ck-text-secondary">
                    Admin en Clickatón (silent-haze). Publicar sincroniza snapshot público a InfoSpot /
                    CLF. Flags globales de ads NO se activan acá.
                  </p>
                  <form action={saveCampaignPublishTargetsFormAction} className="space-y-4">
                    <input type="hidden" name="partnerId" value={partner.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <div className="flex flex-wrap gap-4">
                      {(publicationByCampaign[campaign.id] ?? []).map((row) => (
                        <label
                          key={row.application}
                          className="flex items-center gap-2 text-sm text-ck-text-secondary"
                        >
                          <input
                            type="checkbox"
                            name="targetApp"
                            value={row.application}
                            defaultChecked={row.selected}
                          />
                          {APPLICATION_LABELS[row.application]}
                        </label>
                      ))}
                    </div>
                    <Button type="submit" variant="secondary">
                      Guardar targets
                    </Button>
                  </form>

                  <div className="grid gap-4 md:grid-cols-2">
                    {(publicationByCampaign[campaign.id] ?? []).map((row) => (
                      <Card key={row.application} variant="outlined" className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ck-text">
                            {APPLICATION_LABELS[row.application]}
                          </p>
                          <Badge>{row.selected ? "seleccionada" : "no seleccionada"}</Badge>
                          {row.syncStatus ? <Badge>{row.syncStatus}</Badge> : null}
                          {row.freshness ? <Badge>{row.freshness}</Badge> : null}
                          {row.targetStatus ? <Badge>{row.targetStatus}</Badge> : null}
                        </div>
                        <p className="text-xs text-ck-text-secondary">
                          DB: {row.dbConfigured ? row.dbHostMasked : "NO CONFIGURADA"} · Ads flag{" "}
                          {row.adsFlagEnv}: {row.adsFlagOn ? "ON" : "OFF"}
                          {row.attempts ? ` · intentos ${row.attempts}` : ""}
                        </p>
                        {row.lastError ? (
                          <p className="text-xs text-red-300">{row.lastError}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <form action={publishCampaignFormAction}>
                            <input type="hidden" name="partnerId" value={partner.id} />
                            <input type="hidden" name="campaignId" value={campaign.id} />
                            <input type="hidden" name="application" value={row.application} />
                            <Button type="submit" disabled={!row.selected || !row.dbConfigured}>
                              Publicar / Sincronizar
                            </Button>
                          </form>
                          <form action={retryCampaignPublishFormAction}>
                            <input type="hidden" name="partnerId" value={partner.id} />
                            <input type="hidden" name="campaignId" value={campaign.id} />
                            <input type="hidden" name="application" value={row.application} />
                            <Button type="submit" variant="secondary">
                              Reintentar
                            </Button>
                          </form>
                          <form action={pauseResumeCampaignTargetFormAction}>
                            <input type="hidden" name="partnerId" value={partner.id} />
                            <input type="hidden" name="campaignId" value={campaign.id} />
                            <input type="hidden" name="application" value={row.application} />
                            <input
                              type="hidden"
                              name="status"
                              value={row.targetStatus === "PAUSED" ? "ACTIVE" : "PAUSED"}
                            />
                            <Button type="submit" variant="secondary">
                              {row.targetStatus === "PAUSED" ? "Reanudar" : "Pausar"}
                            </Button>
                          </form>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <form action={publishCampaignFormAction}>
                    <input type="hidden" name="partnerId" value={partner.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <Button type="submit">Publicar a todos los targets ACTIVE</Button>
                  </form>
                </section>
              </Card>
            );
          })
        )}
      </div>
    </AdminScrollStability>
  );
}
