/**
 * Gráficas welcome responsivas (desktop / mobile) — dominio sin migración.
 *
 * Persistencia: `DnxPartnerAsset` existente (`type` carrier `BRAND_PHOTO` u `OTHER`)
 * + metadata tipada `welcomeGraphic` (purpose / device / motion).
 * No inventa enums Prisma; no requiere schema nuevo.
 */
import { PartnersDomainError } from "./types";
import { assertSafePartnerDestinationUrl } from "./tracking";

/** Breakpoint canónico DS / Tailwind `md` (PublicMarketingHeader, shells). */
export const WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX = 768;

export const WELCOME_GRAPHIC_PURPOSE = "WELCOME_GRAPHIC" as const;

export const WELCOME_GRAPHIC_DEVICE_TARGETS = ["DESKTOP", "MOBILE"] as const;
export type WelcomeGraphicDeviceTarget = (typeof WELCOME_GRAPHIC_DEVICE_TARGETS)[number];

export const WELCOME_GRAPHIC_MOTION_VARIANTS = ["PRIMARY", "STATIC_FALLBACK"] as const;
export type WelcomeGraphicMotionVariant = (typeof WELCOME_GRAPHIC_MOTION_VARIANTS)[number];

/** Carrier Prisma existente (sin ampliar enum BrandAssetType). */
export const WELCOME_GRAPHIC_CARRIER_ASSET_TYPES = ["BRAND_PHOTO", "OTHER"] as const;

export const WELCOME_GRAPHIC_ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
] as const;

export type WelcomeGraphicLimits = {
  desktopStaticMaxBytes: number;
  mobileStaticMaxBytes: number;
  desktopGifMaxBytes: number;
  mobileGifMaxBytes: number;
  desktopMinWidth: number;
  desktopMinHeight: number;
  desktopMaxWidth: number;
  desktopMaxHeight: number;
  mobileMinWidth: number;
  mobileMinHeight: number;
  mobileMaxWidth: number;
  mobileMaxHeight: number;
};

export const DEFAULT_WELCOME_GRAPHIC_LIMITS: WelcomeGraphicLimits = {
  desktopStaticMaxBytes: 2 * 1024 * 1024,
  mobileStaticMaxBytes: 1 * 1024 * 1024,
  desktopGifMaxBytes: 1536 * 1024,
  mobileGifMaxBytes: 768 * 1024,
  desktopMinWidth: 600,
  desktopMinHeight: 315,
  desktopMaxWidth: 2400,
  desktopMaxHeight: 1350,
  mobileMinWidth: 600,
  mobileMinHeight: 600,
  mobileMaxWidth: 1440,
  mobileMaxHeight: 2560,
};

export type WelcomeGraphicSlotKey =
  | "WELCOME_GRAPHIC_DESKTOP"
  | "WELCOME_GRAPHIC_MOBILE"
  | "WELCOME_GRAPHIC_DESKTOP_STATIC_FALLBACK"
  | "WELCOME_GRAPHIC_MOBILE_STATIC_FALLBACK";

export type WelcomeGraphicSlotGuide = {
  slotKey: WelcomeGraphicSlotKey;
  deviceTarget: WelcomeGraphicDeviceTarget;
  motionVariant: WelcomeGraphicMotionVariant;
  title: string;
  shortLabel: string;
  description: string;
  recommendation: string;
  suggestedSize: string;
  required: boolean;
};

