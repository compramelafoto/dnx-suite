"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useGateVisibility } from "@/contexts/GateVisibilityContext";
import PhotoGrid from "./PhotoGrid";
import PhotoSlideViewer from "./PhotoSlideViewer";
import HiddenAlbumVerificationGate from "./HiddenAlbumVerificationGate";
import AlbumReactivationBanner from "./AlbumReactivationBanner";
import PendingOrderAlbumBanner from "./PendingOrderAlbumBanner";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";
import FaceBulkOfferModal from "./FaceBulkOfferModal";
import {
  computeFaceBulkOffer,
  readFaceBulkOfferSession,
  writeFaceBulkOfferSession,
} from "@/lib/face-bulk-offer";
import {
  clearAlbumCheckoutSelection,
  readAlbumCheckoutSelection,
  writeAlbumCheckoutSelection,
  writeFaceBulkPackPhotoIds,
} from "@/lib/album-checkout-selection";
import { AlbumTestModeClientBanner } from "@/components/album/AlbumTestModeNotice";
import PublicAlbumMediaTabs from "@/components/public/video/PublicAlbumMediaTabs";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import {
  CHECKOUT_NAV_LANDED_EVENT,
  CHECKOUT_PREPARE_READY_EVENT,
  CHECKOUT_PREPARE_TIMEOUT_MS,
  messageForCheckoutPrepareError,
} from "@/lib/checkout-prepare";
import { isPurchaseUxV2EnabledClient } from "@/lib/album-purchase/purchase-ux-v2-feature-flag";
import PurchaseStickyBar, {
  PURCHASE_STICKY_BAR_CONTENT_PADDING,
} from "@/components/album-purchase/PurchaseStickyBar";
import PurchaseToast from "@/components/album-purchase/PurchaseToast";
import { usePurchaseStickyBarState } from "@/components/album-purchase/hooks/usePurchaseStickyBarState";
import { usePurchaseUxFeedback } from "@/components/album-purchase/hooks/usePurchaseUxFeedback";
import PackBuyerContactSheet from "@/components/album-purchase/PackBuyerContactSheet";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { albumPackClientPriceArs } from "@/lib/album-packs/album-pack-client-price";
import { applyAlbumExtensionSurchargeToClientTotalArs } from "@/lib/pricing/album-extension-surcharge";
import {
  getPublicPackBadgeLabel,
  getPublicPackPurchaseNote,
  getPublicPackSelectionHeadline,
  getPublicPackSelectionHelpText,
  isBulkPhotoSelectionPack,
  type PublicPack,
} from "@/lib/album-packs/public-pack";
import { isAlbumPackGalleryAvailable } from "@/lib/albums/album-pack-gallery-availability";
import type { AlbumPackBuyerContact } from "@/lib/album-packs/validate-album-pack-buyer-contact";
import {
  readStoredAlbumPackBuyerContact,
  writeStoredAlbumPackBuyerContact,
} from "@/lib/album-packs/validate-album-pack-buyer-contact";
import GalleryPricingBand from "@/components/gallery/GalleryPricingBand";
import GallerySalesNotReadyNotice from "@/components/gallery/GallerySalesNotReadyNotice";
import { buildGallerySelectionEstimate, formatGallerySelectionButtonTotal } from "@/lib/gallery/format-gallery-selection-estimate";
import type { GalleryPricingSnapshot } from "@/lib/pricing/gallery-pricing-snapshot";
import { Trash2 } from "lucide-react";

type Album = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  createdAt: string;
  firstPhotoDate?: string | null;
  /** Foto marcada como portada (listados usan URL sin marca; la grilla del álbum siempre preview con marca) */
  coverPhotoId?: number | null;
  expirationExtensionDays?: number | null;
  isHidden?: boolean;
  showComingSoonMessage?: boolean;
  hiddenPhotosEnabled?: boolean;
  /** Protección visual al ampliar fotos no compradas. Activada salvo que el fotógrafo la apague. */
  scanProtectionEnabled?: boolean;
  /** Paquete “todas mis fotos” por reconocimiento facial (precio base en centavos; el checkout suma comisión de plataforma como el digital) */
  enableFaceBulkPurchase?: boolean;
  faceBulkPriceCents?: number | null;
  /** Precio base digital por foto del álbum (centavos), para comparar conveniencia */
  digitalPhotoPriceCents?: number | null;
  /** % fee plataforma sobre base digital (servidor: `getPlatformFeePercent`). */
  checkoutDigitalFeePercent?: number;
  publicVisiblePacks?: PublicPack[];
  photos: { id: number; previewUrl: string; originalKey: string; analysisStatus?: string | null }[];
};

type PublicPackWithClientPrice = PublicPack & {
  clientPriceArs?: number;
};

type PackSelectionModeState = {
  packId: string;
  packName: string;
  requiredCount: number;
  photoIds: Set<string>;
  compositionFulfillmentKind: PublicPack["compositionFulfillmentKind"];
};

type PackDraftPreparedSummary = {
  draftId: string;
  sessionId: string;
  packId: string;
  packName: string;
  selectedCount: number;
  totalCents: number;
  status: string;
};

type PackDraftCartStorage = {
  items: PackDraftPreparedSummary[];
  orderId: number | null;
};

function albumPackGuestTokenStorageKey(albumId: number): string {
  return `album_${albumId}_pack_selection_guest_token`;
}

function albumPackDraftStorageKey(albumId: number): string {
  return `album_${albumId}_pack_order_draft_summary`;
}

function isPackDraftPreparedSummary(value: unknown): value is PackDraftPreparedSummary {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PackDraftPreparedSummary>;
  return (
    typeof row.draftId === "string" &&
    typeof row.sessionId === "string" &&
    typeof row.packName === "string" &&
    typeof row.selectedCount === "number" &&
    typeof row.totalCents === "number" &&
    typeof row.status === "string"
  );
}

function normalizePackDraftPreparedSummary(
  row: Partial<PackDraftPreparedSummary>
): PackDraftPreparedSummary | null {
  if (!isPackDraftPreparedSummary(row)) return null;
  return {
    ...row,
    packId: typeof row.packId === "string" ? row.packId : "",
  };
}

function readStoredPackDraftCart(albumId: number): PackDraftCartStorage {
  if (typeof window === "undefined") {
    return { items: [], orderId: null };
  }
  try {
    const raw = sessionStorage.getItem(albumPackDraftStorageKey(albumId));
    if (!raw) return { items: [], orderId: null };
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        items: parsed
          .map((row) => normalizePackDraftPreparedSummary(row as Partial<PackDraftPreparedSummary>))
          .filter((row): row is PackDraftPreparedSummary => row != null),
        orderId: null,
      };
    }
    if (!parsed || typeof parsed !== "object") {
      return { items: [], orderId: null };
    }
    const record = parsed as Partial<PackDraftCartStorage> & Partial<PackDraftPreparedSummary>;
    const legacyItem = normalizePackDraftPreparedSummary(record);
    if (legacyItem) {
      return {
        items: [legacyItem],
        orderId:
          record.orderId != null && Number.isInteger(Number(record.orderId))
            ? Number(record.orderId)
            : null,
      };
    }
    const items = Array.isArray(record.items)
      ? record.items
          .map((row) => normalizePackDraftPreparedSummary(row as Partial<PackDraftPreparedSummary>))
          .filter((row): row is PackDraftPreparedSummary => row != null)
      : [];
    const orderId =
      record.orderId != null && Number.isInteger(Number(record.orderId))
        ? Number(record.orderId)
        : null;
    return { items, orderId };
  } catch {
    return { items: [], orderId: null };
  }
}

function writeStoredPackDraftCart(
  albumId: number,
  items: PackDraftPreparedSummary[],
  orderId: number | null
) {
  if (typeof window === "undefined") return;
  if (items.length === 0) {
    sessionStorage.removeItem(albumPackDraftStorageKey(albumId));
    return;
  }
  const payload: PackDraftCartStorage = { items, orderId };
  sessionStorage.setItem(albumPackDraftStorageKey(albumId), JSON.stringify(payload));
}

function sumPackCartTotalCents(items: PackDraftPreparedSummary[]): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.totalCents) ? item.totalCents : 0), 0);
}

function packOrderErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "DRAFT_BUYER_EMAIL_REQUIRED":
    case "BUYER_EMAIL_REQUIRED":
      return "Necesitamos tu email para continuar.";
    case "DRAFT_ACCESS_DENIED":
      return "Tu sesión expiró. Volvé a elegir las fotos del pack.";
    case "ALBUM_PACK_PAY_DISABLED":
      return "El pago de packs no está habilitado para este álbum.";
    case "MP_NOT_CONNECTED":
      return "El fotógrafo aún no conectó Mercado Pago para recibir pagos.";
    case "DRAFT_NOT_FOUND":
      return "No encontramos tu selección. Volvé a elegir las fotos del pack.";
    default:
      return fallback;
  }
}

function resolveAlbumPackPlatformFeePercent(feePercent: number | null | undefined): number {
  return typeof feePercent === "number" && Number.isFinite(feePercent) && feePercent >= 0
    ? feePercent
    : 0;
}

/**
 * Normaliza una previewUrl en el cliente para asegurar que sea una URL absoluta válida
 * Esta función es defensiva y solo se ejecuta si el servidor no normalizó correctamente
 */
