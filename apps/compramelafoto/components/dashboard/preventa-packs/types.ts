export type BenefitRow = {
  id: number;
  packDefinitionId: number;
  kind: "DIGITAL" | "PHYSICAL";
  includedQuantity: number;
  sortOrder: number;
  photographerProductId: number | null;
  templatePolicy: "NONE" | "REQUIRED" | "OPTIONAL";
  templateId: number | null;
  /** Plantilla del diseñador nuevo con la que se arma el diseño al canjear. */
  templateV2Id?: string | null;
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
  /** Pack destacado del catálogo público ("Recomendado"). Uno solo por álbum. */
  isRecommended?: boolean;
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

/** Plantilla del diseñador nuevo que se puede asignar a un beneficio. */
export type TemplateOption = {
  id: string;
  name: string;
  group: string;
  /** Cuántas fotos del cliente usa (huecos `photo_n`). 0 = no arma nada. */
  photoInputs: number;
};
