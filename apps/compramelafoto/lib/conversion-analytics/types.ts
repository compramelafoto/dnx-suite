/** Motivos de recuperación (misma lógica que auditoría de abandono). */
export type RecoveryReasonKey =
  | "same_cart"
  | "fewer_photos"
  | "product_change"
  | "complete_change";

export type RecoveryReasonBreakdown = Record<RecoveryReasonKey, number>;

export type ConversionSummary = {
  purchaseAttempts: number;
  completedPurchases: number;
  conversionRatePct: number;
  recoveredAbandonments: number;
  realAbandonments: number;
  recoveryRatePct: number;
};

export type RecoveredRevenue = {
  totalArs: number;
  averageTicketArs: number;
  /** Pagos PAID únicos recuperados (dedup por buyer_key_album + paid_id). */
  recoveryPairs: number;
};

export type ConversionDailyPoint = {
  date: string;
  attempts: number;
  purchases: number;
  conversionRatePct: number;
  recoveries: number;
};

export type AlbumConversionRankRow = {
  albumId: number;
  albumTitle: string | null;
  attempts: number;
  purchases: number;
  conversionRatePct: number;
};

export type PhotographerConversionRankRow = {
  photographerId: number;
  name: string | null;
  email: string;
  attempts: number;
  purchases: number;
  conversionRatePct: number;
};

/** Eventos UX de checkout MP (presentes + futuros en FunnelVisit). */
export type ConversionUxFunnelEvent = {
  event: string;
  visits: number;
  visitors: number;
};

export type PhotographerConversionAnalytics = {
  periodDays: number;
  summary: ConversionSummary;
  recoveryReasons: RecoveryReasonBreakdown;
  recoveredRevenue: RecoveredRevenue;
};

export type AdminConversionAnalytics = PhotographerConversionAnalytics & {
  dailySeries: ConversionDailyPoint[];
  topAlbums: AlbumConversionRankRow[];
  bottomAlbums: AlbumConversionRankRow[];
  topPhotographers: PhotographerConversionRankRow[];
  bottomPhotographers: PhotographerConversionRankRow[];
  uxFunnelEvents: ConversionUxFunnelEvent[];
};
