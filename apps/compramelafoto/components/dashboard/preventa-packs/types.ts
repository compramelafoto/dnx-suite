export type BenefitRow = {
  id: number;
  packDefinitionId: number;
  kind: "DIGITAL" | "PHYSICAL";
  includedQuantity: number;
  sortOrder: number;
  photographerProductId: number | null;
  templatePolicy: "NONE" | "REQUIRED" | "OPTIONAL";
  templateId: number | null;
  extraUnitPriceOverrideArs: number | null;
  requiredPhotoCount: number;
  selectionMode: "SINGLE_PHOTO" | "MULTI_PHOTO_FIXED" | "ALBUM_CHOICE";
  maxPhotosPerUnit: number | null;
};

export type PackRow = {
  id: number;
  albumId: number;
  name: string;
  description: string | null;
  /** URL pública cuadrada 1:1 (opcional). */
  coverImageUrl?: string | null;
  isActive: boolean;
  availabilityPhase?: "PRE_UPLOAD" | "POST_UPLOAD" | null;
  validFrom: string | null;
  validUntil: string | null;
  redemptionDeadlineAt: string | null;
  displayOrder: number;
  /** Precio base del fotógrafo (ARS), tal como se guarda en BD. */
  priceClientArs: number;
  /** Precio final al cliente (base + fee), solo en respuesta GET listado. */
  priceFinalClientArs?: number;
  currency: string;
  benefits?: BenefitRow[];
};

export type PhotographerProductOption = {
  id: number;
  name: string;
  size: string | null;
  retailPrice: number;
  isActive?: boolean;
};

export type TemplateOption = {
  id: number;
  name: string;
  group: string;
};
