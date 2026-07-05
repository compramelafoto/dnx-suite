import { prisma } from "@/lib/prisma";

export type CommercialOfferSourceKind = "catalog" | "system_template" | "manual";

export type AlbumCommercialOffer = {
  catalogProductId?: number;
  sourceKind: CommercialOfferSourceKind;

  title: string;
  imageUrl?: string;

  preventa?: {
    enabled: boolean;
    packDefinitionId: number;
    pricePhotographerArs: number;
    availabilityPhase?: string | null;
  };

  galeria?: {
    enabled: boolean;
    albumPackId: string;
    pricePhotographerArs: number;
    availabilityPhase?: string | null;
  };
};

export type PackDefinitionCommercialInput = {
  id: number;
  name: string;
  isActive: boolean;
  priceClientArs: number;
  coverImageUrl?: string | null;
  availabilityPhase?: string | null;
  sourceCatalogProductId?: number | null;
};

export type AlbumPackCommercialInput = {
  id: string;
  name: string;
  isActive: boolean;
  price: number;
  availabilityPhase: string;
};

export type CatalogProductCommercialInput = {
  id: number;
  name: string;
  sourceTemplateId?: number | null;
  imageUrl?: string | null;
};

type OfferAccumulator = AlbumCommercialOffer & {
  matchNames: Set<string>;
};

function normalizeCommercialTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveSourceKind(
  catalogProductId: number | undefined,
  catalog?: CatalogProductCommercialInput | null
): CommercialOfferSourceKind {
  if (!catalogProductId) return "manual";
  if (catalog?.sourceTemplateId) return "system_template";
  return "catalog";
}

function resolveImageUrl(
  preventa?: Pick<PackDefinitionCommercialInput, "coverImageUrl">,
  catalog?: CatalogProductCommercialInput | null
): string | undefined {
  const cover = preventa?.coverImageUrl?.trim();
  if (cover) return cover;
  const catalogImg = catalog?.imageUrl?.trim();
  if (catalogImg) return catalogImg;
  return undefined;
}

function registerMatchNames(
  acc: OfferAccumulator,
  names: Array<string | null | undefined>
): void {
  for (const name of names) {
    if (!name?.trim()) continue;
    acc.matchNames.add(normalizeCommercialTitle(name));
  }
}

function findOfferForAlbumPack(
  offers: OfferAccumulator[],
  albumPack: AlbumPackCommercialInput,
  consumedAlbumPackIds: Set<string>
): OfferAccumulator | null {
  if (consumedAlbumPackIds.has(albumPack.id)) return null;
  const normalizedPackName = normalizeCommercialTitle(albumPack.name);

  for (const offer of offers) {
    if (offer.galeria) continue;
    if (offer.matchNames.has(normalizedPackName)) {
      return offer;
    }
  }
  return null;
}

/**
 * Adapter read-only: agrupa PackDefinition + AlbumPack en ofertas comerciales unificadas.
 * No escribe ni sincroniza datos.
 */
