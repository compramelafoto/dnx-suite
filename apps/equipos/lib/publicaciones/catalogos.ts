import type { prisma } from "@repo/db";

/** Tipos derivados del cliente, igual que en `lib/inventario/tipos.ts`. */
export type GearListing = NonNullable<Awaited<ReturnType<typeof prisma.gearListing.findFirst>>>;
export type GearListingCondition = GearListing["condition"];
export type GearListingUsageSeal = GearListing["usageSeal"];

export const PROVINCIAS: string[] = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Ciudad Autónoma de Buenos Aires",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

export const MONTURAS: string[] = [
  "Canon EF",
  "Canon RF",
  "Nikon F",
  "Nikon Z",
  "Sony E",
  "Fujifilm X",
  "Fujifilm GFX",
  "Micro 4/3",
  "L-Mount",
  "Pentax K",
  "Otra",
];

export const CONDITION_LABELS: Record<GearListingCondition, string> = {
  NEW: "Nuevo",
  LIKE_NEW: "Como nuevo",
  VERY_GOOD: "Muy bueno",
  GOOD: "Bueno",
  WITH_DETAILS: "Con detalles",
};
