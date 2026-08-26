/**
 * Placa de agradecimiento a sponsors de Clickatón.
 *
 * Arma los datos desde la participación del partner en una edición y delega el
 * render en `@repo/template-engine-renderer`, el mismo pipeline que usan las
 * placas de participante.
 */
import { formatDateDayMonthUppercase } from "@repo/template-engine";
import {
  fetchImageAsDataUrl,
  renderSponsorThankYouCardPng,
  type SponsorThankYouCardData,
  type SponsorThankYouCardResult,
} from "@repo/template-engine-renderer";
import {
  resolveSponsorCardLogoCandidates,
  type DnxPartnerDisplayTier,
  type DnxPartnerParticipationType,
  type PartnerBrandAssetRecord,
} from "@repo/partners";
import { prisma } from "@/lib/admin/db";
import { CLICKATON_CARD_LOGO_DATA_URL } from "@/lib/participant-cards/participant-card-branding-logo";

const CLICKATON_TIMEZONE = "America/Argentina/Cordoba";

const TIER_LABELS: Record<DnxPartnerDisplayTier, string> = {
  INSTITUTIONAL: "Partner institucional",
  MAIN: "Sponsor principal",
  STANDARD: "Sponsor oficial",
  SUPPORTING: "Colaborador",
};

const PARTICIPATION_TYPE_LABELS: Partial<
  Record<DnxPartnerParticipationType, string>
> = {
  SPONSOR: "Sponsor oficial",
  BENEFIT_PROVIDER: "Proveedor de beneficios",
  PRIZE_PROVIDER: "Proveedor de premios",
  SERVICE_PROVIDER: "Proveedor de servicios",
  INSTITUTIONAL_PARTNER: "Partner institucional",
  MEDIA_PARTNER: "Media partner",
  COMMERCIAL_PARTNER: "Partner comercial",
  COLLABORATOR: "Colaborador",
};

export const DEFAULT_SPONSOR_THANKYOU_MESSAGE =
  "Gracias por acompañar a la comunidad de fotógrafas y fotógrafos que hace posible este encuentro.";

export class SponsorThankYouCardError extends Error {
  constructor(
    readonly code: "PARTNER_NOT_FOUND" | "EDITION_NOT_FOUND" | "LOGO_UNUSABLE",
    message: string
  ) {
    super(message);
    this.name = "SponsorThankYouCardError";
  }
}

/**
 * Base pública de la app: los logos guardados en R2 se sirven por el proxy
 * relativo `/api/media/<key>` y hay que resolverlos a URL absoluta antes de
 * descargarlos.
 */
function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_CLICKATON_URL?.trim() ||
    process.env.CLICKATON_PUBLIC_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

export type SponsorLogoResolution = {
  dataUrl: string;
  /** Motivos por los que se descartó cada candidato previo; vacío si el primero sirvió. */
  warnings: string[];
};

/**
 * Descarga el logo y lo embebe como data URL. El render corre sobre
 * `about:blank` (o en el worker remoto), así que una URL relativa no resuelve
 * contra ningún origen y una privada no es alcanzable desde el worker.
 *
 * Si ningún candidato sirve devuelve `dataUrl` vacío: la placa se genera igual,
 * sin logo, y el motivo queda en `warnings`.
 */
export async function resolveSponsorLogoDataUrl(input: {
  assets: readonly PartnerBrandAssetRecord[];
  logoUrl: string | null;
}): Promise<SponsorLogoResolution> {
  const candidates = resolveSponsorCardLogoCandidates({
    assets: input.assets,
    logoUrl: input.logoUrl,
  });

  if (candidates.length === 0) {
    return { dataUrl: "", warnings: ["El sponsor no tiene logo cargado."] };
  }

  const warnings: string[] = [];
  const baseUrl = resolveAppBaseUrl();

  for (const candidate of candidates) {
    const fetched = await fetchImageAsDataUrl(candidate.url, { baseUrl });
    if (fetched.ok) {
      return { dataUrl: fetched.dataUrl, warnings };
    }
    warnings.push(`${candidate.url}: ${fetched.reason}`);
  }

  return { dataUrl: "", warnings };
}

