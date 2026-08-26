/**
 * Placa de agradecimiento a sponsors de un concurso FotoRank.
 *
 * Comparte plantilla, variables y motor con la placa de Clickatón
 * (`@repo/template-engine-renderer`); cambian la marca y el origen de datos.
 *
 * Fuente de los sponsors: la configuración de premios y recompensas del
 * concurso (`rulesData`), que es donde el panel de organizador los carga hoy.
 * Si además existe el sponsor en el CRM de partners (`DnxPartner`), se prefiere
 * su logo de marca, que está curado y aprobado.
 */
import { prisma } from "@repo/db";
import {
  resolveSponsorCardLogoCandidates,
  type PartnerBrandAssetRecord,
} from "@repo/partners";
import {
  fetchImageAsDataUrl,
  renderSponsorThankYouCardPng,
  type SponsorThankYouCardData,
  type SponsorThankYouCardResult,
} from "@repo/template-engine-renderer";
import { parsePrizesRewardsConfig } from "../prizesRewards";
import { FOTORANK_CARD_LOGO_DATA_URL } from "./sponsor-card-logo-asset";

const FOTORANK_TIMEZONE = "America/Argentina/Buenos_Aires";

export const DEFAULT_FOTORANK_SPONSOR_MESSAGE =
  "Gracias por apoyar a quienes compiten, comparten y elevan el nivel de la fotografía.";

export class ContestSponsorCardError extends Error {
  constructor(
    readonly code:
      | "CONTEST_NOT_FOUND"
      | "FORBIDDEN"
      | "SPONSOR_REQUIRED"
      | "SPONSOR_NOT_FOUND",
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = "ContestSponsorCardError";
  }
}

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    process.env.FOTORANK_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

function instagramHandleFromUrl(raw: string | null | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  const match = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(value);
  if (match?.[1]) return `@${match[1]}`;
  if (value.startsWith("@")) return value;
  return "";
}

function formatContestDate(startAt: Date | null, timezone: string | null): string {
  if (!startAt) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: timezone?.trim() || FOTORANK_TIMEZONE,
  })
    .format(startAt)
    .replace(" de ", " DE ")
    .toUpperCase();
}

/** Clave de comparación tolerante a mayúsculas, tildes y espacios repetidos. */
function sponsorKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type ContestSponsorSummary = {
  name: string;
  websiteUrl: string;
  logoUrl: string;
  /** Etiqueta derivada de lo que el sponsor aportó al concurso. */
  roleLabel: string;
  prizeNames: string[];
  rewardNames: string[];
};

/**
 * Agrega los sponsors del concurso a partir de premios y recompensas, igual
 * que la pestaña «Sponsors» del panel de organizador.
 */
export function aggregateContestSponsors(rulesData: unknown): ContestSponsorSummary[] {
  const config = parsePrizesRewardsConfig(rulesData);
  const map = new Map<string, ContestSponsorSummary>();

  const upsert = (input: {
    name?: string;
    url?: string;
    logoUrl?: string;
    prizeName?: string;
    rewardName?: string;
  }) => {
    const name = input.name?.trim();
    if (!name) return;
    const key = sponsorKey(name);
    const existing = map.get(key) ?? {
      name,
      websiteUrl: "",
      logoUrl: "",
      roleLabel: "",
      prizeNames: [] as string[],
      rewardNames: [] as string[],
    };
    if (input.url?.trim()) existing.websiteUrl = input.url.trim();
    if (input.logoUrl?.trim()) existing.logoUrl = input.logoUrl.trim();
    if (input.prizeName) existing.prizeNames.push(input.prizeName);
    if (input.rewardName) existing.rewardNames.push(input.rewardName);
    map.set(key, existing);
  };

  for (const prize of config.prizes) {
    upsert({
      name: prize.sponsorName,
      url: prize.sponsorUrl,
      logoUrl: prize.sponsorLogoUrl,
      prizeName: prize.name,
    });
  }
  for (const reward of config.rewards) {
    upsert({
      name: reward.sponsorName,
      url: reward.sponsorUrl,
      logoUrl: reward.sponsorLogoUrl,
      rewardName: reward.name,
    });
  }

  return [...map.values()].map((sponsor) => ({
    ...sponsor,
    roleLabel:
      sponsor.prizeNames.length > 0 && sponsor.rewardNames.length > 0
        ? "Sponsor oficial"
        : sponsor.prizeNames.length > 0
          ? "Sponsor de premios"
          : "Sponsor de recompensas",
  }));
}

/**
 * El organizador debe ser miembro activo de la organización dueña del concurso.
 * Mismo criterio que el resto del panel de organizador.
 */
