export type PrizeType =
  | "CASH"
  | "TROPHY"
  | "DIPLOMA"
  | "CERTIFICATE"
  | "PHYSICAL_PRODUCT"
  | "DIGITAL_PRODUCT"
  | "SCHOLARSHIP"
  | "PROMOTION"
  | "DISCOUNT"
  | "SPONSOR_BENEFIT"
  | "OTHER";

export type RewardType =
  | "DISCOUNT"
  | "COUPON"
  | "COURSE_ACCESS"
  | "MEMBERSHIP"
  | "GIFT_CARD"
  | "FEATURED_PUBLICATION"
  | "SPONSOR_BENEFIT"
  | "OTHER";

export type DeliveryStatus = "PENDING" | "ANNOUNCED" | "ASSIGNED" | "DELIVERED" | "CANCELLED";
export type PrizeScope = "GENERAL" | "CATEGORY" | "POSITION" | "MENTION";
export type RewardRecipients = "ALL" | "FINALISTS" | "WINNERS" | "CATEGORY";

export type ContestPrizeItem = {
  id: string;
  name: string;
  type: PrizeType;
  shortDescription: string;
  fullDescription?: string;
  scope: PrizeScope;
  categoryId?: string;
  positionLabel?: string;
  winnersCount?: number;
  sponsorName?: string;
  sponsorUrl?: string;
  sponsorLogoUrl?: string;
  sponsorContribution?: string;
  estimatedDeliveryAt?: string;
  deliveryMode?: string;
  deliveryStatus?: DeliveryStatus;
  winnerLabel?: string;
  assignedAt?: string;
  deliveredAt?: string;
  internalNotes?: string;
  visiblePublic?: boolean;
  isPrimary?: boolean;
  isMonetary?: boolean;
  amount?: number;
  currency?: string;
  fundedBy?: "ORGANIZER" | "SPONSOR" | "OTHER";
  payoutMethod?: "OFF_PLATFORM" | "PLATFORM_FUTURE";
  payoutStatus?: "PENDING" | "PAID" | "CANCELLED";
};

export type ContestRewardItem = {
  id: string;
  name: string;
  type: RewardType;
  description: string;
  recipients: RewardRecipients;
  categoryId?: string;
  sponsorName?: string;
  sponsorUrl?: string;
  sponsorLogoUrl?: string;
  couponCode?: string;
  externalLink?: string;
  validUntil?: string;
  deliveryStatus?: DeliveryStatus;
  winnerLabel?: string;
  assignedAt?: string;
  deliveredAt?: string;
  internalNotes?: string;
  visiblePublic?: boolean;
};

export type ContestEconomyConfig = {
  entryMode: "FREE" | "PAID";
  entryFeeAmount?: number;
  entryFeeCurrency?: string;
  paidRegistrationsCount?: number;
  gatewayFeePercent?: number;
  diplomasEnabled?: boolean;
  diplomaEmailsEnabled?: boolean;
  reviewedByOrganizer?: boolean;
  platformIntervenesMonetaryPrizes?: boolean;
};

export type PrizesRewardsConfig = {
  noPrizesExplicit?: boolean;
  prizes: ContestPrizeItem[];
  rewards: ContestRewardItem[];
  economy: ContestEconomyConfig;
};

const DEFAULT_CONFIG: PrizesRewardsConfig = {
  noPrizesExplicit: false,
  prizes: [],
  rewards: [],
  economy: {
    entryMode: "FREE",
    entryFeeCurrency: "USD",
    paidRegistrationsCount: 0,
    gatewayFeePercent: 0,
    diplomasEnabled: false,
    diplomaEmailsEnabled: false,
    reviewedByOrganizer: false,
    platformIntervenesMonetaryPrizes: false,
  },
};

export function parsePrizesRewardsConfig(rulesData: unknown): PrizesRewardsConfig {
  if (!rulesData || typeof rulesData !== "object" || Array.isArray(rulesData)) return DEFAULT_CONFIG;
  const root = rulesData as { premiosRecompensas?: Partial<PrizesRewardsConfig> };
  const raw = root.premiosRecompensas;
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  return {
    noPrizesExplicit: Boolean(raw.noPrizesExplicit),
    prizes: Array.isArray(raw.prizes) ? (raw.prizes as ContestPrizeItem[]) : [],
    rewards: Array.isArray(raw.rewards) ? (raw.rewards as ContestRewardItem[]) : [],
    economy: {
      ...DEFAULT_CONFIG.economy,
      ...(raw.economy ?? {}),
    },
  };
}

export function toRulesDataWithPrizesRewards(
  baseRulesData: unknown,
  config: PrizesRewardsConfig
): Record<string, unknown> {
  const base =
    baseRulesData && typeof baseRulesData === "object" && !Array.isArray(baseRulesData)
      ? (baseRulesData as Record<string, unknown>)
      : {};
  return {
    ...base,
    premiosRecompensas: config,
  };
}

export function computeEconomySummary(config: PrizesRewardsConfig) {
  const fee = Number(config.economy.entryFeeAmount ?? 0);
  const paid = Number(config.economy.paidRegistrationsCount ?? 0);
  const gross = config.economy.entryMode === "PAID" ? fee * paid : 0;
  const platformCommission = gross * 0.15;
  const gatewayFee = gross * (Number(config.economy.gatewayFeePercent ?? 0) / 100);
  const diplomaModuleCost = config.economy.diplomasEnabled ? 20 : 0;
  const diplomaEmailCost = config.economy.diplomaEmailsEnabled ? 20 : 0;
  const servicesTotal = diplomaModuleCost + diplomaEmailCost;
  const netForOrganizer = gross - platformCommission - gatewayFee - servicesTotal;
  return {
    gross,
    platformCommission,
    gatewayFee,
    diplomaModuleCost,
    diplomaEmailCost,
    servicesTotal,
    netForOrganizer,
  };
}

export function getPrizesModuleStatus(config: PrizesRewardsConfig): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" {
  if (config.noPrizesExplicit) return "COMPLETE";
  if (config.prizes.length > 0 || config.rewards.length > 0) return "COMPLETE";
  return "NOT_STARTED";
}

export function getEconomyModuleStatus(config: PrizesRewardsConfig): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" {
  const e = config.economy;
  const touched =
    e.entryMode === "PAID" ||
    Number(e.entryFeeAmount ?? 0) > 0 ||
    Number(e.paidRegistrationsCount ?? 0) > 0 ||
    Boolean(e.diplomasEnabled) ||
    Boolean(e.diplomaEmailsEnabled);
  if (e.reviewedByOrganizer) return "COMPLETE";
  return touched ? "IN_PROGRESS" : "NOT_STARTED";
}
