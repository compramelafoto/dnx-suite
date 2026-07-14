/**
 * Capacidades públicas de una edición — qué acciones puede ofrecer la UI.
 * Solo flags de contrato; sin lógica de evaluación en Clickaton todavía.
 */

export type PublicMarathonCapabilities = {
  marathonId: string;
  canRegister: boolean;
  canViewRules: boolean;
  canViewChallenges: boolean;
  canUploadPhotos: boolean;
  canViewResults: boolean;
  canViewGallery: boolean;
  /** Futuro vínculo comercial (p. ej. ComprameLaFoto); no integrar todavía. */
  canBuyWinningPhotos: boolean;
  canJoinWaitlist: boolean;
  canDownloadCertificate: boolean;
  /** Check-in / acreditación pública cuando aplique. */
  canCheckIn: boolean;
  evaluatedAt: string;
};
