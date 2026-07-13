import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { EventFolderScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import {
  buildEventGalleryPhotoGridItem,
  filterEventGalleryPublicPhotos,
} from "@/lib/events/event-gallery-public-photos";
import Link from "next/link";
import EventGalleryGrid from "../EventGalleryGrid";
import EventGalleryEmptyState from "@/components/events/EventGalleryEmptyState";
import EventGalleryFolderChips from "../EventGalleryFolderChips";
import EventGallerySearchSection from "../EventGallerySearchSection";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import {
  buildPreservedGalleryQueryString,
  resolvePublicGalleryFolderFilter,
  type PublicGalleryFolderFilter,
} from "@/lib/events/event-public-gallery-folder-filter";
import { resolveEventGalleryPublicState } from "@/lib/events/resolve-event-gallery-public-state";
import PublicEventMediaTabs from "@/components/public/video/PublicEventMediaTabs";
import GalleryMediaTypeBadges from "@/components/gallery/GalleryMediaTypeBadges";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { listPublicReadyVideosForEvent } from "@/lib/videos/public-event-videos";
import { resolveEventPublicVideoAccessContext } from "@/lib/videos/public-event-video-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function EventGalleryPublicBetaPage({
  params,
  searchParams,
}: {
  params: { shareSlug: string } | Promise<{ shareSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { shareSlug } = await Promise.resolve(params);
  if (!shareSlug) return notFound();

  const rawSearch = searchParams ? await searchParams : {};

  const event = await prisma.event.findUnique({
    where: { shareSlug },
    select: { id: true, creatorId: true, title: true, city: true, coverImageKey: true },
  });
  if (!event) return notFound();

  const activeFolders = await prisma.eventFolder.findMany({
    where: {
      eventId: event.id,
      isActive: true,
      OR: [
        { folderScope: EventFolderScope.ORGANIZER },
        { folderScope: EventFolderScope.PHOTOGRAPHER, listedInPublicGallery: true },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, slug: true },
  });

  const folderIdRaw = Array.isArray(rawSearch.folderId)
    ? rawSearch.folderId[0]
    : rawSearch.folderId;
  const folderSlugRaw = Array.isArray(rawSearch.folder) ? rawSearch.folder[0] : rawSearch.folder;

  const photos = await prisma.photo.findMany({
    where: {
      album: {
        eventId: event.id,
        isHidden: false,
        deletedAt: null,
      },
      isRemoved: false,
    },
    select: {
      id: true,
      previewUrl: true,
      albumId: true,
      eventFolderId: true,
      album: {
        select: {
          publicSlug: true,
          isPublic: true,
          isHidden: true,
          enablePrintedPhotos: true,
          enableDigitalPhotos: true,
          selectedLabId: true,
          albumProfitMarginPercent: true,
          pickupBy: true,
          digitalPhotoPriceCents: true,
          termsAcceptedAt: true,
          termsVersion: true,
        },
      },
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ capturedAt: "asc" }, { createdAt: "asc" }],
  });

  const availablePhotos = filterEventGalleryPublicPhotos(photos);

  const galleryPublicState = await resolveEventGalleryPublicState({
    eventId: event.id,
    availablePhotosCount: availablePhotos.length,
  });

  const preservedQs = buildPreservedGalleryQueryString(rawSearch);
  const folderFilter: PublicGalleryFolderFilter =
    activeFolders.length > 0
      ? resolvePublicGalleryFolderFilter({
          folderIdRaw,
          folderSlugRaw,
          activeFolders,
        })
      : { kind: "all" };

  let displayedPhotos = availablePhotos;
  if (activeFolders.length > 0) {
    if (folderFilter.kind === "folder") {
      displayedPhotos = availablePhotos.filter((p) => p.eventFolderId === folderFilter.id);
    } else if (folderFilter.kind === "uncategorized") {
      displayedPhotos = availablePhotos.filter((p) => p.eventFolderId == null);
    }
  }

  const showUncategorizedChip =
    activeFolders.length > 0 &&
    availablePhotos.some((p) => p.eventFolderId == null);

  const galleryBasePath = `/g/${shareSlug}/beta`;

  const coverUrl = event.coverImageKey ? getR2PublicUrl(event.coverImageKey) : null;
  const publicVideosEnabled = isVideoMvpEnabled();
  const eventVideoAccess = await resolveEventPublicVideoAccessContext(event);
  const initialPublicVideos = publicVideosEnabled
    ? (
        await listPublicReadyVideosForEvent(prisma, event.id, {
          applyExpiresFilter: eventVideoAccess.applyExpiresFilter,
        })
      ).videos
    : [];
  const hasPublicVideos = initialPublicVideos.length > 0;

  const photosGalleryContent =
    galleryPublicState.state === "AVAILABLE" ? (
      <>
        <EventGallerySearchSection eventId={event.id} />
        {activeFolders.length > 0 ? (
          <EventGalleryFolderChips
            basePath={galleryBasePath}
            folders={activeFolders}
            showUncategorizedChip={showUncategorizedChip}
            preservedSearchString={preservedQs}
            activeFilter={folderFilter}
          />
        ) : null}
        <EventGalleryGrid
          photos={displayedPhotos
            .map((photo) =>
              buildEventGalleryPhotoGridItem({
                id: photo.id,
                albumId: photo.albumId,
                photographerId: photo.uploadedBy?.id ?? null,
                photographerName: photo.uploadedBy?.name ?? null,
                mode: "thumb",
              })
            )
            .filter((photo) => photo.src)}
        />
      </>
    ) : hasPublicVideos ? null : (
      <EventGalleryEmptyState
        state={galleryPublicState.state}
        shareSlug={shareSlug}
        reactivatableCount={galleryPublicState.reactivatableAlbums.length}
      />
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {coverUrl && (
        <div className="relative w-full aspect-[2/1] max-h-[40vh] bg-gray-200">
          <img src={coverUrl} alt="" className="w-full h-full object-cover object-center" />
          <GalleryMediaTypeBadges
            hasPhotos={displayedPhotos.length > 0}
            hasVideos={hasPublicVideos}
            className="bottom-3 right-3 sm:bottom-4 sm:right-4"
          />
        </div>
      )}
      <header className="bg-white border-b border-gray-200">
        <div className="w-full max-w-4xl mx-auto px-4 py-4 flex items-center justify-between min-w-0">
          <Link href={`/e/${shareSlug}`} className="text-gray-600 hover:text-gray-900 text-sm truncate min-w-0">
            ← Volver al evento
          </Link>
          <span className="text-sm text-gray-500 flex-shrink-0">compramelafoto</span>
        </div>
      </header>

      <main className="w-full max-w-none mx-auto px-4 md:px-6 lg:px-8 py-8 min-w-0 box-border">
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-sm font-semibold text-amber-900">Vista beta de compra colaborativa</p>
          <p className="text-xs sm:text-sm text-amber-800">
            Esta versión está en prueba y puede cambiar sin aviso.
          </p>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 break-words">
          Galería del evento
        </h1>
        <p className="text-sm text-gray-500 mb-6 break-words">
          {event.title}
          {event.city ? ` · ${event.city}` : ""}
        </p>
        <ProtectedAlbumWrapper enableProtection={availablePhotos.length > 0}>
          <PublicEventMediaTabs
            shareSlug={shareSlug}
            publicVideosEnabled={publicVideosEnabled}
            initialPublicVideos={initialPublicVideos}
            photoCount={displayedPhotos.length}
            photosContent={photosGalleryContent}
          />
        </ProtectedAlbumWrapper>
      </main>
    </div>
  );
}
