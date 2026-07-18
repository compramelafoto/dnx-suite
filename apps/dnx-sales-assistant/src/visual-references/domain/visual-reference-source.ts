export type VisualReferenceSourceKind =
  | "LOCAL_CURATED"
  | "COMPRAMELAFOTO_FUTURE"
  | "GOOGLE_DRIVE_FUTURE"
  | "EXTERNAL_PROVIDER_FUTURE";

export type VisualReferenceSource = {
  kind: VisualReferenceSourceKind;
  originalIdentifier?: string;
  originalFilename?: string;
};