export const WELCOME_GRAPHIC_SLOTS: readonly WelcomeGraphicSlotGuide[] = [
  {
    slotKey: "WELCOME_GRAPHIC_DESKTOP",
    deviceTarget: "DESKTOP",
    motionVariant: "PRIMARY",
    title: "Escritorio",
    shortLabel: "Desktop",
    description: "Pieza horizontal que se mostrará en computadoras y pantallas amplias.",
    recommendation:
      "Proporción ~16:9 a 1.91:1 · sugerido 1200×630. Evitá botones dibujados y texto pegado a bordes. Reservá aire para la X y el CTA del sistema.",
    suggestedSize: "1200 × 630 px",
    required: false,
  },
  {
    slotKey: "WELCOME_GRAPHIC_MOBILE",
    deviceTarget: "MOBILE",
    motionVariant: "PRIMARY",
    title: "Celular",
    shortLabel: "Mobile",
    description: "Pieza vertical o adaptada que se mostrará en teléfonos.",
    recommendation:
      "Proporción ~4:5 a 9:16 · sugerido 1080×1350 o 1080×1920. Debe caber en el diálogo sin tapar X ni CTA.",
    suggestedSize: "1080 × 1350 px",
    required: false,
  },
  {
    slotKey: "WELCOME_GRAPHIC_DESKTOP_STATIC_FALLBACK",
    deviceTarget: "DESKTOP",
    motionVariant: "STATIC_FALLBACK",
    title: "Escritorio · fallback estático",
    shortLabel: "Desktop estático",
    description: "Versión estática para reduced motion cuando la pieza desktop es GIF.",
    recommendation: "PNG/WebP/JPG. Misma composición que el GIF, sin animación.",
    suggestedSize: "1200 × 630 px",
    required: false,
  },
  {
    slotKey: "WELCOME_GRAPHIC_MOBILE_STATIC_FALLBACK",
    deviceTarget: "MOBILE",
    motionVariant: "STATIC_FALLBACK",
    title: "Celular · fallback estático",
    shortLabel: "Mobile estático",
    description: "Versión estática para reduced motion cuando la pieza mobile es GIF.",
    recommendation: "PNG/WebP/JPG. Misma composición que el GIF, sin animación.",
    suggestedSize: "1080 × 1350 px",
    required: false,
  },
] as const;

export const WELCOME_GRAPHIC_SAFE_AREA_COPY =
  "Evitá texto esencial junto a bordes, no dibujes botones ni CTAs en la imagen, reservá espacio visual para la X, y recordá que el sistema agrega «Contenido patrocinado» y el CTA accesible. Probá ambas vistas antes de aprobar.";

export const WELCOME_GRAPHIC_CTA_COPY =
  "Evitá incluir botones o llamadas a la acción dentro de la imagen. El sistema agregará el CTA de forma accesible.";

export type WelcomeGraphicMetadataV1 = {
  v: 1;
  purpose: typeof WELCOME_GRAPHIC_PURPOSE;
  deviceTarget: WelcomeGraphicDeviceTarget;
  motionVariant: WelcomeGraphicMotionVariant;
  /** true si el archivo es animado (GIF). */
  animated: boolean;
  /** Asset id del fallback estático (mismo device). */
  staticFallbackAssetId?: string | null;
  /** Marca el asset como predeterminado del sponsor para ese device+motion. */
  isDefault?: boolean;
};

export type WelcomeGraphicAssetLike = {
  id: string;
  partnerId: string;
  type: string;
  status: string;
  approvalStatus: string;
  archivedAt?: Date | string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
  isPrimary?: boolean;
  metadata?: unknown;
};

export type WelcomeGraphicPieceSnapshot = {
  imageUrl: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  animated: boolean;
  reducedMotionFallbackUrl: string | null;
  source: "SELECTED" | "DEFAULT" | "CROSS_DEVICE" | "LOGO" | "LEGACY_IMAGE_URL";
};

/** Payload público / snapshot (sin PII administrativa). */
export type WelcomeResponsiveMediaSnapshot = {
  /** Compat: pieza universal o logo (prioridad baja frente a campos device). */
  imageUrl: string | null;
  desktop: WelcomeGraphicPieceSnapshot | null;
  mobile: WelcomeGraphicPieceSnapshot | null;
  logoFallback: WelcomeGraphicPieceSnapshot | null;
  mediaMinDesktopPx: number;
};

export function slotKeyForWelcomeGraphic(
  deviceTarget: WelcomeGraphicDeviceTarget,
  motionVariant: WelcomeGraphicMotionVariant,
): WelcomeGraphicSlotKey {
  if (deviceTarget === "DESKTOP" && motionVariant === "PRIMARY") {
    return "WELCOME_GRAPHIC_DESKTOP";
  }
  if (deviceTarget === "MOBILE" && motionVariant === "PRIMARY") {
    return "WELCOME_GRAPHIC_MOBILE";
  }
  if (deviceTarget === "DESKTOP" && motionVariant === "STATIC_FALLBACK") {
    return "WELCOME_GRAPHIC_DESKTOP_STATIC_FALLBACK";
  }
  return "WELCOME_GRAPHIC_MOBILE_STATIC_FALLBACK";
}