async function loadContestForOrganizer(input: { contestId: string; userId: number }) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: {
      id: true,
      title: true,
      organizationId: true,
      startAt: true,
      timezone: true,
      rulesData: true,
    },
  });
  if (!contest) {
    throw new ContestSponsorCardError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  }

  const member = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: contest.organizationId,
      userId: input.userId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "EDITOR", "VIEWER"] },
    },
    select: { id: true },
  });
  if (!member) {
    throw new ContestSponsorCardError("FORBIDDEN", "Sin acceso a este concurso.", 403);
  }

  return contest;
}

export async function listContestSponsorsForOrganizer(input: {
  contestId: string;
  userId: number;
}): Promise<ContestSponsorSummary[]> {
  const contest = await loadContestForOrganizer(input);
  return aggregateContestSponsors(contest.rulesData);
}

/**
 * Logo curado del CRM de partners, si el sponsor está dado de alta ahí.
 * Se busca por nombre porque los premios sólo guardan el nombre del sponsor.
 */
async function findPartnerBrandLogoCandidates(sponsorName: string): Promise<string[]> {
  const partner = await prisma.dnxPartner.findFirst({
    where: { name: { equals: sponsorName, mode: "insensitive" } },
    select: { id: true, logoUrl: true },
  });
  if (!partner) return [];

  const assets = await prisma.dnxPartnerAsset.findMany({
    where: { partnerId: partner.id, archivedAt: null },
    orderBy: { isPrimary: "desc" },
  });

  return resolveSponsorCardLogoCandidates({
    assets: assets as unknown as PartnerBrandAssetRecord[],
    logoUrl: partner.logoUrl,
  }).map((candidate) => candidate.url);
}

export type BuildContestSponsorCardInput = {
  contestId: string;
  /** Nombre del sponsor tal como figura en premios o recompensas. */
  sponsorName: string;
  /** Organizador autenticado; se valida su acceso al concurso. */
  userId: number;
  message?: string | null;
  tierLabel?: string | null;
};

export type ContestSponsorCardBuild = {
  data: SponsorThankYouCardData;
  /** Por qué se descartó cada logo candidato; vacío si el logo salió bien. */
  logoWarnings: string[];
};

export async function buildContestSponsorThankYouData(
  input: BuildContestSponsorCardInput
): Promise<ContestSponsorCardBuild> {
  const wanted = input.sponsorName?.trim();
  if (!wanted) {
    throw new ContestSponsorCardError(
      "SPONSOR_REQUIRED",
      "Falta el nombre del sponsor.",
      400
    );
  }

  const contest = await loadContestForOrganizer({
    contestId: input.contestId,
    userId: input.userId,
  });

  const sponsors = aggregateContestSponsors(contest.rulesData);
  const sponsor = sponsors.find((s) => sponsorKey(s.name) === sponsorKey(wanted));
  if (!sponsor) {
    throw new ContestSponsorCardError(
      "SPONSOR_NOT_FOUND",
      "El sponsor no figura en los premios ni en las recompensas de este concurso.",
      404
    );
  }

  // El logo de marca del CRM gana sobre el cargado suelto en el premio.
  const candidates = [
    ...(await findPartnerBrandLogoCandidates(sponsor.name)),
    sponsor.logoUrl,
  ].filter((url) => Boolean(url?.trim()));

  const logoWarnings: string[] = [];
  let logoDataUrl = "";
  const baseUrl = resolveAppBaseUrl();

  if (candidates.length === 0) {
    logoWarnings.push("El sponsor no tiene logo cargado.");
  }
  for (const candidate of candidates) {
    const fetched = await fetchImageAsDataUrl(candidate, { baseUrl });
    if (fetched.ok) {
      logoDataUrl = fetched.dataUrl;
      break;
    }
    logoWarnings.push(`${candidate}: ${fetched.reason}`);
  }

  return {
    logoWarnings,
    data: {
      sponsor: {
        name: sponsor.name,
        logoUrl: logoDataUrl,
        tierLabel: input.tierLabel?.trim() || sponsor.roleLabel,
        instagram: instagramHandleFromUrl(sponsor.websiteUrl),
        website: sponsor.websiteUrl,
        message: input.message?.trim() || DEFAULT_FOTORANK_SPONSOR_MESSAGE,
      },
      program: {
        productLabel: "FotoRank",
        name: contest.title,
        dateFormatted: formatContestDate(contest.startAt, contest.timezone),
        city: "",
        logoUrl: FOTORANK_CARD_LOGO_DATA_URL,
      },
    },
  };
}

export async function renderContestSponsorThankYouCard(
  input: BuildContestSponsorCardInput
): Promise<SponsorThankYouCardResult & { logoWarnings: string[] }> {
  const built = await buildContestSponsorThankYouData(input);
  const card = await renderSponsorThankYouCardPng({
    product: "fotorank",
    data: built.data,
  });
  return { ...card, logoWarnings: built.logoWarnings };
}

export function buildContestSponsorCardFilename(sponsorName: string): string {
  const slug = sponsorName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `fotorank-gracias-${slug || "sponsor"}.png`;
}
