/**
 * Lógica pura — carga idempotente de premios SFEF en rulesData.premiosRecompensas.
 * Sin I/O ni Prisma.
 */

export const SFEF_SLUG = "santa-fe-en-foco";
export const SFEF_CONTEST_ID = "cmsf1je750005xpzcrizp52rd";

export const SFEF_CATEGORY_SPECS = [
  { slug: "fotografo-profesional", label: "Fotógrafo Profesional" },
  { slug: "fotografo-amateur", label: "Fotógrafo Amateur" },
  { slug: "reportero-grafico", label: "Reportero Gráfico" },
  { slug: "fotografia-aerea", label: "Fotografía Aérea" },
] as const;

export const SFEF_PLACE_SPECS = [
  { place: 1, amount: 500_000, positionLabel: "1.º", name: "1.º Premio" },
  { place: 2, amount: 400_000, positionLabel: "2.º", name: "2.º Premio" },
  { place: 3, amount: 300_000, positionLabel: "3.º", name: "3.º Premio" },
] as const;

export type SfefCategoryRef = {
  id: string;
  slug: string;
  name: string;
  status?: string;
  sortOrder?: number;
};

/** Subconjunto de ContestPrizeItem usado por la operación. */
export type SfefPrizeItem = {
  id: string;
  name: string;
  type: "CASH";
  shortDescription: string;
  scope: "CATEGORY";
  categoryId: string;
  positionLabel: string;
  winnersCount: number;
  visiblePublic: boolean;
  isPrimary: boolean;
  isMonetary: true;
  amount: number;
  currency: "ARS";
  deliveryStatus: "PENDING";
  payoutMethod: "OFF_PLATFORM";
  payoutStatus: "PENDING";
  fundedBy: "ORGANIZER";
  winnerLabel?: string;
  assignedAt?: string;
  deliveredAt?: string;
};

export type PrizeChangeAction = "create" | "update" | "keep" | "remove_duplicate";

export type PrizeChange = {
  action: PrizeChangeAction;
  prizeId: string;
  categorySlug: string;
  place: number;
  before?: Partial<SfefPrizeItem> | Record<string, unknown>;
  after?: SfefPrizeItem;
  reason?: string;
};

