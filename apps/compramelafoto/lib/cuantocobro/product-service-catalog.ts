import type { CuantoCobroQuoteItem, CuantoCobroQuoteItemType } from "@/lib/cuantocobro/types";
import { createEmptyQuoteItem, createQuoteItemId } from "@/lib/cuantocobro/quote-items";

export type ProductServiceCatalogOption = {
  id: string;
  title: string;
  description: string;
  itemType: CuantoCobroQuoteItemType;
  defaultName: string;
  defaults?: Partial<Omit<CuantoCobroQuoteItem, "id">>;
};

export const PRODUCT_SERVICE_CATALOG: readonly ProductServiceCatalogOption[] = [
  {
    id: "coverage",
    title: "Cobertura fotográfica",
    description: "Evento, boda o jornada con disparos, edición y entrega del material.",
    itemType: "own-service",
    defaultName: "Cobertura fotográfica",
  },
  {
    id: "session",
    title: "Sesión fotográfica",
    description: "Retrato, producto o sesión puntual con tiempo de cobertura y edición.",
    itemType: "own-service",
    defaultName: "Sesión fotográfica",
  },
  {
    id: "editing",
    title: "Edición / postproducción",
    description: "Selección, retoque y exportación sin cobertura en el lugar.",
    itemType: "own-service",
    defaultName: "Edición / postproducción",
  },
  {
    id: "photobook",
    title: "Fotolibro",
    description: "Diseño, revisión y producción de un álbum impreso.",
    itemType: "physical-product",
    defaultName: "Fotolibro",
    defaults: { desiredMarginPercent: "35" },
  },
  {
    id: "prints",
    title: "Impresiones",
    description: "Tirada de fotos en laboratorio con diseño y envío si aplica.",
    itemType: "physical-product",
    defaultName: "Impresiones",
    defaults: { desiredMarginPercent: "30" },
  },
  {
    id: "canvas",
    title: "Cuadro / canvas",
    description: "Ampliación o cuadro con costo de proveedor y preparación.",
    itemType: "physical-product",
    defaultName: "Cuadro / canvas",
    defaults: { desiredMarginPercent: "35" },
  },
  {
    id: "video",
    title: "Video",
    description: "Servicio audiovisual coordinado con un tercero o equipo externo.",
    itemType: "outsourced",
    defaultName: "Video",
    defaults: { desiredMarginPercent: "20" },
  },
  {
    id: "drone",
    title: "Drone",
    description: "Tomas aéreas contratadas a un operador o proveedor.",
    itemType: "outsourced",
    defaultName: "Drone",
    defaults: { desiredMarginPercent: "20" },
  },
  {
    id: "second-photographer",
    title: "Segundo fotógrafo",
    description: "Refuerzo de cobertura con costo de tercero y tu coordinación.",
    itemType: "outsourced",
    defaultName: "Segundo fotógrafo",
    defaults: { desiredMarginPercent: "15" },
  },
  {
    id: "makeup",
    title: "Maquilladora",
    description: "Servicio de maquillaje para la sesión o evento.",
    itemType: "outsourced",
    defaultName: "Maquilladora",
    defaults: { desiredMarginPercent: "15" },
  },
  {
    id: "expenses",
    title: "Viáticos / gastos",
    description: "Traslados, estacionamiento, comidas u otros gastos del trabajo.",
    itemType: "expense",
    defaultName: "Viáticos / gastos",
  },
  {
    id: "other",
    title: "Otro producto o servicio",
    description: "Línea personalizada: definís nombre, tipo y costos a mano.",
    itemType: "own-service",
    defaultName: "",
  },
] as const;

export function getProductServiceCatalogOption(catalogId: string): ProductServiceCatalogOption | undefined {
  return PRODUCT_SERVICE_CATALOG.find((option) => option.id === catalogId);
}

export function createQuoteItemFromCatalogOption(catalogId: string): CuantoCobroQuoteItem {
  const option = getProductServiceCatalogOption(catalogId);
  if (!option) {
    return createEmptyQuoteItem({ id: createQuoteItemId() });
  }

  return createEmptyQuoteItem({
    id: createQuoteItemId(),
    name: option.defaultName,
    description: option.description,
    itemType: option.itemType,
    quantity: "1",
    ...option.defaults,
  });
}

export const PRODUCT_SERVICE_FALLBACK_LABEL = "Producto o servicio";

export function formatProductServiceListLabel(index: number, name: string): string {
  const trimmed = name.trim();
  return trimmed || `${PRODUCT_SERVICE_FALLBACK_LABEL} ${index + 1}`;
}
