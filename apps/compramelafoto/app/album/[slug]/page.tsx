/**
 * `/album/[slug]` — landing pública unificada del álbum.
 *
 * Este álbum funciona como landing dinámica: preventa o galería según estado
 * (fotos no removidas en DB + packs de preventa activos vía `listActivePacksForPublicCatalog`).
 * No redirigimos entre URLs para el visitante: el mismo slug renderiza el modo correcto.
 * La ruta legacy `/album/[slug]/preventa` se mantiene y redirige aquí conservando query params.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Prisma, Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import { canOpenAlbumGallery } from "@/lib/album-helpers";
import { HIDDEN_ALBUM_GRANT_COOKIE } from "@/lib/hidden-album-audit";
import { filterPublicAlbumPhotosForHiddenVisitor } from "@/lib/hidden-album/filter-public-album-photos";
import { evaluateAlbumSalesReadiness, isAlbumSinglesPurchaseReady } from "@/lib/albums/album-sales-readiness";
import { resolveAlbumExtensionSalesPricing } from "@/lib/pricing/album-extension-surcharge";
import { getAuthUser } from "@/lib/auth";
import { canPhotographerPreviewTestAlbum } from "@/lib/public-album-test-access";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { loadGalleryPricingSnapshot } from "@/lib/pricing/load-gallery-pricing-snapshot";
import { albumPackComponentsInclude } from "@/lib/album-packs/album-pack-components-persistence";
import { getPublicVisiblePacks } from "@/lib/album-packs/get-public-visible-packs";
import { collectAlbumPackPrintProductIds } from "@/lib/album-packs/public-pack";
import { isAlbumPackPaymentGloballyAllowedForAlbum } from "@/lib/album-packs/album-pack-feature-flags";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import ClientAlbumView from "@/components/photo/ClientAlbumView";
import PhotographerHeader from "@/components/photographer/PhotographerHeader";
import PhotographerFooter from "@/components/photographer/PhotographerFooter";
import PreventaPage from "@/app/album/[slug]/preventa/PreventaPage";
import AlbumNotifyForm from "./AlbumNotifyForm";
import {
  albumHasPublicReadyVideos,
  listPublicReadyVideosForAlbum,
} from "@/lib/videos/public-ready-videos";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import EventGalleryFolderChips from "@/app/g/[shareSlug]/EventGalleryFolderChips";
import {
  buildPreservedGalleryQueryString,
  resolvePublicGalleryFolderFilter,
  type PublicGalleryFolderFilter,
} from "@/lib/events/event-public-gallery-folder-filter";
import { EventFolderScope } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await Promise.resolve(params);
  if (!slug?.trim()) return {};
  const album = await prisma.album.findFirst({
    where: { publicSlug: slug.trim() },
    select: { title: true, user: { select: { name: true } } },
  });
  if (!album) return {};
  const title = album.title || "Álbum";
  const name = album.user?.name || "Fotógrafo";
  return {
    title: `${title} - ${name} | ComprameLaFoto`,
    description: `Ver y comprar fotos del álbum ${title}.`,
  };
}

const selectAlbumBase = {
  id: true,
  userId: true,
  title: true,
  location: true,
  eventDate: true,
  publicSlug: true,
  createdAt: true,
  deletedAt: true,
  firstPhotoDate: true,
  coverPhotoId: true,
  isHidden: true,
  isTest: true,
  isPublic: true,
  enablePrintedPhotos: true,
  enableDigitalPhotos: true,
  eventId: true,
  selectedLabId: true,
  albumProfitMarginPercent: true,
  pickupBy: true,
  digitalPhotoPriceCents: true,
  digitalDiscount5Plus: true,
  digitalDiscount10Plus: true,
  digitalDiscount20Plus: true,
  includeDigitalWithPrint: true,
  digitalWithPrintDiscountPercent: true,
  termsAcceptedAt: true,
  termsVersion: true,
  printPricingSource: true,
  showComingSoonMessage: true,
  hiddenPhotosEnabled: true,
  enableFaceBulkPurchase: true,
  faceBulkPriceCents: true,
  albumPackPayEnabled: true,
  packs: {
    select: {
      id: true,
      name: true,
      description: true,
      coverImageUrl: true,
      price: true,
      includedPhotoCount: true,
      requiresSelection: true,
      requiresDesign: true,
      templateId: true,
      packType: true,
      availabilityPhase: true,
      isActive: true,
      components: albumPackComponentsInclude,
    },
    orderBy: [{ createdAt: Prisma.SortOrder.desc }],
  },
  photos: {
    where: { isRemoved: false },
    select: {
      id: true,
      previewUrl: true,
      originalKey: true,
      createdAt: true,
      analysisStatus: true,
      userId: true,
      sellDigital: true,
      sellPrint: true,
      folderId: true,
      eventFolderId: true,
    },
    orderBy: { createdAt: Prisma.SortOrder.asc },
  },
  user: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      tertiaryColor: true,
      publicPageHandler: true,
      isPublicPageEnabled: true,
      defaultDigitalPhotoPrice: true,
    },
  },
} as Prisma.AlbumSelect;

const selectAlbumBaseWithExtension = {
  ...selectAlbumBase,
  expirationExtensionDays: true,
} as Prisma.AlbumSelect;

const selectForExtensionFallback = (err: any) => {
  const msg = String(err?.message ?? "");
  return msg.includes("expirationExtensionDays") || msg.includes("Unknown field");
};

/**
 * Cuando ya hay galería y el catálogo de preventa sigue activo: no bloqueamos la vista;
 * recordamos canje para quien ya compró. Compras nuevas siguen en la UI de galería (ClientAlbumView).
 */