function formatArsShortDescription(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

export function stablePrizeId(categorySlug: string, place: number): string {
  return `sfef-2026-${categorySlug}-${place}`;
}

export function buildDesiredPrize(input: {
  categoryId: string;
  categorySlug: string;
  place: number;
  amount: number;
  positionLabel: string;
  name: string;
}): SfefPrizeItem & { place: number } {
  return {
    id: stablePrizeId(input.categorySlug, input.place),
    name: input.name,
    type: "CASH",
    shortDescription: formatArsShortDescription(input.amount),
    scope: "CATEGORY",
    categoryId: input.categoryId,
    positionLabel: input.positionLabel,
    winnersCount: 1,
    visiblePublic: true,
    isPrimary: input.place === 1,
    isMonetary: true,
    amount: input.amount,
    currency: "ARS",
    deliveryStatus: "PENDING",
    payoutMethod: "OFF_PLATFORM",
    payoutStatus: "PENDING",
    fundedBy: "ORGANIZER",
    place: input.place,
  };
}

function parsePlace(prize: Record<string, unknown>): number | null {
  const label = String(prize.positionLabel ?? "").trim();
  const fromLabel = label.match(/^(\d+)/);
  if (fromLabel) return Number(fromLabel[1]);
  const name = String(prize.name ?? "").trim();
  const fromName = name.match(/(\d+)/);
  if (fromName) return Number(fromName[1]);
  const id = String(prize.id ?? "");
  const fromId = id.match(/-(1|2|3)$/);
  if (fromId) return Number(fromId[1]);
  return null;
}

function isCanonicalShape(prize: Record<string, unknown>, desired: SfefPrizeItem): boolean {
  return (
    prize.id === desired.id &&
    prize.name === desired.name &&
    prize.type === desired.type &&
    prize.shortDescription === desired.shortDescription &&
    prize.scope === desired.scope &&
    prize.categoryId === desired.categoryId &&
    prize.positionLabel === desired.positionLabel &&
    prize.winnersCount === desired.winnersCount &&
    prize.visiblePublic === desired.visiblePublic &&
    prize.isPrimary === desired.isPrimary &&
    prize.isMonetary === desired.isMonetary &&
    prize.amount === desired.amount &&
    prize.currency === desired.currency &&
    prize.deliveryStatus === desired.deliveryStatus &&
    prize.payoutMethod === desired.payoutMethod &&
    prize.payoutStatus === desired.payoutStatus &&
    prize.fundedBy === desired.fundedBy &&
    !prize.winnerLabel &&
    !prize.assignedAt &&
    !prize.deliveredAt
  );
}

export function resolveSfefCategories(categories: SfefCategoryRef[]): {
  ok: true;
  categories: Array<SfefCategoryRef & { slug: (typeof SFEF_CATEGORY_SPECS)[number]["slug"] }>;
} | {
  ok: false;
  missingSlugs: string[];
  found: SfefCategoryRef[];
} {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const missingSlugs: string[] = [];
  const resolved: Array<SfefCategoryRef & { slug: (typeof SFEF_CATEGORY_SPECS)[number]["slug"] }> = [];
  for (const spec of SFEF_CATEGORY_SPECS) {
    const found = bySlug.get(spec.slug);
    if (!found) {
      missingSlugs.push(spec.slug);
      continue;
    }
    resolved.push({ ...found, slug: spec.slug });
  }
  if (missingSlugs.length > 0) return { ok: false, missingSlugs, found: categories };
  return { ok: true, categories: resolved };
}

export function upsertSfefPrizes(input: {
  existingPrizes: unknown[];
  categories: Array<SfefCategoryRef & { slug: string }>;
  allowExtraPrizes?: boolean;
}): {
  prizes: SfefPrizeItem[];
  changes: PrizeChange[];
  extrasPreserved: Record<string, unknown>[];
  validation: {
    ok: boolean;
    totalPrizes: number;
    expectedTotal: number;
    perCategory: Array<{ categorySlug: string; count: number; sum: number }>;
    grandTotal: number;
    errors: string[];
  };
} {
  const existing = (Array.isArray(input.existingPrizes) ? input.existingPrizes : []).filter(
    (p): p is Record<string, unknown> => Boolean(p) && typeof p === "object" && !Array.isArray(p),
  );

  const desiredList = [] as Array<SfefPrizeItem & { place: number }>;
  for (const cat of input.categories) {
    for (const place of SFEF_PLACE_SPECS) {
      desiredList.push(
        buildDesiredPrize({
          categoryId: cat.id,
          categorySlug: cat.slug,
          place: place.place,
          amount: place.amount,
          positionLabel: place.positionLabel,
          name: place.name,
        }),
      );
    }
  }

  const categoryIdToSlug = new Map(input.categories.map((c) => [c.id, c.slug]));
  const usedExisting = new Set<number>();
  const changes: PrizeChange[] = [];
  const nextCanonical: SfefPrizeItem[] = [];

  for (const desiredWithPlace of desiredList) {
    const { place, ...desired } = desiredWithPlace;
    const categorySlug = categoryIdToSlug.get(desired.categoryId) ?? "unknown";
    let matchIndex = existing.findIndex((p, idx) => !usedExisting.has(idx) && p.id === desired.id);
    if (matchIndex < 0) {
      matchIndex = existing.findIndex((p, idx) => {
        if (usedExisting.has(idx)) return false;
        if (p.categoryId !== desired.categoryId) return false;
        return parsePlace(p) === place;
      });
    }
    if (matchIndex < 0) {
      // Fallback: same category + same monetary amount (legacy incomplete rows).
      matchIndex = existing.findIndex((p, idx) => {
        if (usedExisting.has(idx)) return false;
        return (
          p.categoryId === desired.categoryId &&
          p.isMonetary === true &&
          Number(p.amount) === desired.amount &&
          p.scope === "CATEGORY"
        );
      });
    }

    if (matchIndex < 0) {
      nextCanonical.push(desired);
      changes.push({
        action: "create",
        prizeId: desired.id,
        categorySlug,
        place,
        after: desired,
      });
      continue;
    }

    usedExisting.add(matchIndex);
    const before = existing[matchIndex]!;
    if (isCanonicalShape(before, desired)) {
      nextCanonical.push(desired);
      changes.push({
        action: "keep",
        prizeId: desired.id,
        categorySlug,
        place,
        before,
        after: desired,
      });
    } else {
      nextCanonical.push(desired);
      changes.push({
        action: "update",
        prizeId: desired.id,
        categorySlug,
        place,
        before,
        after: desired,
        reason: "shape_or_fields_mismatch",
      });
    }
  }

  const extrasPreserved: Record<string, unknown>[] = [];
  for (let i = 0; i < existing.length; i++) {
    if (usedExisting.has(i)) continue;
    const prize = existing[i]!;
    const catId = typeof prize.categoryId === "string" ? prize.categoryId : null;
    const place = parsePlace(prize);
    const isSfefSlot =
      catId != null &&
      categoryIdToSlug.has(catId) &&
      place != null &&
      place >= 1 &&
      place <= 3 &&
      (prize.scope === "CATEGORY" || prize.isMonetary === true);

    if (isSfefSlot) {
      changes.push({
        action: "remove_duplicate",
        prizeId: String(prize.id ?? `idx-${i}`),
        categorySlug: categoryIdToSlug.get(catId!) ?? "unknown",
        place,
        before: prize,
        reason: "duplicate_category_place_slot",
      });
      continue;
    }

    extrasPreserved.push(prize);
  }

  const prizes = [...nextCanonical, ...(extrasPreserved as unknown as SfefPrizeItem[])];
  const errors: string[] = [];
  const expectedTotal = desiredList.length;
  const perCategory = input.categories.map((cat) => {
    const catPrizes = nextCanonical.filter((p) => p.categoryId === cat.id);
    const sum = catPrizes.reduce((acc, p) => acc + p.amount, 0);
    if (catPrizes.length !== 3) {
      errors.push(`category ${cat.slug} has ${catPrizes.length} canonical prizes (expected 3)`);
    }
    const places = catPrizes.map((p) => Number(p.id.slice(-1))).sort();
    if (places.join(",") !== "1,2,3") {
      errors.push(`category ${cat.slug} places=${places.join(",")} (expected 1,2,3)`);
    }
    if (sum !== 1_200_000) {
      errors.push(`category ${cat.slug} sum=${sum} (expected 1200000)`);
    }
    return { categorySlug: cat.slug, count: catPrizes.length, sum };
  });

  const grandTotal = nextCanonical.reduce((acc, p) => acc + p.amount, 0);
  if (grandTotal !== 4_800_000) {
    errors.push(`grandTotal=${grandTotal} (expected 4800000)`);
  }
  if (nextCanonical.length !== expectedTotal) {
    errors.push(`canonicalCount=${nextCanonical.length} (expected ${expectedTotal})`);
  }
  if (!input.allowExtraPrizes && extrasPreserved.length > 0) {
    errors.push(`extraNonCanonicalPrizes=${extrasPreserved.length}`);
  }
  if (prizes.length !== expectedTotal && !input.allowExtraPrizes) {
    errors.push(`totalPrizes=${prizes.length} (expected ${expectedTotal})`);
  }

  // Ensure array order: category sort then place.
  nextCanonical.sort((a, b) => {
    const ca = input.categories.findIndex((c) => c.id === a.categoryId);
    const cb = input.categories.findIndex((c) => c.id === b.categoryId);
    if (ca !== cb) return ca - cb;
    return Number(a.id.slice(-1)) - Number(b.id.slice(-1));
  });

  const ordered =
    input.allowExtraPrizes && extrasPreserved.length > 0
      ? [...nextCanonical, ...(extrasPreserved as unknown as SfefPrizeItem[])]
      : nextCanonical;

  return {
    prizes: ordered,
    changes,
    extrasPreserved,
    validation: {
      ok: errors.length === 0,
      totalPrizes: ordered.length,
      expectedTotal,
      perCategory,
      grandTotal,
      errors,
    },
  };
}

export function mergePremiosRecompensas(
  rulesData: unknown,
  prizes: SfefPrizeItem[],
): Record<string, unknown> {
  const base =
    rulesData && typeof rulesData === "object" && !Array.isArray(rulesData)
      ? ({ ...(rulesData as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const prevModule =
    base.premiosRecompensas &&
    typeof base.premiosRecompensas === "object" &&
    !Array.isArray(base.premiosRecompensas)
      ? ({ ...(base.premiosRecompensas as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const prevEconomy =
    prevModule.economy && typeof prevModule.economy === "object" && !Array.isArray(prevModule.economy)
      ? (prevModule.economy as Record<string, unknown>)
      : {};

  return {
    ...base,
    premiosRecompensas: {
      ...prevModule,
      noPrizesExplicit: false,
      prizes,
      rewards: Array.isArray(prevModule.rewards) ? prevModule.rewards : [],
      economy: {
        ...prevEconomy,
        entryMode: "FREE",
        entryFeeCurrency: prevEconomy.entryFeeCurrency ?? "ARS",
        paidRegistrationsCount: Number(prevEconomy.paidRegistrationsCount ?? 0),
        gatewayFeePercent: Number(prevEconomy.gatewayFeePercent ?? 0),
        diplomasEnabled: Boolean(prevEconomy.diplomasEnabled),
        diplomaEmailsEnabled: Boolean(prevEconomy.diplomaEmailsEnabled),
        reviewedByOrganizer: Boolean(prevEconomy.reviewedByOrganizer),
        platformIntervenesMonetaryPrizes: false,
      },
    },
  };
}
