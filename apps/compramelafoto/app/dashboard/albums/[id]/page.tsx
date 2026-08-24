"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  Suspense,
  startTransition,
  type MutableRefObject,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useUploadProgress } from "@/contexts/UploadProgressContext";
import Cropper, { Area, Point } from "react-easy-crop";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import PreventaPackDashboardSection from "@/components/dashboard/preventa-packs/PreventaPackDashboardSection";
import AlbumUpsellConfigCard from "@/components/dashboard/preventa-packs/AlbumUpsellConfigCard";
import AlbumStudentRosterSection from "@/components/dashboard/album-school/AlbumStudentRosterSection";
import AlbumSchoolOperationsSection from "@/components/dashboard/album-school/AlbumSchoolOperationsSection";
import AlbumPacksSection from "@/components/dashboard/album-packs/AlbumPacksSection";
import AlbumVideosSection from "@/components/dashboard/album-videos/AlbumVideosSection";
import AlbumResumenSection from "@/components/dashboard/albums/AlbumResumenSection";
import AlbumSharePanel from "@/components/dashboard/albums/AlbumSharePanel";
import AlbumPublicationSection from "@/components/dashboard/albums/AlbumPublicationSection";
import AlbumConfigurationSection from "@/components/dashboard/albums/AlbumConfigurationSection";
import AlbumEventScheduleFields, {
  EMPTY_ALBUM_EVENT_SCHEDULE,
  albumEventScheduleToApiPayload,
  displayLabelForAlbumEventSchedule,
  hydrateAlbumEventScheduleFromApi,
  type AlbumEventScheduleApiShape,
  type AlbumEventScheduleValue,
} from "@/components/dashboard/albums/AlbumEventScheduleFields";
import AlbumSchoolCommissionSection from "@/components/dashboard/albums/AlbumSchoolCommissionSection";
import AlbumWorkspaceNav from "@/components/dashboard/albums/AlbumWorkspaceNav";
import AlbumVentasForm from "@/components/dashboard/albums/AlbumVentasForm";
import AlbumSalesStatusBadge from "@/components/dashboard/albums/AlbumSalesStatusBadge";
import { evaluateAlbumShareEligibility } from "@/lib/albums/album-share-eligibility";
import type { AlbumSalesReadinessInput } from "@/lib/albums/album-sales-readiness";
import AlbumPhotosFolderExplorer, {
  type AlbumCoverCropPhoto,
  type AlbumPhotoSelectItem,
} from "@/components/dashboard/albums/AlbumPhotosFolderExplorer";
import type { AlbumUploadSelection } from "@/components/dashboard/albums/AlbumUploadZone";
import { fileWebkitRelativePath } from "@/lib/albums/parse-upload-relative-path";
import {
  runAlbumPhotoUploadQueue,
  type AlbumPhotoUploadPhase,
} from "@/lib/albums/run-album-photo-upload-queue";
import type { AlbumPhotoUploadOutcome } from "@/lib/albums/album-photo-upload-outcome";
import { isAsyncAlbumPhotoIngestEnabledClient } from "@/lib/albums/album-photo-ingest-feature-flag";
import {
  getAlbumPhotoUploadConcurrency,
  isLikelyMobileUploadDevice,
  logAlbumPhotoUploadIssue,
  resolveAlbumPhotoContentType,
} from "@/lib/albums/album-photo-content-type";
import { prepareMobileUploadFileForQueue } from "@/lib/albums/prepare-mobile-album-photo-upload";
import type { AlbumPricingSnapshot } from "@/components/dashboard/albums/AlbumPricingSection";
import {
  type AlbumDashboardLegacyTabId,
  ALBUM_DASHBOARD_DEFAULT_TAB,
  ALBUM_PUBLICATION_DEFAULT_PANEL,
  type AlbumPublicationPanelId,
  type ParseLegacyAlbumTabOptions,
  albumExtrasTabLabel,
  albumGalleryTabLabel,
  albumPreventaTabLabel,
  albumSalesTypesTabLabel,
  albumSchoolCommissionTabLabel,
} from "@/lib/albums/album-dashboard-nav";
import {
  buildAlbumDashboardTabHref,
  normalizeAlbumDashboardTab,
  albumDashboardLocationHref,
  albumDashboardTabUrlNeedsReplace,
  resolveAlbumPublicationPanel,
  logAlbumTabSync,
} from "@/lib/albums/album-dashboard-url";
import { DsDashboardInner, DsInfoPanel } from "@/components/ui/DsLayout";
import type { AlbumSalesFormState } from "@/lib/albums/album-sales-form-state";
import AlbumCommercialOffersView from "@/components/dashboard/commercial/AlbumCommercialOffersView";
import { isAlbumCommercialUnifiedUiEnabledClient } from "@/lib/commercial/album-commercial-unified-ui-feature-flag";
import { isVideoMvpEnabledClient } from "@/lib/videos/video-feature-flag";
import type { AlbumPhotoStats } from "@/lib/albums/album-photo-stats";

