import { EquipoError } from "../inventario/equipos";
import type { GearItemKind, GearItemStatus } from "../inventario/tipos";
import { MONTURAS, PROVINCIAS, type GearListingCondition } from "./catalogos";

export type ListingInput = {
  priceArs: number;
  priceUsdRef?: number | null;
  condition: GearListingCondition;
  description?: string;
  accessories?: string;
  province: string;
  city: string;
  mount?: string | null;
  socialConsent: boolean;
  declaredFirstOwner?: boolean;
  includesCharger?: boolean;
  includesManual?: boolean;
  includesBox?: boolean;
  batteriesCount?: number | null;
};

const invalido = (msg: string) => new EquipoError("DATO_INVALIDO", msg);

export function validateListingInput(input: ListingInput, _kind: GearItemKind): ListingInput {
  if (!Number.isInteger(input.priceArs) || input.priceArs < 1) {
    throw invalido("El precio tiene que ser un número entero de pesos, mayor a cero.");
  }
  if (
    input.priceUsdRef != null &&
    (!Number.isInteger(input.priceUsdRef) || input.priceUsdRef < 0)
  ) {
    throw invalido("El valor de referencia en dólares tiene que ser un número entero.");
  }
  if (!PROVINCIAS.includes(input.province)) {
    throw invalido("Elegí una provincia de la lista.");
  }
  const city = (input.city ?? "").trim();
  if (!city) throw invalido("Indicá la ciudad.");
  const mount = input.mount ?? null;
  if (mount !== null && !MONTURAS.includes(mount)) {
    throw invalido("Elegí una montura de la lista.");
  }
  if (!input.socialConsent) {
    throw invalido(
      "Para publicar tenés que aceptar que el artículo pueda salir en las redes del portal.",
    );
  }
  const description = (input.description ?? "").trim();
  const accessories = (input.accessories ?? "").trim();
  if (description.length > 2000) throw invalido("La descripción no puede superar los 2000 caracteres.");
  if (accessories.length > 500) throw invalido("Los accesorios no pueden superar los 500 caracteres.");
  if (
    input.batteriesCount != null &&
    (!Number.isInteger(input.batteriesCount) || input.batteriesCount < 0 || input.batteriesCount > 10)
  ) {
    throw invalido("La cantidad de baterías tiene que ser un número entero de 0 a 10.");
  }
  return { ...input, city, description, accessories };
}

export function requiresSerial(kind: GearItemKind): boolean {
  return kind === "BODY" || kind === "LENS";
}

const NO_PUBLICABLE = "Este equipo no se puede publicar en su estado actual.";

export function listingBlocker(
  item: {
    status: GearItemStatus;
    kind: GearItemKind;
    serialNormalized: string | null;
    photoKeys: string[];
  },
  ctx: {
    ownReportOpen: boolean;
    activeListing: boolean;
    serialPhotoKey: string | null;
    /** Vista privada sin almacenamiento: las fotos no se exigen. */
    fotosOpcionales?: boolean;
  },
): string | null {
  if (item.status === "STOLEN" || item.status === "LOST" || item.status === "SOLD") {
    return NO_PUBLICABLE;
  }
  if (ctx.ownReportOpen) return NO_PUBLICABLE;
  if (ctx.activeListing) return "Este equipo ya tiene una publicación.";
  if (item.photoKeys.length === 0 && !ctx.fotosOpcionales) return "Subí al menos una foto del equipo.";
  if (requiresSerial(item.kind)) {
    if (!item.serialNormalized) return "Para cámaras y lentes el número de serie es obligatorio.";
    if (!ctx.serialPhotoKey && !ctx.fotosOpcionales) return "Subí una foto del número de serie grabado en el equipo.";
  }
  return null;
}

export function maskSerial(serialNormalized: string | null): string | null {
  if (!serialNormalized) return null;
  // Nunca la serie completa: con 4 caracteres o menos sólo se ven los últimos 2.
  const visibles = serialNormalized.length <= 4 ? 2 : 4;
  return "••••" + serialNormalized.slice(-visibles);
}