function normalizePreviewUrlClient(previewUrl: string | null | undefined, originalKey?: string | null): string | null {
  const publicBase =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    "";

  const buildUrlFromKey = (key: string): string | null => {
    if (!publicBase) return null;
    const cleanKey = key.replace(/^\//, "");
    return `${publicBase.replace(/\/$/, "")}/${cleanKey}`;
  };

  const extractKeyFromUrl = (url: string): string | null => {
    const match = url.match(/\/uploads\/.+/);
    if (match?.[0]) {
      return match[0].replace(/^\//, "");
    }
    return null;
  };

  // Si no hay previewUrl ni originalKey, retornar null
  if (!previewUrl && !originalKey) {
    return null;
  }

  // Si previewUrl es null/undefined pero tenemos originalKey, intentar construir desde originalKey
  if (!previewUrl && originalKey) {
    // Construir previewKey desde originalKey
    // originalKey es "uploads/uuid-original_xxx.jpg"
    // previewKey sería "uploads/uuid-preview_xxx.jpg"
    const previewKey = originalKey.replace(/original_/, "preview_");
    const built = buildUrlFromKey(previewKey);
    if (built) return built;
    console.warn("⚠️ previewUrl es null pero tenemos originalKey, falta NEXT_PUBLIC_R2_PUBLIC_URL");
    return null;
  }

  if (!previewUrl) {
    return null;
  }

  // Si ya es una URL absoluta válida, validarla
  if (previewUrl.startsWith("http://") || previewUrl.startsWith("https://")) {
    // Validación defensiva: nunca permitir localhost
    if (previewUrl.includes("localhost") || previewUrl.includes("127.0.0.1")) {
      console.warn(`⚠️ previewUrl con localhost detectada en cliente: ${previewUrl}`);
      // Si tenemos originalKey, intentar construir desde ahí
      if (originalKey) {
        const previewKey = originalKey.replace(/original_/, "preview_");
        const built = buildUrlFromKey(previewKey);
        if (built) return built;
      }
      const keyFromUrl = extractKeyFromUrl(previewUrl);
      if (keyFromUrl) {
        const built = buildUrlFromKey(keyFromUrl);
        if (built) return built;
      }
      return null;
    }
    return previewUrl;
  }

  // Si es un endpoint interno de previews protegidas, usarlo directo
  if (previewUrl.startsWith("/api/photos/")) {
    return previewUrl;
  }

  // Si es una ruta relativa, construir desde base pública
  if (previewUrl.startsWith("/uploads/") || previewUrl.startsWith("uploads/")) {
    const built = buildUrlFromKey(previewUrl);
    if (built) return built;
    console.warn(`⚠️ previewUrl relativa sin base pública: "${previewUrl}"`);
    return null;
  }

  // Si no reconocemos el formato, intentar construir desde originalKey si está disponible
  if (originalKey) {
    console.warn(`⚠️ previewUrl con formato desconocido en cliente: "${previewUrl}", debería haberse normalizado en servidor`);
    return null;
  }

  return previewUrl;
}

/** Ids únicos, orden numérico, solo enteros finitos > 0 (mismo contrato que ComprarClient al parsear). */
function normalizePhotoIdsForComprarQuery(ids: ReadonlyArray<number | string>): number[] {
  const set = new Set<number>();
  for (const raw of ids) {
    const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n > 0) set.add(Math.trunc(n));
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Ruta de compra del álbum. `albumPathBase` debe ser `/a/{id numérico}` (no el slug público): la ruta
 * `app/a/[id]/comprar` valida el segmento como ID. Opcional `source` solo informativo en ComprarClient.
 */
function buildAlbumComprarUrl(
  albumPathBase: string,
  photoIds: ReadonlyArray<number | string>,
  options?: { source?: string; debugCheckout?: boolean }
): string {
  const normalized = normalizePhotoIdsForComprarQuery(photoIds);
  const params = new URLSearchParams();
  params.set("photoIds", normalized.join(","));
  if (options?.source) params.set("source", options.source);
  if (options?.debugCheckout) params.set("debugCheckout", "1");
  const base = albumPathBase.replace(/\/$/, "");
  return `${base}/comprar?${params.toString()}`;
}

/**
 * IDs de fotos válidas en el álbum a partir de ítems devueltos por /search/face (dedupe, orden de llegada).
 */
function uniqueAlbumPhotoIdsFromFaceItems(
  album: Album,
  items: ReadonlyArray<{ id: number }>
): number[] {
  if (!album.photos.length) return [];
  const albumIdSet = new Set(album.photos.map((p) => p.id));
  const seen = new Set<number>();
  const out: number[] = [];
  for (const item of items) {
    const id = item.id;
    if (!Number.isFinite(id) || id <= 0 || !albumIdSet.has(id)) continue;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * IDs incluidos en el pack “face bulk”.
 * - Álbum oculto + grant: allowedPhotoIds del verificador (o todas si el visitante ve el álbum completo).
 * - Álbum no oculto: solo `nonHiddenFaceMatchIds` (última búsqueda facial exitosa; no OCR ni todo el álbum).
 */
function resolveFaceBulkPackTargetIds(
  album: Album,
  hasGrant: boolean,
  allowedPhotoIds: number[] | null,
  nonHiddenFaceMatchIds: readonly number[]
): number[] {
  if (!album.photos.length) return [];
  const albumIdSet = new Set(album.photos.map((p) => p.id));

  if (album.hiddenPhotosEnabled && hasGrant) {
    if (Array.isArray(allowedPhotoIds) && allowedPhotoIds.length > 0) {
      return allowedPhotoIds.filter((id) => albumIdSet.has(id));
    }
    if (allowedPhotoIds === null) {
      return album.photos.map((p) => p.id);
    }
    return [];
  }

  if (nonHiddenFaceMatchIds.length === 0) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of nonHiddenFaceMatchIds) {
    if (!Number.isFinite(id) || id <= 0 || !albumIdSet.has(id)) continue;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export default function ClientAlbumView({
  album,
  galleryPricing,
  enablePrintedPhotos = false,
  publicSlug,
  hasPublicReadyVideos = false,
  publicVideosEnabled = false,
  initialPublicVideos = [],
  tertiaryColor,
  isAccessBlocked,
  initialHasGrant,
  simulateClientView = false,
  photographerBypassGrant = false,
  albumPackPayButtonEnabled = false,
  testClientPreview,
  salesReadyToSell = true,
  singlesPurchaseReady,
  extensionSalesPricing,
}: {
  album: Album;
  /** Snapshot de pricing para banda comercial en galería (servidor). */
  galleryPricing?: GalleryPricingSnapshot | null;
  /** Si el álbum permite impresiones (copy de selección; no afecta precios). */
  enablePrintedPhotos?: boolean;
  /** Slug público del álbum (`/album/[slug]`) para listar videos READY. */
  publicSlug?: string | null;
  /** Servidor: hay videos READY publicables (permite galería sin fotos). */
  hasPublicReadyVideos?: boolean;
  /** Servidor: feature flag MVP (`isVideoMvpEnabled`). */
  publicVideosEnabled?: boolean;
  /** Videos READY precargados en servidor (pestaña sin depender del fetch público). */
  initialPublicVideos?: PublicVideoDto[];
  tertiaryColor?: string | null;
  isAccessBlocked?: boolean;
  /** Si es true (ej. dueño o admin), no se muestra el gate ni loading; se muestran las fotos de entrada */
  initialHasGrant?: boolean;
  /** Vista simulada de cliente (?vista=cliente) para el fotógrafo dueño */
  simulateClientView?: boolean;
  /** Dueño/admin con bypass de grant (para banner de prueba) */
  photographerBypassGrant?: boolean;
  /** True solo si ALBUM_PACK_PUBLIC_PAY_ENABLED y álbum tienen habilitado el pago de packs. */
  albumPackPayButtonEnabled?: boolean;
  /** Vista simulada para el fotógrafo (álbum modo TEST) */
  testClientPreview?: boolean;
  /** Si false, la galería es solo visualización (sin precios ni compra). */
  salesReadyToSell?: boolean;
  /** Compra suelta en grilla (digital y/o impresiones listas). */
  singlesPurchaseReady?: boolean;
  /** Recargo por período extendido del álbum (packs y totales mostrados). */
  extensionSalesPricing?: {
    active: boolean;
    extensionDays: number;
    surchargePercentForDisplay: number;
    fixedPricePer30DaysArs: number | null;
  } | null;
}) {
  const accentColor = tertiaryColor || "#c27b3d";
  const canPurchaseSingles = singlesPurchaseReady ?? salesReadyToSell;
  const canPurchasePacks = isAlbumPackGalleryAvailable(album.publicVisiblePacks?.length ?? 0);
  const purchaseUxV2 = isPurchaseUxV2EnabledClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const albumComprarPathBase = `/a/${album.id}`;

  function handleRequestRemoval(photoId: string) {
    router.push(`/a/${album.id}/remover/${photoId}`);
  }
  
  // Inicializar con un Set vacío para evitar problemas de hidratación
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [notificationName, setNotificationName] = useState("");
  const [notificationWhatsapp, setNotificationWhatsapp] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notificationSubmitted, setNotificationSubmitted] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSelfie, setNotificationSelfie] = useState<File | null>(null);
  const [notificationSelfiePreview, setNotificationSelfiePreview] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [biometricConsent, setBiometricConsent] = useState(false);
  const notificationSelfieInputRef = useRef<HTMLInputElement | null>(null);
  const [showSlideViewer, setShowSlideViewer] = useState(false);
  const [slideViewerIndex, setSlideViewerIndex] = useState(0);
  const [slideViewerPhotoList, setSlideViewerPhotoList] = useState<Array<{ id: string; src: string; alt: string; selected: boolean }>>([]);
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionSuccess, setExtensionSuccess] = useState(false);
  const [searchTab, setSearchTab] = useState<"text" | "face">("text");
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ id: number; previewUrl: string; originalKey: string; analysisStatus?: string | null }>>([]);
  /** Solo búsqueda facial (no OCR): base del pack en álbumes no ocultos. */
  const [lastFaceSearchMatchIds, setLastFaceSearchMatchIds] = useState<number[]>([]);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const [faceInputMode, setFaceInputMode] = useState<"camera" | "file">("camera");
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showFaceConsentModal, setShowFaceConsentModal] = useState(false);
  const [faceConsentLoading, setFaceConsentLoading] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: number; faceConsent?: boolean } | null | undefined>(undefined);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showFaceBulkOfferModal, setShowFaceBulkOfferModal] = useState(false);
  /** True si el usuario ya interactuó con la oferta del modal en esta sesión (o venía guardado en sessionStorage). */
  const [faceBulkOfferHandled, setFaceBulkOfferHandled] = useState(false);
  /** Ref sincronizado con los ids del pack para el click del modal (evita cierres/navegación con lista vacía). */
  const faceBulkPackIdsRef = useRef<number[]>([]);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const packsSectionRef = useRef<HTMLElement | null>(null);

  // Verificación de grant para álbum con fotos ocultas (dueño/admin ya tienen grant desde el servidor → sin parpadeo del gate)
  const [grantLoading, setGrantLoading] = useState(
    !!album.hiddenPhotosEnabled && !initialHasGrant
  );
  const [hasGrant, setHasGrant] = useState(
    !album.hiddenPhotosEnabled || !!initialHasGrant
  );
  /** IDs de fotos que el usuario puede ver tras selfie; null = ver todas (dueño/admin o álbum sin ocultas) */
  const [allowedPhotoIds, setAllowedPhotoIds] = useState<number[] | null>(null);

  useEffect(() => {
    if (!album.hiddenPhotosEnabled) {
      setHasGrant(true);
      setGrantLoading(false);
      setAllowedPhotoIds(null);
      return;
    }
    let cancelled = false;
    const grantUrl = simulateClientView
      ? `/api/albums/${album.id}/hidden/check-grant?simulate=1`
      : `/api/albums/${album.id}/hidden/check-grant`;
    fetch(grantUrl, { credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled) {
          setHasGrant(Boolean(data?.hasGrant));
          setAllowedPhotoIds(
            Array.isArray(data?.allowedPhotoIds) ? data.allowedPhotoIds : null
          );
        }
      })
      .finally(() => {
        if (!cancelled) setGrantLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [album.id, album.hiddenPhotosEnabled, simulateClientView]);

  const gateVisibility = useGateVisibility();
  const gateVisible = Boolean(album.hiddenPhotosEnabled && (grantLoading || !hasGrant));
  useEffect(() => {
    gateVisibility?.setGateVisible(gateVisible);
    return () => {
      gateVisibility?.setGateVisible(false);
    };
  }, [gateVisible, gateVisibility]);

  const hasSelection = selected.size > 0;
  const checkoutDebugEnabled =
    searchParams.get("debugCheckout") === "1" ||
    process.env.NEXT_PUBLIC_CHECKOUT_DEBUG === "1";
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutSubmitError, setCheckoutSubmitError] = useState<string | null>(null);
  const checkoutFallbackTimerRef = useRef<number | null>(null);
  const checkoutRetryHrefRef = useRef<string | null>(null);

  const clearCheckoutPrepareTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (checkoutFallbackTimerRef.current != null) {
      window.clearTimeout(checkoutFallbackTimerRef.current);
      checkoutFallbackTimerRef.current = null;
    }
  }, []);
  const [packSelectionMode, setPackSelectionMode] = useState<PackSelectionModeState | null>(null);
  const [packSelectionSaving, setPackSelectionSaving] = useState(false);
  const [packSelectionError, setPackSelectionError] = useState<string | null>(null);
  const [packPaymentSubmitting, setPackPaymentSubmitting] = useState(false);
  const [packPaymentError, setPackPaymentError] = useState<string | null>(null);
  const [packDraftPreparedSummaries, setPackDraftPreparedSummaries] = useState<
    PackDraftPreparedSummary[]
  >([]);
  const [packCartOrderId, setPackCartOrderId] = useState<number | null>(null);
  const [packBuyerContactSheetOpen, setPackBuyerContactSheetOpen] = useState(false);
  const [packBuyerContactInitial, setPackBuyerContactInitial] =
    useState<Partial<AlbumPackBuyerContact> | null>(null);
  const [pendingAllPhotosPack, setPendingAllPhotosPack] = useState<{
    packId: string;
    packName: string;
  } | null>(null);

  const canSelectPhotosForPurchase = canPurchaseSingles || packSelectionMode != null;

  const singlesSelectionCount = packSelectionMode
    ? packSelectionMode.photoIds.size
    : selected.size;

  const gallerySelectionEstimate = useMemo(
    () =>
      packSelectionMode
        ? null
        : buildGallerySelectionEstimate(galleryPricing, singlesSelectionCount),
    [galleryPricing, singlesSelectionCount, packSelectionMode]
  );

  const photoSelectionHelpText = useMemo(() => {
    if (packSelectionMode) {
      const activePack = (album.publicVisiblePacks ?? []).find(
        (p) => p.id === packSelectionMode.packId
      );
      const printSpec =
        activePack?.size && activePack?.finish
          ? `${activePack.size} ${activePack.finish}`
          : activePack?.size ?? null;
      const help = getPublicPackSelectionHelpText(
        packSelectionMode.packName,
        packSelectionMode.requiredCount,
        packSelectionMode.compositionFulfillmentKind,
        printSpec
      );
      return (
        <>
          <strong className="text-[#1a1a1a]">Estás armando un pack.</strong> {help} Guardá la
          selección cuando termines.
        </>
      );
    }
    if (enablePrintedPhotos) {
      return (
        <>
          Seleccioná las fotos que querés comprar. En el siguiente paso vas a poder elegir archivo
          digital o impresión, según las opciones disponibles.
        </>
      );
    }
    return (
      <>
        Seleccioná las fotos que querés comprar. Después tocá{" "}
        <strong className="text-[#1a1a1a]">Comprar seleccionadas</strong> para continuar con la
        compra digital.
      </>
    );
  }, [packSelectionMode, enablePrintedPhotos, album.publicVisiblePacks]);

  const startCheckoutNavigation = useCallback((href: string) => {
    if (typeof window === "undefined") return;
    const navStartPerf = performance.now();
    const clickPerfRaw = sessionStorage.getItem(`album_${album.id}_checkout_click_perf`);
    const clickToNavMs = clickPerfRaw ? Math.round(navStartPerf - Number(clickPerfRaw)) : null;
    sessionStorage.setItem(`album_${album.id}_checkout_nav_start_ms`, String(Date.now()));
    sessionStorage.setItem(`album_${album.id}_checkout_nav_start_perf`, String(navStartPerf));
    checkoutRetryHrefRef.current = href;
    console.info("[checkout-prepare] starting", {
      albumId: album.id,
      selectedCount: readAlbumCheckoutSelection(String(album.id)).length,
    });
    if (checkoutDebugEnabled) {
      console.info("[checkout-debug] Inicio navegación a checkout", {
        albumId: album.id,
        href,
        clickToNavigationMs: clickToNavMs,
      });
    }
    clearCheckoutPrepareTimer();
    checkoutFallbackTimerRef.current = window.setTimeout(() => {
      console.warn("[checkout-prepare] error", { albumId: album.id, kind: "timeout" });
      setCheckoutSubmitting(false);
      setCheckoutSubmitError(messageForCheckoutPrepareError("timeout"));
    }, CHECKOUT_PREPARE_TIMEOUT_MS);
    router.push(href);
  }, [router, album.id, checkoutDebugEnabled, clearCheckoutPrepareTimer]);

  useEffect(() => {
    const albumIdStr = String(album.id);
    const onCheckoutSignal = (e: Event) => {
      const detail = (e as CustomEvent<{ albumId?: string }>).detail;
      if (detail?.albumId !== albumIdStr) return;
      clearCheckoutPrepareTimer();
      setCheckoutSubmitting(false);
      setCheckoutSubmitError(null);
    };
    window.addEventListener(CHECKOUT_NAV_LANDED_EVENT, onCheckoutSignal);
    window.addEventListener(CHECKOUT_PREPARE_READY_EVENT, onCheckoutSignal);
    return () => {
      window.removeEventListener(CHECKOUT_NAV_LANDED_EVENT, onCheckoutSignal);
      window.removeEventListener(CHECKOUT_PREPARE_READY_EVENT, onCheckoutSignal);
      clearCheckoutPrepareTimer();
    };
  }, [album.id, clearCheckoutPrepareTimer]);

  const handleCheckoutRetry = useCallback(() => {
    const href = checkoutRetryHrefRef.current;
    if (!href || checkoutSubmitting) return;
    setCheckoutSubmitError(null);
    setCheckoutSubmitting(true);
    startCheckoutNavigation(href);
  }, [checkoutSubmitting, startCheckoutNavigation]);
  

  // Si llega con ?fotos=1&t=TOKEN (link del email), cargar fotos filtradas por rostro
  const fotosParam = searchParams.get("fotos");
  const tokenParam = searchParams.get("t");
  useEffect(() => {
    if (fotosParam !== "1" || !tokenParam || album.photos.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/a/my-face-photos?t=${encodeURIComponent(tokenParam)}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.photoIds) && data.photoIds.length > 0) {
          const idSet = new Set(data.photoIds);
          const filtered = album.photos.filter((p) => idSet.has(p.id));
          if (filtered.length > 0) {
            setSearchResults(filtered);
            setSearchTab("face");
            if (!album.hiddenPhotosEnabled) {
              setLastFaceSearchMatchIds(filtered.map((p) => p.id));
            }
            // Limpiar la URL de los params
            const url = new URL(window.location.href);
            url.searchParams.delete("fotos");
            url.searchParams.delete("t");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [fotosParam, tokenParam, album.id, album.photos]);

  // Cargar selección guardada desde sessionStorage solo en el cliente después del mount
  useEffect(() => {
    setMounted(true);
    try {
      const ids = readAlbumCheckoutSelection(String(album.id));
      if (ids.length > 0) {
        setSelected(new Set(ids.map(String)));
      }
    } catch {}
  }, [album.id]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const stored = readStoredPackDraftCart(album.id);
    setPackDraftPreparedSummaries(stored.items);
    setPackCartOrderId(stored.orderId);
  }, [mounted, album.id]);

  useEffect(() => {
    if (!mounted) return;
    if (readFaceBulkOfferSession(album.id)) setFaceBulkOfferHandled(true);
  }, [mounted, album.id]);

  // Guardar selección en sessionStorage cada vez que cambia (solo si está montado)
  useEffect(() => {
    if (!mounted) return;
    const arr = normalizePhotoIdsForComprarQuery(Array.from(selected));
    if (arr.length > 0) {
      writeAlbumCheckoutSelection(String(album.id), arr);
    } else {
      clearAlbumCheckoutSelection(String(album.id));
    }
  }, [selected, album.id, mounted]);

  useEffect(() => {
    if (!faceFile) {
      if (facePreviewUrl) URL.revokeObjectURL(facePreviewUrl);
      setFacePreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(faceFile);
    setFacePreviewUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [faceFile, facePreviewUrl]);

  // Preview de selfie para registro de interés
  useEffect(() => {
    if (!notificationSelfie) {
      if (notificationSelfiePreview) URL.revokeObjectURL(notificationSelfiePreview);
      setNotificationSelfiePreview(null);
      return;
    }
    const nextUrl = URL.createObjectURL(notificationSelfie);
    setNotificationSelfiePreview(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [notificationSelfie, notificationSelfiePreview]);

  // Cerrar modales con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showFaceModal) {
          setShowFaceModal(false);
        }
        if (showOcrModal) {
          setShowOcrModal(false);
        }
      }
    }
    if (showFaceModal || showOcrModal) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showFaceModal, showOcrModal]);

  // Mantener la lista del slide en sync con la selección para que el botón "Seleccionar" se actualice
  const activeSelectionSet = packSelectionMode?.photoIds ?? selected;

  useEffect(() => {
    if (!showSlideViewer || slideViewerPhotoList.length === 0) return;
    setSlideViewerPhotoList((prev) =>
      prev.map((p) => ({ ...p, selected: activeSelectionSet.has(p.id) }))
    );
  }, [activeSelectionSet, showSlideViewer]);

  function toggle(id: string) {
    if (packSelectionMode) {
      setPackSelectionError(null);
      setPackSelectionMode((prev) => {
        if (!prev) return prev;
        const next = new Set(prev.photoIds);
        if (next.has(id)) {
          next.delete(id);
          return { ...prev, photoIds: next };
        }
        if (next.size >= prev.requiredCount) {
          setPackSelectionError(`Este pack requiere exactamente ${prev.requiredCount} fotos.`);
          return prev;
        }
        next.add(id);
        return { ...prev, photoIds: next };
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleComprar() {
    if (checkoutSubmitting) return;
    if (selected.size === 0) return;
    setCheckoutSubmitting(true);
    setCheckoutSubmitError(null);
    const arr = normalizePhotoIdsForComprarQuery(Array.from(selected));
    if (arr.length === 0) {
      alert(
        "No pudimos armar la lista de fotos para comprar. Probá actualizar la página o elegir otras fotos."
      );
      setCheckoutSubmitting(false);
      return;
    }
    writeAlbumCheckoutSelection(String(album.id), arr);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`album_${album.id}_checkout_click_perf`, String(performance.now()));
    }
    if (checkoutDebugEnabled) {
      console.info("[checkout-debug] Click comprar seleccionadas", {
        albumId: album.id,
        selectedCount: arr.length,
      });
    }
    const checkoutUrl = buildAlbumComprarUrl(albumComprarPathBase, arr, {
      debugCheckout: checkoutDebugEnabled,
    });
    startCheckoutNavigation(checkoutUrl);
  }

  async function openFaceSearchFlow() {
    setSearchTab("face");
    setPackSelectionError(null);
    if (authUser === undefined) {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const u = data?.user ?? null;
      setAuthUser(u ? { id: u.id, faceConsent: u.faceConsent } : null);
      if (
        u?.faceConsent ||
        (typeof window !== "undefined" && sessionStorage.getItem("faceConsentSession"))
      ) {
        setShowFaceModal(true);
      } else {
        setShowFaceConsentModal(true);
      }
      return;
    }
    if (
      authUser?.faceConsent ||
      (typeof window !== "undefined" && sessionStorage.getItem("faceConsentSession"))
    ) {
      setShowFaceModal(true);
    } else {
      setShowFaceConsentModal(true);
    }
  }

  function handleStartAllPhotosPack(pack: PublicPack) {
    if (checkoutSubmitting || packSelectionSaving || packPaymentSubmitting) return;
    setPackPaymentError(null);
    setPackSelectionError(null);
    setPackSelectionMode(null);
    setPendingAllPhotosPack({ packId: pack.id, packName: pack.name });
    void openFaceSearchFlow();
  }

  async function handleStartAllEventPhotosPack(pack: PublicPack) {
    if (checkoutSubmitting || packSelectionSaving || packPaymentSubmitting) return;
    const photoIds = album.photos.map((photo) => photo.id);
    if (photoIds.length === 0) {
      setPackSelectionError("No hay fotos disponibles en este álbum.");
      return;
    }
    setPendingAllPhotosPack(null);
    setPackPaymentError(null);
    setPackSelectionError(null);
    setPackSelectionMode(null);
    setPackSelectionSaving(true);
    try {
      await persistPackSelectionForAlbumPack({
        packId: pack.id,
        packName: pack.name,
        photoIds,
      });
    } catch (packErr: unknown) {
      const message =
        packErr instanceof Error ? packErr.message : "No pudimos preparar el pack.";
      setPackSelectionError(message);
    } finally {
      setPackSelectionSaving(false);
    }
  }

  function handleStartPackPurchase(pack: PublicPackWithClientPrice) {
    if (pack.selectionMode === "ALL_MY_PHOTOS") {
      handleStartAllPhotosPack(pack);
      return;
    }
    if (pack.selectionMode === "ALL_EVENT_PHOTOS") {
      void handleStartAllEventPhotosPack(pack);
      return;
    }
    handleStartPackSelection(pack);
  }

  function handleStartPackSelection(pack: PublicPack) {
    if (checkoutSubmitting || packSelectionSaving || packPaymentSubmitting) return;
    const requiredCount = Number(pack.includedPhotoCount ?? 0);
    if (!pack.requiresSelection || !Number.isFinite(requiredCount) || requiredCount <= 0) {
      setPackSelectionError("Este pack no está listo para selección de fotos.");
      return;
    }
    setPendingAllPhotosPack(null);
    setPackPaymentError(null);
    setPackSelectionError(null);
    setPackSelectionMode({
      packId: pack.id,
      packName: pack.name,
      requiredCount,
      photoIds: new Set<string>(),
      compositionFulfillmentKind: pack.compositionFulfillmentKind,
    });
  }

  async function persistPackSelectionForAlbumPack(params: {
    packId: string;
    packName: string;
    photoIds: number[];
  }) {
    const selectedIds = params.photoIds.filter((n) => Number.isFinite(n) && n > 0);
    if (selectedIds.length === 0) {
      throw new Error("No hay fotos para guardar en el pack.");
    }

    const storedGuestToken =
      typeof window === "undefined"
        ? null
        : sessionStorage.getItem(albumPackGuestTokenStorageKey(album.id));
    const res = await fetch("/api/album-pack-selections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        albumId: album.id,
        albumPackId: params.packId,
        photoIds: selectedIds,
        ...(storedGuestToken ? { guestToken: storedGuestToken } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data?.error === "string" ? data.error : "No se pudo guardar la selección del pack."
      );
    }

    const sessionId = String(data?.session?.id ?? "").trim();
    const guestToken = String(data?.guestToken ?? "").trim();
    if (!sessionId) {
      throw new Error("La sesión de selección no se creó correctamente.");
    }
    const finalGuestToken = guestToken || storedGuestToken || "";
    if (typeof window !== "undefined" && finalGuestToken) {
      sessionStorage.setItem(albumPackGuestTokenStorageKey(album.id), finalGuestToken);
    }

    const markReadyRes = await fetch(`/api/album-pack-selections/${sessionId}/mark-ready`, {
      method: "POST",
      headers: {
        ...(finalGuestToken ? { "x-guest-token": finalGuestToken } : {}),
      },
    });
    const markReadyData = await markReadyRes.json().catch(() => ({}));
    if (!markReadyRes.ok) {
      throw new Error(
        typeof markReadyData?.error === "string"
          ? markReadyData.error
          : "No se pudo confirmar la selección del pack."
      );
    }

    const draftRes = await fetch("/api/album-pack-order-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        ...(finalGuestToken ? { guestToken: finalGuestToken } : {}),
      }),
    });
    const draftData = await draftRes.json().catch(() => ({}));
    if (!draftRes.ok) {
      throw new Error("No pudimos preparar la compra. Intentá nuevamente.");
    }

    const draftId = String(draftData?.draftId ?? "").trim();
    const draftStatus = String(draftData?.summary?.status ?? "").trim() || "DRAFT";
    const packName = String(draftData?.summary?.pack?.name ?? "").trim() || params.packName;
    const packId = String(draftData?.summary?.pack?.id ?? params.packId).trim();
    const totalCents = Number(draftData?.summary?.totalCents ?? 0);
    const preparedSummary: PackDraftPreparedSummary = {
      draftId,
      sessionId,
      packId,
      packName,
      selectedCount: selectedIds.length,
      totalCents: Number.isFinite(totalCents) ? totalCents : 0,
      status: draftStatus,
    };

    setPackDraftPreparedSummaries((prev) => {
      const next = [...prev, preparedSummary];
      writeStoredPackDraftCart(album.id, next, null);
      return next;
    });
    setPackCartOrderId(null);
  }

  async function handleRemovePreparedPack(draftId: string) {
    if (packPaymentSubmitting) return;
    const storedGuestToken =
      typeof window === "undefined"
        ? null
        : sessionStorage.getItem(albumPackGuestTokenStorageKey(album.id));

    try {
      await fetch(`/api/album-pack-order-drafts/${draftId}`, {
        method: "DELETE",
        headers: {
          ...(storedGuestToken ? { "x-guest-token": storedGuestToken } : {}),
        },
      });
    } catch {}

    setPackDraftPreparedSummaries((prev) => {
      const next = prev.filter((item) => item.draftId !== draftId);
      writeStoredPackDraftCart(album.id, next, null);
      return next;
    });
    setPackCartOrderId(null);
    setPackPaymentError(null);
  }

  function handleCancelPackSelection() {
    if (packSelectionSaving) return;
    setPackSelectionMode(null);
    setPackSelectionError(null);
  }

  async function handleSavePackSelection() {
    if (!packSelectionMode || packSelectionSaving) return;
    const selectedIds = Array.from(packSelectionMode.photoIds).map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n) && n > 0);
    if (selectedIds.length !== packSelectionMode.requiredCount) {
      setPackSelectionError(
        `Para continuar tenés que seleccionar exactamente ${packSelectionMode.requiredCount} fotos.`
      );
      return;
    }

    setPackSelectionSaving(true);
    setPackSelectionError(null);
    setPackPaymentError(null);
    try {
      await persistPackSelectionForAlbumPack({
        packId: packSelectionMode.packId,
        packName: packSelectionMode.packName,
        photoIds: selectedIds,
      });
      setPackSelectionMode(null);
    } catch (err: any) {
      const message = String(err?.message ?? "");
      if (message.includes("Revisá la cantidad de fotos seleccionadas.")) {
        setPackSelectionError("Revisá la cantidad de fotos seleccionadas.");
      } else if (message.includes("No pudimos preparar la compra. Intentá nuevamente.")) {
        setPackSelectionError("No pudimos preparar la compra. Intentá nuevamente.");
      } else {
        setPackSelectionError(message || "No se pudo guardar la selección del pack.");
      }
    } finally {
      setPackSelectionSaving(false);
    }
  }

  async function resolvePackBuyerContact(): Promise<{
    contact: AlbumPackBuyerContact | null;
    initial: Partial<AlbumPackBuyerContact> | null;
  }> {
    const stored = readStoredAlbumPackBuyerContact(album.id);
    if (stored) {
      return { contact: stored, initial: stored };
    }

    let initial: Partial<AlbumPackBuyerContact> | null = null;
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const user = data?.user;
      if (user?.email) {
        initial = {
          buyerEmail: String(user.email),
          buyerName: String(user.name ?? "").trim() || undefined,
        };
      }
    } catch {}

    return { contact: null, initial };
  }

  async function executePackPayment(buyerContact?: AlbumPackBuyerContact | null) {
    if (packDraftPreparedSummaries.length === 0 || packPaymentSubmitting) return;
    setPackPaymentSubmitting(true);
    setPackPaymentError(null);
    try {
      const storedGuestToken =
        typeof window === "undefined"
          ? null
          : sessionStorage.getItem(albumPackGuestTokenStorageKey(album.id));

      let orderId = packCartOrderId;
      if (!orderId) {
        const draftIds = packDraftPreparedSummaries.map((item) => item.draftId);
        const useCombinedOrder = draftIds.length > 1;
        const createOrderRes = await fetch(
          useCombinedOrder
            ? "/api/album-pack-order-drafts/create-combined-order"
            : `/api/album-pack-order-drafts/${draftIds[0]}/create-order`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(storedGuestToken ? { "x-guest-token": storedGuestToken } : {}),
            },
            body: JSON.stringify({
              ...(useCombinedOrder ? { draftIds } : {}),
              ...(buyerContact
                ? {
                    buyerEmail: buyerContact.buyerEmail,
                    buyerName: buyerContact.buyerName,
                    buyerPhone: buyerContact.buyerPhone,
                  }
                : {}),
            }),
          }
        );
        const createOrderData = await createOrderRes.json().catch(() => ({}));
        if (!createOrderRes.ok) {
          const code = String(createOrderData?.code ?? "").trim();
          if (
            code === "DRAFT_BUYER_EMAIL_REQUIRED" ||
            code === "BUYER_EMAIL_REQUIRED" ||
            code === "BUYER_NAME_REQUIRED" ||
            code === "BUYER_PHONE_REQUIRED" ||
            code === "BUYER_PHONE_INVALID"
          ) {
            setPackBuyerContactSheetOpen(true);
            throw new Error(
              typeof createOrderData?.error === "string"
                ? createOrderData.error
                : "Completá tus datos para continuar."
            );
          }
          throw new Error(
            packOrderErrorMessage(
              code,
              typeof createOrderData?.error === "string"
                ? createOrderData.error
                : "No pudimos generar la orden. Intentá nuevamente."
            )
          );
        }
        const nextOrderId = Number(createOrderData?.orderId);
        if (!Number.isInteger(nextOrderId) || nextOrderId <= 0) {
          throw new Error("No pudimos generar la orden. Intentá nuevamente.");
        }
        orderId = nextOrderId;
        setPackCartOrderId(nextOrderId);
        writeStoredPackDraftCart(album.id, packDraftPreparedSummaries, nextOrderId);
      }

      const prefRes = await fetch(
        `/api/album-pack-orders/${orderId}/create-payment-preference`,
        {
          method: "POST",
          headers: {
            ...(storedGuestToken ? { "x-guest-token": storedGuestToken } : {}),
          },
        }
      );
      const prefData = await prefRes.json().catch(() => ({}));
      if (!prefRes.ok) {
        const code = String(prefData?.code ?? "").trim();
        throw new Error(
          packOrderErrorMessage(
            code,
            typeof prefData?.error === "string"
              ? prefData.error
              : "No pudimos iniciar el pago. Intentá nuevamente."
          )
        );
      }
      const initPoint = String(prefData?.initPoint ?? "").trim();
      if (!initPoint) {
        throw new Error("No pudimos iniciar el pago. Intentá nuevamente.");
      }
      if (typeof window !== "undefined") {
        window.location.href = initPoint;
      }
    } catch (err: any) {
      const message = String(err?.message ?? "");
      if (message.includes("Completá tus datos")) {
        setPackPaymentError(null);
      } else if (message.includes("No pudimos generar la orden")) {
        setPackPaymentError(message);
      } else if (message.includes("No pudimos iniciar el pago")) {
        setPackPaymentError(message);
      } else if (message.includes("Tu sesión expiró")) {
        setPackPaymentError(message);
      } else if (message.includes("Mercado Pago")) {
        setPackPaymentError(message);
      } else {
        setPackPaymentError(message || "No pudimos iniciar el pago. Intentá nuevamente.");
      }
    } finally {
      setPackPaymentSubmitting(false);
    }
  }

  async function handlePayPreparedPack() {
    if (packDraftPreparedSummaries.length === 0 || packPaymentSubmitting) return;
    const { contact, initial } = await resolvePackBuyerContact();
    if (initial) setPackBuyerContactInitial(initial);
    if (!contact) {
      setPackBuyerContactSheetOpen(true);
      return;
    }
    await executePackPayment(contact);
  }

  async function handlePackBuyerContactSubmit(contact: AlbumPackBuyerContact) {
    writeStoredAlbumPackBuyerContact(album.id, contact);
    setPackBuyerContactSheetOpen(false);
    await executePackPayment(contact);
  }


  async function handleNotifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notificationName.trim() || !notificationWhatsapp.trim()) return;
    
    // Validar términos y condiciones
    if (!termsAccepted) {
      alert("Debés aceptar los Términos y Condiciones para continuar.");
      return;
    }
    
    // Validar consentimiento biométrico si hay selfie
    if (notificationSelfie && !biometricConsent) {
      alert("Si subís una selfie, debés aceptar el consentimiento biométrico para que podamos avisarte cuando aparezcan tus fotos.");
      return;
    }

    setNotificationLoading(true);
    try {
      // Dividir el nombre completo en nombre y apellido (si hay espacio)
      const nameParts = notificationName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Si hay selfie, usar el nuevo endpoint con FormData
      if (notificationSelfie) {
        const formData = new FormData();
        formData.append("name", firstName);
        formData.append("lastName", lastName);
        formData.append("whatsapp", notificationWhatsapp.trim());
        formData.append("email", notificationEmail.trim() || "");
        formData.append("selfie", notificationSelfie);
        formData.append("termsAccepted", "true");
        formData.append("biometricConsent", "true");

        const res = await fetch(`/api/a/${album.id}/register-interest`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error registrando interés");
        }
      } else {
        // Sin selfie, usar el endpoint tradicional
        const res = await fetch(`/api/a/${album.id}/notifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: firstName,
            lastName: lastName,
            whatsapp: notificationWhatsapp.trim(),
            email: notificationEmail.trim() || undefined
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error suscribiendo notificación");
        }
      }

      setNotificationSubmitted(true);
      setNotificationName("");
      setNotificationWhatsapp("");
      setNotificationEmail("");
      setNotificationSelfie(null);
      setNotificationSelfiePreview(null);
      setTermsAccepted(false);
      setBiometricConsent(false);
    } catch (err: any) {
      alert(err?.message || "Error. Por favor intentá nuevamente.");
    } finally {
      setNotificationLoading(false);
    }
  }

  const faceBulkPackState = useMemo(() => {
    const targetIds = resolveFaceBulkPackTargetIds(
      album,
      hasGrant,
      allowedPhotoIds,
      lastFaceSearchMatchIds
    );
    const feePct = album.checkoutDigitalFeePercent;
    return {
      targetIds,
      offer: computeFaceBulkOffer(album, targetIds, {
        platformFeePercent:
          typeof feePct === "number" && Number.isFinite(feePct) && feePct >= 0 ? feePct : undefined,
      }),
    };
  }, [album, hasGrant, allowedPhotoIds, lastFaceSearchMatchIds]);

  const faceBulkTargetPhotoIds = faceBulkPackState.targetIds;
  const faceBulkOffer = faceBulkPackState.offer;
  faceBulkPackIdsRef.current = faceBulkTargetPhotoIds;

  const goToFaceBulkCheckout = useCallback(() => {
    if (checkoutSubmitting) return;
    setCheckoutSubmitting(true);
    setCheckoutSubmitError(null);
    const ids = normalizePhotoIdsForComprarQuery(faceBulkPackIdsRef.current);
    if (ids.length === 0) {
      alert(
        "No pudimos armar el pack de fotos para el checkout. Probá cerrar y volver a buscar tu rostro, o elegí las fotos a mano en la galería."
      );
      setCheckoutSubmitting(false);
      return;
    }
    try {
      writeAlbumCheckoutSelection(String(album.id), ids);
      writeFaceBulkPackPhotoIds(String(album.id), ids);
    } catch {
      alert(
        "No se pudo guardar la selección en el navegador. Probá de nuevo, desactivá el modo privado o usá otra ventana."
      );
      setCheckoutSubmitting(false);
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`album_${album.id}_checkout_click_perf`, String(performance.now()));
    }
    const href = buildAlbumComprarUrl(albumComprarPathBase, ids, {
      source: "face-bulk",
      debugCheckout: checkoutDebugEnabled,
    });
    startCheckoutNavigation(href);
  }, [album.id, albumComprarPathBase, checkoutSubmitting, startCheckoutNavigation, checkoutDebugEnabled]);

  const dismissFaceBulkOffer = useCallback(
    (session: "dismissed" | "converted") => {
      writeFaceBulkOfferSession(album.id, session);
      setFaceBulkOfferHandled(true);
      setShowFaceBulkOfferModal(false);
    },
    [album.id]
  );

  const handleFaceBulkOfferBuyAll = useCallback(() => {
    if (checkoutSubmitting) return;
    setCheckoutSubmitting(true);
    setCheckoutSubmitError(null);
    const ids = normalizePhotoIdsForComprarQuery(faceBulkPackIdsRef.current);
    if (ids.length === 0) {
      alert(
        "No pudimos armar el pack de fotos. Probá cerrar el modal y volver a buscar tu rostro."
      );
      setCheckoutSubmitting(false);
      return;
    }
    try {
      writeAlbumCheckoutSelection(String(album.id), ids);
      writeFaceBulkPackPhotoIds(String(album.id), ids);
    } catch {
      alert(
        "No se pudo guardar la selección en el navegador. Probá de nuevo o desactivá el modo privado."
      );
      setCheckoutSubmitting(false);
      return;
    }
    writeFaceBulkOfferSession(album.id, "converted");
    setFaceBulkOfferHandled(true);
    setShowFaceBulkOfferModal(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`album_${album.id}_checkout_click_perf`, String(performance.now()));
    }
    const href = buildAlbumComprarUrl(albumComprarPathBase, ids, {
      source: "face-bulk",
      debugCheckout: checkoutDebugEnabled,
    });
    startCheckoutNavigation(href);
  }, [album.id, albumComprarPathBase, checkoutSubmitting, startCheckoutNavigation, checkoutDebugEnabled]);

  const handleFaceBulkOfferChooseSome = useCallback(() => {
    dismissFaceBulkOffer("dismissed");
  }, [dismissFaceBulkOffer]);

  const handleFaceBulkOfferRemindLater = useCallback(() => {
    dismissFaceBulkOffer("dismissed");
  }, [dismissFaceBulkOffer]);

  const handleClearPurchaseSelection = useCallback(() => {
    if (packSelectionMode) {
      setPackSelectionMode((prev) => (prev ? { ...prev, photoIds: new Set<string>() } : prev));
      setPackSelectionError(null);
      return;
    }
    setSelected(new Set());
  }, [packSelectionMode]);

  const albumPackPlatformFeePercent = resolveAlbumPackPlatformFeePercent(
    album.checkoutDigitalFeePercent
  );
  const extensionSurchargeMode = useMemo(() => {
    if (!extensionSalesPricing?.active) return null;
    if (
      extensionSalesPricing.fixedPricePer30DaysArs != null &&
      extensionSalesPricing.fixedPricePer30DaysArs > 0
    ) {
      return {
        kind: "FIXED_PER_30_DAYS" as const,
        priceArs: extensionSalesPricing.fixedPricePer30DaysArs,
      };
    }
    return {
      kind: "PERCENT_OF_SUBTOTAL" as const,
      percent: extensionSalesPricing.surchargePercentForDisplay || 15,
    };
  }, [extensionSalesPricing]);
  const publicVisiblePacksWithClientPrice = useMemo(
    () =>
      (album.publicVisiblePacks ?? []).map((pack) => {
        const clientSubtotalArs = albumPackClientPriceArs(pack.price, albumPackPlatformFeePercent);
        if (!extensionSalesPricing?.active || !extensionSurchargeMode) {
          return { ...pack, clientPriceArs: clientSubtotalArs };
        }
        return {
          ...pack,
          clientPriceArs: applyAlbumExtensionSurchargeToClientTotalArs({
            clientSubtotalArs,
            extensionDays: extensionSalesPricing.extensionDays,
            mode: extensionSurchargeMode,
            active: true,
          }).clientTotalArs,
        };
      }),
    [
      album.publicVisiblePacks,
      albumPackPlatformFeePercent,
      extensionSalesPricing,
      extensionSurchargeMode,
    ]
  );

  const packDraftPreparedSummary = useMemo(() => {
    if (packDraftPreparedSummaries.length === 0) return null;
    const totalCents = sumPackCartTotalCents(packDraftPreparedSummaries);
    const selectedCount = packDraftPreparedSummaries.reduce(
      (sum, item) => sum + item.selectedCount,
      0
    );
    const last = packDraftPreparedSummaries[packDraftPreparedSummaries.length - 1]!;
    const uniqueNames = new Set(packDraftPreparedSummaries.map((item) => item.packName));
    const packName =
      packDraftPreparedSummaries.length === 1
        ? last.packName
        : uniqueNames.size === 1
          ? `${packDraftPreparedSummaries.length}× ${last.packName}`
          : `${packDraftPreparedSummaries.length} packs preparados`;
    return {
      draftId: last.draftId,
      packName,
      selectedCount,
      totalCents,
      preparedPackCount: packDraftPreparedSummaries.length,
    };
  }, [packDraftPreparedSummaries]);

  const stickyBarState = usePurchaseStickyBarState({
    packSelectionMode,
    packDraftPreparedSummary,
    selectedSinglesCount: selected.size,
    packSelectionSaving,
    packPaymentSubmitting,
    checkoutSubmitting,
    searchLoading,
    pendingAllPhotosPack,
    packSelectionError,
    packPaymentError,
    searchError,
    checkoutSubmitError,
    albumPackPayButtonEnabled,
    publicVisiblePacks: publicVisiblePacksWithClientPrice,
    digitalPhotoPriceCents: album.digitalPhotoPriceCents,
    faceBulkSavings: faceBulkOffer.eligible
      ? {
          savingsCents: faceBulkOffer.savingsCents,
          packTotalClientCents: faceBulkOffer.packTotalClientCents,
        }
      : null,
    faceBulkSelectedMatch:
      faceBulkOffer.eligible &&
      faceBulkTargetPhotoIds.length > 0 &&
      selected.size === faceBulkTargetPhotoIds.length &&
      faceBulkTargetPhotoIds.every((id) => selected.has(String(id))),
    galleryPricing,
    onSavePackSelection: () => void handleSavePackSelection(),
    onPayPreparedPack: () => void handlePayPreparedPack(),
    onComprarSingles: handleComprar,
    onClearSelection: handleClearPurchaseSelection,
    onOpenFaceSearch: () => void openFaceSearchFlow(),
  });

  const showPurchaseStickyUx =
    purchaseUxV2 &&
    mounted &&
    stickyBarState.visible &&
    (canPurchaseSingles || canPurchasePacks);

  const { toast: purchaseToast, dismissToast: dismissPurchaseToast } = usePurchaseUxFeedback({
    enabled: purchaseUxV2 && mounted,
    packsSectionRef,
    packDraftPreparedSummary,
    packSelectionMode,
    searchResultsCount: searchResults.length,
    searchLoading,
    pendingAllPhotosPack,
  });

  const baseDate = album.firstPhotoDate
    ? new Date(album.firstPhotoDate)
    : album.photos.length > 0
      ? new Date(album.createdAt)
      : null;
  const extensionDays = album.expirationExtensionDays ?? 0;
  const visibleUntil = baseDate
    ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000)
    : null;
  const now = new Date();
  const isExpired = visibleUntil ? now >= visibleUntil : false;

  // Álbum con fotos ocultas: mostrar gate de verificación hasta tener grant
  if (album.hiddenPhotosEnabled && (grantLoading || !hasGrant)) {
    return (
      <main className="select-none w-full max-w-none box-border" style={{ padding: 24 }}>
        <h1 className="text-2xl font-medium text-[#1a1a1a] mb-6">{album.title}</h1>
        <div className="w-full flex justify-center">
          <HiddenAlbumVerificationGate
          albumId={album.id}
          albumTitle={album.title}
          tertiaryColor={tertiaryColor}
        />
        </div>
      </main>
    );
  }

  if (isAccessBlocked) {
    return (
      <main className="select-none w-full max-w-none box-border px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-medium text-[#1a1a1a] mb-6">{album.title}</h1>
        <div className="flex w-full min-w-0 items-stretch justify-center min-h-[60vh] py-6 sm:py-10">
          <AlbumReactivationBanner
            variant="accessBlocked"
            visibleUntil={visibleUntil}
            extensionLoading={extensionLoading}
            extensionSuccess={extensionSuccess}
            onReactivate={handleRequestExtension}
            tertiaryColor={tertiaryColor}
          />
        </div>
      </main>
    );
  }

  // Con fotos ocultas y grant por selfie: solo mostrar las autorizadas para ese rostro (no las demás ni como "dañadas")
  const photosToShow =
    album.hiddenPhotosEnabled && hasGrant && allowedPhotoIds !== null
      ? album.photos.filter((p) => allowedPhotoIds.includes(p.id))
      : album.photos;

  const photos = photosToShow.map((p) => {
    // Normalización defensiva en el cliente
    const normalizedUrl = normalizePreviewUrlClient(p.previewUrl, p.originalKey);
    if (!normalizedUrl) {
      console.warn(`⚠️ No se pudo normalizar previewUrl para foto ${p.id}, previewUrl: "${p.previewUrl}", originalKey: "${p.originalKey}"`);
    }
    const analysis = (p.analysisStatus || "").toUpperCase();
    const statusBadge =
      analysis && analysis !== "DONE"
        ? analysis === "ERROR"
          ? "Error análisis"
          : "Analizando..."
        : null;
    return {
      id: String(p.id),
      src: normalizedUrl || "", // Usar solo URL normalizada
      alt: `Foto ${p.id}`,
      selected: activeSelectionSet.has(String(p.id)),
      statusBadge,
    };
  }).filter((p) => p.src); // Filtrar fotos sin URL válida

  const showFaceBulkCta = faceBulkOffer.eligible;

  /** Pack “todas mis fotos”: bajo la grilla de resultados para no perderlo al hacer scroll */
  const placeFaceBulkUnderSearchResults =
    showFaceBulkCta && faceBulkTargetPhotoIds.length > 0 && searchResults.length > 0;

  /** Precios del pack facial: API usa sufijo *Cents pero los valores son pesos ARS (no dividir por 100). */
  const formatArsFaceBulkPesos = (pesos: number): string =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(pesos);

  const searchPhotos = searchResults
    .map((p) => {
      const thumbUrl = `/api/photos/${p.id}/view?mode=thumb&albumId=${album.id}`;
      return {
        id: String(p.id),
        src: thumbUrl,
        alt: `Foto ${p.id}`,
        selected: activeSelectionSet.has(String(p.id)),
      };
    })
    .filter((p): p is { id: string; src: string; alt: string; selected: boolean } => Boolean(p));

  async function handleSearchText() {
    if (searchText.trim().length < 1) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/albums/${album.id}/search/text?q=${encodeURIComponent(searchText.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error buscando texto");
      setSearchResults(Array.isArray(data.items) ? data.items : []);
      setLastFaceSearchMatchIds([]);
    } catch (err: any) {
      setSearchError(err?.message || "Error buscando texto");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSearchFace(fileOverride?: File) {
    const fileToUse = fileOverride || faceFile;
    if (!fileToUse) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const formData = new FormData();
      formData.append("file", fileToUse);
      const res = await fetch(`/api/albums/${album.id}/search/face`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error buscando rostro");
      const items = Array.isArray(data.items) ? data.items : [];
      setSearchResults(items);
      const faceIdsForBulk = album.hiddenPhotosEnabled ? [] : uniqueAlbumPhotoIdsFromFaceItems(album, items);
      setLastFaceSearchMatchIds(faceIdsForBulk);

      const pendingPack = pendingAllPhotosPack;
      if (pendingPack) {
        if (faceIdsForBulk.length === 0) {
          setPendingAllPhotosPack(null);
          setPackSelectionError(
            "No encontramos fotos tuyas con esa selfie. Probá otra foto o contactá al fotógrafo."
          );
        } else {
          setPackSelectionSaving(true);
          setPackSelectionError(null);
          setPackPaymentError(null);
          try {
            await persistPackSelectionForAlbumPack({
              packId: pendingPack.packId,
              packName: pendingPack.packName,
              photoIds: faceIdsForBulk,
            });
          } catch (packErr: unknown) {
            const message =
              packErr instanceof Error ? packErr.message : "No pudimos preparar el pack.";
            setPackSelectionError(message);
          } finally {
            setPackSelectionSaving(false);
            setPendingAllPhotosPack(null);
          }
        }
      }

      if (items.length > 0 && typeof window !== "undefined") {
        const targetIds = resolveFaceBulkPackTargetIds(album, hasGrant, allowedPhotoIds, faceIdsForBulk);
        const feePct = album.checkoutDigitalFeePercent;
        const offer = computeFaceBulkOffer(album, targetIds, {
          platformFeePercent:
            typeof feePct === "number" && Number.isFinite(feePct) && feePct >= 0 ? feePct : undefined,
        });
        if (offer.eligible && !readFaceBulkOfferSession(album.id)) {
          setShowFaceBulkOfferModal(true);
        }
      }
    } catch (err: any) {
      setSearchError(err?.message || "Error buscando rostro");
    } finally {
      setSearchLoading(false);
    }
  }


  async function handleRequestExtension() {
    if (extensionLoading) return;
    setExtensionLoading(true);
    try {
      const res = await fetch("/api/album-extensions/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: album.id, daysToAdd: 30 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error solicitando reactivación");
      }
      setExtensionSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      alert(err?.message || "No se pudo solicitar la reactivación");
    } finally {
      setExtensionLoading(false);
    }
  }

  function renderFaceBulkPackCard() {
    if (!showFaceBulkCta || faceBulkTargetPhotoIds.length === 0) return null;
    return (
      <div
        className="mb-6 mx-auto w-full min-w-0 max-w-3xl sm:max-w-4xl rounded-2xl border-2 p-5 sm:p-6 shadow-md ring-1 ring-black/5 relative z-[60] isolate"
        style={{ borderColor: accentColor, backgroundColor: `${accentColor}14` }}
      >
        <h3 className="text-xl sm:text-2xl font-bold text-[#1a1a1a]">
          Pack especial:{" "}
          {album.hiddenPhotosEnabled &&
          Array.isArray(allowedPhotoIds) &&
          allowedPhotoIds.length > 0
            ? "todas las fotos donde aparecés"
            : album.hiddenPhotosEnabled
              ? "todas las fotos de este álbum"
              : "fotos encontradas con tu búsqueda facial"}
        </h3>
        <p className="mt-2 text-sm text-[#374151]">
          Incluye{" "}
          <strong>
            {faceBulkOffer.packPhotoCount} foto{faceBulkOffer.packPhotoCount !== 1 ? "s" : ""}
          </strong>
        </p>

        <div className="mt-3">
          <span className="line-through text-gray-500">
            {formatArsFaceBulkPesos(faceBulkOffer.individualTotalCents)}
          </span>
        </div>

        <p className="text-2xl font-bold" style={{ color: accentColor }}>
          {formatArsFaceBulkPesos(faceBulkOffer.packTotalClientCents)}
        </p>
        <p className="text-xs text-[#6b7280]">Precio final (incluye comisión de plataforma)</p>

        <p className="text-sm text-emerald-700">
          Ahorrás {formatArsFaceBulkPesos(faceBulkOffer.savingsCents)}
        </p>

        <button
          type="button"
          className="mt-4 w-full rounded-xl px-5 py-4 text-white font-semibold cursor-pointer relative z-[1]"
          style={{ backgroundColor: accentColor }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goToFaceBulkCheckout();
          }}
        >
          Comprar todas mis fotos
        </button>
      </div>
    );
  }

  const iaSearchModals =
    mounted &&
    (showFaceConsentModal || showFaceModal || showOcrModal) &&
    createPortal(
      <>
        {showFaceConsentModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="box-border w-full min-w-0 max-w-5xl rounded-2xl bg-white p-6 sm:p-8 shadow-xl">
              <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] mb-3">
                Reconocimiento facial
              </h3>
              <p className="text-sm sm:text-base text-[#6b7280] mb-6 leading-relaxed max-w-none">
                Esta función usa reconocimiento facial para ayudarte a encontrar tus fotos en el
                álbum.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowFaceConsentModal(false)}
                  disabled={faceConsentLoading}
                >
                  No, gracias
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    setFaceConsentLoading(true);
                    try {
                      if (authUser) {
                        await fetch("/api/users/me/face-consent", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ faceConsent: true }),
                          credentials: "include",
                        });
                        setAuthUser({ ...authUser, faceConsent: true });
                      } else if (typeof window !== "undefined") {
                        sessionStorage.setItem("faceConsentSession", "1");
                      }
                      setShowFaceConsentModal(false);
                      setShowFaceModal(true);
                    } finally {
                      setFaceConsentLoading(false);
                    }
                  }}
                  disabled={faceConsentLoading}
                >
                  {faceConsentLoading ? "..." : "Acepto"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {showFaceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="w-full max-w-5xl rounded-2xl bg-white p-6 sm:p-8 shadow-xl min-w-0">
              <div className="flex items-center justify-between mb-4 gap-4">
                <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a]">
                  Encontrá tus fotos
                </h3>
                <button
                  type="button"
                  className="text-sm text-[#6b7280] hover:text-[#1a1a1a] shrink-0"
                  onClick={() => setShowFaceModal(false)}
                >
                  Cerrar
                </button>
              </div>
              <p className="text-sm sm:text-base text-[#6b7280] mb-6 leading-relaxed max-w-none">
                Elegí cómo querés cargar tu selfie.
              </p>
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
                <label className="group flex w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-[#e5e7eb] bg-white px-6 py-8 text-center shadow-lg transition hover:border-[#cbd5f5] sm:px-8">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    ref={cameraInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFaceFile(file);
                      if (file) {
                        setFaceInputMode("camera");
                        setShowFaceModal(false);
                        handleSearchFace(file);
                      }
                    }}
                  />
                  <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:h-[140px] sm:w-[140px]">
                    <svg
                      viewBox="0 0 64 64"
                      className="h-full w-full"
                      aria-hidden="true"
                    >
                      <rect x="10" y="18" width="44" height="30" rx="6" fill="#E5E7EB" />
                      <rect x="18" y="14" width="12" height="6" rx="2" fill="#9CA3AF" />
                      <circle cx="32" cy="33" r="10" fill="#FFFFFF" stroke="#6B7280" strokeWidth="3" />
                      <circle cx="46" cy="24" r="2.5" fill="#6B7280" />
                    </svg>
                  </div>
                  <div className="w-full min-w-0 px-1">
                    <p className="text-base font-semibold text-[#1a1a1a]">Tomar selfie</p>
                    <p className="text-sm text-[#6b7280] leading-snug mt-1">
                      Abrí la cámara frontal
                    </p>
                  </div>
                </label>
                <label className="group flex w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-[#e5e7eb] bg-white px-6 py-8 text-center shadow-lg transition hover:border-[#cbd5f5] sm:px-8">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFaceFile(file);
                      if (file) {
                        setFaceInputMode("file");
                        setShowFaceModal(false);
                        handleSearchFace(file);
                      }
                    }}
                  />
                  <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:h-[140px] sm:w-[140px]">
                    <svg
                      viewBox="0 0 64 64"
                      className="h-full w-full"
                      aria-hidden="true"
                    >
                      <path
                        d="M32 14v26"
                        stroke="#6B7280"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M24 26l8-8 8 8"
                        stroke="#6B7280"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <rect x="12" y="40" width="40" height="12" rx="6" fill="#E5E7EB" />
                    </svg>
                  </div>
                  <div className="w-full min-w-0 px-1">
                    <p className="text-base font-semibold text-[#1a1a1a]">Subir archivo</p>
                    <p className="text-sm text-[#6b7280] leading-snug mt-1">
                      Elegí una selfie guardada
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
        {showOcrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img src="/OCR.png" alt="" className="h-10 w-10 object-contain" aria-hidden />
                  <h3 id="ocr-modal-title" className="text-lg font-semibold text-[#1a1a1a]">OCR</h3>
                </div>
                <button
                  type="button"
                  className="text-sm text-[#6b7280] hover:text-[#1a1a1a] p-1"
                  onClick={() => setShowOcrModal(false)}
                  aria-label="Cerrar"
                >
                  Cerrar
                </button>
              </div>
              <p className="text-sm text-[#6b7280] mb-4">
                Escribí acá lo que querés buscar y hacé clic en <strong>Buscar</strong>. Patente, dorsal, camiseta, DNI o nombre.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      id="album-search-ocr"
                      name="searchText"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchText.trim().length >= 1 && !searchLoading) {
                          handleSearchText();
                          setShowOcrModal(false);
                        }
                      }}
                      placeholder="Ej: 5, 33, apellido, patente, dorsal..."
                      className="w-full border border-[#e5e7eb] rounded-md pl-9 pr-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-offset-0"
                      onFocus={(e) => {
                        e.target.style.borderColor = accentColor;
                        e.target.style.boxShadow = `0 0 0 2px ${accentColor}40`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#e5e7eb";
                        e.target.style.boxShadow = "none";
                      }}
                      autoFocus
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] text-lg">
                      🔎
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => {
                      handleSearchText();
                      setShowOcrModal(false);
                    }}
                    disabled={searchLoading || searchText.trim().length < 1}
                    className="px-6 py-3"
                  >
                    {searchLoading ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[#6b7280]">
                  {["PATENTE", "CAMISETA", "DORSAL", "DNI", "NOMBRE", "PALABRA"].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => setSearchText(hint)}
                      className="rounded-full border border-[#e5e7eb] px-3 py-1 hover:border-[#cbd5f5] transition"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </>,
      document.body
    );

  return (
    <>
    {testClientPreview ? <AlbumTestModeClientBanner /> : null}
    <main
      className={`select-none w-full min-w-0 max-w-none box-border ${showPurchaseStickyUx ? PURCHASE_STICKY_BAR_CONTENT_PADDING : ""}`}
      style={{ padding: 24 }}
      data-protected="true"
    >
      <h1 className="text-2xl font-medium text-[#1a1a1a] mb-1">{album.title}</h1>
      {salesReadyToSell && !testClientPreview ? (
        <PendingOrderAlbumBanner albumId={album.id} />
      ) : null}
      {album.hiddenPhotosEnabled && photographerBypassGrant && !simulateClientView ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="m-0 font-medium">Vista de fotógrafo</p>
          <p className="m-0 mt-1 text-amber-900">
            Como dueño del álbum ves todas las fotos. Los clientes deben pasar por reconocimiento facial.
            {" "}
            <a
              href="?vista=cliente"
              className="font-semibold underline underline-offset-2 hover:text-amber-950"
            >
              Probar vista cliente
            </a>
          </p>
        </div>
      ) : null}
      {album.hiddenPhotosEnabled && simulateClientView ? (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="m-0">
            Vista cliente simulada.{" "}
            <a href="?" className="font-semibold underline underline-offset-2">
              Volver a vista fotógrafo
            </a>
          </p>
        </div>
      ) : null}
      {(album.isHidden || isExpired) && (
        <div className="mb-6 w-full min-w-0">
          <AlbumReactivationBanner
            variant="expiringNotice"
            extensionLoading={extensionLoading}
            extensionSuccess={extensionSuccess}
            onReactivate={handleRequestExtension}
            tertiaryColor={tertiaryColor}
          />
        </div>
      )}
      <div className="text-[#6b7280] text-sm space-y-1 mb-6">
        {album.location && <p>📍 {album.location}</p>}
        {album.eventDate && (
          <p>📅 {new Date(album.eventDate).toLocaleDateString("es-AR")}</p>
        )}
        {visibleUntil && (
          <p className="text-amber-700 font-medium mt-2">
            ⏱ Este álbum se eliminará automáticamente el {visibleUntil.toLocaleDateString("es-AR")}
          </p>
        )}
      </div>

      {!canPurchaseSingles && !canPurchasePacks ? <GallerySalesNotReadyNotice /> : null}

      {canPurchaseSingles ? <GalleryPricingBand pricing={galleryPricing} /> : null}

      {canPurchasePacks && publicVisiblePacksWithClientPrice.length > 0 && (
        <section
          ref={packsSectionRef}
          className="mb-8 rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-4 scroll-mt-4"
        >
          <div>
            <h2 className="text-lg font-medium text-[#1a1a1a]">Packs disponibles</h2>
            <p className="text-sm text-[#6b7280] leading-relaxed">
              Los packs agrupan varias fotos a un precio especial. También podés elegir fotos sueltas
              en la galería más abajo.
            </p>
          </div>
          {packSelectionError && !purchaseUxV2 ? (
            <p className="text-sm text-red-600">{packSelectionError}</p>
          ) : null}
          {packSelectionSaving ? (
            <p className="text-sm text-[#6b7280]">Preparando tu pack con las fotos encontradas…</p>
          ) : null}
          {packDraftPreparedSummaries.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-emerald-900">
                {packDraftPreparedSummaries.length === 1
                  ? "Compra preparada"
                  : `${packDraftPreparedSummaries.length} packs preparados`}
              </h3>
              <div className="space-y-2">
                {packDraftPreparedSummaries.map((preparedPack, index) => (
                  <div
                    key={preparedPack.draftId}
                    className="flex items-start justify-between gap-3 rounded-md border border-emerald-200/80 bg-white/70 px-3 py-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-emerald-900">
                        {packDraftPreparedSummaries.length > 1 ? (
                          <span className="text-emerald-700">Pack {index + 1}: </span>
                        ) : null}
                        <strong>{preparedPack.packName}</strong>
                      </p>
                      <p className="text-xs text-emerald-800">
                        {preparedPack.selectedCount} foto
                        {preparedPack.selectedCount === 1 ? "" : "s"} ·{" "}
                        {formatPurchaseArs(preparedPack.totalCents)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemovePreparedPack(preparedPack.draftId)}
                      disabled={packPaymentSubmitting || packSelectionSaving}
                      className="shrink-0 rounded-md p-1.5 text-emerald-800 transition hover:bg-emerald-100 hover:text-red-700 disabled:opacity-50"
                      aria-label={`Quitar pack ${preparedPack.packName}`}
                      title="Quitar este pack"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-emerald-800">
                Total:{" "}
                <strong>
                  {formatPurchaseArs(sumPackCartTotalCents(packDraftPreparedSummaries))}
                </strong>
              </p>
              {!purchaseUxV2 && !packSelectionMode && albumPackPayButtonEnabled ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePayPreparedPack}
                  disabled={packPaymentSubmitting}
                >
                  {packPaymentSubmitting
                    ? "Iniciando pago..."
                    : packDraftPreparedSummaries.length > 1
                      ? "Pagar packs"
                      : "Pagar pack"}
                </Button>
              ) : !purchaseUxV2 && !packSelectionMode ? (
                <Button variant="secondary" size="sm" disabled>
                  Pago próximamente disponible
                </Button>
              ) : null}
              {packPaymentError && !purchaseUxV2 ? (
                <p className="text-sm text-red-600">{packPaymentError}</p>
              ) : null}
            </div>
          )}
          <div className="grid gap-3">
            {publicVisiblePacksWithClientPrice.map((pack) => {
              const purchaseNote = getPublicPackPurchaseNote(pack);
              const badgeLabel = getPublicPackBadgeLabel(pack.compositionFulfillmentKind);
              const badgeClass =
                pack.compositionFulfillmentKind === "PRINT"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : pack.compositionFulfillmentKind === "MIXED"
                    ? "bg-violet-50 text-violet-800 border-violet-200"
                    : "bg-sky-50 text-sky-800 border-sky-200";
              const packBusy =
                (packSelectionSaving || searchLoading) && pendingAllPhotosPack?.packId === pack.id;
              const bulkSelection = isBulkPhotoSelectionPack(pack);
              const fixedSelection =
                pack.selectionMode === "FIXED" &&
                pack.requiresSelection &&
                (pack.includedPhotoCount ?? 0) > 0;
              const preparedCountForPack = packDraftPreparedSummaries.filter(
                (item) => item.packId === pack.id
              ).length;
              const hasPreparedForPack = preparedCountForPack > 0;
              const repeatPackLabel = "Agregar otro pack igual";

              return (
                <article
                  key={pack.id}
                  className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white p-4"
                >
                  <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    {pack.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pack.coverImageUrl}
                        alt=""
                        className="h-24 w-24 shrink-0 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] object-cover sm:h-[7.5rem] sm:w-[7.5rem]"
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-[#1a1a1a]">{pack.name}</h3>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                          >
                            {badgeLabel}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[#374151]">
                          {getPublicPackSelectionHeadline(pack)}
                        </p>
                        {pack.description ? (
                          <p className="text-sm text-[#6b7280] leading-relaxed">{pack.description}</p>
                        ) : null}
                        {purchaseNote ? (
                          <p className="text-sm text-[#6b7280] leading-relaxed">{purchaseNote}</p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-[#1a1a1a]">
                        {formatPurchaseArs(pack.clientPriceArs ?? pack.price)}
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    {bulkSelection && pack.selectionMode === "ALL_MY_PHOTOS" ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStartPackPurchase(pack)}
                        disabled={
                          packSelectionSaving ||
                          searchLoading ||
                          checkoutSubmitting ||
                          packPaymentSubmitting ||
                          packSelectionMode != null
                        }
                      >
                        {packBusy
                          ? searchLoading
                            ? "Buscando con IA..."
                            : "Preparando tu pack..."
                          : hasPreparedForPack
                            ? repeatPackLabel
                            : "Buscar mis fotos con IA"}
                      </Button>
                    ) : bulkSelection && pack.selectionMode === "ALL_EVENT_PHOTOS" ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStartPackPurchase(pack)}
                        disabled={
                          packSelectionSaving ||
                          checkoutSubmitting ||
                          packPaymentSubmitting ||
                          packSelectionMode != null
                        }
                      >
                        {packSelectionSaving
                          ? "Preparando tu pack..."
                          : hasPreparedForPack
                            ? repeatPackLabel
                            : "Incluir todas las fotos del álbum"}
                      </Button>
                    ) : fixedSelection ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStartPackPurchase(pack)}
                        disabled={
                          packSelectionSaving ||
                          checkoutSubmitting ||
                          (packSelectionMode != null && packSelectionMode.packId !== pack.id)
                        }
                      >
                        {packSelectionMode?.packId === pack.id
                          ? "Seleccionando este pack..."
                          : hasPreparedForPack
                            ? repeatPackLabel
                            : "Elegir fotos para este pack"}
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" disabled>
                        Próximamente disponible
                      </Button>
                    )}
                  </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <hr className="border-[#e5e7eb] my-6" />

      <PublicAlbumMediaTabs
        publicSlug={publicSlug}
        publicVideosEnabled={publicVideosEnabled}
        initialPublicVideos={initialPublicVideos}
        accentColor={accentColor}
        photoCount={album.photos.length}
        defaultTab={album.photos.length === 0 && hasPublicReadyVideos ? "videos" : "photos"}
        photosContent={
      <>
      {packSelectionMode && (
        <div className="mb-6 rounded-xl border border-[#c27b3d33] bg-[#faf7f4] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#1a1a1a]">
            Seleccionando fotos para: {packSelectionMode.packName}
          </p>
          <p className="text-sm text-[#4b5563]">
            Seleccionaste {packSelectionMode.photoIds.size} de {packSelectionMode.requiredCount} fotos.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!purchaseUxV2 ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSavePackSelection}
                  disabled={packSelectionSaving}
                >
                  {packSelectionSaving ? "Confirmando pack…" : "Confirmar pack"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancelPackSelection}
                  disabled={packSelectionSaving}
                >
                  Cancelar selección de pack
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCancelPackSelection}
                disabled={packSelectionSaving}
              >
                Cancelar pack
              </Button>
            )}
          </div>
          {packSelectionError && !purchaseUxV2 ? (
            <p className="text-sm text-red-600">{packSelectionError}</p>
          ) : null}
        </div>
      )}

      {mounted && !packSelectionMode && selected.size > 0 && album.photos.length > 0 && (
        <div
          className="mb-6 w-full rounded-2xl border px-5 py-4 sm:px-6 sm:py-5 bg-[#faf7f4] shadow-sm"
          style={{ borderColor: `${accentColor}33` }}
          role="status"
        >
          <p className="text-sm sm:text-[15px] text-[#374151] leading-relaxed">
            <strong className="text-[#1a1a1a] font-semibold">
              Tenés {selected.size} foto{selected.size === 1 ? "" : "s"} seleccionada
              {selected.size === 1 ? "" : "s"}
            </strong>
            . Podés seguir sumando desde la galería o continuar con la compra.
          </p>
        </div>
      )}

      {album.photos.length > 0 ? (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-[#1a1a1a]">
            Fotos ({album.photos.length})
          </h2>
        </div>
      ) : null}

      {album.photos.length === 0 ? (
        hasPublicReadyVideos ? (
          <p className="text-sm text-[#6b7280] mb-4 leading-relaxed">
            Todavía no hay fotos en este álbum. Podés ver los videos disponibles en la pestaña Videos.
          </p>
        ) : (
        <div className="ds-gallery-empty-state w-full" role="status">
          {album.showComingSoonMessage ? (
            <div className="ds-gallery-empty-state__panel rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8 shadow-sm">
              <div className="ds-gallery-empty-state__stack">
                <div className="ds-gallery-empty-state__icon flex flex-col items-center gap-4 py-2">
                  <img
                    src="/watermark.png"
                    alt="ComprameLaFoto"
                    className="w-48 h-auto opacity-90"
                  />
                  <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--center text-lg text-[#6b7280] m-0">
                    Las fotos serán subidas próximamente.
                  </p>
                </div>
                {!notificationSubmitted ? (
                  <>
                    <p className="ds-gallery-empty-state__copy ds-readable-text ds-readable-text--fluid ds-readable-text--center text-base sm:text-lg text-[#1a1a1a] m-0">
                      Dejá tus datos y te avisaremos apenas estén disponibles:
                    </p>
                    <div className="ds-gallery-empty-state__actions">
                      <div className="ds-notify-form-shell">
                        <form onSubmit={handleNotifySubmit} className="ds-form-stack w-full">
                          <DsField label="Nombre completo" htmlFor="album-notification-name">
                            <Input
                              id="album-notification-name"
                              name="notificationName"
                              type="text"
                              value={notificationName}
                              onChange={(e) => setNotificationName(e.target.value)}
                              placeholder="Nombre completo"
                              required
                              disabled={notificationLoading}
                            />
                          </DsField>
                          <DsField label="WhatsApp" htmlFor="album-notification-whatsapp">
                            <Input
                              id="album-notification-whatsapp"
                              name="notificationWhatsapp"
                              type="tel"
                              value={notificationWhatsapp}
                              onChange={(e) => setNotificationWhatsapp(e.target.value)}
                              placeholder="WhatsApp (ej: +5491123456789)"
                              required
                              disabled={notificationLoading}
                            />
                          </DsField>
                          <DsField label="Email" htmlFor="album-notification-email">
                            <Input
                              id="album-notification-email"
                              name="notificationEmail"
                              type="email"
                              value={notificationEmail}
                              onChange={(e) => setNotificationEmail(e.target.value)}
                              placeholder="Email"
                              required
                              disabled={notificationLoading}
                            />
                          </DsField>

                          <DsField
                            label="Selfie (opcional)"
                            hint="Te avisaremos automáticamente cuando aparezcan tus fotos"
                            htmlFor="album-notification-selfie"
                          >
                            <div className="ds-upload-zone">
                              <input
                                id="album-notification-selfie"
                                ref={notificationSelfieInputRef}
                                type="file"
                                accept="image/*"
                                capture="user"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setNotificationSelfie(file);
                                  if (!file) {
                                    setBiometricConsent(false);
                                  }
                                }}
                                disabled={notificationLoading}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => notificationSelfieInputRef.current?.click()}
                                disabled={notificationLoading}
                                className={`ds-upload-zone__inner min-h-[11rem] rounded-2xl border-2 border-dashed px-6 py-8 text-center transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  notificationSelfie
                                    ? "border-[#10b981] bg-[#10b981]/5"
                                    : "border-[#e5e7eb] bg-white hover:border-[#cbd5f5]"
                                }`}
                                style={
                                  notificationSelfie
                                    ? { backgroundColor: `${accentColor}14` }
                                    : undefined
                                }
                              >
                                {notificationSelfie && notificationSelfiePreview ? (
                                  <>
                                    <img
                                      src={notificationSelfiePreview}
                                      alt="Tu selfie"
                                      className="h-32 w-32 shrink-0 self-center rounded-2xl border border-[#e5e7eb] bg-white object-cover sm:h-36 sm:w-36"
                                    />
                                    <div className="ds-upload-zone__copy">
                                      <p className="ds-upload-zone__title">Selfie cargada</p>
                                      <p className="ds-upload-zone__hint">Tocá para cambiar</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <img
                                      src="/faceid.png"
                                      alt="Tomar selfie"
                                      className="h-28 w-28 shrink-0 self-center rounded-2xl border border-[#e5e7eb] bg-white p-4 object-contain sm:h-32 sm:w-32"
                                    />
                                    <div className="ds-upload-zone__copy">
                                      <p className="ds-upload-zone__title">Tomar/Subir selfie</p>
                                      <p className="ds-upload-zone__hint">Reconocimiento facial con IA</p>
                                    </div>
                                  </>
                                )}
                              </button>
                            </div>
                            {notificationSelfie ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setNotificationSelfie(null);
                                  setBiometricConsent(false);
                                  if (notificationSelfieInputRef.current) {
                                    notificationSelfieInputRef.current.value = "";
                                  }
                                }}
                                disabled={notificationLoading}
                                className="mt-2 text-sm text-red-600 hover:text-red-700 hover:underline transition-colors disabled:opacity-50"
                              >
                                Eliminar selfie
                              </button>
                            ) : null}
                          </DsField>

                          <div className="space-y-3 pt-1">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={termsAccepted}
                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                disabled={notificationLoading}
                                className="mt-1 w-4 h-4 rounded border-[#d1d5db] text-[#c27b3d] focus:ring-2 focus:ring-[#c27b3d]"
                                style={{ accentColor }}
                                required
                              />
                              <span className="text-sm text-[#1a1a1a]">
                                Acepto los{" "}
                                <a
                                  href="/terminos"
                                  target="_blank"
                                  className="underline text-[#c27b3d] hover:text-[#a0662f]"
                                >
                                  Términos y Condiciones
                                </a>{" "}
                                *
                              </span>
                            </label>
                            {notificationSelfie ? (
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={biometricConsent}
                                  onChange={(e) => setBiometricConsent(e.target.checked)}
                                  disabled={notificationLoading}
                                  className="mt-1 w-4 h-4 rounded border-[#d1d5db] text-[#c27b3d] focus:ring-2 focus:ring-[#c27b3d]"
                                  style={{ accentColor }}
                                  required
                                />
                                <span className="text-sm text-[#1a1a1a]">
                                  Acepto el{" "}
                                  <a
                                    href="/consentimiento-biometrico"
                                    target="_blank"
                                    className="underline text-[#c27b3d] hover:text-[#a0662f]"
                                  >
                                    Consentimiento Biométrico
                                  </a>{" "}
                                  para el reconocimiento facial. Entiendo que mis datos biométricos se
                                  eliminarán automáticamente después de 90 días. *
                                </span>
                              </label>
                            ) : null}
                          </div>

                          <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            accentColor={accentColor}
                            disabled={
                              notificationLoading ||
                              !notificationName.trim() ||
                              !notificationWhatsapp.trim() ||
                              !termsAccepted ||
                              (notificationSelfie ? !biometricConsent : false)
                            }
                            className="w-full rounded-md"
                          >
                            {notificationLoading ? "Enviando..." : "Avisame"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="ds-gallery-empty-state__copy">
                    <div className="w-full rounded-md border border-[#10b981]/20 bg-[#10b981]/10 p-4">
                      <p className="ds-readable-text ds-readable-text--center text-sm sm:text-base text-[#10b981] m-0">
                        ✅ Perfecto! Te avisaremos cuando las fotos estén disponibles.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="ds-readable-text ds-readable-text--fluid text-[#6b7280] m-0 w-full">
              No hay fotos en este álbum.
            </p>
          )}
        </div>
        )
      ) : (
        <>
          {album.photos.length > 0 && (
            <div className="mb-5 rounded-xl border border-[#eceae6] bg-[#fafafa] p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-[#1a1a1a]">
                  Encontrá tus fotos más rápido
                </h3>
                <p className="text-sm text-[#6b7280] mt-1 leading-relaxed">
                  Usá reconocimiento facial con selfie o buscá por número de camiseta, dorsal,
                  patente, DNI o nombre.
                </p>
              </div>
            <div className="flex flex-col items-center">
              <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2 sm:gap-5">
                <button
                  type="button"
                  onClick={() => {
                    setPendingAllPhotosPack(null);
                    void openFaceSearchFlow();
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border px-5 py-5 text-center shadow-md transition sm:min-h-[200px] ${
                    searchTab === "face"
                      ? "border-transparent"
                      : "border-[#e5e7eb] hover:border-[#cbd5f5] bg-white"
                  }`}
                  style={searchTab === "face" ? { backgroundColor: `${accentColor}14` } : undefined}
                >
                  <img
                    src="/faceid.png"
                    alt="Buscar por selfie"
                    className="h-[120px] w-[120px] rounded-2xl border border-[#e5e7eb] bg-white p-4 object-contain sm:h-[140px] sm:w-[140px]"
                  />
                  <div>
                    <p className="text-base font-semibold text-[#1a1a1a]">Buscar por selfie</p>
                    <p className="text-sm text-[#6b7280] mt-0.5 leading-snug">
                      Reconocimiento facial privado
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTab("text");
                    setShowOcrModal(true);
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border px-5 py-5 text-center shadow-md transition sm:min-h-[200px] ${
                    searchTab === "text"
                      ? "border-transparent"
                      : "border-[#e5e7eb] hover:border-[#cbd5f5] bg-white"
                  }`}
                  style={searchTab === "text" ? { backgroundColor: `${accentColor}14` } : undefined}
                >
                  <img
                    src="/OCR.png"
                    alt="Buscar por número o palabra clave"
                    className="h-[120px] w-[120px] rounded-2xl border border-[#e5e7eb] bg-white p-4 object-contain sm:h-[140px] sm:w-[140px]"
                  />
                  <div>
                    <p className="text-base font-semibold text-[#1a1a1a]">
                      Buscar por número o palabra clave
                    </p>
                    <p className="text-sm text-[#6b7280] mt-0.5 leading-snug">
                      Camiseta, dorsal, patente, DNI o nombre
                    </p>
                  </div>
                </button>
              </div>
            </div>
            {searchError && !purchaseUxV2 && (
              <p className="mt-3 text-sm text-[#ef4444]">{searchError}</p>
            )}
            {searchLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#6b7280]">
                <span className="animate-pulse">⏳</span>
                Procesando búsqueda...
              </div>
            )}
            {!searchLoading && searchResults.length === 0 && (searchText.trim() || faceFile) && (
              <div className="mt-4 rounded-md border border-dashed border-[#e5e7eb] p-4 text-sm text-[#6b7280]">
                No encontramos resultados todavía. Probá con otro texto o una selfie más clara.
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                  <p className="text-sm text-[#6b7280]">
                    Resultados: {searchResults.length}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (packSelectionMode) {
                          setPackSelectionError(null);
                          setPackSelectionMode((prev) => {
                            if (!prev) return prev;
                            const next = new Set(prev.photoIds);
                            for (const p of searchResults) {
                              if (next.size >= prev.requiredCount) break;
                              next.add(String(p.id));
                            }
                            if (next.size >= prev.requiredCount) {
                              setPackSelectionError(`Alcanzaste el máximo de ${prev.requiredCount} fotos para este pack.`);
                            }
                            return { ...prev, photoIds: next };
                          });
                          return;
                        }
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const p of searchResults) next.add(String(p.id));
                          return next;
                        });
                      }}
                      className="text-sm font-medium text-[#1a1a1a] hover:underline"
                    >
                      Seleccionar todas
                    </button>
                    <span className="text-[#d1d5db]" aria-hidden>
                      |
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = new Set(searchResults.map((p) => String(p.id)));
                        if (packSelectionMode) {
                          setPackSelectionMode((prev) => {
                            if (!prev) return prev;
                            const next = new Set(prev.photoIds);
                            ids.forEach((id) => next.delete(id));
                            return { ...prev, photoIds: next };
                          });
                          return;
                        }
                        setSelected((prev) => {
                          const next = new Set(prev);
                          ids.forEach((id) => next.delete(id));
                          return next;
                        });
                      }}
                      className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline"
                    >
                      Quitar selección (resultados)
                    </button>
                    <span className="text-[#d1d5db] max-sm:hidden" aria-hidden>
                      |
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchResults([]);
                        setLastFaceSearchMatchIds([]);
                      }}
                      className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline"
                    >
                      Limpiar resultados
                    </button>
                  </div>
                </div>
                <PhotoGrid
                  photos={searchPhotos}
                  onPhotoSelect={toggle}
                  onPhotoOpenSlide={(id) => {
                    const index = searchPhotos.findIndex((p) => p.id === id);
                    if (index !== -1) {
                      setSlideViewerPhotoList(
                        searchPhotos.map((p) => ({
                          ...p,
                          src: `/api/photos/${p.id}/view?mode=preview&albumId=${album.id}`,
                        }))
                      );
                      setSlideViewerIndex(index);
                      setShowSlideViewer(true);
                    }
                  }}
                  noDrag
                />
                {!packSelectionMode && placeFaceBulkUnderSearchResults && faceBulkOfferHandled
                  ? renderFaceBulkPackCard()
                  : null}
              </div>
            )}
          </div>
          )}
          {canPurchaseSingles && !packSelectionMode && !placeFaceBulkUnderSearchResults
            ? renderFaceBulkPackCard()
            : null}
<p className="text-sm text-[#6b7280] mb-4 leading-relaxed">
            {canSelectPhotosForPurchase
              ? photoSelectionHelpText
              : canPurchasePacks
                ? "Explorá las fotos o elegí un pack arriba para comprar."
                : "Explorá las fotos del álbum. La compra se habilitará cuando el fotógrafo active las ventas."}
          </p>
          <PhotoGrid
            photos={photos}
            onPhotoSelect={canSelectPhotosForPurchase ? toggle : undefined}
            onPhotoRequestRemoval={handleRequestRemoval}
            noDrag
            onPhotoOpenSlide={(id) => {
              const index = photos.findIndex((p) => p.id === id);
              if (index !== -1) {
                setSlideViewerPhotoList(
                  photos.map((p) => ({
                    id: p.id,
                    src: `/api/photos/${p.id}/view?mode=preview&albumId=${album.id}`,
                    alt: p.alt,
                    selected: p.selected,
                  }))
                );
                setSlideViewerIndex(index);
                setShowSlideViewer(true);
              }
            }}
          />
          {canPurchaseSingles ? (
          <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {!packSelectionMode && !purchaseUxV2 && (
              <Button
                type="button"
                variant="primary"
                onClick={handleComprar}
                disabled={selected.size === 0 || checkoutSubmitting}
                className="min-h-[48px] whitespace-normal"
              >
                {checkoutSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Procesando compra...
                  </span>
                ) : (
                  <>Comprar seleccionadas {selected.size > 0 ? `(${selected.size})` : ""}</>
                )}
              </Button>
            )}
            {!packSelectionMode && !purchaseUxV2 && gallerySelectionEstimate ? (
              <div className="flex flex-col gap-1 text-sm text-[#374151] leading-relaxed">
                <p className="font-medium text-[#1a1a1a]">
                  {gallerySelectionEstimate.selectedCountLabel}
                </p>
                {gallerySelectionEstimate.discountAppliedLabel ? (
                  <p className="font-medium text-emerald-700">
                    {gallerySelectionEstimate.discountAppliedLabel}
                  </p>
                ) : null}
                <p className="font-semibold text-[#1a1a1a]">
                  {gallerySelectionEstimate.estimatedTotalLabel}
                </p>
              </div>
            ) : null}
            {(packSelectionMode ? packSelectionMode.photoIds.size > 0 : selected.size > 0) &&
            !purchaseUxV2 ? (
              <button
                type="button"
                onClick={() => {
                  if (packSelectionMode) {
                    setPackSelectionMode((prev) => (prev ? { ...prev, photoIds: new Set<string>() } : prev));
                    return;
                  }
                  setSelected(new Set());
                }}
                disabled={checkoutSubmitting || packSelectionSaving}
                className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Deseleccionar todas
              </button>
            ) : null}
          </div>
          {!packSelectionMode && checkoutSubmitting && !purchaseUxV2 ? (
            <p className="mt-3 text-sm font-medium text-[#374151]">
              Estamos preparando tu compra. No cierres esta pantalla.
            </p>
          ) : null}
          {!packSelectionMode && checkoutSubmitError && !purchaseUxV2 ? (
            <div className="mt-2 flex flex-col items-start gap-2">
              <p className="text-sm text-red-600">{checkoutSubmitError}</p>
              {checkoutRetryHrefRef.current ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="text-sm"
                  onClick={handleCheckoutRetry}
                  disabled={checkoutSubmitting}
                >
                  Reintentar
                </Button>
              ) : null}
            </div>
          ) : null}
          </>
          ) : null}
        </>
      )}
      </>
      }
      />

      {/* CTA flotante (legacy — oculto con UX V2) */}
      {canPurchaseSingles && !packSelectionMode && !purchaseUxV2 && (
        <button
          type="button"
          onClick={handleComprar}
          disabled={!hasSelection || checkoutSubmitting}
          className={`fixed z-50 right-5 bottom-5 md:right-8 md:bottom-8 px-4 py-3 rounded-full shadow-lg text-white text-sm font-semibold transition-all disabled:pointer-events-none ${
            hasSelection && !checkoutSubmitting
              ? "bg-[#c27b3d] hover:bg-[#a0652d]"
              : "bg-[#9ca3af] cursor-not-allowed"
          }`}
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          {checkoutSubmitting ? "Procesando..." : hasSelection ? "Comprar fotos" : "Seleccioná fotos"}
        </button>
      )}

      {showPurchaseStickyUx ? (
        <>
          <PurchaseStickyBar
            visible={stickyBarState.visible}
            accentColor={accentColor}
            packName={stickyBarState.packName}
            selectedCount={stickyBarState.selectedCount}
            requiredCount={stickyBarState.requiredCount}
            selectedSummaryLabel={stickyBarState.selectedSummaryLabel}
            discountAppliedLabel={stickyBarState.discountAppliedLabel}
            totalLabel={stickyBarState.totalLabel}
            savingsLabel={stickyBarState.savingsLabel}
            errorMessage={stickyBarState.errorMessage}
            statusLine={stickyBarState.statusLine}
            primaryAction={stickyBarState.primaryAction}
            secondaryAction={stickyBarState.secondaryAction}
          />
          <PurchaseToast toast={purchaseToast} onDismiss={dismissPurchaseToast} />
        </>
      ) : null}

      {mounted && packDraftPreparedSummary ? (
        <PackBuyerContactSheet
          open={packBuyerContactSheetOpen}
          accentColor={accentColor}
          packName={packDraftPreparedSummary.packName}
          totalLabel={`Total: ${formatPurchaseArs(packDraftPreparedSummary.totalCents)}`}
          loading={packPaymentSubmitting}
          initialContact={packBuyerContactInitial}
          onClose={() => {
            if (!packPaymentSubmitting) setPackBuyerContactSheetOpen(false);
          }}
          onSubmit={(contact) => void handlePackBuyerContactSubmit(contact)}
        />
      ) : null}

      {/* Slide Viewer */}
      {showSlideViewer && slideViewerPhotoList.length > 0 && (
        <PhotoSlideViewer
          photos={slideViewerPhotoList}
          initialIndex={slideViewerIndex}
          protectUnpurchased={album.scanProtectionEnabled !== false}
          onClose={() => setShowSlideViewer(false)}
          onPhotoSelect={canSelectPhotosForPurchase ? toggle : undefined}
          selectionTotalLabel={
            packSelectionMode
              ? null
              : formatGallerySelectionButtonTotal(galleryPricing, selected.size)
          }
        />
      )}
    </main>
    {iaSearchModals}

    {mounted && showFaceBulkOfferModal && faceBulkOffer.eligible ? (
      <FaceBulkOfferModal
        open={showFaceBulkOfferModal}
        accentColor={accentColor}
        packPhotoCount={faceBulkOffer.packPhotoCount}
        searchMatchCount={searchResults.length}
        priceEachLabel={formatArsFaceBulkPesos(faceBulkOffer.digitalUnitClientCents)}
        packPriceLabel={formatArsFaceBulkPesos(faceBulkOffer.packTotalClientCents)}
        savingsLabel={formatArsFaceBulkPesos(faceBulkOffer.savingsCents)}
        strikethroughTotalLabel={formatArsFaceBulkPesos(faceBulkOffer.individualTotalCents)}
        onBuyAll={handleFaceBulkOfferBuyAll}
        onChooseSome={handleFaceBulkOfferChooseSome}
        onRemindLater={handleFaceBulkOfferRemindLater}
      />
    ) : null}
    </>
  );
}