function buildOriginalUrl(originalKey?: string | null): string {
  if (!originalKey) return "";
  if (originalKey.startsWith("http://") || originalKey.startsWith("https://")) {
    return originalKey;
  }
  const publicBase =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    "";
  if (!publicBase) return originalKey;
  const cleanKey = originalKey.replace(/^\//, "");
  return `${publicBase.replace(/\/$/, "")}/${cleanKey}`;
}

type Album = {
  id: number;
  userId?: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  eventSchedule?: AlbumEventScheduleApiShape | null;
  eventId?: number | null;
  eventShareSlug?: string | null;
  eventCollaborativePhotoPricing?: {
    photoPricingMode: string;
    fixedPhotoPrice: number | null;
    minimumPhotoPrice: number | null;
    locksPhotographerDigitalPricing: boolean;
  } | null;
  publicSlug: string;
  coverPhotoId: number | null;
  createdAt: string;
  expirationExtensionDays?: number | null;
  isOwner?: boolean;
  digitalPhotoPriceCents?: number | null;
  photographerHandler?: string | null;
  hiddenPhotosEnabled?: boolean;
  hiddenSelfieRetentionDays?: number | null;
  showComingSoonMessage?: boolean;
  scanProtectionEnabled?: boolean;
  preCompraCloseAt?: string | null;
  requireClientApproval?: boolean;
  schoolId?: number | null;
  studentIdentificationMode?: string | null;
  allowManualStudentFallback?: boolean;
  organizerCommissionEnabled?: boolean;
  organizerCommissionPercentage?: number | null;
  organizerCommissionAppliesTo?: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS">;
  mode?: "SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE";
  /** Carpetas del evento mostradas/asignación (oficiales + propias del fotógrafo cuando aplica). */
  eventFolders?: Array<{
    id: number;
    name: string;
    parentId?: number | null;
    folderScope?: string;
    sortOrder?: number;
    listedInPublicGallery?: boolean;
    isMine?: boolean;
    photoCount?: number;
  }>;
  albumFolders?: Array<{
    id: number;
    name: string;
    parentId: number | null;
    path: string;
    sortOrder: number;
    _count?: { photos: number; children: number };
  }>;
  /** Modo prueba: no visible públicamente para clientes (salvo preview del dueño) */
  isTest?: boolean;
  isPublic?: boolean;
  isHidden?: boolean;
  /** Con flag global (`ALBUM_PACK_PUBLIC_PAY_ENABLED`), permite el botón de pago de packs en público */
  albumPackPayEnabled?: boolean;
  printPricingSource?: "PHOTOGRAPHER" | "LAB_PREFERRED" | null;
  albumProfitMarginPercent?: number | null;
  selectedLabId?: number | null;
  pickupBy?: "CLIENT" | "PHOTOGRAPHER" | null;
  selectedLab?: {
    id: number;
    name: string;
    city?: string | null;
    province?: string | null;
  } | null;
  digitalDiscount5Plus?: number | null;
  digitalDiscount10Plus?: number | null;
  digitalDiscount20Plus?: number | null;
  includeDigitalWithPrint?: boolean;
  digitalWithPrintDiscountPercent?: number | null;
  enablePrintedPhotos?: boolean;
  enableDigitalPhotos?: boolean;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
  photoStats: AlbumPhotoStats;
};

const EMPTY_ALBUM_PHOTO_STATS: AlbumPhotoStats = {
  total: 0,
  uncategorized: 0,
  earliestCreatedAt: null,
  myPhotosCount: 0,
  hasOtherContributors: false,
};

function albumPhotoStatsFromAlbum(
  album: Pick<Album, "photoStats"> | null | undefined
): AlbumPhotoStats {
  if (album?.photoStats && typeof album.photoStats.total === "number") {
    return album.photoStats;
  }
  return EMPTY_ALBUM_PHOTO_STATS;
}

/** Álbum escolar: solo si hay FK válida a School (evita tabs/secciones con schoolId nulo o inválido). */
function albumIsLinkedToSchool(schoolId: number | null | undefined): boolean {
  return typeof schoolId === "number" && Number.isFinite(schoolId) && schoolId > 0;
}

type AlbumDashboardConfigTabId = AlbumDashboardLegacyTabId;

/** Sincroniza `configTab` con `?tab=` (atrás/adelante; ignora mientras hay navegación programática). */
function AlbumDetailTabQuerySync({
  tabParseOpts,
  currentTab,
  tabParam,
  pendingTabRef,
  applyTabFromUrl,
}: {
  tabParseOpts: ParseLegacyAlbumTabOptions;
  currentTab: AlbumDashboardConfigTabId;
  tabParam: string | null;
  pendingTabRef: MutableRefObject<AlbumDashboardConfigTabId | null>;
  applyTabFromUrl: (tab: AlbumDashboardConfigTabId) => void;
}) {
  useEffect(() => {
    const parsed = normalizeAlbumDashboardTab(tabParam, tabParseOpts);
    const pending = pendingTabRef.current;

    if (pending) {
      if (parsed === pending) {
        logAlbumTabSync("pending-cleared", {
          from: currentTab,
          to: pending,
          currentSearch: tabParam,
        });
        pendingTabRef.current = null;
      } else {
        logAlbumTabSync("pending-skip", {
          from: currentTab,
          pending,
          parsed,
          currentSearch: tabParam,
        });
      }
      return;
    }

    if (parsed && parsed !== currentTab) {
      logAlbumTabSync("url-to-state", {
        from: currentTab,
        to: parsed,
        reason: "searchParams-changed",
        currentSearch: tabParam,
      });
      applyTabFromUrl(parsed);
    }
  }, [tabParam, tabParseOpts, applyTabFromUrl, currentTab, pendingTabRef]);
  return null;
}

export default function DashboardAlbumDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const pubParam = searchParams.get("pub");
  const tabSearchString = searchParams.toString();
  const params = useParams();
  const albumId = params?.id ? parseInt(String(params.id)) : null;

  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadSucceeded, setUploadSucceeded] = useState(0);
  const [uploadCurrentFile, setUploadCurrentFile] = useState<string | null>(null);
  const [uploadProgressRatio, setUploadProgressRatio] = useState(0);
  const [uploadFailedCount, setUploadFailedCount] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<AlbumPhotoUploadPhase | null>(null);
  const [uploadActiveCount, setUploadActiveCount] = useState(0);
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);
  const [failedFiles, setFailedFiles] = useState<Array<{ file: File; error: string }>>([]);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [uploadEventFolderId, setUploadEventFolderId] = useState<string>("");
  const [uploadAlbumFolderId, setUploadAlbumFolderId] = useState<string>("");
  const [ingestJobsSummary, setIngestJobsSummary] = useState<{
    pending: number;
    processing: number;
    failed: number;
  } | null>(null);

  // Estados para editar álbum
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [eventSchedule, setEventSchedule] = useState<AlbumEventScheduleValue>(EMPTY_ALBUM_EVENT_SCHEDULE);
  const [eventScheduleDisplay, setEventScheduleDisplay] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [hiddenPhotosEnabled, setHiddenPhotosEnabled] = useState(false);
  const [hiddenSelfieRetentionDays, setHiddenSelfieRetentionDays] = useState("");
  const [showComingSoonMessage, setShowComingSoonMessage] = useState(false);
  const [scanProtectionEnabled, setScanProtectionEnabled] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [minDigitalPhotoPrice, setMinDigitalPhotoPrice] = useState<number | null>(null);
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [photographerUserId, setPhotographerUserId] = useState<number | null>(null);
  const [hasActivePrintProducts, setHasActivePrintProducts] = useState<boolean | undefined>(
    undefined
  );
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [showCoverCrop, setShowCoverCrop] = useState(false);
  const [coverCropPhoto, setCoverCropPhoto] = useState<AlbumCoverCropPhoto | null>(null);
  const [fallbackPreviewPhotoId, setFallbackPreviewPhotoId] = useState<number | null>(null);
  const [coverCrop, setCoverCrop] = useState<Point>({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverCroppedArea, setCoverCroppedArea] = useState<Area | null>(null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [interestedList, setInterestedList] = useState<Array<{ id: number; email: string; name?: string | null; lastName?: string | null; whatsapp?: string | null; createdAt: string; hasBiometric: boolean; hasSelfie: boolean }>>([]);
  const [interestedLoading, setInterestedLoading] = useState(false);
  type AlbumSalesState = AlbumSalesFormState;
  const emptyAlbumSales = (): AlbumSalesState => ({
    inheritFromPhotographer: true,
    allowedCapabilities: [],
    disabledCapabilities: [],
    enableFaceBulkPurchase: false,
    faceBulkPriceInput: "",
  });
  function albumSalesFromApi(data: Record<string, unknown>): AlbumSalesState {
    const bulk = data.faceBulkPriceCents;
    return {
      inheritFromPhotographer: data.inheritFromPhotographer !== false,
      allowedCapabilities: Array.isArray(data.allowedCapabilities) ? (data.allowedCapabilities as string[]) : [],
      disabledCapabilities: Array.isArray(data.disabledCapabilities) ? (data.disabledCapabilities as string[]) : [],
      enableFaceBulkPurchase: Boolean(data.enableFaceBulkPurchase),
      faceBulkPriceInput:
        bulk != null && Number.isFinite(Number(bulk)) ? String(Number(bulk)) : "",
    };
  }
  const [albumSales, setAlbumSales] = useState<AlbumSalesState | null>(null);
  const [albumSalesLoading, setAlbumSalesLoading] = useState(false);
  const [albumMode, setAlbumMode] = useState<"SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE">("SIMPLE");
  const [albumModeSaving, setAlbumModeSaving] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [selectedPhotoMeta, setSelectedPhotoMeta] = useState<
    Map<string, { canDelete: boolean }>
  >(new Map());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [bulkFolderLoading, setBulkFolderLoading] = useState(false);
  const [bulkFolderBanner, setBulkFolderBanner] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );
  const [bulkFolderPick, setBulkFolderPick] = useState<string>("");
  const [publicationPanel, setPublicationPanel] = useState<AlbumPublicationPanelId>(
    ALBUM_PUBLICATION_DEFAULT_PANEL
  );
  const [configTab, setConfigTab] = useState<AlbumDashboardConfigTabId>(
    ALBUM_DASHBOARD_DEFAULT_TAB
  );
  const [videoMvpUiEnabled, setVideoMvpUiEnabled] = useState(() => isVideoMvpEnabledClient());
  const [commercialUnifiedUiEnabled, setCommercialUnifiedUiEnabled] = useState(() =>
    isAlbumCommercialUnifiedUiEnabledClient()
  );
  const pendingTabNavigationRef = useRef<AlbumDashboardConfigTabId | null>(null);

  const organizerLocksAlbumDigitalPricing = Boolean(
    album?.eventCollaborativePhotoPricing?.locksPhotographerDigitalPricing
  );

  const albumSalesReadinessInput = useMemo((): AlbumSalesReadinessInput | null => {
    if (!album) return null;
    return {
      enableDigitalPhotos: album.enableDigitalPhotos,
      enablePrintedPhotos: album.enablePrintedPhotos,
      digitalPhotoPriceCents: album.digitalPhotoPriceCents ?? null,
      albumProfitMarginPercent: album.albumProfitMarginPercent ?? null,
      selectedLabId: album.selectedLabId ?? null,
      pickupBy: album.pickupBy ?? null,
      printPricingSource: album.printPricingSource ?? null,
      termsAcceptedAt: album.termsAcceptedAt ?? null,
      termsVersion: album.termsVersion ?? null,
      eventCollaborativePhotoPricing: album.eventCollaborativePhotoPricing,
      hasActivePrintProducts,
    };
  }, [album, hasActivePrintProducts]);

  const shareEligibility = useMemo(() => {
    if (!album || !albumSalesReadinessInput) {
      return { canShare: false, blockReasons: [] as string[], shareWarnings: [] as string[], salesReadiness: null };
    }
    return evaluateAlbumShareEligibility({
      ...albumSalesReadinessInput,
      mpConnected,
      isTest: album.isTest,
      photoCount: albumPhotoStatsFromAlbum(album).total,
    });
  }, [album, albumSalesReadinessInput, mpConnected]);

  const albumPhotoStats = useMemo(() => albumPhotoStatsFromAlbum(album), [album]);

  const visibleUntil = useMemo(() => {
    if (!album) return new Date();
    const extensionDays = album.expirationExtensionDays ?? 0;
    const dayMs = 24 * 60 * 60 * 1000;
    const earliestMs = albumPhotoStats.earliestCreatedAt
      ? new Date(albumPhotoStats.earliestCreatedAt).getTime()
      : NaN;
    const baseDate = Number.isFinite(earliestMs)
      ? new Date(earliestMs)
      : new Date(album.createdAt);
    return new Date(baseDate.getTime() + (30 + extensionDays) * dayMs);
  }, [album, albumPhotoStats.earliestCreatedAt]);

  const coverPreviewUrl = useMemo(() => {
    if (!album) return null;
    if (album.coverPhotoId) {
      return `/api/photos/${album.coverPhotoId}/view?albumId=${album.id}&mode=cover`;
    }
    if (fallbackPreviewPhotoId) {
      return `/api/photos/${fallbackPreviewPhotoId}/view?albumId=${album.id}&mode=preview`;
    }
    return null;
  }, [album, fallbackPreviewPhotoId]);

  useEffect(() => {
    if (!albumId || !album) {
      setFallbackPreviewPhotoId(null);
      return;
    }
    if (album.coverPhotoId) {
      setFallbackPreviewPhotoId(null);
      return;
    }
    if (albumPhotoStats.total <= 0) {
      setFallbackPreviewPhotoId(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/dashboard/albums/${albumId}/photos?limit=1`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const first = Array.isArray(data.photos) ? data.photos[0] : null;
        const id = first?.id;
        if (typeof id === "number" && Number.isFinite(id)) {
          setFallbackPreviewPhotoId(id);
        } else {
          setFallbackPreviewPhotoId(null);
        }
      } catch {
        if (!cancelled) setFallbackPreviewPhotoId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [albumId, album?.id, album?.coverPhotoId, albumPhotoStats.total]);

  const albumPricingSnapshot = useMemo((): AlbumPricingSnapshot | null => {
    if (!album) return null;
    return {
      digitalPhotoPriceCents: album.digitalPhotoPriceCents ?? null,
      digitalDiscount5Plus: album.digitalDiscount5Plus ?? null,
      digitalDiscount10Plus: album.digitalDiscount10Plus ?? null,
      digitalDiscount20Plus: album.digitalDiscount20Plus ?? null,
      printPricingSource:
        album.printPricingSource === "LAB_PREFERRED" ? "LAB_PREFERRED" : "PHOTOGRAPHER",
      albumProfitMarginPercent: album.albumProfitMarginPercent ?? null,
      selectedLabId: album.selectedLabId ?? null,
      pickupBy: album.pickupBy ?? null,
      selectedLab: album.selectedLab ?? null,
      includeDigitalWithPrint: Boolean(album.includeDigitalWithPrint),
      digitalWithPrintDiscountPercent: album.digitalWithPrintDiscountPercent ?? null,
    };
  }, [album]);

  const handlePricingSaved = useCallback((patch: Partial<AlbumPricingSnapshot>) => {
    setAlbum((prev) => (prev ? { ...prev, ...patch } : prev));
    setError(null);
  }, []);

  const applyAlbumTabFromUrl = useCallback((tab: AlbumDashboardConfigTabId) => {
    setConfigTab(tab);
  }, []);

  const schoolLinked = albumIsLinkedToSchool(album?.schoolId);
  const schoolAlbumMode = album?.mode === "SCHOOL";

  const tabParseOpts = useMemo(
    (): ParseLegacyAlbumTabOptions => ({
      schoolLinked,
      schoolAlbumMode,
      videoMvpEnabled: videoMvpUiEnabled,
      commercialUnifiedUiEnabled,
    }),
    [schoolLinked, schoolAlbumMode, videoMvpUiEnabled, commercialUnifiedUiEnabled]
  );

  const resolvedAlbumTab = useMemo(() => {
    if (!schoolLinked && (configTab === "escuela" || configTab === "operativo")) {
      return ALBUM_DASHBOARD_DEFAULT_TAB;
    }
    if (!schoolAlbumMode && configTab === "comision-escolar") {
      return "ventas" as const;
    }
    if (!videoMvpUiEnabled && configTab === "videos") {
      return "fotos" as const;
    }
    if (!commercialUnifiedUiEnabled && configTab === "vista-comercial") {
      return ALBUM_DASHBOARD_DEFAULT_TAB;
    }
    return configTab;
  }, [schoolLinked, schoolAlbumMode, configTab, videoMvpUiEnabled, commercialUnifiedUiEnabled]);

  const resolvedPublicationPanel = useMemo(
    () => resolveAlbumPublicationPanel(tabParam, pubParam),
    [tabParam, pubParam]
  );

  const replaceAlbumTabUrlIfNeeded = useCallback(
    (
      tab: AlbumDashboardConfigTabId,
      reason: string,
      pub?: AlbumPublicationPanelId | null
    ) => {
      const expected = buildAlbumDashboardTabHref(
        pathname,
        tab,
        new URLSearchParams(tabSearchString),
        { pub: tab === "publicacion" ? (pub ?? publicationPanel) : null }
      );
      const current = albumDashboardLocationHref(pathname, tabSearchString);
      if (expected === current) return;

      logAlbumTabSync("router-replace", {
        from: resolvedAlbumTab,
        to: tab,
        reason,
        currentSearch: tabParam,
        expected,
        current,
      });
      pendingTabNavigationRef.current = tab;
      router.replace(expected, { scroll: false });
    },
    [pathname, router, tabParam, tabSearchString, resolvedAlbumTab, publicationPanel]
  );

  const changeAlbumTab = useCallback(
    (tab: AlbumDashboardConfigTabId, pub?: AlbumPublicationPanelId) => {
      const nextPub =
        tab === "publicacion"
          ? (pub ?? publicationPanel ?? ALBUM_PUBLICATION_DEFAULT_PANEL)
          : null;

      if (tab === resolvedAlbumTab && (!nextPub || nextPub === publicationPanel)) {
        replaceAlbumTabUrlIfNeeded(tab, "canonicalize-same-tab", nextPub);
        return;
      }

      logAlbumTabSync("user-tab-change", {
        from: resolvedAlbumTab,
        to: tab,
        pub: nextPub,
        reason: "changeAlbumTab",
        currentSearch: tabParam,
      });

      pendingTabNavigationRef.current = tab;
      setConfigTab(tab);
      if (nextPub) setPublicationPanel(nextPub);
      replaceAlbumTabUrlIfNeeded(tab, "changeAlbumTab", nextPub);
    },
    [resolvedAlbumTab, tabParam, replaceAlbumTabUrlIfNeeded, publicationPanel]
  );

  const changePublicationPanel = useCallback(
    (panel: AlbumPublicationPanelId) => {
      if (resolvedAlbumTab !== "publicacion") {
        changeAlbumTab("publicacion", panel);
        return;
      }
      if (panel === publicationPanel) {
        replaceAlbumTabUrlIfNeeded("publicacion", "canonicalize-pub-panel", panel);
        return;
      }
      setPublicationPanel(panel);
      replaceAlbumTabUrlIfNeeded("publicacion", "changePublicationPanel", panel);
    },
    [resolvedAlbumTab, publicationPanel, changeAlbumTab, replaceAlbumTabUrlIfNeeded]
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/video-mvp-enabled", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled && typeof data.enabled === "boolean") {
          setVideoMvpUiEnabled(data.enabled);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const uploadProgress = useUploadProgress();

  const folderBulkEnabled = useMemo(
    () => Boolean(album?.isOwner),
    [album?.isOwner]
  );

  const albumUsesEventFolders = useMemo(
    () =>
      Boolean(
        album &&
          typeof album.eventId === "number" &&
          Number.isFinite(album.eventId) &&
          album.eventId > 0
      ),
    [album]
  );

  useEffect(() => {
    if (
      !schoolLinked &&
      (configTab === "operativo" || configTab === "escuela")
    ) {
      changeAlbumTab(ALBUM_DASHBOARD_DEFAULT_TAB);
    }
  }, [schoolLinked, configTab, changeAlbumTab]);

  useEffect(() => {
    if (!commercialUnifiedUiEnabled && configTab === "vista-comercial") {
      changeAlbumTab(ALBUM_DASHBOARD_DEFAULT_TAB);
    }
  }, [commercialUnifiedUiEnabled, configTab, changeAlbumTab]);

  useEffect(() => {
    if (!schoolAlbumMode && configTab === "comision-escolar") {
      changeAlbumTab("ventas");
    }
  }, [schoolAlbumMode, configTab, changeAlbumTab]);

  useEffect(() => {
    if (!uploading) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading]);

  /** Canonicaliza alias / tab inválido en URL cuando no hay navegación programática pendiente. */
  useEffect(() => {
    if (pendingTabNavigationRef.current) return;
    if (tabParam == null) return;
    if (
      !albumDashboardTabUrlNeedsReplace(
        tabParam,
        resolvedAlbumTab,
        tabParseOpts,
        resolvedPublicationPanel
      )
    ) {
      return;
    }

    const expected = buildAlbumDashboardTabHref(
      pathname,
      resolvedAlbumTab,
      new URLSearchParams(tabSearchString),
      {
        pub: resolvedAlbumTab === "publicacion" ? resolvedPublicationPanel : null,
      }
    );
    const current = albumDashboardLocationHref(pathname, tabSearchString);
    if (expected === current) return;

    logAlbumTabSync("canonicalize-url", {
      from: resolvedAlbumTab,
      to: resolvedAlbumTab,
      pub: resolvedPublicationPanel,
      reason: "alias-or-invalid-tab",
      currentSearch: tabParam,
      expected,
      current,
    });
    pendingTabNavigationRef.current = resolvedAlbumTab;
    router.replace(expected, { scroll: false });
  }, [
    resolvedAlbumTab,
    resolvedPublicationPanel,
    tabParam,
    tabSearchString,
    tabParseOpts,
    pathname,
    router,
  ]);

  useEffect(() => {
    setPublicationPanel(resolvedPublicationPanel);
  }, [resolvedPublicationPanel]);

  const shareLink = useMemo(() => {
    if (shareUrl) return shareUrl;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (album?.eventShareSlug) {
      return `${origin}/g/${album.eventShareSlug}`;
    }
    if (album?.publicSlug) {
      return `${origin}/a/${album.publicSlug}`;
    }
    return "";
  }, [shareUrl, album?.eventShareSlug, album?.publicSlug]);

  const openAlbumShareModal = useCallback(() => {
    if (shareLink) {
      setShareUrl(shareLink);
    } else if (album?.publicSlug && typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/a/${album.publicSlug}`);
    }
    setShowShareModal(true);
  }, [shareLink, album?.publicSlug]);

  const requestShareAlbum = useCallback(() => {
    if (!shareEligibility.canShare) {
      setError(
        shareEligibility.blockReasons[0] ??
          "Completá la configuración de ventas antes de compartir el álbum."
      );
      changeAlbumTab("ventas");
      return;
    }
    setError(null);
    changeAlbumTab("publicacion", "compartir");
  }, [shareEligibility, changeAlbumTab]);

  async function handleDeleteAlbum() {
    if (!album || !albumId || deletingAlbum) return;

    const stats = albumPhotoStatsFromAlbum(album);
    const { hasOtherContributors, myPhotosCount, total: totalPhotos } = stats;

    const msg = hasOtherContributors
      ? `Este álbum es colaborativo. Solo se eliminarán tus ${myPhotosCount} foto${myPhotosCount === 1 ? "" : "s"}. El álbum permanecerá con las de otros fotógrafos. ¿Continuar?`
      : `¿Eliminar el álbum "${album.title}" y sus ${totalPhotos} foto${totalPhotos === 1 ? "" : "s"}? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;

    setDeletingAlbum(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error eliminando álbum");
      if (data.deleted === "my_photos_only") {
        await loadAlbum({ silent: true });
      } else {
        router.push("/dashboard/albums");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error eliminando álbum");
    } finally {
      setDeletingAlbum(false);
    }
  }

  const appBaseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const albumPublicUrl = album?.publicSlug ? `${appBaseUrl}/a/${album.publicSlug}` : "";

  useEffect(() => {
    if (!albumId || isNaN(albumId)) {
      setError("ID de álbum inválido");
      setLoading(false);
      return;
    }
    
    // Verificar si hay un link de álbum nuevo guardado
    const newAlbumUrl = sessionStorage.getItem("newAlbumUrl");
    const newAlbumTitle = sessionStorage.getItem("newAlbumTitle");
    if (newAlbumUrl) {
      setShareUrl(newAlbumUrl);
      setShowShareModal(true);
      sessionStorage.removeItem("newAlbumUrl");
      sessionStorage.removeItem("newAlbumTitle");
    }
    
    loadAlbum();
  }, [albumId]);

  useEffect(() => {
    if (!albumId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function pollIngestJobs(refreshPhotosOnIdle: boolean) {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/dashboard/albums/${albumId}/ingest-jobs`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          summary: { pending: number; processing: number; failed: number };
        };
        setIngestJobsSummary(data.summary);
        const active = data.summary.pending + data.summary.processing;
        if (active === 0) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (refreshPhotosOnIdle) {
            await loadAlbum({ silent: true });
          }
        } else if (!intervalId && !cancelled) {
          intervalId = setInterval(() => void pollIngestJobs(true), 4000);
        }
      } catch {
        /* ignorar errores de red en poll */
      }
    }

    void pollIngestJobs(false);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [albumId]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (typeof data?.minDigitalPhotoPrice === "number") {
          setMinDigitalPhotoPrice(data.minDigitalPhotoPrice);
        }
      } catch (err) {
        console.warn("Error cargando configuración:", err);
      }
    }
    loadConfig();
  }, []);

  async function saveAlbumMode() {
    if (!albumId) return;
    setAlbumModeSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: albumMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Error al guardar tipo de álbum"
        );
      }
      setAlbum((prev) =>
        prev
          ? {
              ...prev,
              mode:
                data.mode === "EVENT" ||
                data.mode === "SCHOOL" ||
                data.mode === "COLLABORATIVE"
                  ? data.mode
                  : "SIMPLE",
            }
          : prev
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar tipo de álbum");
    } finally {
      setAlbumModeSaving(false);
    }
  }

  useEffect(() => {
    if (!albumId || isNaN(albumId)) return;
    let cancelled = false;
    setAlbumSalesLoading(true);
    fetch(`/api/dashboard/albums/${albumId}/sales-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAlbumSales(albumSalesFromApi(data));
      })
      .catch(() => { if (!cancelled) setAlbumSales(null); })
      .finally(() => { if (!cancelled) setAlbumSalesLoading(false); });
    return () => { cancelled = true; };
  }, [albumId]);

  // Cerrar modales con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showRetryModal) {
          handleCancelRetry();
        }
        if (showShareModal) {
          setShowShareModal(false);
        }
        if (showCoverCrop && !coverSaving) {
          setShowCoverCrop(false);
          setCoverCropPhoto(null);
        }
      }
    }
    if (showRetryModal || showShareModal || showCoverCrop) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showRetryModal, showShareModal, showCoverCrop, coverSaving]);

  useEffect(() => {
    async function loadMpStatus() {
      try {
        const res = await fetch("/api/dashboard/photographer", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (typeof data?.mpConnected === "boolean") {
          setMpConnected(data.mpConnected);
        }
        if (typeof data?.id === "number" && Number.isFinite(data.id)) {
          setPhotographerUserId(data.id);
        }
      } catch (err) {
        console.warn("Error cargando estado de Mercado Pago:", err);
      }
    }
    loadMpStatus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fotografo/products", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        const products = Array.isArray(data) ? data : [];
        const active = products.filter((p: { isActive?: boolean }) => p.isActive !== false);
        setHasActivePrintProducts(active.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasActivePrintProducts(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bulkFolderBanner || bulkFolderBanner.kind !== "success") return;
    const t = window.setTimeout(() => setBulkFolderBanner(null), 4500);
    return () => window.clearTimeout(t);
  }, [bulkFolderBanner]);

  async function loadInterested() {
    if (!albumId) return;
    setInterestedLoading(true);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/interested`, { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (res.ok) {
        setInterestedList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("Error cargando interesados:", err);
    } finally {
      setInterestedLoading(false);
    }
  }

  async function loadAlbum(opts?: { silent?: boolean }) {
    // Post-mutación (delete/upload/bulk): recarga metadata + photoStats completos.
    // Optimización futura: PATCH local de photoStats vía loadAlbumPhotoStats(id) sin
    // rehidratar título, carpetas, ventas, etc.
    if (!albumId) return;

    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setError("Álbum no encontrado");
          if (!silent) setLoading(false);
          return;
        }
        throw new Error(data?.error || data?.detail || "Error cargando álbum");
      }
      setAlbum({
        ...(data as Album),
        photoStats: albumPhotoStatsFromAlbum(data as Album),
      });
      setSelectedPhotoIds(new Set());
      setSelectedPhotoMeta(new Map());
      setUploadEventFolderId("");
      // Inicializar valores de edición
      setTitle(data.title || "");
      setLocation(data.location || "");
      const hydratedSchedule = hydrateAlbumEventScheduleFromApi({
        eventSchedule: data.eventSchedule,
        eventDate: data.eventDate,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      });
      setEventSchedule(hydratedSchedule.value);
      setEventScheduleDisplay(hydratedSchedule.displayLabel);
      setAlbumMode(
        data.mode === "EVENT" || data.mode === "SCHOOL" || data.mode === "COLLABORATIVE"
          ? data.mode
          : "SIMPLE"
      );
      setIsPublic(data.isPublic !== false);
      setHiddenPhotosEnabled(Boolean(data.hiddenPhotosEnabled));
      setHiddenSelfieRetentionDays(
        data.hiddenSelfieRetentionDays != null ? String(data.hiddenSelfieRetentionDays) : ""
      );
      setShowComingSoonMessage(Boolean(data.showComingSoonMessage));
      setScanProtectionEnabled(data.scanProtectionEnabled !== false);
      // Establecer shareUrl si no está ya establecido
      if (!shareUrl && data.publicSlug) {
        setShareUrl(`${typeof window !== "undefined" ? window.location.origin : ""}/a/${data.publicSlug}`);
      }
      loadInterested();
    } catch (err: any) {
      console.error("Error cargando álbum:", err);
      setError(err.message || "Error cargando álbum");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!albumId) return;

    if (!confirm("¿Estás seguro de que querés eliminar esta foto?")) {
      return;
    }
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/photos/${photoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error eliminando foto");
      }

      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
      setSelectedPhotoMeta((prev) => {
        const next = new Map(prev);
        next.delete(photoId);
        return next;
      });
      await loadAlbum();
    } catch (err: any) {
      console.error("Error eliminando foto:", err);
      setError(err.message || "Error eliminando foto");
    }
  }

  function handlePhotoSelect(photoId: string, meta?: { canDelete?: boolean }) {
    const allowFolderBulk =
      Boolean(album?.isOwner) &&
      typeof album?.eventId === "number" &&
      Number.isFinite(album.eventId) &&
      album.eventId > 0;
    if (meta?.canDelete === false && !allowFolderBulk) return;

    if (selectedPhotoIds.has(photoId)) {
      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
      setSelectedPhotoMeta((prev) => {
        const next = new Map(prev);
        next.delete(photoId);
        return next;
      });
      return;
    }

    setSelectedPhotoIds((prev) => new Set(prev).add(photoId));
    if (meta?.canDelete !== undefined) {
      setSelectedPhotoMeta((prev) => {
        const next = new Map(prev);
        next.set(photoId, { canDelete: meta.canDelete !== false });
        return next;
      });
    }
  }

  function handleClearPhotoSelection() {
    setSelectedPhotoIds(new Set());
    setSelectedPhotoMeta(new Map());
  }

  function handleSelectAllPhotos(items: AlbumPhotoSelectItem[]) {
    const allowFolderBulk =
      Boolean(album?.isOwner) &&
      typeof album?.eventId === "number" &&
      Number.isFinite(album.eventId) &&
      album.eventId > 0;
    const ids = items
      .filter((item) => item.canDelete !== false || allowFolderBulk)
      .map((item) => item.id);
    setSelectedPhotoIds(new Set(ids));
    setSelectedPhotoMeta(() => {
      const next = new Map<string, { canDelete: boolean }>();
      for (const item of items) {
        if (!ids.includes(item.id)) continue;
        if (item.canDelete !== undefined) {
          next.set(item.id, { canDelete: item.canDelete !== false });
        }
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (!albumId || !album || selectedPhotoIds.size === 0) return;
    const toDelete = Array.from(selectedPhotoIds).filter((id) => {
      const meta = selectedPhotoMeta.get(id);
      if (!meta) return false;
      return meta.canDelete;
    });
    if (toDelete.length === 0) {
      setError("Ninguna de las fotos seleccionadas se puede eliminar.");
      return;
    }
    if (!confirm(`¿Eliminar ${toDelete.length} foto${toDelete.length !== 1 ? "s" : ""} seleccionada${toDelete.length !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingSelected(true);
    setError(null);
    try {
      for (const id of toDelete) {
        const res = await fetch(`/api/dashboard/albums/${albumId}/photos/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error eliminando foto");
        }
      }
      setSelectedPhotoIds(new Set());
      setSelectedPhotoMeta(new Map());
      await loadAlbum();
    } catch (err: any) {
      console.error("Error eliminando fotos:", err);
      setError(err?.message || "Error eliminando fotos");
    } finally {
      setDeletingSelected(false);
    }
  }

  async function handleBulkSetFolder(targetFolderId: number | null) {
    if (!albumId || !album || selectedPhotoIds.size === 0) return;

    const photoIds = Array.from(selectedPhotoIds)
      .map((sid) => parseInt(sid, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (photoIds.length === 0) return;

    setBulkFolderLoading(true);
    setBulkFolderBanner(null);
    setError(null);
    try {
      const body = albumUsesEventFolders
        ? { photoIds, eventFolderId: targetFolderId }
        : { photoIds, folderId: targetFolderId };
      const res = await fetch(`/api/dashboard/albums/${albumId}/photos/bulk-set-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo actualizar las carpetas.");
      }
      const n = typeof data.updated === "number" ? data.updated : photoIds.length;
      setBulkFolderBanner({
        kind: "success",
        text:
          targetFolderId === null
            ? `Se quitó la carpeta en ${n} foto${n !== 1 ? "s" : ""}.`
            : `Se asignó la carpeta en ${n} foto${n !== 1 ? "s" : ""}.`,
      });
      setSelectedPhotoIds(new Set());
      setSelectedPhotoMeta(new Map());
      setBulkFolderPick("");
      await loadAlbum();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al mover fotos";
      setBulkFolderBanner({ kind: "error", text: msg });
    } finally {
      setBulkFolderLoading(false);
    }
  }

  async function handleBulkApplyFolderPick() {
    if (bulkFolderPick === "") return;
    if (bulkFolderPick === "__none__") {
      await handleBulkSetFolder(null);
      return;
    }
    const folderId = parseInt(bulkFolderPick, 10);
    if (!Number.isFinite(folderId) || folderId <= 0) return;
    await handleBulkSetFolder(folderId);
  }

  function handleSetCover(photo: AlbumCoverCropPhoto) {
    if (!albumId || !album) return;
    setCoverCropPhoto(photo);
    setCoverCrop({ x: 0, y: 0 });
    setCoverZoom(1);
    setCoverCroppedArea(null);
    setShowCoverCrop(true);
  }

  const handleCoverCropComplete = useCallback((croppedArea: Area) => {
    setCoverCroppedArea(croppedArea);
  }, []);

  async function handleSaveCoverCrop() {
    if (!albumId || !coverCropPhoto) return;
    if (!coverCroppedArea) {
      setError("Ajustá el recorte antes de guardar la portada.");
      return;
    }
    setCoverSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/cover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: coverCropPhoto.id,
          crop: coverCrop,
          zoom: coverZoom,
          aspect: 1,
          cropArea: coverCroppedArea,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error estableciendo portada");
      }

      const savedPhotoId = coverCropPhoto.id;
      setAlbum((prev) =>
        prev ? { ...prev, coverPhotoId: savedPhotoId } : prev
      );
      setFallbackPreviewPhotoId(null);
      setShowCoverCrop(false);
      setCoverCropPhoto(null);
    } catch (err: any) {
      console.error("Error estableciendo portada:", err);
      setError(err.message || "Error estableciendo portada");
    } finally {
      setCoverSaving(false);
    }
  }

  // Función auxiliar para crear un identificador único de archivo
  function getFileId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  const PROXY_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
  const MOBILE_LARGE_PUT_ERROR_MESSAGE =
    "No se pudo subir esta foto desde el celular. Probá con buena conexión o subila desde computadora. Estamos ajustando la subida móvil.";

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isFetchNetworkError(e: unknown): boolean {
    if (!e || typeof e !== "object") return true;
    const err = e as { message?: string; name?: string };
    if (
      err.message &&
      err.message !== "Failed to fetch" &&
      !String(err.message).toLowerCase().includes("fetch")
    ) {
      return false;
    }
    return (
      !err.message ||
      err.message === "Failed to fetch" ||
      (err.name === "TypeError" && String(err.message).toLowerCase().includes("fetch"))
    );
  }

  async function uploadViaProxy(
    file: File,
    opts?: { eventFolderId?: number; folderId?: number; relativePath?: string }
  ): Promise<AlbumPhotoUploadOutcome> {
    const formData = new FormData();
    formData.append("file", file);
    if (opts?.eventFolderId != null) {
      formData.append("eventFolderId", String(opts.eventFolderId));
    }
    if (opts?.folderId != null) {
      formData.append("folderId", String(opts.folderId));
    }
    if (opts?.relativePath) {
      formData.append("relativePath", opts.relativePath);
    }
    const res = await fetch(`/api/dashboard/albums/${albumId}/photos/proxy-upload`, {
      method: "POST",
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as {
      photo?: { id: number };
      jobId?: string;
      async?: boolean;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data?.error || "No se pudo subir la foto por el servidor");
    }
    if (data.async && data.jobId) {
      return { kind: "async", jobId: data.jobId };
    }
    const photoId = data.photo?.id ?? 0;
    if (!photoId) {
      throw new Error("No se pudo procesar la foto después de subirla.");
    }
    return { kind: "sync", photoId };
  }

  // Función para subir un archivo individual (init → PUT a R2 → complete/complete-light).
  async function uploadSingleFile(
    file: File,
    opts?: {
      eventFolderId?: number;
      folderId?: number;
      relativePath?: string;
      onPhase?: (phase: AlbumPhotoUploadPhase) => void;
      /** En móvil: solo proxy-upload (sin PUT directo a R2). */
      mobileProxyOnly?: boolean;
    }
  ): Promise<AlbumPhotoUploadOutcome> {
    if (!albumId) throw new Error("No hay álbum seleccionado");

    const contentType = resolveAlbumPhotoContentType(file.name, file.type);
    const logBase = {
      filename: file.name,
      sizeBytes: file.size,
      contentType,
      albumId,
    };

    const tryProxyUpload = async (): Promise<AlbumPhotoUploadOutcome> => {
      opts?.onPhase?.("storage");
      opts?.onPhase?.("process");
      return uploadViaProxy(file, opts);
    };

    if (opts?.mobileProxyOnly) {
      return tryProxyUpload();
    }

    if (
      isLikelyMobileUploadDevice() &&
      file.size <= PROXY_UPLOAD_MAX_BYTES
    ) {
      try {
        return await tryProxyUpload();
      } catch (proxyErr: unknown) {
        const proxyMessage =
          proxyErr instanceof Error ? proxyErr.message : "proxy_first_failed";
        logAlbumPhotoUploadIssue({
          ...logBase,
          phase: "proxy",
          error: `proxy_first: ${proxyMessage}`,
        });
      }
    }

    let initData: { uploadUrl?: string; key?: string; error?: string } = {};
    opts?.onPhase?.("init");

    try {
      const initRes = await fetch(
        `/api/dashboard/albums/${albumId}/photos/direct-upload/init`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            contentType,
            size: file.size,
          }),
        }
      );
      initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        const errMsg = initData?.error || "No se pudo iniciar la subida";
        logAlbumPhotoUploadIssue({ ...logBase, phase: "init", error: errMsg });
        throw new Error(errMsg);
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message && err.message !== "Failed to fetch") throw e;
      logAlbumPhotoUploadIssue({
        ...logBase,
        phase: "init",
        error: "Failed to fetch",
      });
      throw new Error(
        "No se pudo iniciar la subida. Revisá tu conexión e intentá de nuevo."
      );
    }

    try {
      opts?.onPhase?.("storage");
      const uploadRes = await fetch(initData.uploadUrl!, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!uploadRes.ok) {
        logAlbumPhotoUploadIssue({
          ...logBase,
          phase: "storage_put",
          error: `HTTP ${uploadRes.status}`,
        });
        throw new Error("STORAGE_PUT_FAILED");
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (file.size <= PROXY_UPLOAD_MAX_BYTES) {
        try {
          return await tryProxyUpload();
        } catch (proxyErr: unknown) {
          const proxyMessage =
            proxyErr instanceof Error ? proxyErr.message : "Error al subir por el servidor";
          logAlbumPhotoUploadIssue({
            ...logBase,
            phase: "proxy",
            error: proxyMessage,
          });
          if (proxyErr instanceof Error && proxyErr.message.includes("procesar la foto")) {
            throw proxyErr;
          }
          throw new Error(
            "No se pudo enviar la foto. Probá de nuevo en unos minutos."
          );
        }
      }
      if (err?.message && err.message !== "STORAGE_PUT_FAILED" && !isFetchNetworkError(e)) {
        throw e;
      }
      logAlbumPhotoUploadIssue({
        ...logBase,
        phase: "storage_put",
        error: err?.message || "storage_put_failed",
      });
      throw new Error(
        file.size > PROXY_UPLOAD_MAX_BYTES
          ? MOBILE_LARGE_PUT_ERROR_MESSAGE
          : "No se pudo conectar con el almacenamiento. Probá de nuevo; si persiste, revisá tu conexión."
      );
    }

    try {
      opts?.onPhase?.("process");
      const useAsyncComplete = isAsyncAlbumPhotoIngestEnabledClient();
      const completePath = useAsyncComplete
        ? "direct-upload/complete-light"
        : "direct-upload/complete";
      const completeRes = await fetch(
        `/api/dashboard/albums/${albumId}/photos/${completePath}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: initData.key,
            originalName: file.name,
            size: file.size,
            ...(opts?.eventFolderId != null ? { eventFolderId: opts.eventFolderId } : {}),
            ...(opts?.folderId != null ? { folderId: opts.folderId } : {}),
            ...(opts?.relativePath ? { relativePath: opts.relativePath } : {}),
          }),
        }
      );
      const completeData = (await completeRes.json().catch(() => ({}))) as {
        photo?: { id: number };
        jobId?: string;
        async?: boolean;
        error?: string;
      };
      if (!completeRes.ok) {
        const errMsg = completeData?.error || "Error procesando foto";
        logAlbumPhotoUploadIssue({ ...logBase, phase: "complete", error: errMsg });
        throw new Error(errMsg);
      }
      if (completeData.async && completeData.jobId) {
        return { kind: "async", jobId: completeData.jobId };
      }
      const photoId = completeData.photo?.id ?? 0;
      if (!photoId) {
        throw new Error("No se pudo procesar la foto después de subirla.");
      }
      return { kind: "sync", photoId };
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message && !isFetchNetworkError(e)) throw e;
      logAlbumPhotoUploadIssue({
        ...logBase,
        phase: "complete",
        error: err?.message || "Failed to fetch",
      });
      throw new Error(
        "La foto se subió pero el servidor tardó en procesarla. Probá de nuevo."
      );
    }
  }

  // Función para eliminar fotos del álbum (rollback en caso de error)
  async function deletePhotosById(photoIds: number[]): Promise<void> {
    if (!albumId) return;
    for (const photoId of photoIds) {
      try {
        await fetch(`/api/dashboard/albums/${albumId}/photos/${photoId}`, { method: "DELETE" });
      } catch (e) {
        console.warn("No se pudo eliminar foto al hacer rollback:", photoId, e);
      }
    }
  }

  // Función principal de subida: sube una por una. Si alguna falla, se guardan las que sí subieron
  // y se ofrece reintentar las fallidas (evita perder todo por timeout en foto 6).
  async function handleFilesSelected(
    selection: AlbumUploadSelection | FileList,
    retryFailed: boolean = false
  ) {
    const isDirectoryUpload =
      !(selection instanceof FileList) && selection.isDirectoryUpload === true;
    const files =
      selection instanceof FileList ? selection : selection.files;
    if (!albumId) return;
    if (mpConnected === false) {
      setError("Debés conectar Mercado Pago para subir fotos.");
      return;
    }

    setError(null);

    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 10);
    const maxBytes = maxMb * 1024 * 1024;

    const fileList = retryFailed ? failedFiles.map((f) => f.file) : Array.from(files);
    if (fileList.length === 0) {
      if (retryFailed) {
        setFailedFiles([]);
        setShowRetryModal(false);
      }
      return;
    }

    // 1. Validar tamaño ANTES de iniciar: si alguna supera 10MB, rechazar todas y no subir ninguna
    const tooLarge = fileList.filter((f) => f.size > maxBytes);
    if (tooLarge.length > 0) {
      const names = tooLarge.map((f) => f.name).join(", ");
      setError(
        `Una o más fotos superan el límite de ${maxMb} MB y no se subió ninguna: ${names}`
      );
      if (retryFailed) {
        setFailedFiles([]);
        setShowRetryModal(false);
      }
      return;
    }

    setUploading(true);
    setUploadTotal(fileList.length);
    setUploadDone(0);
    setUploadSucceeded(0);
    setUploadCurrentFile(null);
    setUploadProgressRatio(0);
    setUploadFailedCount(0);
    setUploadPhase(null);
    setUploadActiveCount(0);
    setUploadStartedAt(Date.now());
    const parsedUploadEventFolder = uploadEventFolderId.trim();
    const batchEventFolderId =
      isDirectoryUpload || parsedUploadEventFolder === ""
        ? undefined
        : (() => {
            const n = parseInt(parsedUploadEventFolder, 10);
            return Number.isInteger(n) && n > 0 ? n : undefined;
          })();
    const parsedUploadAlbumFolder = uploadAlbumFolderId.trim();
    const batchAlbumFolderId =
      isDirectoryUpload || parsedUploadAlbumFolder === ""
        ? undefined
        : (() => {
            const n = parseInt(parsedUploadAlbumFolder, 10);
            return Number.isInteger(n) && n > 0 ? n : undefined;
          })();
    uploadProgress?.startUpload(fileList.length, album?.title ?? null);

    let newFailed: Array<{ file: File; error: string }> = [];

    const applyQueueProgress = (progress: {
      processed: number;
      succeeded: number;
      failed: number;
      progressRatio: number;
      currentFile: string | null;
      phase: AlbumPhotoUploadPhase | null;
      activeUploads: number;
    }) => {
      startTransition(() => {
        setUploadDone(progress.processed);
        setUploadSucceeded(progress.succeeded);
        setUploadFailedCount(progress.failed);
        setUploadProgressRatio(progress.progressRatio);
        setUploadCurrentFile(progress.currentFile);
        setUploadPhase(progress.phase);
        setUploadActiveCount(progress.activeUploads);
      });
      uploadProgress?.updateProgress({
        done: progress.processed,
        failed: progress.failed,
        progressRatio: progress.progressRatio,
      });
    };

    const mobileUpload = isLikelyMobileUploadDevice();

    try {
      const { failed, successCount, asyncJobIds } = await runAlbumPhotoUploadQueue({
        files: fileList,
        concurrency: getAlbumPhotoUploadConcurrency(),
        maxAttempts: mobileUpload ? 4 : 2,
        retryDelayMs: mobileUpload ? 1500 : 800,
        betweenFilesDelayMs: mobileUpload ? 350 : 0,
        uploadFile: async (file, hooks) => {
          const relativePath = isDirectoryUpload ? fileWebkitRelativePath(file) : undefined;
          let uploadable = file;
          if (mobileUpload) {
            hooks.onPhase("init");
            setUploadCurrentFile(`Preparando ${file.name}…`);
            uploadable = await prepareMobileUploadFileForQueue(file);
          }
          return uploadSingleFile(uploadable, {
            eventFolderId: batchEventFolderId,
            folderId: batchAlbumFolderId,
            relativePath: relativePath || undefined,
            onPhase: hooks.onPhase,
            mobileProxyOnly: mobileUpload,
          });
        },
        onProgress: applyQueueProgress,
      });

      newFailed = failed
        .filter((item) => item.error)
        .map((item) => ({ file: item.file, error: item.error! }));

      if (asyncJobIds.length > 0) {
        try {
          const res = await fetch(`/api/dashboard/albums/${albumId}/ingest-jobs`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = (await res.json()) as {
              summary: { pending: number; processing: number; failed: number };
            };
            setIngestJobsSummary(data.summary);
          }
        } catch {
          /* el poll periódico actualizará */
        }
      }

      if (newFailed.length > 0) {
        setFailedFiles(newFailed);
        setShowRetryModal(true);
        setError(
          successCount > 0
            ? `Se subieron ${successCount.toLocaleString("es-AR")} foto(s). ${newFailed.length.toLocaleString("es-AR")} no se pudieron subir. Podés reintentarlas.`
            : `No se pudo subir ninguna foto. ${newFailed[0]?.error || ""}`
        );
      } else {
        setFailedFiles([]);
        setShowRetryModal(false);
        setError(null);
        if (uploadSessionId && albumId) {
          sessionStorage.removeItem(`upload-success-${albumId}-${uploadSessionId}`);
        }
        setUploadSessionId(null);
      }

      await loadAlbum({ silent: true });
    } catch (err: any) {
      console.error("Error subiendo fotos:", err);
      setError(err?.message || "Error subiendo fotos.");
      if (newFailed.length > 0) {
        setFailedFiles(newFailed);
        setShowRetryModal(true);
      }
    } finally {
      setUploading(false);
      setUploadCurrentFile(null);
      setUploadPhase(null);
      setUploadActiveCount(0);
      setUploadStartedAt(null);
      setUploadProgressRatio(0);
      uploadProgress?.finishUpload();
    }
  }

  // Función para reintentar archivos fallidos
  async function handleRetryFailed() {
    if (failedFiles.length === 0) return;
    const filesToRetry = failedFiles.map(f => f.file);
    setShowRetryModal(false);
    setFailedFiles([]);
    // Crear un FileList simulado desde los archivos fallidos
    const dataTransfer = new DataTransfer();
    filesToRetry.forEach(file => dataTransfer.items.add(file));
    await handleFilesSelected(dataTransfer.files, true);
  }

  // Función para cancelar retry y limpiar estado
  function handleCancelRetry() {
    setShowRetryModal(false);
    setFailedFiles([]);
    if (uploadSessionId && albumId) {
      const storageKey = `upload-success-${albumId}-${uploadSessionId}`;
      sessionStorage.removeItem(storageKey);
    }
    setUploadSessionId(null);
  }

  async function handleSaveConfiguration() {
    if (!albumId) return;

    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }

    setConfigSaving(true);
    setError(null);

    try {
      const schedulePayload = albumEventScheduleToApiPayload(eventSchedule);
      const bodyPayload: Record<string, unknown> = {
        title: title.trim(),
        location: location.trim() || null,
        ...schedulePayload,
        isPublic,
        hiddenPhotosEnabled,
        hiddenSelfieRetentionDays:
          hiddenSelfieRetentionDays.trim() === ""
            ? null
            : parseInt(hiddenSelfieRetentionDays, 10) || null,
        showComingSoonMessage,
        scanProtectionEnabled,
      };

      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error guardando configuración");
      }

      if (data._warning) {
        setError(String(data._warning));
        setHiddenPhotosEnabled(Boolean(data.hiddenPhotosEnabled));
      } else {
        setError(null);
      }

      if (data._hiddenAnalysisQueued && Number(data._hiddenAnalysisQueued) > 0) {
        setError(
          `Fotos ocultas activadas. Se encolaron ${data._hiddenAnalysisQueued} foto(s) para análisis facial; en unos minutos el reconocimiento estará listo.`
        );
      }

      const nextDisplay = displayLabelForAlbumEventSchedule(eventSchedule);
      setEventScheduleDisplay(nextDisplay);
      setAlbum((prev) =>
        prev
          ? {
              ...prev,
              ...(data as Partial<Album>),
              eventSchedule: {
                eventDate: eventSchedule.eventDate,
                eventStartTime: eventSchedule.eventStartTime,
                eventEndTime: eventSchedule.eventEndTime,
                displayLabel: nextDisplay,
              },
              photoStats: prev.photoStats,
            }
          : prev
      );
      if (!data._warning && !data._hiddenAnalysisQueued) {
        setError(null);
      }
    } catch (err: unknown) {
      console.error("Error guardando configuración:", err);
      setError(err instanceof Error ? err.message : "Error guardando configuración");
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleSaveAlbum() {
    if (!albumId) return;

    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const schedulePayload = albumEventScheduleToApiPayload(eventSchedule);
      const bodyPayload: Record<string, unknown> = {
        title: title.trim(),
        location: location.trim() || null,
        ...schedulePayload,
      };

      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error guardando cambios");
      }

      const nextDisplay = displayLabelForAlbumEventSchedule(eventSchedule);
      setEventScheduleDisplay(nextDisplay);
      // Mantener stats y carpetas; el PATCH devuelve un subconjunto de campos del álbum.
      setAlbum((prev) =>
        prev
          ? {
              ...prev,
              ...(data as Partial<Album>),
              eventSchedule: {
                eventDate: eventSchedule.eventDate,
                eventStartTime: eventSchedule.eventStartTime,
                eventEndTime: eventSchedule.eventEndTime,
                displayLabel: nextDisplay,
              },
              photoStats: prev.photoStats,
              eventCollaborativePhotoPricing:
                prev.eventCollaborativePhotoPricing ?? (data as Album).eventCollaborativePhotoPricing,
              eventFolders: prev.eventFolders,
              eventShareSlug: prev.eventShareSlug ?? (data as Album).eventShareSlug,
            }
          : prev
      );
      setEditing(false);
      setError(null);
    } catch (err: any) {
      console.error("Error guardando álbum:", err);
      setError(err.message || "Error guardando cambios");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 md:py-16 bg-white min-h-screen w-full min-w-0">
          <div className="container-custom">
            <div className="max-w-7xl mx-auto text-center">
              <p className="text-[#6b7280]">Cargando álbum...</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!album) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 md:py-16 bg-white min-h-screen w-full min-w-0">
          <div className="container-custom">
            <div className="max-w-7xl mx-auto">
              <Card className="bg-[#ef4444]/10 border-[#ef4444]">
                <p className="text-[#ef4444]">{error || "Álbum no encontrado"}</p>
              </Card>
              <div className="mt-4 text-center">
                <Link href="/dashboard/albums" className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline">
                  ← Volver a Mis Álbumes
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const nextStepsMode =
    album.mode === "EVENT" || album.mode === "SCHOOL" || album.mode === "COLLABORATIVE"
      ? album.mode
      : ("SIMPLE" as const);

  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <section className="py-12 md:py-16 bg-white min-h-screen w-full min-w-0">
        <div className="container-custom ds-page-shell ds-fill-width">
          <DsDashboardInner className="w-full ds-stack-section gap-8 px-1 sm:px-0">
            <Suspense fallback={null}>
              <AlbumDetailTabQuerySync
                tabParseOpts={tabParseOpts}
                currentTab={resolvedAlbumTab}
                tabParam={tabParam}
                pendingTabRef={pendingTabNavigationRef}
                applyTabFromUrl={applyAlbumTabFromUrl}
              />
            </Suspense>
            {/* Panel superior: título y acciones en la misma fila */}
            <div className="w-full min-w-0 space-y-2">
              <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <Input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-2xl font-medium"
                      disabled={saving}
                    />
                  ) : (
                    <h1 className="text-2xl sm:text-3xl font-medium text-[#1a1a1a] m-0 leading-tight">
                      {album.title}
                    </h1>
                  )}
                  {album && !editing ? (
                    <AlbumSalesStatusBadge
                      className="mt-2"
                      album={albumSalesReadinessInput ?? {
                        enableDigitalPhotos: album.enableDigitalPhotos,
                        enablePrintedPhotos: album.enablePrintedPhotos,
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => changeAlbumTab("configuracion")}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#6b7280] transition-colors hover:border-[#d1d5db] hover:bg-[#f8f9fa] hover:text-[#1a1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]"
                    title="Configuración del álbum"
                    aria-label="Configuración del álbum"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <a
                    href={`/a/${album.publicSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#c27b3d] shadow-sm transition-colors hover:border-[#c27b3d]/40 hover:bg-[#c27b3d]/10 hover:text-[#a6692f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]"
                    title="Vista del cliente: abrir el álbum en una pestaña nueva tal como lo ve quien compra"
                    aria-label="Vista del cliente"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </a>
                  <button
                    type="button"
                    onClick={requestShareAlbum}
                    disabled={!shareEligibility.canShare}
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#e5e7eb] bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] ${
                      shareEligibility.canShare
                        ? "text-[#6b7280] hover:border-[#d1d5db] hover:bg-[#f8f9fa] hover:text-[#1a1a1a]"
                        : "cursor-not-allowed text-[#9ca3af] opacity-60"
                    }`}
                    title={
                      shareEligibility.canShare
                        ? "Compartir álbum"
                        : shareEligibility.blockReasons[0] ?? "Completá la venta antes de compartir"
                    }
                    aria-label="Compartir álbum"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAlbum()}
                    disabled={deletingAlbum}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#6b7280] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] disabled:opacity-50"
                    title="Eliminar álbum"
                    aria-label="Eliminar álbum"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {!editing && (
                <div className="ds-intro-prose ds-intro-prose--start text-sm text-[#6b7280] space-y-1 m-0">
                  {album.location && <p className="m-0">📍 {album.location}</p>}
                  {(eventScheduleDisplay || album.eventSchedule?.displayLabel) && (
                    <p className="m-0">
                      📅 {eventScheduleDisplay || album.eventSchedule?.displayLabel}
                    </p>
                  )}
                </div>
              )}
            </div>

          {/* Workspace: navegación 2 niveles + contenido por tab legacy */}
          <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col basis-auto">
            <AlbumWorkspaceNav
              activeTab={resolvedAlbumTab}
              publicationPanel={publicationPanel}
              videoMvpEnabled={videoMvpUiEnabled}
              schoolLinked={schoolLinked}
              schoolAlbumMode={schoolAlbumMode}
              commercialUnifiedUiEnabled={commercialUnifiedUiEnabled}
              onTabChange={(id) => changeAlbumTab(id as AlbumDashboardConfigTabId)}
              onPublicationPanelChange={changePublicationPanel}
              sticky
            />
            <div className="mt-4 flex w-full min-w-0 max-w-full flex-1 min-h-0 flex-col pt-0 [&>*]:w-full [&>*]:max-w-full [&>.ds-tab-panel]:min-w-[min(100%,20rem)] items-stretch self-stretch">
            {resolvedAlbumTab === "resumen" && album && (
              <AlbumResumenSection
                albumId={album.id}
                title={album.title}
                publicSlug={album.publicSlug}
                eventShareSlug={album.eventShareSlug}
                photographerHandler={album.photographerHandler}
                eventId={album.eventId}
                mode={album.mode}
                isTest={album.isTest}
                photoCount={albumPhotoStats.total}
                visibleUntil={visibleUntil}
                mpConnected={mpConnected}
                organizerLocksAlbumDigitalPricing={organizerLocksAlbumDigitalPricing}
                topError={error}
                nextStepsMode={nextStepsMode}
                videoMvpEnabled={videoMvpUiEnabled}
                salesReadinessAlbum={albumSalesReadinessInput ?? undefined}
                canShareWithClients={shareEligibility.canShare}
                shareBlockReasons={shareEligibility.blockReasons}
              />
            )}
            {resolvedAlbumTab === "publicacion" && album && (
              <AlbumPublicationSection
                albumId={album.id}
                publicSlug={album.publicSlug}
                eventShareSlug={album.eventShareSlug}
                photographerHandler={album.photographerHandler}
                mode={album.mode}
                activePanel={publicationPanel}
                isTest={album.isTest}
                isPublic={album.isPublic}
                isHidden={album.isHidden}
                hiddenPhotosEnabled={album.hiddenPhotosEnabled}
                photoCount={albumPhotoStats.total}
                visibleUntil={visibleUntil}
                expirationExtensionDays={album.expirationExtensionDays}
                coverPhotoId={album.coverPhotoId}
                coverPreviewUrl={coverPreviewUrl}
                onEditVisibility={() => changeAlbumTab("configuracion")}
                canShareWithClients={shareEligibility.canShare}
                shareBlockReasons={shareEligibility.blockReasons}
                shareWarnings={shareEligibility.shareWarnings}
              />
            )}
            {resolvedAlbumTab === "configuracion" && album && (
              <AlbumConfigurationSection
                albumId={album.id}
                eventId={album.eventId}
                lockEventFields={Boolean(album.eventId)}
                title={title}
                location={location}
                eventSchedule={eventSchedule}
                isPublic={isPublic}
                hiddenPhotosEnabled={hiddenPhotosEnabled}
                hiddenSelfieRetentionDays={hiddenSelfieRetentionDays}
                showComingSoonMessage={showComingSoonMessage}
                scanProtectionEnabled={scanProtectionEnabled}
                onScanProtectionChange={setScanProtectionEnabled}
                albumMode={albumMode}
                albumModeSaving={albumModeSaving}
                saving={configSaving}
                photographerHandler={album.photographerHandler}
                onTitleChange={setTitle}
                onLocationChange={setLocation}
                onEventScheduleChange={setEventSchedule}
                onIsPublicChange={setIsPublic}
                onHiddenPhotosChange={setHiddenPhotosEnabled}
                onHiddenSelfieRetentionChange={setHiddenSelfieRetentionDays}
                onShowComingSoonChange={setShowComingSoonMessage}
                onAlbumModeChange={setAlbumMode}
                onSave={() => void handleSaveConfiguration()}
                onSaveAlbumMode={() => void saveAlbumMode()}
              />
            )}
            {resolvedAlbumTab === "ventas" && album && albumPricingSnapshot && (
              <div className="ds-tab-panel ds-stack-section w-full min-w-0 gap-6">
                <AlbumVentasForm
                  albumId={album.id}
                  active={resolvedAlbumTab === "ventas"}
                  album={{
                    ...albumPricingSnapshot,
                    eventCollaborativePhotoPricing: album.eventCollaborativePhotoPricing,
                    enablePrintedPhotos: album.enablePrintedPhotos,
                    enableDigitalPhotos: album.enableDigitalPhotos,
                    albumPackPayEnabled: album.albumPackPayEnabled,
                    termsAcceptedAt: album.termsAcceptedAt,
                    termsVersion: album.termsVersion,
                  }}
                  albumSales={albumSales}
                  albumSalesLoading={albumSalesLoading}
                  onAlbumSalesChange={(next) => setAlbumSales(next)}
                  organizerLocksAlbumDigitalPricing={organizerLocksAlbumDigitalPricing}
                  minDigitalPhotoPrice={minDigitalPhotoPrice}
                  mpConnected={mpConnected}
                  onPricingSaved={handlePricingSaved}
                  onError={setError}
                  canShareWithClients={shareEligibility.canShare}
                  shareBlockReasons={shareEligibility.blockReasons}
                />
              </div>
            )}
            {resolvedAlbumTab === "videos" && album && videoMvpUiEnabled && (
              <AlbumVideosSection
                albumId={album.id}
                mpConnected={mpConnected}
                eventId={album.eventId}
              />
            )}
            {resolvedAlbumTab === "packs" && album && (
              <div className="w-full min-w-0 self-stretch ds-tab-panel ds-stack-section gap-6">
                <Link
                  href={`/dashboard/albums/${album.id}?tab=ventas`}
                  prefetch={false}
                  className="text-sm font-medium text-[#c27b3d] hover:underline w-fit"
                >
                  ← {albumSalesTypesTabLabel()}
                </Link>
                <div className="ds-content-container w-full max-w-3xl space-y-2">
                  <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">{albumGalleryTabLabel()}</h2>
                  <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
                    Estos packs se muestran cuando las fotos ya están publicadas. El cliente compra
                    después de ver la galería.
                  </p>
                </div>
              <AlbumPacksSection
                albumId={album.id}
                active={resolvedAlbumTab === "packs"}
                albumMode={album.mode ?? "SIMPLE"}
                albumPackPayEnabled={Boolean(album.albumPackPayEnabled)}
                eventOfficialDigitalAlbumPricing={organizerLocksAlbumDigitalPricing}
                onAlbumPackPayEnabledChange={(next) =>
                  setAlbum((prev) =>
                    prev ? { ...prev, albumPackPayEnabled: next } : prev
                  )
                }
              />
              </div>
            )}
            {resolvedAlbumTab === "preventa" && album && (
              <div className="w-full min-w-0 self-stretch ds-tab-panel ds-stack-section gap-6">
                <Link
                  href={`/dashboard/albums/${album.id}?tab=ventas`}
                  prefetch={false}
                  className="text-sm font-medium text-[#c27b3d] hover:underline w-fit"
                >
                  ← {albumSalesTypesTabLabel()}
                </Link>
                <div className="ds-content-container w-full max-w-3xl space-y-2">
                  <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">{albumPreventaTabLabel()}</h2>
                  <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
                    Estos packs se venden antes de publicar las fotos. El cliente compra primero y
                    elige las imágenes después.
                  </p>
                </div>

                <PreventaPackDashboardSection
                  albumId={album.id}
                  albumPublicSlug={album.publicSlug}
                  active={resolvedAlbumTab === "preventa"}
                  onError={setError}
                />
              </div>
            )}
            {resolvedAlbumTab === "vista-comercial" && album && commercialUnifiedUiEnabled && (
              <div className="w-full min-w-0 self-stretch ds-tab-panel ds-stack-section gap-6">
                <div className="ds-content-container w-full max-w-3xl space-y-2">
                  <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Vista comercial unificada</h2>
                  <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
                    Mismo producto en preventa y en galería, con precios y estados en un solo lugar (solo lectura).
                  </p>
                </div>
                <AlbumCommercialOffersView
                  albumId={album.id}
                  active={resolvedAlbumTab === "vista-comercial"}
                />
              </div>
            )}
            {resolvedAlbumTab === "adicionales" && album && (
              <div className="w-full min-w-0 self-stretch ds-tab-panel ds-stack-section gap-6">
                <Link
                  href={`/dashboard/albums/${album.id}?tab=ventas`}
                  prefetch={false}
                  className="text-sm font-medium text-[#c27b3d] hover:underline w-fit"
                >
                  ← {albumSalesTypesTabLabel()}
                </Link>
                <div className="ds-content-container w-full max-w-3xl space-y-2">
                  <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">{albumExtrasTabLabel()}</h2>
                  <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
                    Son productos o servicios extra que se ofrecen durante la compra, como fotos
                    digitales adicionales, impresiones extra o packs complementarios.
                  </p>
                </div>
                <AlbumUpsellConfigCard
                  albumId={album.id}
                  active={resolvedAlbumTab === "adicionales"}
                  onError={setError}
                />
              </div>
            )}
            {resolvedAlbumTab === "comision-escolar" && album && schoolAlbumMode && (
              <div className="w-full min-w-0 self-stretch ds-tab-panel ds-stack-section gap-6">
                <Link
                  href={`/dashboard/albums/${album.id}?tab=ventas`}
                  prefetch={false}
                  className="text-sm font-medium text-[#c27b3d] hover:underline w-fit"
                >
                  ← {albumSalesTypesTabLabel()}
                </Link>
                <div className="ds-content-container w-full max-w-3xl space-y-2">
                  <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">
                    {albumSchoolCommissionTabLabel()}
                  </h2>
                  <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
                    Reconocimiento comercial por ventas desde el link de difusión escolar.
                  </p>
                </div>
                <AlbumSchoolCommissionSection
                  key={album.id}
                  albumId={album.id}
                  active={resolvedAlbumTab === "comision-escolar"}
                  initial={{
                    organizerCommissionEnabled: Boolean(album.organizerCommissionEnabled),
                    organizerCommissionPercentage: album.organizerCommissionPercentage ?? null,
                    organizerCommissionAppliesTo:
                      Array.isArray(album.organizerCommissionAppliesTo) &&
                      album.organizerCommissionAppliesTo.length
                        ? album.organizerCommissionAppliesTo
                        : ["PREVENTA"],
                  }}
                  onSaved={(patch) =>
                    setAlbum((prev) =>
                      prev
                        ? {
                            ...prev,
                            organizerCommissionEnabled: patch.organizerCommissionEnabled,
                            organizerCommissionPercentage: patch.organizerCommissionPercentage,
                            organizerCommissionAppliesTo: patch.organizerCommissionAppliesTo,
                          }
                        : prev
                    )
                  }
                  onError={setError}
                />
              </div>
            )}
            {resolvedAlbumTab === "escuela" && schoolLinked && (
              <div className="ds-tab-panel ds-stack-section w-full self-stretch">
                <AlbumStudentRosterSection
                  albumId={album.id}
                  schoolId={album.schoolId ?? null}
                  eventTitle={album.title}
                  eventLocation={album.location}
                  isTestMode={Boolean(album.isTest)}
                  studentIdentificationMode={
                    (album.studentIdentificationMode as
                      | "NONE"
                      | "MANUAL"
                      | "ROSTER_OPTIONAL"
                      | "ROSTER_REQUIRED"
                      | null) ?? null
                  }
                  allowManualStudentFallback={Boolean(album.allowManualStudentFallback)}
                  onAlbumConfigSaved={(patch) =>
                    setAlbum((a) =>
                      a
                        ? {
                            ...a,
                            studentIdentificationMode: patch.studentIdentificationMode,
                            allowManualStudentFallback: patch.allowManualStudentFallback,
                          }
                        : a
                    )
                  }
                />
              </div>
            )}
            {resolvedAlbumTab === "operativo" && schoolLinked && (
              <div className="ds-tab-panel w-full min-w-0">
                <AlbumSchoolOperationsSection albumId={album.id} />
              </div>
            )}
            {resolvedAlbumTab === "fotos" && album && (
              <div className="ds-tab-panel ds-tab-panel--lg w-full min-w-0 ds-stack-section gap-6">
          <DsInfoPanel title="Ventas y precios">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#374151] m-0 min-w-0">
                La configuración de precios y ventas se gestiona en Venta → Qué vendés.
              </p>
              <Link
                href={`/dashboard/albums/${album.id}?tab=ventas`}
                prefetch={false}
                className="w-full shrink-0 sm:w-auto"
              >
                <Button type="button" variant="secondary" size="md" className="w-full whitespace-nowrap sm:w-auto">
                  Ir a Ventas
                </Button>
              </Link>
            </div>
          </DsInfoPanel>
          {editing && (
            <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
              <div className="ds-form-stack w-full max-w-2xl gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Ubicación
                </label>
                <Input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Buenos Aires, Argentina"
                  disabled={saving}
                  className="w-full"
                />
              </div>
              <AlbumEventScheduleFields
                value={eventSchedule}
                onChange={setEventSchedule}
                disabled={saving || Boolean(album.eventId)}
                readOnly={Boolean(album.eventId)}
              />
              <p className="ds-readable-text text-xs text-[#6b7280] m-0">
                La configuración de precios y ventas se gestiona desde la pestaña Venta.
              </p>
              </div>
            </Card>
          )}

          {error && (
            <Card className="w-full min-w-0 bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444] text-sm break-words">{error}</p>
            </Card>
          )}

          {ingestJobsSummary &&
          ingestJobsSummary.pending + ingestJobsSummary.processing > 0 ? (
            <Card className="w-full min-w-0 bg-[#3b82f6]/10 border-[#3b82f6]">
              <p className="text-[#1e40af] text-sm break-words m-0">
                Procesando{" "}
                {(ingestJobsSummary.pending + ingestJobsSummary.processing).toLocaleString(
                  "es-AR"
                )}{" "}
                foto(s) en segundo plano. Aparecerán en la galería cuando terminen.
              </p>
            </Card>
          ) : null}

          {ingestJobsSummary && ingestJobsSummary.failed > 0 ? (
            <Card className="w-full min-w-0 bg-[#f59e0b]/10 border-[#f59e0b]">
              <p className="text-[#92400e] text-sm break-words m-0">
                {ingestJobsSummary.failed.toLocaleString("es-AR")} foto(s) no se pudieron
                procesar. Reintentá la subida o contactá soporte si persiste.
              </p>
            </Card>
          ) : null}

          <AlbumPhotosFolderExplorer
            albumId={album.id}
            albumTitle={album.title}
            eventId={album.eventId}
            isOwner={album.isOwner}
            coverPhotoId={album.coverPhotoId}
            photoStats={albumPhotoStats}
            initialAlbumFolders={album.albumFolders}
            initialEventFolders={album.eventFolders}
            mpConnected={mpConnected}
            uploading={uploading}
            uploadTotal={uploadTotal}
            uploadDone={uploadDone}
            uploadSucceeded={uploadSucceeded}
            uploadFailedCount={uploadFailedCount}
            uploadProgressRatio={uploadProgressRatio}
            uploadCurrentFile={uploadCurrentFile}
            uploadPhase={uploadPhase}
            uploadActiveCount={uploadActiveCount}
            uploadStartedAt={uploadStartedAt}
            selectedPhotoIds={selectedPhotoIds}
            deletingSelected={deletingSelected}
            bulkFolderLoading={bulkFolderLoading}
            bulkFolderBanner={bulkFolderBanner}
            bulkFolderPick={bulkFolderPick}
            folderBulkEnabled={folderBulkEnabled}
            onFilesSelected={handleFilesSelected}
            onPhotoSelect={handlePhotoSelect}
            onDeletePhoto={handleDeletePhoto}
            onSetCover={album.isOwner ? handleSetCover : undefined}
            onDeleteSelected={() => void handleDeleteSelected()}
            onClearSelection={handleClearPhotoSelection}
            onSelectAll={handleSelectAllPhotos}
            onBulkFolderPickChange={setBulkFolderPick}
            onBulkApplyFolder={() => void handleBulkApplyFolderPick()}
            onBulkClearFolder={() => void handleBulkSetFolder(null)}
            onError={setError}
            uploadEventFolderId={uploadEventFolderId}
            onUploadEventFolderIdChange={setUploadEventFolderId}
            uploadAlbumFolderId={uploadAlbumFolderId}
            onUploadAlbumFolderIdChange={setUploadAlbumFolderId}
          />

          {/* Interesados */}
          <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
            <div className="ds-stack-section gap-4">
            <div className="ds-content-container w-full space-y-2">
            <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Interesados</h2>
            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
              Personas que se registraron para recibir avisos. Enviá el link del álbum por WhatsApp si no vieron el email.
            </p>
            </div>
            {interestedLoading ? (
              <p className="text-[#6b7280] py-4">Cargando interesados...</p>
            ) : interestedList.length === 0 ? (
              <p className="text-[#6b7280] py-4">No hay interesados registrados en este álbum.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Nombre</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Email</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">WhatsApp</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Acciones</th>
                      <th className="text-left py-2 px-2 font-medium text-[#1a1a1a]">Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interestedList.map((i) => (
                      <tr key={i.id} className="border-b border-[#e5e7eb] hover:bg-[#f9fafb]">
                        <td className="py-2 px-2">
                          {[i.name, i.lastName].filter(Boolean).join(" ") || "-"}
                        </td>
                        <td className="py-2 px-2">{i.email}</td>
                        <td className="py-2 px-2">{i.whatsapp || "-"}</td>
                        <td className="py-2 px-2">
                          <a
                            href={i.whatsapp
                              ? (() => {
                                  const c = (i.whatsapp || "").replace(/\D/g, "");
                                  const n = c.startsWith("0") ? "54" + c.slice(1) : c.startsWith("54") ? c : "54" + c.replace(/^0/, "");
                                  return `https://wa.me/${n}?text=${encodeURIComponent(`Hola! Las fotos de tu álbum ya están listas. Podés verlas acá: ${albumPublicUrl || ""}`)}`;
                                })()
                              : "#"
                            }
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                              i.whatsapp
                                ? "border-green-200 bg-green-50 hover:bg-green-100 text-green-700"
                                : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed pointer-events-none"
                            }`}
                            title={i.whatsapp ? "Enviar link del álbum por WhatsApp" : "Sin WhatsApp"}
                            aria-disabled={!i.whatsapp}
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </a>
                        </td>
                        <td className="py-2 px-2 text-[#6b7280]">
                          {new Date(i.createdAt).toLocaleDateString("es-AR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </Card>

              </div>
            )}
            </div>
          </div>

          {/* Modal de recorte de portada */}
          {showCoverCrop && coverCropPhoto && album && (
            <>
              <div
                className="fixed inset-0 bg-black/60 z-40"
                onClick={() => {
                  if (!coverSaving) {
                    setShowCoverCrop(false);
                    setCoverCropPhoto(null);
                  }
                }}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-4xl shrink-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#1a1a1a]">Recortar portada</h2>
                    <button
                      onClick={() => {
                        if (!coverSaving) {
                          setShowCoverCrop(false);
                          setCoverCropPhoto(null);
                        }
                      }}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="relative w-full h-[420px] bg-black/90 rounded-lg overflow-hidden">
                    <Cropper
                      image={buildOriginalUrl(coverCropPhoto.originalKey)}
                      crop={coverCrop}
                      zoom={coverZoom}
                      aspect={1}
                      onCropChange={setCoverCrop}
                      onZoomChange={setCoverZoom}
                      onCropComplete={handleCoverCropComplete}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-[#6b7280]">Zoom</label>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={coverZoom}
                      onChange={(e) => setCoverZoom(Number(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e7eb]">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!coverSaving) {
                          setShowCoverCrop(false);
                          setCoverCropPhoto(null);
                        }
                      }}
                      disabled={coverSaving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSaveCoverCrop}
                      disabled={coverSaving}
                    >
                      {coverSaving ? "Guardando..." : "Guardar portada"}
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Modal para compartir link (portal a body: ancho real del viewport, sin recortes por ancestros) */}
          {showShareModal &&
            typeof document !== "undefined" &&
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-[100] bg-black/50"
                  onClick={() => setShowShareModal(false)}
                  aria-hidden
                />
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 overflow-y-auto overscroll-y-contain">
                  {/* shrink-0: evita que el flex encoja el panel al ancho de una “columna” de texto; ancho explícito con viewport */}
                  <div className="box-border my-auto w-[min(100%,calc(100vw-1.5rem))] sm:w-[min(100%,calc(100vw-2.5rem))] max-w-4xl shrink-0 grow-0">
                    <Card className="w-full max-w-full overflow-x-hidden overflow-y-auto max-h-[min(92vh,900px)] space-y-4 shadow-xl min-w-0">
                      <div className="flex justify-between items-start gap-3">
                        <h2 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] pr-2 leading-snug">
                          {shareUrl && shareUrl.includes("newAlbumUrl")
                            ? "¡Álbum creado!"
                            : "Compartir álbum"}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setShowShareModal(false)}
                          className="shrink-0 text-[#6b7280] hover:text-[#1a1a1a] p-1 rounded-lg hover:bg-[#f3f4f6]"
                          aria-label="Cerrar"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-4 min-w-0">
                        {album && coverPreviewUrl ? (
                          <div className="w-full min-w-0 -mx-1 sm:mx-0">
                            <div className="w-full max-h-48 sm:max-h-64 md:max-h-80 rounded-xl overflow-hidden bg-[#f3f4f6] flex items-center justify-center">
                              <img
                                src={coverPreviewUrl}
                                alt={album.title || "Vista previa del álbum"}
                                className="w-full h-full max-h-48 sm:max-h-64 md:max-h-80 object-cover"
                              />
                            </div>
                          </div>
                        ) : null}
                        {album && (
                          <AlbumSharePanel
                            embedded
                            albumId={album.id}
                            publicSlug={album.publicSlug}
                            eventShareSlug={album.eventShareSlug}
                            photographerHandler={album.photographerHandler}
                            mode={album.mode}
                            primaryShareUrl={shareLink || undefined}
                            title={
                              shareUrl && shareUrl.includes("newAlbumUrl")
                                ? "¡Álbum creado!"
                                : "Compartir álbum"
                            }
                            description={
                              shareUrl && shareUrl.includes("newAlbumUrl")
                                ? shareEligibility.canShare
                                  ? "¡Tu álbum fue creado exitosamente! Copiá el enlace para compartirlo con tus clientes."
                                  : "Álbum creado. Completá la configuración de ventas antes de compartir el enlace con tus clientes."
                                : undefined
                            }
                            variant="compact"
                            disabled={!shareEligibility.canShare}
                          />
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              </>,
              document.body
            )}

          {/* Modal de error para archivos fallidos */}
          {showRetryModal && failedFiles.length > 0 && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={handleCancelRetry}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="mx-auto w-full max-w-4xl min-w-[min(100%,20rem)] shrink-0">
                  <Card className="w-full min-w-0 space-y-4 max-h-[85vh] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start border-b border-[#e5e7eb] pb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-[#1a1a1a]">
                          Error en la subida
                        </h2>
                        <p className="text-sm text-[#6b7280] mt-1">
                          {failedFiles.length} archivo(s) no se pudieron subir. Podés reintentar la carga.
                        </p>
                      </div>
                      <button
                        onClick={handleCancelRetry}
                        className="text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                        aria-label="Cerrar"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {failedFiles.map((failedFile, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border border-red-200 bg-red-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1a1a1a] truncate">
                                {failedFile.file.name}
                              </p>
                              <p className="text-xs text-red-700 mt-1">
                                {failedFile.error}
                              </p>
                              <p className="text-xs text-[#6b7280] mt-1">
                                Tamaño: {(failedFile.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-[#e5e7eb]">
                      <p className="text-xs text-[#6b7280]">
                        💡 Tip: Si falla en el celular, probá con buena señal o subí esas fotos desde una computadora.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          onClick={handleCancelRetry}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="primary"
                          onClick={handleRetryFailed}
                          disabled={uploading}
                        >
                          {uploading ? "Reintentando..." : `Reintentar ${failedFiles.length} archivo(s)`}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
          </DsDashboardInner>
        </div>
    </section>
    </>
  );
}
