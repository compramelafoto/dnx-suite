/**
 * Tipos del Centro Editorial de Coberturas.
 */

export type CoverageAlbumSnapshot = {
  clfAlbumId: number;
  publicSlug: string;
  title: string;
  clfEventId: number | null;
  eventTitle: string | null;
  city: string | null;
  isPublic: boolean;
  isHidden: boolean;
  deletedAt: Date | null;
  firstPhotoDate: Date | null;
  createdAt: Date;
  expirationExtensionDays: number | null;
  cleanupStatus: string | null;
  coverThumbnailKey: string | null;
  photoCount: number;
  photographers: CoveragePhotographerInput[];
};

export type CoveragePhotographerInput = {
  clfUserId: number;
  displayName: string;
  role: "PRIMARY" | "COLLABORATOR" | "CONTRIBUTOR";
  photoCount: number;
  companyName?: string | null;
};

export type CoverageSyncResult = {
  coverageId: string;
  clfAlbumId: number;
  created: boolean;
  updated: boolean;
  commercialStatus: string;
  canShowPurchaseCta: boolean;
  photographerCount: number;
};

export type CoverageDashboardMetrics = {
  total: number;
  discovered: number;
  linked: number;
  dismissed: number;
  stale: number;
  availableCommercial: number;
  withArticles: number;
  multiPhotographer: number;
  aiReady: number;
  selectorReady: number;
  creditsReady: number;
};