export function getWelcomeGraphicSlot(
  slotKey: WelcomeGraphicSlotKey,
): WelcomeGraphicSlotGuide {
  const slot = WELCOME_GRAPHIC_SLOTS.find((s) => s.slotKey === slotKey);
  if (!slot) {
    throw new PartnersDomainError("VALIDATION", `Slot welcome desconocido: ${slotKey}`);
  }
  return slot;
}

export function buildWelcomeGraphicMetadata(input: {
  deviceTarget: WelcomeGraphicDeviceTarget;
  motionVariant?: WelcomeGraphicMotionVariant;
  animated?: boolean;
  staticFallbackAssetId?: string | null;
  isDefault?: boolean;
}): WelcomeGraphicMetadataV1 {
  return {
    v: 1,
    purpose: WELCOME_GRAPHIC_PURPOSE,
    deviceTarget: input.deviceTarget,
    motionVariant: input.motionVariant ?? "PRIMARY",
    animated: Boolean(input.animated),
    staticFallbackAssetId: input.staticFallbackAssetId ?? null,
    isDefault: input.isDefault ?? false,
  };
}

export function parseWelcomeGraphicMetadata(
  metadata: unknown,
): WelcomeGraphicMetadataV1 | null {
  if (!metadata || typeof metadata !== "object") return null;
  const root = metadata as Record<string, unknown>;
  const raw = (root.welcomeGraphic ?? root) as Record<string, unknown>;
  if (!raw || typeof raw !== "object") return null;
  if (raw.v !== 1) return null;
  if (raw.purpose !== WELCOME_GRAPHIC_PURPOSE) return null;
  const device = raw.deviceTarget;
  const motion = raw.motionVariant;
  if (
    device !== "DESKTOP" &&
    device !== "MOBILE"
  ) {
    return null;
  }
  if (motion !== "PRIMARY" && motion !== "STATIC_FALLBACK") {
    return null;
  }
  return {
    v: 1,
    purpose: WELCOME_GRAPHIC_PURPOSE,
    deviceTarget: device,
    motionVariant: motion,
    animated: Boolean(raw.animated),
    staticFallbackAssetId:
      typeof raw.staticFallbackAssetId === "string" ? raw.staticFallbackAssetId : null,
    isDefault: Boolean(raw.isDefault),
  };
}

export function wrapWelcomeGraphicMetadata(
  meta: WelcomeGraphicMetadataV1,
): { welcomeGraphic: WelcomeGraphicMetadataV1 } {
  return { welcomeGraphic: meta };
}

export function isWelcomeGraphicAsset(asset: WelcomeGraphicAssetLike): boolean {
  if (
    !(WELCOME_GRAPHIC_CARRIER_ASSET_TYPES as readonly string[]).includes(asset.type)
  ) {
    return false;
  }
  return parseWelcomeGraphicMetadata(asset.metadata) != null;
}

export function isAnimatedWelcomeMime(mimeType: string | null | undefined): boolean {
  return (mimeType ?? "").toLowerCase().trim() === "image/gif";
}

export function maxBytesForWelcomeGraphic(input: {
  deviceTarget: WelcomeGraphicDeviceTarget;
  animated: boolean;
  limits?: WelcomeGraphicLimits;
}): number {
  const limits = input.limits ?? DEFAULT_WELCOME_GRAPHIC_LIMITS;
  if (input.deviceTarget === "DESKTOP") {
    return input.animated ? limits.desktopGifMaxBytes : limits.desktopStaticMaxBytes;
  }
  return input.animated ? limits.mobileGifMaxBytes : limits.mobileStaticMaxBytes;
}

export type WelcomeGraphicIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

function isApprovedActive(asset: WelcomeGraphicAssetLike): boolean {
  return (
    !asset.archivedAt &&
    asset.status === "ACTIVE" &&
    asset.approvalStatus === "APPROVED"
  );
}