export function buildAlbumCommercialOffers(input: {
  packDefinitions: PackDefinitionCommercialInput[];
  albumPacks: AlbumPackCommercialInput[];
  catalogProducts: CatalogProductCommercialInput[];
}): AlbumCommercialOffer[] {
  const catalogById = new Map(
    input.catalogProducts.map((product) => [product.id, product] as const)
  );
  const offers: OfferAccumulator[] = [];
  const offerByKey = new Map<string, OfferAccumulator>();

  for (const pack of input.packDefinitions) {
    const catalogProductId = pack.sourceCatalogProductId ?? undefined;
    const catalog = catalogProductId ? catalogById.get(catalogProductId) : undefined;
    const key = catalogProductId
      ? `catalog:${catalogProductId}`
      : `preventa:${pack.id}`;

    let acc = offerByKey.get(key);
    if (!acc) {
      acc = {
        catalogProductId,
        sourceKind: resolveSourceKind(catalogProductId, catalog),
        title: catalog?.name?.trim() || pack.name.trim(),
        imageUrl: resolveImageUrl(pack, catalog),
        matchNames: new Set<string>(),
      };
      offerByKey.set(key, acc);
      offers.push(acc);
    }

    acc.preventa = {
      enabled: pack.isActive,
      packDefinitionId: pack.id,
      pricePhotographerArs: pack.priceClientArs,
      availabilityPhase: pack.availabilityPhase ?? null,
    };
    acc.imageUrl = acc.imageUrl ?? resolveImageUrl(pack, catalog);
    registerMatchNames(acc, [pack.name, catalog?.name]);
  }

  const consumedAlbumPackIds = new Set<string>();

  for (const albumPack of input.albumPacks) {
    const matched = findOfferForAlbumPack(offers, albumPack, consumedAlbumPackIds);
    if (matched) {
      matched.galeria = {
        enabled: albumPack.isActive,
        albumPackId: albumPack.id,
        pricePhotographerArs: albumPack.price,
        availabilityPhase: albumPack.availabilityPhase,
      };
      registerMatchNames(matched, [albumPack.name]);
      consumedAlbumPackIds.add(albumPack.id);
      continue;
    }

    const acc: OfferAccumulator = {
      sourceKind: "manual",
      title: albumPack.name.trim(),
      galeria: {
        enabled: albumPack.isActive,
        albumPackId: albumPack.id,
        pricePhotographerArs: albumPack.price,
        availabilityPhase: albumPack.availabilityPhase,
      },
      matchNames: new Set([normalizeCommercialTitle(albumPack.name)]),
    };
    offers.push(acc);
    offerByKey.set(`galeria:${albumPack.id}`, acc);
    consumedAlbumPackIds.add(albumPack.id);
  }

  return offers
    .map(({ matchNames: _matchNames, ...offer }) => offer)
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
}

export function commercialOfferSourceKindLabel(kind: CommercialOfferSourceKind): string {
  switch (kind) {
    case "catalog":
      return "Catálogo fotógrafo";
    case "system_template":
      return "Plantilla del sistema";
    case "manual":
      return "Manual (sin catálogo)";
    default:
      return kind;
  }
}

/** Carga datos del álbum y genera ofertas comerciales (solo lectura). */
export async function loadAlbumCommercialOffers(albumId: number): Promise<AlbumCommercialOffer[]> {
  const [packDefinitions, albumPacks] = await Promise.all([
    prisma.packDefinition.findMany({
      where: { albumId },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        priceClientArs: true,
        coverImageUrl: true,
        availabilityPhase: true,
        sourceCatalogProductId: true,
      },
    }),
    prisma.albumPack.findMany({
      where: { albumId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        price: true,
        availabilityPhase: true,
      },
    }),
  ]);

  const catalogProductIds = [
    ...new Set(
      packDefinitions
        .map((pack) => pack.sourceCatalogProductId)
        .filter((id): id is number => typeof id === "number")
    ),
  ];

  const catalogProducts =
    catalogProductIds.length === 0
      ? []
      : await prisma.catalogProduct.findMany({
          where: { id: { in: catalogProductIds } },
          select: {
            id: true,
            name: true,
            sourceTemplateId: true,
            images: {
              orderBy: { id: "asc" },
              take: 1,
              select: { publicUrl: true },
            },
          },
        });

  const catalogInputs: CatalogProductCommercialInput[] = catalogProducts.map((product) => ({
    id: product.id,
    name: product.name,
    sourceTemplateId: product.sourceTemplateId,
    imageUrl: product.images[0]?.publicUrl ?? null,
  }));

  return buildAlbumCommercialOffers({
    packDefinitions: packDefinitions.map((pack) => ({
      id: pack.id,
      name: pack.name,
      isActive: pack.isActive,
      priceClientArs: pack.priceClientArs,
      coverImageUrl: pack.coverImageUrl,
      availabilityPhase: pack.availabilityPhase,
      sourceCatalogProductId: pack.sourceCatalogProductId,
    })),
    albumPacks: albumPacks.map((pack) => ({
      id: pack.id,
      name: pack.name,
      isActive: pack.isActive,
      price: pack.price,
      availabilityPhase: pack.availabilityPhase,
    })),
    catalogProducts: catalogInputs,
  });
}