function PreventaRedemptionBanner() {
  return (
    <section
      className="w-full bg-[#fffbf7] border-b border-[#c27b3d]/20"
      role="region"
      aria-label="Canje de preventa"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm sm:text-base font-semibold text-[#1a1a1a] leading-snug">
          ¿Compraste preventa? Ingresá para canjear tu pack
        </p>
        <Link
          href="/cliente/recuperar-pack"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b26f36] transition-colors"
        >
          Ingresar / recuperar acceso
        </Link>
      </div>
    </section>
  );
}

function ComingSoonEmptyState({ albumId }: { albumId: number }) {
  return (
    <section className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="ds-gallery-empty-state w-full">
        <div className="ds-gallery-empty-state__panel rounded-2xl border border-gray-200 bg-white p-8 md:p-12 shadow-sm">
          <div className="ds-gallery-empty-state__stack">
            <div className="ds-gallery-empty-state__icon flex flex-col items-center gap-3">
              <img src="/watermark.png" alt="ComprameLaFoto" className="w-16 sm:w-20 opacity-70" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#1a1a1a] m-0">
                Galería aún no disponible
              </h1>
            </div>
            <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--center text-base sm:text-lg text-[#6b7280] m-0 w-full">
              Las fotos se subirán pronto. Dejanos tus datos y te avisamos cuando estén listas.
            </p>
            <div className="ds-gallery-empty-state__actions">
              <AlbumNotifyForm albumId={albumId} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function AlbumPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await Promise.resolve(params);
  const resolvedSearchParams: Record<string, string | string[] | undefined> = searchParams
    ? await searchParams
    : {};
  const simulateClientView = resolvedSearchParams.vista === "cliente";
  if (!slug?.trim()) return notFound();

  let album: any = null;
  try {
    album = await prisma.album.findFirst({
      where: { publicSlug: slug.trim() },
      select: selectAlbumBaseWithExtension,
    });
  } catch (err: any) {
    if (selectForExtensionFallback(err)) {
      album = await prisma.album.findFirst({
        where: { publicSlug: slug.trim() },
        select: selectAlbumBase,
      });
    } else {
      throw err;
    }
  }

  if (!album) return notFound();
  if (album.deletedAt) return notFound();

  const authUser = await getAuthUser();
  const testGate = await canPhotographerPreviewTestAlbum(
    { isTest: Boolean((album as { isTest?: boolean }).isTest), userId: album.userId },
    authUser
  );
  if (!testGate.allowed) {
    return (
      <section className="py-16 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center w-full px-4 sm:px-6 max-w-lg">
          <img src="/watermark.png" alt="ComprameLaFoto" className="w-28 mx-auto opacity-70 mb-6" />
          <h2 className="text-xl font-semibold text-[#1a1a1a] mb-2">Modo prueba</h2>
          <p className="text-base text-[#6b7280] leading-relaxed">
            Este álbum está en modo prueba. No está disponible para visitantes.
          </p>
        </div>
      </section>
    );
  }

  // Fotos publicadas en DB (no removidas) — mismo criterio que usa el listado en galería.
  const hasPhotos = album.photos.length > 0;
  // AlbumPack legacy (galería / selección): filtra por fase ALWAYS | PRE_UPLOAD | POST_UPLOAD.
  const albumPackRows = Array.isArray(album.packs) ? album.packs : [];
  const printProductIds = collectAlbumPackPrintProductIds(albumPackRows);
  const printProductsForPacks =
    printProductIds.length > 0
      ? await prisma.photographerProduct.findMany({
          where: { id: { in: printProductIds } },
          select: {
            id: true,
            name: true,
            size: true,
            acabado: true,
            isActive: true,
          },
        })
      : [];
  const printProductsById = new Map(
    printProductsForPacks.map((product) => [product.id, product])
  );
  const publicVisiblePacks = getPublicVisiblePacks({
    packs: albumPackRows,
    hasPublishedPhotos: hasPhotos,
    printProductsById,
  });
  const now = new Date();
  // PackDefinition preventa/canjeable: activos + ventana validFrom/validUntil + fase según `hasPhotos`.
  const activePacks = await listActivePacksForPublicCatalog(album.id, now, {
    hasPhotos,
  });
  const hasActivePreventaCatalogPacks = activePacks.length > 0;
  const publicVideosEnabled = isVideoMvpEnabled();
  const hasPublicReadyVideos = publicVideosEnabled
    ? await albumHasPublicReadyVideos(prisma, album.id)
    : false;

  // A) Sin fotos + preventa en catálogo → UI de compra preventa (cliente vive en esta URL).
  if (!hasPhotos && hasActivePreventaCatalogPacks) {
    return <PreventaPage testClientPreview={testGate.isTestPreview} />;
  }

  // Sin fotos, sin preventa y sin videos públicos → aviso “pronto”.
  if (!hasPhotos && !hasActivePreventaCatalogPacks && !hasPublicReadyVideos) {
    return <ComingSoonEmptyState albumId={album.id} />;
  }

  const isOwner = authUser?.id === album.userId;
  const isAdmin = authUser?.role === Role.ADMIN;
  const hasAccess = authUser
    ? await prisma.albumAccess.findUnique({
        where: { albumId_userId: { albumId: album.id, userId: authUser.id } },
      })
    : null;
  const canAccess = canOpenAlbumGallery(album, {
    isOwner,
    isAdmin,
    hasAlbumAccess: Boolean(hasAccess),
  });

  if (!canAccess) {
    return (
      <section className="py-16 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center w-full px-4 sm:px-6">
          <div className="mx-auto flex flex-col items-center space-y-6 max-w-6xl">
            <img src="/watermark.png" alt="ComprameLaFoto" className="w-28 mx-auto opacity-70" />
            <h2 className="text-2xl font-semibold text-[#1a1a1a]">No tenés autorización</h2>
            <p className="text-base text-[#6b7280] leading-relaxed">
              Este álbum no está disponible públicamente. Si te invitaron al evento, pedile al organizador o fotógrafo
              que te autorice el acceso.
            </p>
            <p className="text-xs text-[#9ca3af]">ID del álbum: {album.publicSlug || album.id}</p>
          </div>
        </div>
      </section>
    );
  }

  let photographer: any = null;
  if (album.user && album.user.isPublicPageEnabled && album.user.publicPageHandler) {
    photographer = {
      id: album.user.id,
      name: album.user.name,
      logoUrl: album.user.logoUrl,
      secondaryColor: album.user.secondaryColor,
      tertiaryColor: album.user.tertiaryColor,
      publicPageHandler: album.user.publicPageHandler,
    };
  }

  let firstPhotoDate: string | null = null;
  if (album.firstPhotoDate) {
    firstPhotoDate = album.firstPhotoDate.toISOString();
  } else if (album.photos.length > 0 && album.photos[0]?.createdAt) {
    firstPhotoDate = album.photos[0].createdAt.toISOString();
  }

  const baseDate = firstPhotoDate ? new Date(firstPhotoDate) : null;
  const extensionDays = (album as any).expirationExtensionDays ?? 0;
  const visibleUntil = baseDate
    ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000)
    : null;
  const isExpired = visibleUntil ? new Date() >= visibleUntil : false;
  const isAccessBlocked = !isAdmin && Boolean(album.isHidden || isExpired);

  const coverPhotoId = (album as { coverPhotoId?: number | null }).coverPhotoId ?? null;

  const albumEventId =
    typeof (album as { eventId?: number | null }).eventId === "number" &&
    Number.isFinite((album as { eventId?: number | null }).eventId) &&
    ((album as { eventId?: number | null }).eventId ?? 0) > 0
      ? ((album as { eventId?: number | null }).eventId as number)
      : null;

  let activeFolders: Array<{ id: number; name: string; slug: string | null }> = [];
  if (albumEventId != null) {
    activeFolders = await prisma.eventFolder.findMany({
      where: {
        eventId: albumEventId,
        isActive: true,
        OR: [
          { folderScope: EventFolderScope.ORGANIZER },
          { folderScope: EventFolderScope.PHOTOGRAPHER, listedInPublicGallery: true },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, slug: true },
    });
  } else {
    activeFolders = await prisma.albumFolder.findMany({
      where: { albumId: album.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }).then((rows) => rows.map((r) => ({ ...r, slug: null })));
  }

  const folderIdRaw = Array.isArray(resolvedSearchParams.folderId)
    ? resolvedSearchParams.folderId[0]
    : resolvedSearchParams.folderId;
  const folderSlugRaw = Array.isArray(resolvedSearchParams.folder) ? resolvedSearchParams.folder[0] : resolvedSearchParams.folder;
  const preservedQs = buildPreservedGalleryQueryString(resolvedSearchParams);
  const folderFilter: PublicGalleryFolderFilter =
    activeFolders.length > 0
      ? resolvePublicGalleryFolderFilter({
          folderIdRaw,
          folderSlugRaw,
          activeFolders,
        })
      : { kind: "all" };

  let galleryPhotos = album.photos as Array<{
    id: number;
    previewUrl: string;
    originalKey: string;
    createdAt: Date;
    folderId?: number | null;
    eventFolderId?: number | null;
  }>;

  if (activeFolders.length > 0) {
    if (folderFilter.kind === "folder") {
      galleryPhotos = galleryPhotos.filter((p) =>
        albumEventId != null
          ? p.eventFolderId === folderFilter.id
          : p.folderId === folderFilter.id
      );
    } else if (folderFilter.kind === "uncategorized") {
      galleryPhotos = galleryPhotos.filter((p) =>
        albumEventId != null ? p.eventFolderId == null : p.folderId == null
      );
    }
  }

  const showUncategorizedChip =
    activeFolders.length > 0 &&
    (album.photos as Array<{ folderId?: number | null; eventFolderId?: number | null }>).some((p) =>
      albumEventId != null ? p.eventFolderId == null : p.folderId == null
    );

  const galleryBasePath = `/album/${album.publicSlug ?? slug}`;

  const mappedPhotos: Array<{ id: number; previewUrl: string; originalKey: string }> = galleryPhotos.map(
    (p: { id: number; originalKey: string }) => ({
      id: p.id,
      previewUrl: `/api/photos/${p.id}/view?albumId=${album.id}&mode=thumb`,
      originalKey: p.originalKey,
    })
  );
  const signedPhotos = mappedPhotos.filter((p: { previewUrl: string }) => Boolean(p.previewUrl));
  const hiddenPhotosEnabled = Boolean((album as { hiddenPhotosEnabled?: boolean }).hiddenPhotosEnabled);
  const photographerBypassGrant = isOwner || isAdmin || Boolean(hasAccess);
  const grantCookie = (await cookies()).get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
  const hiddenVisitorPhotos = await filterPublicAlbumPhotosForHiddenVisitor(
    album.id,
    hiddenPhotosEnabled,
    signedPhotos.filter((p) => p.previewUrl),
    { photographerBypassGrant, simulateClientView, grantCookieValue: grantCookie }
  );
  const initialHasGrant = hiddenVisitorPhotos.initialHasGrant;
  const photosForClient = hiddenVisitorPhotos.photos;
  const selectedLabIdAlbum = (album as { selectedLabId?: number | null }).selectedLabId ?? null;
  const checkoutDigitalFeePercent = await resolveAlbumOrderDigitalMarketplaceFeePercent({
    photographerId: album.userId ?? null,
    labId: selectedLabIdAlbum,
  });
  const albumSalesReadinessInput = {
    enableDigitalPhotos: (album as { enableDigitalPhotos?: boolean }).enableDigitalPhotos,
    enablePrintedPhotos: (album as { enablePrintedPhotos?: boolean }).enablePrintedPhotos,
    digitalPhotoPriceCents: (album as { digitalPhotoPriceCents?: number | null }).digitalPhotoPriceCents ?? null,
    albumProfitMarginPercent: (album as { albumProfitMarginPercent?: number | null }).albumProfitMarginPercent ?? null,
    selectedLabId: (album as { selectedLabId?: number | null }).selectedLabId ?? null,
    pickupBy: (album as { pickupBy?: string | null }).pickupBy ?? null,
    printPricingSource: (album as { printPricingSource?: string | null }).printPricingSource ?? null,
    termsAcceptedAt: (album as { termsAcceptedAt?: Date | null }).termsAcceptedAt ?? null,
    termsVersion: (album as { termsVersion?: string | null }).termsVersion ?? null,
  };
  const albumSalesReadiness = evaluateAlbumSalesReadiness(albumSalesReadinessInput);
  const singlesPurchaseReady = isAlbumSinglesPurchaseReady(albumSalesReadinessInput);
  const extensionSalesPricing = await resolveAlbumExtensionSalesPricing({
    album: {
      userId: album.userId,
      firstPhotoDate: album.firstPhotoDate,
      createdAt: album.createdAt,
      expirationExtensionDays: (album as { expirationExtensionDays?: number | null }).expirationExtensionDays ?? 0,
    },
    clientSubtotalArs: 0,
    prismaClient: prisma,
  });
  const galleryPricing = await loadGalleryPricingSnapshot(
    prisma,
    {
      userId: album.userId,
      eventId: (album as { eventId?: number | null }).eventId ?? null,
      enableDigitalPhotos: (album as { enableDigitalPhotos?: boolean }).enableDigitalPhotos ?? true,
      enablePrintedPhotos: (album as { enablePrintedPhotos?: boolean }).enablePrintedPhotos ?? true,
      digitalPhotoPriceCents: (album as { digitalPhotoPriceCents?: number | null }).digitalPhotoPriceCents ?? null,
      albumProfitMarginPercent: (album as { albumProfitMarginPercent?: number | null }).albumProfitMarginPercent ?? null,
      selectedLabId: (album as { selectedLabId?: number | null }).selectedLabId ?? null,
      pickupBy: (album as { pickupBy?: string | null }).pickupBy ?? null,
      printPricingSource: (album as { printPricingSource?: string | null }).printPricingSource ?? null,
      termsAcceptedAt: (album as { termsAcceptedAt?: Date | null }).termsAcceptedAt ?? null,
      termsVersion: (album as { termsVersion?: string | null }).termsVersion ?? null,
      digitalDiscount5Plus: (album as { digitalDiscount5Plus?: number | null }).digitalDiscount5Plus ?? null,
      digitalDiscount10Plus: (album as { digitalDiscount10Plus?: number | null }).digitalDiscount10Plus ?? null,
      digitalDiscount20Plus: (album as { digitalDiscount20Plus?: number | null }).digitalDiscount20Plus ?? null,
      includeDigitalWithPrint: (album as { includeDigitalWithPrint?: boolean | null }).includeDigitalWithPrint ?? null,
      digitalWithPrintDiscountPercent:
        (album as { digitalWithPrintDiscountPercent?: number | null }).digitalWithPrintDiscountPercent ?? null,
      photos: album.photos.map((p: { id: number; userId?: number | null; sellDigital?: boolean; sellPrint?: boolean }) => ({
        id: p.id,
        userId: p.userId ?? null,
        sellDigital: p.sellDigital,
        sellPrint: p.sellPrint,
      })),
      user: album.user
        ? { defaultDigitalPhotoPrice: (album.user as { defaultDigitalPhotoPrice?: number | null }).defaultDigitalPhotoPrice ?? null }
        : null,
    },
    checkoutDigitalFeePercent
  );
  const albumPackPayButtonEnabled = isAlbumPackPaymentGloballyAllowedForAlbum(album.albumPackPayEnabled);

  const applyVideoExpiresFilter = !(isOwner || isAdmin || Boolean(hasAccess));
  const initialPublicVideos = publicVideosEnabled
    ? (
        await listPublicReadyVideosForAlbum(prisma, album.id, {
          applyExpiresFilter: applyVideoExpiresFilter,
        })
      ).videos
    : [];

  // B) Con fotos y/o videos READY: galería pública tras `canAccess`.
  return (
    <>
      {photographer ? (
        <PhotographerHeader photographer={photographer} handler={photographer.publicPageHandler} />
      ) : null}
      {/* C) Galería + preventa activa en catálogo → banner de canje (galería sigue visible). */}
      {hasActivePreventaCatalogPacks ? <PreventaRedemptionBanner /> : null}
      <ProtectedAlbumWrapper enableProtection={hasPhotos && !isAccessBlocked} albumId={album.id}>
        {activeFolders.length > 0 && hasPhotos && !isAccessBlocked ? (
          <EventGalleryFolderChips
            basePath={galleryBasePath}
            folders={activeFolders}
            showUncategorizedChip={showUncategorizedChip}
            preservedSearchString={preservedQs}
            activeFilter={folderFilter}
          />
        ) : null}
        <Suspense
          fallback={
            <div className="p-8 text-center text-[#6b7280]" style={{ padding: 24 }}>
              Cargando álbum…
            </div>
          }
        >
          <ClientAlbumView
            testClientPreview={testGate.isTestPreview}
            salesReadyToSell={albumSalesReadiness.readyToSell}
            singlesPurchaseReady={singlesPurchaseReady}
            extensionSalesPricing={{
              active: extensionSalesPricing.active,
              extensionDays: extensionSalesPricing.extensionDays,
              surchargePercentForDisplay: extensionSalesPricing.surchargePercentForDisplay,
              fixedPricePer30DaysArs: extensionSalesPricing.fixedPricePer30DaysArs,
            }}
            galleryPricing={galleryPricing}
            enablePrintedPhotos={(album as { enablePrintedPhotos?: boolean }).enablePrintedPhotos !== false}
            publicSlug={album.publicSlug ?? slug}
            hasPublicReadyVideos={hasPublicReadyVideos}
            publicVideosEnabled={publicVideosEnabled}
            initialPublicVideos={initialPublicVideos}
            album={{
              id: album.id,
              title: album.title,
              location: album.location,
              eventDate: album.eventDate ? album.eventDate.toISOString() : null,
              createdAt: album.createdAt.toISOString(),
              firstPhotoDate,
              coverPhotoId,
              expirationExtensionDays: (album as any).expirationExtensionDays ?? 0,
              showComingSoonMessage: album.showComingSoonMessage,
              hiddenPhotosEnabled,
              enableFaceBulkPurchase: Boolean((album as any).enableFaceBulkPurchase),
              faceBulkPriceCents:
                typeof (album as any).faceBulkPriceCents === "number"
                  ? (album as any).faceBulkPriceCents
                  : null,
              digitalPhotoPriceCents:
                typeof (album as any).digitalPhotoPriceCents === "number"
                  ? (album as any).digitalPhotoPriceCents
                  : null,
              checkoutDigitalFeePercent,
              publicVisiblePacks,
              photos: photosForClient,
            }}
            tertiaryColor={photographer?.tertiaryColor}
            isAccessBlocked={isAccessBlocked}
            initialHasGrant={initialHasGrant}
            simulateClientView={simulateClientView}
            photographerBypassGrant={photographerBypassGrant}
            albumPackPayButtonEnabled={albumPackPayButtonEnabled}
          />
        </Suspense>
      </ProtectedAlbumWrapper>
      {photographer ? <PhotographerFooter photographer={photographer} /> : null}
    </>
  );
}
