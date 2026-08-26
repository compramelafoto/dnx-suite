import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Gift,
  Medal,
  Package,
  Sparkles,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";
import type { ContestPrizeItem, ContestRewardItem, PrizeType } from "../prizesRewards";
import { hasUsableImageUrl } from "../contest-visual/url";

/** Estados de publicación del contrato visual (sin persistencia propia). */
export type ContestPrizePublicationStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PUBLIC";

export type ContestPrizeVisualType =
  | "CASH"
  | "PRODUCT"
  | "VOUCHER"
  | "SERVICE"
  | "EXHIBITION"
  | "PUBLICATION"
  | "CERTIFICATE"
  | "TROPHY"
  | "MENTION"
  | "OTHER";

export type ContestPrizeScope = "GENERAL" | "CATEGORY" | "POSITION" | "MENTION";

/**
 * Contrato visual de premio para landing pública.
 * Preparado para persistencia futura; no migraciones en esta etapa.
 */
export type ContestPrizePresentation = {
  id: string;
  title: string;
  shortDescription: string;
  type: ContestPrizeVisualType;
  status: ContestPrizePublicationStatus;
  scope: ContestPrizeScope;
  categoryId?: string;
  categoryName?: string;
  rank?: string;
  monetaryAmount?: number;
  currency?: string;
  benefitLabel?: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  sponsorLogoAlt?: string;
  conditionsSummary?: string;
  rulesAnchor?: string;
  featured: boolean;
  order: number;
};

export type PublicCategoryRef = { id: string; name: string };

function mapPrizeType(type: PrizeType): ContestPrizeVisualType {
  switch (type) {
    case "CASH":
      return "CASH";
    case "TROPHY":
      return "TROPHY";
    case "DIPLOMA":
    case "CERTIFICATE":
      return "CERTIFICATE";
    case "PHYSICAL_PRODUCT":
    case "DIGITAL_PRODUCT":
      return "PRODUCT";
    case "SCHOLARSHIP":
      return "SERVICE";
    case "DISCOUNT":
    case "PROMOTION":
      return "VOUCHER";
    case "SPONSOR_BENEFIT":
      return "OTHER";
    default:
      return "OTHER";
  }
}

export function prizeTypeIcon(type: ContestPrizeVisualType): LucideIcon {
  switch (type) {
    case "CASH":
      return Wallet;
    case "PRODUCT":
      return Package;
    case "VOUCHER":
      return Ticket;
    case "SERVICE":
      return Sparkles;
    case "EXHIBITION":
      return Medal;
    case "PUBLICATION":
      return BookOpen;
    case "CERTIFICATE":
      return BadgeCheck;
    case "TROPHY":
      return Trophy;
    case "MENTION":
      return Award;
    default:
      return Gift;
  }
}

export function formatPrizeAmount(amount: number, currency: string, locale = "es-AR"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "ARS",
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * Solo premios con visiblePublic llegan a la landing.
 * DRAFT / no públicos se excluyen.
 */
export function toPublicPrizePresentations(
  prizes: ContestPrizeItem[],
  categories: PublicCategoryRef[],
  options?: { rulesAnchor?: string },
): ContestPrizePresentation[] {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const out: ContestPrizePresentation[] = [];

  prizes.forEach((p, index) => {
    if (!p.visiblePublic) return;
    const title = p.name?.trim();
    if (!title) return;

    const categoryName = p.categoryId ? catMap.get(p.categoryId) : undefined;
    const logoOk = hasUsableImageUrl(p.sponsorLogoUrl);

    out.push({
      id: p.id,
      title,
      shortDescription: (p.shortDescription ?? "").trim(),
      type: mapPrizeType(p.type),
      status: "PUBLIC",
      scope: p.scope,
      categoryId: p.categoryId,
      categoryName,
      rank: p.positionLabel?.trim() || undefined,
      monetaryAmount: p.isMonetary && typeof p.amount === "number" ? p.amount : undefined,
      currency: p.isMonetary ? p.currency?.trim() || undefined : undefined,
      benefitLabel:
        !p.isMonetary && p.sponsorContribution?.trim()
          ? p.sponsorContribution.trim()
          : undefined,
      sponsorName: p.sponsorName?.trim() || undefined,
      sponsorLogoUrl: logoOk ? p.sponsorLogoUrl!.trim() : undefined,
      sponsorLogoAlt: logoOk
        ? `Logo de ${p.sponsorName?.trim() || "sponsor del premio"}`
        : undefined,
      conditionsSummary: undefined,
      rulesAnchor: options?.rulesAnchor ?? "#bases",
      featured: Boolean(p.isPrimary),
      order: index,
    });
  });

  return out.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.order - b.order;
  });
}

/** Rewards públicos como menciones/beneficios (scope GENERAL). */
export function rewardsToPrizePresentations(
  rewards: ContestRewardItem[],
  startOrder = 1000,
): ContestPrizePresentation[] {
  return rewards
    .filter((r) => r.visiblePublic && r.name?.trim())
    .map((r, i) => ({
      id: r.id,
      title: r.name.trim(),
      shortDescription: (r.description ?? "").trim(),
      type: "OTHER" as const,
      status: "PUBLIC" as const,
      scope: (r.recipients === "CATEGORY" ? "CATEGORY" : "GENERAL") as ContestPrizeScope,
      categoryId: r.categoryId,
      sponsorName: r.sponsorName?.trim() || undefined,
      sponsorLogoUrl: hasUsableImageUrl(r.sponsorLogoUrl) ? r.sponsorLogoUrl!.trim() : undefined,
      sponsorLogoAlt: hasUsableImageUrl(r.sponsorLogoUrl)
        ? `Logo de ${r.sponsorName?.trim() || "sponsor"}`
        : undefined,
      rulesAnchor: "#bases",
      featured: false,
      order: startOrder + i,
    }));
}

export function groupPrizesByCategory(
  prizes: ContestPrizePresentation[],
): Array<{ categoryId: string | null; categoryName: string; prizes: ContestPrizePresentation[] }> {
  const general = prizes.filter((p) => p.scope !== "CATEGORY" || !p.categoryId);
  const byCat = new Map<string, ContestPrizePresentation[]>();
  for (const p of prizes) {
    if (p.scope === "CATEGORY" && p.categoryId) {
      const list = byCat.get(p.categoryId) ?? [];
      list.push(p);
      byCat.set(p.categoryId, list);
    }
  }
  const groups: Array<{
    categoryId: string | null;
    categoryName: string;
    prizes: ContestPrizePresentation[];
  }> = [];
  if (general.length) {
    groups.push({ categoryId: null, categoryName: "Premios generales", prizes: general });
  }
  for (const [categoryId, list] of byCat) {
    groups.push({
      categoryId,
      categoryName: list[0]?.categoryName ?? "Categoría",
      prizes: list,
    });
  }
  return groups;
}
