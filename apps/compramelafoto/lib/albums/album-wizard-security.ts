export type AlbumWizardSecurityMode = "public" | "private" | "selfie";

export function albumPrivacyFromWizardSecurityMode(mode: AlbumWizardSecurityMode): {
  isPublic: boolean;
  hiddenPhotosEnabled: boolean;
} {
  switch (mode) {
    case "private":
      return { isPublic: false, hiddenPhotosEnabled: false };
    case "selfie":
      return { isPublic: true, hiddenPhotosEnabled: true };
    case "public":
    default:
      return { isPublic: true, hiddenPhotosEnabled: false };
  }
}
