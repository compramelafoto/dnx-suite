import type { CatalogDeliveryType, CatalogProductType } from "@/lib/prisma";
import type { CatalogDigitalQuantityMode } from "@/lib/catalog-products/digital-quantity-mode";

export type SystemCatalogTemplateComponentSeed = {
  name: string;
  quantity: number;
  deliveryType: CatalogDeliveryType;
  sortOrder: number;
  notes?: string;
  digitalQuantityMode?: CatalogDigitalQuantityMode;
};

export type SystemCatalogTemplateSeed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  productType: CatalogProductType;
  suggestedPriceCents: number;
  tags: string[];
  isRecommended: boolean;
  sortOrder: number;
  components: SystemCatalogTemplateComponentSeed[];
};

/** Plantillas iniciales del sistema (idempotentes por slug). */
export const SYSTEM_CATALOG_TEMPLATE_SEEDS: SystemCatalogTemplateSeed[] = [
  {
    slug: "pack-fotos-digitales",
    name: "Pack de Fotos Digitales",
    description: "Varias fotos digitales con precio preferencial por volumen.",
    category: "Digital",
    productType: "PACK",
    suggestedPriceCents: 15_000,
    tags: ["digital", "evento"],
    isRecommended: true,
    sortOrder: 10,
    components: [{ name: "Foto digital", quantity: 10, deliveryType: "DIGITAL", sortOrder: 0 }],
  },
  {
    slug: "todas-las-fotos-evento",
    name: "Todas las Fotos del Evento",
    description: "Descarga completa de todas las fotos del evento.",
    category: "Digital",
    productType: "PACK",
    suggestedPriceCents: 25_000,
    tags: ["digital", "evento"],
    isRecommended: true,
    sortOrder: 20,
    components: [
      {
        name: "Todas las fotos del evento",
        quantity: 1,
        deliveryType: "DIGITAL",
        sortOrder: 0,
        digitalQuantityMode: "ALL_EVENT_PHOTOS",
        notes: "Acceso a la galería completa",
      },
    ],
  },
  {
    slug: "carpeta-escolar-basica",
    name: "Carpeta escolar básica",
    description: "Carpeta institucional con fotos individuales y de grupo.",
    category: "Escolar",
    productType: "PACK",
    suggestedPriceCents: 35_000,
    tags: ["escolar", "carpeta"],
    isRecommended: true,
    sortOrder: 30,
    components: [
      { name: "Foto individual", quantity: 2, deliveryType: "DIGITAL", sortOrder: 0 },
      { name: "Foto grupal", quantity: 1, deliveryType: "DIGITAL", sortOrder: 1 },
      { name: "Carpeta impresa", quantity: 1, deliveryType: "IMPRESO", sortOrder: 2 },
    ],
  },
  {
    slug: "carpeta-escolar-premium",
    name: "Carpeta escolar premium",
    description: "Carpeta premium con diseño personalizado y más fotos.",
    category: "Escolar",
    productType: "COMBO",
    suggestedPriceCents: 55_000,
    tags: ["escolar", "carpeta", "premium"],
    isRecommended: true,
    sortOrder: 40,
    components: [
      { name: "Foto individual", quantity: 3, deliveryType: "DIGITAL", sortOrder: 0 },
      { name: "Foto grupal", quantity: 2, deliveryType: "DIGITAL", sortOrder: 1 },
      { name: "Carpeta con diseño", quantity: 1, deliveryType: "DISEÑO", sortOrder: 2 },
      { name: "Carpeta impresa", quantity: 1, deliveryType: "IMPRESO", sortOrder: 3 },
    ],
  },
  {
    slug: "pack-impresiones",
    name: "Pack de Impresiones",
    description: "Varias impresiones del mismo tamaño con precio pack.",
    category: "Impresión",
    productType: "PACK",
    suggestedPriceCents: 12_000,
    tags: ["impresion"],
    isRecommended: true,
    sortOrder: 50,
    components: [{ name: "Impresión 15×21", quantity: 5, deliveryType: "IMPRESO", sortOrder: 0 }],
  },
  {
    slug: "combo-digital-impresiones",
    name: "Combo Digital + Impresiones",
    description: "Fotos digitales más impresiones en una sola oferta.",
    category: "Combo",
    productType: "COMBO",
    suggestedPriceCents: 20_000,
    tags: ["digital", "impresion", "combo"],
    isRecommended: true,
    sortOrder: 60,
    components: [
      { name: "Foto digital", quantity: 5, deliveryType: "DIGITAL", sortOrder: 0 },
      { name: "Impresión 15×21", quantity: 2, deliveryType: "IMPRESO", sortOrder: 1 },
    ],
  },
  {
    slug: "combo-llavero-foto-digital",
    name: "Combo Llavero con Foto + Foto Digital",
    description: "Llavero personalizado más descarga digital.",
    category: "Combo",
    productType: "COMBO",
    suggestedPriceCents: 18_000,
    tags: ["combo", "llavero"],
    isRecommended: true,
    sortOrder: 70,
    components: [
      { name: "Llavero con foto", quantity: 1, deliveryType: "IMPRESO", sortOrder: 0 },
      { name: "Foto digital", quantity: 1, deliveryType: "DIGITAL", sortOrder: 1 },
    ],
  },
  {
    slug: "combo-sticker-foto-digital",
    name: "Combo Sticker con Foto + Foto Digital",
    description: "Sticker personalizado más descarga digital.",
    category: "Combo",
    productType: "COMBO",
    suggestedPriceCents: 15_000,
    tags: ["combo", "sticker"],
    isRecommended: true,
    sortOrder: 80,
    components: [
      { name: "Sticker con foto", quantity: 1, deliveryType: "IMPRESO", sortOrder: 0 },
      { name: "Foto digital", quantity: 1, deliveryType: "DIGITAL", sortOrder: 1 },
    ],
  },
  {
    slug: "stickers-foto-archivo-digital",
    name: "Stickers con foto + archivo digital",
    description: "Pack de stickers personalizados con archivo digital incluido.",
    category: "Combo",
    productType: "COMBO",
    suggestedPriceCents: 16_000,
    tags: ["combo", "sticker", "digital"],
    isRecommended: true,
    sortOrder: 90,
    components: [
      { name: "Sticker con foto", quantity: 3, deliveryType: "IMPRESO", sortOrder: 0 },
      { name: "Archivo digital", quantity: 1, deliveryType: "DIGITAL", sortOrder: 1 },
    ],
  },
  {
    slug: "cuadro-impreso-mdf",
    name: "Cuadro impreso sobre MDF",
    description: "Cuadro impreso sobre MDF listo para colgar.",
    category: "Impresión",
    productType: "SIMPLE",
    suggestedPriceCents: 45_000,
    tags: ["impresion", "cuadro"],
    isRecommended: true,
    sortOrder: 100,
    components: [{ name: "Cuadro MDF", quantity: 1, deliveryType: "IMPRESO", sortOrder: 0 }],
  },
  {
    slug: "diploma-graduacion-personalizado",
    name: "Diploma de graduación personalizado",
    description: "Diploma personalizado con datos del alumno.",
    category: "Escolar",
    productType: "SIMPLE",
    suggestedPriceCents: 8_000,
    tags: ["escolar", "diploma"],
    isRecommended: true,
    sortOrder: 110,
    components: [
      { name: "Diploma personalizado", quantity: 1, deliveryType: "DISEÑO", sortOrder: 0 },
    ],
  },
];
