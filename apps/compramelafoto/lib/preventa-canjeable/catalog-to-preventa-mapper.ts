import type { CatalogDeliveryType } from "@/lib/prisma";
import type { CreateBenefitInput } from "@/lib/preventa-canjeable/pack-service";
import {
  resolveDigitalQuantityMode,
  type CatalogDigitalQuantityMode,
} from "@/lib/catalog-products/digital-quantity-mode";

export type CatalogComponentForMapper = {
  id: number;
  name: string;
  quantity: number;
  deliveryType: CatalogDeliveryType;
  sortOrder: number;
  notes: string;
  requiresDesign?: boolean;
  digitalQuantityMode?: CatalogDigitalQuantityMode;
};

export class CatalogToPreventaMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogToPreventaMapperError";
  }
}

function mapDigitalComponent(
  component: CatalogComponentForMapper,
  sortOrder: number
): CreateBenefitInput {
  const mode = resolveDigitalQuantityMode({
    deliveryType: component.deliveryType,
    digitalQuantityMode: component.digitalQuantityMode,
    notes: component.notes,
  });

  if (mode === "ALL_EVENT_PHOTOS" || mode === "ALL_MY_PHOTOS") {
    return {
      packDefinitionId: 0,
      kind: "DIGITAL",
      includedQuantity: 1,
      sortOrder,
      photographerProductId: null,
      templatePolicy: "NONE",
      templateId: null,
      extraUnitPriceOverrideArs: null,
      requiredPhotoCount: 1,
      selectionMode: "ALBUM_CHOICE",
      maxPhotosPerUnit: null,
      regularUnitPriceAfterPreventaArs: null,
    };
  }

  const qty = Math.max(1, component.quantity);
  return {
    packDefinitionId: 0,
    kind: "DIGITAL",
    includedQuantity: qty,
    sortOrder,
    photographerProductId: null,
    templatePolicy: "NONE",
    templateId: null,
    extraUnitPriceOverrideArs: null,
    requiredPhotoCount: qty > 1 ? qty : 1,
    selectionMode: qty > 1 ? "MULTI_PHOTO_FIXED" : "SINGLE_PHOTO",
    maxPhotosPerUnit: null,
    regularUnitPriceAfterPreventaArs: null,
  };
}

function mapPrintComponent(
  component: CatalogComponentForMapper,
  sortOrder: number
): CreateBenefitInput {
  return {
    packDefinitionId: 0,
    kind: "PHYSICAL",
    includedQuantity: component.quantity,
    sortOrder,
    photographerProductId: null,
    templatePolicy: "NONE",
    templateId: null,
    extraUnitPriceOverrideArs: null,
    requiredPhotoCount: 1,
    selectionMode: "SINGLE_PHOTO",
    maxPhotosPerUnit: null,
    regularUnitPriceAfterPreventaArs: null,
  };
}

function mapDesignComponent(
  component: CatalogComponentForMapper,
  sortOrder: number
): CreateBenefitInput {
  return {
    packDefinitionId: 0,
    kind: "PHYSICAL",
    includedQuantity: component.quantity,
    sortOrder,
    photographerProductId: null,
    templatePolicy: "REQUIRED",
    templateId: null,
    extraUnitPriceOverrideArs: null,
    requiredPhotoCount: 1,
    selectionMode: "SINGLE_PHOTO",
    maxPhotosPerUnit: null,
    regularUnitPriceAfterPreventaArs: null,
  };
}

function mapManualComponent(
  component: CatalogComponentForMapper,
  sortOrder: number
): CreateBenefitInput {
  return {
    packDefinitionId: 0,
    kind: "PHYSICAL",
    includedQuantity: component.quantity,
    sortOrder,
    photographerProductId: null,
    templatePolicy: "NONE",
    templateId: null,
    extraUnitPriceOverrideArs: null,
    requiredPhotoCount: 1,
    selectionMode: "ALBUM_CHOICE",
    maxPhotosPerUnit: null,
    regularUnitPriceAfterPreventaArs: null,
  };
}

function mapMixedComponent(
  component: CatalogComponentForMapper,
  sortOrder: number
): CreateBenefitInput[] {
  return [
    {
      ...mapDigitalComponent({ ...component, quantity: 1, name: `${component.name} (digital)` }, sortOrder),
    },
    {
      ...mapPrintComponent(
        { ...component, quantity: 1, name: `${component.name} (impreso)` },
        sortOrder + 1
      ),
    },
  ];
}

/**
 * Mapea un componente de catálogo a uno o más BenefitDefinition inputs.
 * `packDefinitionId` se completa al persistir.
 */
export function mapCatalogComponentToBenefitInputs(
  component: CatalogComponentForMapper,
  sortOrder: number
): CreateBenefitInput[] {
  const deliveryType = component.deliveryType;
  const requiresDesign =
    component.requiresDesign === true || deliveryType === "DISEÑO";

  if (requiresDesign) {
    return [mapDesignComponent(component, sortOrder)];
  }

  switch (deliveryType) {
    case "DIGITAL":
      return [mapDigitalComponent(component, sortOrder)];
    case "IMPRESO":
      return [mapPrintComponent(component, sortOrder)];
    case "MANUAL":
      return [mapManualComponent(component, sortOrder)];
    case "MIXTO":
      return mapMixedComponent(component, sortOrder);
    default:
      throw new CatalogToPreventaMapperError(
        `Tipo de entrega no soportado: ${String(deliveryType)}`
      );
  }
}

export function mapCatalogProductToBenefitInputs(
  components: CatalogComponentForMapper[]
): CreateBenefitInput[] {
  if (components.length === 0) {
    throw new CatalogToPreventaMapperError(
      "El producto del catálogo no tiene componentes para mapear."
    );
  }

  const sorted = [...components].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const out: CreateBenefitInput[] = [];
  let sortOrder = 0;

  for (const component of sorted) {
    const mapped = mapCatalogComponentToBenefitInputs(component, sortOrder);
    for (const row of mapped) {
      out.push({ ...row, sortOrder });
      sortOrder += 1;
    }
  }

  if (out.length === 0) {
    throw new CatalogToPreventaMapperError("No se generaron beneficios desde el catálogo.");
  }

  return out;
}