export function resolveSponsorTierLabel(input: {
  publicRoleLabel?: string | null;
  displayTier?: DnxPartnerDisplayTier | null;
  participationType?: DnxPartnerParticipationType | null;
}): string {
  const explicit = input.publicRoleLabel?.trim();
  if (explicit) return explicit;
  if (input.participationType) {
    const byType = PARTICIPATION_TYPE_LABELS[input.participationType];
    if (byType) return byType;
  }
  if (input.displayTier) return TIER_LABELS[input.displayTier];
  return "Sponsor oficial";
}

export type BuildClickatonSponsorCardInput = {
  partnerId: string;
  editionId: string;
  /** Sobrescribe el mensaje por defecto (admin puede personalizarlo). */
  message?: string | null;
  /** Sobrescribe la etiqueta de categoría del sponsor. */
  tierLabel?: string | null;
};

export type ClickatonSponsorCardBuild = {
  data: SponsorThankYouCardData;
  /** Por qué no se pudo usar cada logo candidato; vacío si el logo salió bien. */
  logoWarnings: string[];
};

export async function buildClickatonSponsorThankYouData(
  input: BuildClickatonSponsorCardInput
): Promise<ClickatonSponsorCardBuild> {
  const [partner, edition, participation, brandAssets] = await Promise.all([
    prisma.dnxPartner.findUnique({
      where: { id: input.partnerId },
      select: {
        name: true,
        logoUrl: true,
        instagram: true,
        websiteUrl: true,
      },
    }),
    prisma.clickatonEdition.findUnique({
      where: { id: input.editionId },
      select: { name: true, city: true, startAt: true, timezone: true },
    }),
    prisma.dnxPartnerParticipation.findFirst({
      where: {
        partnerId: input.partnerId,
        application: "CLICKATON",
        contextType: "EDITION",
        contextId: input.editionId,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        publicRoleLabel: true,
        displayTier: true,
        participationType: true,
      },
    }),
    prisma.dnxPartnerAsset.findMany({
      where: { partnerId: input.partnerId, archivedAt: null },
      orderBy: { isPrimary: "desc" },
    }),
  ]);

  if (!partner) {
    throw new SponsorThankYouCardError("PARTNER_NOT_FOUND", "Sponsor no encontrado.");
  }
  if (!edition) {
    throw new SponsorThankYouCardError("EDITION_NOT_FOUND", "Edición no encontrada.");
  }

  const dateFormatted = edition.startAt
    ? formatDateDayMonthUppercase(
        edition.startAt.toISOString().slice(0, 10),
        edition.timezone?.trim() || CLICKATON_TIMEZONE
      )
    : "";

  const logo = await resolveSponsorLogoDataUrl({
    assets: brandAssets as unknown as PartnerBrandAssetRecord[],
    logoUrl: partner.logoUrl,
  });

  return {
    logoWarnings: logo.warnings,
    data: {
      sponsor: {
        name: partner.name,
        logoUrl: logo.dataUrl,
        tierLabel:
          input.tierLabel?.trim() ||
          resolveSponsorTierLabel({
            publicRoleLabel: participation?.publicRoleLabel,
            displayTier: participation?.displayTier ?? null,
            participationType: participation?.participationType ?? null,
          }),
        instagram: instagramHandleFromUrl(partner.instagram),
        website: partner.websiteUrl ?? "",
        message: input.message?.trim() || DEFAULT_SPONSOR_THANKYOU_MESSAGE,
      },
      program: {
        productLabel: "Clickatón",
        name: edition.name,
        dateFormatted,
        city: edition.city ?? "",
        logoUrl: CLICKATON_CARD_LOGO_DATA_URL,
      },
    },
  };
}

function instagramHandleFromUrl(raw: string | null | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  if (value.startsWith("@")) return value;
  const match = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(value);
  if (match?.[1]) return `@${match[1]}`;
  return `@${value.replace(/^@/, "")}`;
}

export async function renderClickatonSponsorThankYouCard(
  input: BuildClickatonSponsorCardInput
): Promise<SponsorThankYouCardResult & { logoWarnings: string[] }> {
  const built = await buildClickatonSponsorThankYouData(input);
  const card = await renderSponsorThankYouCardPng({
    product: "clickaton",
    data: built.data,
  });
  return { ...card, logoWarnings: built.logoWarnings };
}

export function buildSponsorThankYouFilename(sponsorName: string): string {
  const slug = sponsorName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `clickaton-gracias-${slug || "sponsor"}.png`;
}