export function validateWelcomeGraphicAsset(input: {
  asset: WelcomeGraphicAssetLike;
  expectedPartnerId: string;
  expectedDevice?: WelcomeGraphicDeviceTarget;
  expectedMotion?: WelcomeGraphicMotionVariant;
  limits?: WelcomeGraphicLimits;
  /** Si true, no exige APPROVED (preview). */
  previewDraft?: boolean;
}): WelcomeGraphicIssue[] {
  const issues: WelcomeGraphicIssue[] = [];
  const { asset } = input;
  const meta = parseWelcomeGraphicMetadata(asset.metadata);

  if (asset.partnerId !== input.expectedPartnerId) {
    issues.push({
      code: "ASSET_PARTNER",
      message: "El asset no pertenece a este sponsor.",
      severity: "error",
    });
  }
  if (!meta) {
    issues.push({
      code: "WELCOME_META",
      message: "Falta metadata welcomeGraphic tipada (purpose/device/motion).",
      severity: "error",
    });
  } else {
    if (input.expectedDevice && meta.deviceTarget !== input.expectedDevice) {
      issues.push({
        code: "DEVICE_MISMATCH",
        message: `Se esperaba device ${input.expectedDevice}.`,
        severity: "error",
      });
    }
    if (input.expectedMotion && meta.motionVariant !== input.expectedMotion) {
      issues.push({
        code: "MOTION_MISMATCH",
        message: `Se esperaba motion ${input.expectedMotion}.`,
        severity: "error",
      });
    }
  }

  if (asset.archivedAt) {
    issues.push({
      code: "ASSET_ARCHIVED",
      message: "El asset está archivado.",
      severity: "error",
    });
  }
  if (asset.status !== "ACTIVE") {
    issues.push({
      code: "ASSET_STATUS",
      message: "El asset debe estar ACTIVE.",
      severity: "error",
    });
  }
  if (!input.previewDraft && asset.approvalStatus !== "APPROVED") {
    issues.push({
      code: "ASSET_APPROVAL",
      message: "Variante pendiente o rechazada: no se usa como fallback ni en runtime.",
      severity: "error",
    });
  }

  const alt = asset.altText?.trim() ?? "";
  if (!alt) {
    issues.push({
      code: "ASSET_ALT",
      message: "Alt obligatorio por variante.",
      severity: "error",
    });
  }

  const url = asset.fileUrl?.trim() ?? "";
  if (!url) {
    issues.push({
      code: "ASSET_URL",
      message: "Sin URL pública.",
      severity: "error",
    });
  } else {
    try {
      assertSafePartnerDestinationUrl(url);
    } catch (e) {
      issues.push({
        code: "ASSET_URL_UNSAFE",
        message: e instanceof Error ? e.message : "URL insegura.",
        severity: "error",
      });
    }
    if (/\.svg(\?|$)/i.test(url)) {
      issues.push({
        code: "ASSET_SVG",
        message: "SVG no admitido (pipeline sin sanitizado verificable).",
        severity: "error",
      });
    }
  }

  const mime = (asset.mimeType ?? "").toLowerCase().trim();
  if (mime && !(WELCOME_GRAPHIC_ALLOWED_MIMES as readonly string[]).includes(mime)) {
    issues.push({
      code: "ASSET_MIME",
      message: "MIME no admitido. Usá PNG, WebP, JPG o GIF.",
      severity: "error",
    });
  }

  const animated = meta?.animated || isAnimatedWelcomeMime(mime);
  if (meta && animated !== isAnimatedWelcomeMime(mime) && mime === "image/gif") {
    // mime gif fuerza animated
  }
  if (meta?.motionVariant === "STATIC_FALLBACK" && animated) {
    issues.push({
      code: "STATIC_FALLBACK_ANIMATED",
      message: "El fallback reduced-motion debe ser estático (no GIF).",
      severity: "error",
    });
  }

  const device = meta?.deviceTarget ?? input.expectedDevice ?? "DESKTOP";
  const limits = input.limits ?? DEFAULT_WELCOME_GRAPHIC_LIMITS;
  const maxBytes = maxBytesForWelcomeGraphic({
    deviceTarget: device,
    animated: Boolean(animated),
    limits,
  });
  if (typeof asset.fileSize === "number" && asset.fileSize > maxBytes) {
    issues.push({
      code: "ASSET_SIZE",
      message: `Peso máximo ${Math.round(maxBytes / 1024)} KB para esta variante.`,
      severity: "error",
    });
  }

  if (typeof asset.width === "number" && typeof asset.height === "number") {
    const minW = device === "DESKTOP" ? limits.desktopMinWidth : limits.mobileMinWidth;
    const minH = device === "DESKTOP" ? limits.desktopMinHeight : limits.mobileMinHeight;
    const maxW = device === "DESKTOP" ? limits.desktopMaxWidth : limits.mobileMaxWidth;
    const maxH = device === "DESKTOP" ? limits.desktopMaxHeight : limits.mobileMaxHeight;
    if (asset.width < minW || asset.height < minH) {
      issues.push({
        code: "ASSET_DIM_MIN",
        message: `Dimensiones mínimas recomendadas ${minW}×${minH}.`,
        severity: "warning",
      });
    }
    if (asset.width > maxW || asset.height > maxH) {
      issues.push({
        code: "ASSET_DIM_MAX",
        message: `Dimensiones máximas ${maxW}×${maxH}.`,
        severity: "error",
      });
    }
  }

  return issues;
}

function toPiece(
  asset: WelcomeGraphicAssetLike,
  source: WelcomeGraphicPieceSnapshot["source"],
  reducedMotionFallbackUrl: string | null = null,
): WelcomeGraphicPieceSnapshot | null {
  const url = asset.fileUrl?.trim();
  if (!url || !isApprovedActive(asset)) return null;
  const mime = asset.mimeType?.toLowerCase().trim() || null;
  const meta = parseWelcomeGraphicMetadata(asset.metadata);
  return {
    imageUrl: url,
    mimeType: mime,
    width: asset.width ?? null,
    height: asset.height ?? null,
    alt: (asset.altText?.trim() || "Contenido patrocinado").trim(),
    animated: Boolean(meta?.animated || isAnimatedWelcomeMime(mime)),
    reducedMotionFallbackUrl,
    source,
  };
}

function findStaticFallbackUrl(
  primary: WelcomeGraphicAssetLike,
  pool: readonly WelcomeGraphicAssetLike[],
): string | null {
  const meta = parseWelcomeGraphicMetadata(primary.metadata);
  if (!meta) return null;
  if (meta.staticFallbackAssetId) {
    const linked = pool.find((a) => a.id === meta.staticFallbackAssetId);
    if (linked && isApprovedActive(linked) && linked.fileUrl?.trim()) {
      return linked.fileUrl.trim();
    }
  }
  const sameDeviceStatic = pool.find((a) => {
    const m = parseWelcomeGraphicMetadata(a.metadata);
    return (
      m &&
      m.deviceTarget === meta.deviceTarget &&
      m.motionVariant === "STATIC_FALLBACK" &&
      isApprovedActive(a) &&
      a.fileUrl?.trim()
    );
  });
  return sameDeviceStatic?.fileUrl?.trim() ?? null;
}

/**
 * Prioridad por dispositivo (solo assets APPROVED/ACTIVE; pending/archivados ignorados).
 */
export function resolveWelcomeGraphicForDevice(input: {
  device: WelcomeGraphicDeviceTarget;
  assets: readonly WelcomeGraphicAssetLike[];
  selectedPrimaryId?: string | null;
  /** Forzar logo (campaña «Usar logo»). */
  forceLogo?: boolean;
  logoAsset?: WelcomeGraphicAssetLike | null;
  /** Compat: imageUrl legacy del creative. */
  legacyImageUrl?: string | null;
  legacyAlt?: string | null;
}): {
  piece: WelcomeGraphicPieceSnapshot | null;
  warnings: WelcomeGraphicIssue[];
} {
  const warnings: WelcomeGraphicIssue[] = [];
  const pool = input.assets.filter((a) => isWelcomeGraphicAsset(a) || a.isPrimary);

  if (input.forceLogo) {
    if (input.logoAsset && isApprovedActive(input.logoAsset) && input.logoAsset.fileUrl) {
      return {
        piece: {
          imageUrl: input.logoAsset.fileUrl.trim(),
          mimeType: input.logoAsset.mimeType ?? null,
          width: input.logoAsset.width ?? null,
          height: input.logoAsset.height ?? null,
          alt: input.logoAsset.altText?.trim() || "Logo del sponsor",
          animated: false,
          reducedMotionFallbackUrl: null,
          source: "LOGO",
        },
        warnings,
      };
    }
    warnings.push({
      code: "LOGO_MISSING",
      message: "Se eligió «Usar logo» pero no hay logo aprobado.",
      severity: "error",
    });
    return { piece: null, warnings };
  }

  const graphics = pool.filter((a) => {
    const m = parseWelcomeGraphicMetadata(a.metadata);
    return m && isApprovedActive(a);
  });

  const pickPrimary = (device: WelcomeGraphicDeviceTarget, preferId?: string | null) => {
    if (preferId) {
      const selected = graphics.find((a) => {
        const m = parseWelcomeGraphicMetadata(a.metadata)!;
        return a.id === preferId && m.deviceTarget === device && m.motionVariant === "PRIMARY";
      });
      if (selected) return selected;
    }
    const defaults = graphics.filter((a) => {
      const m = parseWelcomeGraphicMetadata(a.metadata)!;
      return m.deviceTarget === device && m.motionVariant === "PRIMARY" && m.isDefault;
    });
    if (defaults[0]) return defaults[0];
    return graphics.find((a) => {
      const m = parseWelcomeGraphicMetadata(a.metadata)!;
      return m.deviceTarget === device && m.motionVariant === "PRIMARY";
    });
  };

  const selected = pickPrimary(input.device, input.selectedPrimaryId);
  if (selected) {
    const rm = findStaticFallbackUrl(selected, graphics);
    return {
      piece: toPiece(
        selected,
        input.selectedPrimaryId === selected.id ? "SELECTED" : "DEFAULT",
        rm,
      ),
      warnings,
    };
  }

  // Cross-device contain
  const otherDevice: WelcomeGraphicDeviceTarget =
    input.device === "DESKTOP" ? "MOBILE" : "DESKTOP";
  const cross = pickPrimary(otherDevice, null);
  if (cross) {
    warnings.push({
      code: "CROSS_DEVICE",
      message:
        input.device === "MOBILE"
          ? "Sin pieza mobile: se usará la desktop con object-fit contain (puede haber más espacio vacío)."
          : "Sin pieza desktop: se usará la mobile centrada con contain (puede verse más angosta).",
      severity: "warning",
    });
    const rm = findStaticFallbackUrl(cross, graphics);
    return { piece: toPiece(cross, "CROSS_DEVICE", rm), warnings };
  }

  if (input.logoAsset && isApprovedActive(input.logoAsset) && input.logoAsset.fileUrl) {
    return {
      piece: {
        imageUrl: input.logoAsset.fileUrl.trim(),
        mimeType: input.logoAsset.mimeType ?? null,
        width: input.logoAsset.width ?? null,
        height: input.logoAsset.height ?? null,
        alt: input.logoAsset.altText?.trim() || "Logo del sponsor",
        animated: false,
        reducedMotionFallbackUrl: null,
        source: "LOGO",
      },
      warnings,
    };
  }

  const legacy = input.legacyImageUrl?.trim();
  if (legacy) {
    return {
      piece: {
        imageUrl: legacy,
        mimeType: null,
        width: null,
        height: null,
        alt: input.legacyAlt?.trim() || "Contenido patrocinado",
        animated: false,
        reducedMotionFallbackUrl: null,
        source: "LEGACY_IMAGE_URL",
      },
      warnings,
    };
  }

  warnings.push({
    code: "NO_ASSET",
    message: "Sin gráfica ni logo aprobado: bloquear publicación.",
    severity: "error",
  });
  return { piece: null, warnings };
}

export function buildWelcomeResponsiveMediaSnapshot(input: {
  assets: readonly WelcomeGraphicAssetLike[];
  logoAsset?: WelcomeGraphicAssetLike | null;
  selectedDesktopId?: string | null;
  selectedMobileId?: string | null;
  forceLogoDesktop?: boolean;
  forceLogoMobile?: boolean;
  legacyImageUrl?: string | null;
  legacyAlt?: string | null;
}): {
  snapshot: WelcomeResponsiveMediaSnapshot;
  warnings: WelcomeGraphicIssue[];
  canPublish: boolean;
} {
  const desktop = resolveWelcomeGraphicForDevice({
    device: "DESKTOP",
    assets: input.assets,
    selectedPrimaryId: input.selectedDesktopId,
    forceLogo: input.forceLogoDesktop,
    logoAsset: input.logoAsset,
    legacyImageUrl: input.legacyImageUrl,
    legacyAlt: input.legacyAlt,
  });
  const mobile = resolveWelcomeGraphicForDevice({
    device: "MOBILE",
    assets: input.assets,
    selectedPrimaryId: input.selectedMobileId,
    forceLogo: input.forceLogoMobile,
    logoAsset: input.logoAsset,
    legacyImageUrl: input.legacyImageUrl,
    legacyAlt: input.legacyAlt,
  });

  const warnings = [...desktop.warnings, ...mobile.warnings];
  const logoFallback =
    input.logoAsset && isApprovedActive(input.logoAsset) && input.logoAsset.fileUrl
      ? ({
          imageUrl: input.logoAsset.fileUrl.trim(),
          mimeType: input.logoAsset.mimeType ?? null,
          width: input.logoAsset.width ?? null,
          height: input.logoAsset.height ?? null,
          alt: input.logoAsset.altText?.trim() || "Logo del sponsor",
          animated: false,
          reducedMotionFallbackUrl: null,
          source: "LOGO" as const,
        } satisfies WelcomeGraphicPieceSnapshot)
      : null;

  // GIF sin fallback estático ni logo → bloquear
  for (const piece of [desktop.piece, mobile.piece]) {
    if (piece?.animated && !piece.reducedMotionFallbackUrl && !logoFallback) {
      warnings.push({
        code: "GIF_NO_FALLBACK",
        message:
          "GIF sin fallback estático ni logo aprobado: bloquear publicación (reduced motion).",
        severity: "error",
      });
    } else if (piece?.animated && !piece.reducedMotionFallbackUrl && logoFallback) {
      warnings.push({
        code: "GIF_LOGO_FALLBACK",
        message: "GIF sin fallback estático: en reduced motion se usará el logo.",
        severity: "warning",
      });
    }
  }

  if (!desktop.piece || !mobile.piece) {
    if (desktop.piece && !mobile.piece) {
      warnings.push({
        code: "MISSING_MOBILE",
        message: "Falta pieza mobile: publicable con advertencia y preview mobile obligatoria.",
        severity: "warning",
      });
    }
    if (!desktop.piece && mobile.piece) {
      warnings.push({
        code: "MISSING_DESKTOP",
        message: "Falta pieza desktop: publicable con advertencia y preview desktop obligatoria.",
        severity: "warning",
      });
    }
  }

  const snapshot: WelcomeResponsiveMediaSnapshot = {
    imageUrl:
      desktop.piece?.imageUrl ??
      mobile.piece?.imageUrl ??
      logoFallback?.imageUrl ??
      input.legacyImageUrl?.trim() ??
      null,
    desktop: desktop.piece,
    mobile: mobile.piece,
    logoFallback,
    mediaMinDesktopPx: WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX,
  };

  const hasBlocking = warnings.some((w) => w.severity === "error");
  const hasAnyVisual = Boolean(snapshot.desktop || snapshot.mobile || snapshot.logoFallback || snapshot.imageUrl);

  return {
    snapshot,
    warnings,
    canPublish: hasAnyVisual && !hasBlocking,
  };
}

/**
 * Elige URL efectiva para render (reduced motion / error).
 * No genera métricas; puro presentacional.
 */
export function pickWelcomeRenderUrl(input: {
  piece: WelcomeGraphicPieceSnapshot | null;
  logoFallback: WelcomeGraphicPieceSnapshot | null;
  reducedMotion: boolean;
  forceError?: boolean;
}): { url: string | null; alt: string } {
  if (input.forceError) {
    if (input.logoFallback?.imageUrl) {
      return { url: input.logoFallback.imageUrl, alt: input.logoFallback.alt };
    }
    return { url: null, alt: "" };
  }
  const piece = input.piece;
  if (!piece) {
    if (input.logoFallback?.imageUrl) {
      return { url: input.logoFallback.imageUrl, alt: input.logoFallback.alt };
    }
    return { url: null, alt: "" };
  }
  if (input.reducedMotion && piece.animated) {
    const rm = piece.reducedMotionFallbackUrl;
    if (rm) return { url: rm, alt: piece.alt };
    if (input.logoFallback?.imageUrl) {
      return { url: input.logoFallback.imageUrl, alt: input.logoFallback.alt };
    }
    return { url: null, alt: piece.alt };
  }
  return { url: piece.imageUrl, alt: piece.alt };
}

export function assertWelcomeGraphicPublishable(input: {
  snapshot: WelcomeResponsiveMediaSnapshot;
  warnings: WelcomeGraphicIssue[];
}): void {
  const errors = input.warnings.filter((w) => w.severity === "error");
  if (errors.length) {
    throw new PartnersDomainError(
      "VALIDATION",
      errors.map((e) => e.message).join(" · "),
    );
  }
  if (!input.snapshot.imageUrl && !input.snapshot.desktop && !input.snapshot.mobile) {
    throw new PartnersDomainError(
      "VALIDATION",
      "Sin asset visual para welcome: bloquear publicación.",
    );
  }
}
