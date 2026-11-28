/**
 * Compra directa en un álbum con fotos ocultas hasta la selfie: la familia elige primero qué
 * quiere llevar (copias digitales, impresas, el librito) y después llena un casillero por foto,
 * como en el canje del pack. Funciones puras: se prueban sin pantalla ni base.
 *
 * Por qué así: antes se elegían fotos y recién después el producto de cada una, y el librito de
 * 2 fotos se compraba como una impresa sobre una sola foto, sin plantilla ni diseño.
 *
 * El librito se cobra como un ítem impreso de su producto sobre la foto de tapa (el precio no
 * cambia) y viaja con `productDesigns`: las fotos de cada casillero y sus encuadres. Con eso,
 * al aprobarse el pago, se arma el diseño (`ensureProductDesignsForPaidOrder`).
 */

import { normalizePhotoCrop } from "@repo/template-editor-core";
import { albumPhotoFileKey } from "@/lib/album-photo-ref";
import type {
  CanjeCrop,
  CanjePhotoInput,
  CanjeSlotPlan,
} from "@/lib/preventa-canjeable/preventa-canje-slots";

/** Clave del producto en la pantalla: la digital del álbum o un producto del fotógrafo. */
export type ProductoKey = string;

export const DIGITAL_KEY: ProductoKey = "digital";

export function claveDeProducto(productId: number): ProductoKey {
  return `p${productId}`;
}

export type ProductoDeCompra = {
  key: ProductoKey;
  kind: "DIGITAL" | "PHYSICAL";
  /** Producto del fotógrafo (impresas y librito). `null` en la copia digital. */
  productId: number | null;
  name: string;
  size: string | null;
  finish: string | null;
  /** Precio final a la familia, por unidad (con la comisión incluida). */
  unitPriceArs: number | null;
  /** Fotos por unidad: 1 en las copias, las que pida la plantilla en el librito. */
  photosPerUnit: number;
  /** Plantilla del diseño (el librito). `null` en las copias sueltas. */
  templateId: string | null;
  /** Qué foto pide cada lugar del diseño ("Tapa", "Contratapa"), en el orden del armado. */
  photoInputs?: CanjePhotoInput[] | null;
};

export type Cantidades = Record<ProductoKey, number>;

/** Hasta cuántas unidades de un producto en una compra. */
export const MAX_UNIDADES = 10;

export function cantidadValida(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(MAX_UNIDADES, v);
}

/** La elección en la URL (`?q=digital.2,p585.1`) para que sobreviva la recarga de la selfie. */
export function cantidadesAQuery(c: Cantidades): string {
  return Object.entries(c)
    .filter(([, n]) => cantidadValida(n) > 0)
    .map(([k, n]) => `${k}.${cantidadValida(n)}`)
    .join(",");
}

export function cantidadesDeQuery(raw: string | null | undefined, productos: ProductoDeCompra[]): Cantidades {
  const validas = new Set(productos.map((p) => p.key));
  const out: Cantidades = {};
  for (const parte of (raw ?? "").split(",")) {
    const [k, n] = parte.split(".");
    if (!k || !validas.has(k)) continue;
    const v = cantidadValida(n);
    if (v > 0) out[k] = v;
  }
  return out;
}

export function hayAlgoElegido(c: Cantidades): boolean {
  return Object.values(c).some((n) => cantidadValida(n) > 0);
}

/** Total de la elección con los precios de lista (el resumen lo confirma con el servidor). */
export function totalEstimado(productos: ProductoDeCompra[], c: Cantidades): number | null {
  let total = 0;
  for (const p of productos) {
    const n = cantidadValida(c[p.key]);
    if (n === 0) continue;
    if (p.unitPriceArs == null) return null;
    total += n * p.unitPriceArs;
  }
  return total;
}

/**
 * Los "beneficios" que arman los casilleros: el mismo plan que el canje del pack
 * (`buildCanjeSlotPlan`), con las cantidades que eligió la familia. Primero el librito, después
 * las impresas y al final las digitales.
 */
export function beneficiosDeLaCompra(productos: ProductoDeCompra[], c: Cantidades) {
  const orden = (p: ProductoDeCompra) => (p.templateId ? 0 : p.kind === "PHYSICAL" ? 1 : 2);
  return [...productos]
    .filter((p) => cantidadValida(c[p.key]) > 0)
    .sort((a, b) => orden(a) - orden(b))
    .map((p, i) => ({
      stableKey: p.key,
      kind: p.kind,
      selectionMode: p.photosPerUnit > 1 ? ("MULTI_PHOTO_FIXED" as const) : ("SINGLE_PHOTO" as const),
      includedQuantity: cantidadValida(c[p.key]),
      requiredPhotoCount: Math.max(1, p.photosPerUnit),
      sortOrder: i,
      name: p.name,
      photoInputs: p.photoInputs ?? null,
    }));
}

/** Lo que espera `POST /api/a/[id]/orders` en `items`. */
export type ItemDelPedido = {
  fileKey: string;
  tipo: "digital" | "impresa";
  size: string;
  finish: string | null;
  quantity: number;
  productId: number | null;
  productName: string | null;
};

/** Un librito del pedido: sus fotos en el orden de los lugares del diseño y sus encuadres. */
export type ProductDesignRequestV1 = {
  productId: number;
  photoIds: number[];
  crops?: Array<CanjeCrop | null>;
};

export type AlumnoDelLibrito = { nombre: string; apellido: string; curso: string };

/**
 * Los ítems del pedido y los libritos a armar, a partir de los casilleros llenos. Cada foto de
 * una copia es un ítem; cada librito, un ítem impreso sobre su primera foto (la tapa) y un pedido
 * de diseño con todas sus fotos.
 */
export function pedidoDeLaCompra(
  productos: ProductoDeCompra[],
  plan: CanjeSlotPlan,
  filled: Array<number | null>,
  crops?: Readonly<Record<number, CanjeCrop>>
): { items: ItemDelPedido[]; productDesigns: ProductDesignRequestV1[] } {
  const porKey = new Map(productos.map((p) => [p.key, p]));
  const items: ItemDelPedido[] = [];
  const productDesigns: ProductDesignRequestV1[] = [];
  for (const g of plan.groups) {
    const p = porKey.get(g.benefitKey);
    if (!p) continue;
    if (p.templateId && p.productId != null) {
      for (let u = 0; u < g.units; u++) {
        const lugares = g.slotIndexes.slice(u * g.photosPerUnit, (u + 1) * g.photosPerUnit);
        const fotos = lugares.map((i) => filled[i]);
        if (fotos.some((f) => f == null)) continue;
        const photoIds = fotos as number[];
        const encuadres = lugares.map((i) => crops?.[i] ?? null);
        items.push({
          fileKey: albumPhotoFileKey(photoIds[0]!),
          tipo: "impresa",
          size: p.size ?? "",
          finish: p.finish,
          quantity: 1,
          productId: p.productId,
          productName: p.name,
        });
        productDesigns.push(
          encuadres.some(Boolean)
            ? { productId: p.productId, photoIds, crops: encuadres }
            : { productId: p.productId, photoIds }
        );
      }
      continue;
    }
    for (const i of g.slotIndexes) {
      const id = filled[i];
      if (id == null) continue;
      items.push(
        p.kind === "DIGITAL"
          ? {
              fileKey: albumPhotoFileKey(id),
              tipo: "digital",
              size: "DIGITAL",
              finish: null,
              quantity: 1,
              productId: null,
              productName: null,
            }
          : {
              fileKey: albumPhotoFileKey(id),
              tipo: "impresa",
              size: p.size ?? "",
              finish: p.finish,
              quantity: 1,
              productId: p.productId,
              productName: p.name,
            }
      );
    }
  }
  return { items, productDesigns };
}

// ---------------------------------------------------------------------------------------------
// Servidor: validar y guardar los libritos del pedido
// ---------------------------------------------------------------------------------------------

export const PRODUCT_DESIGNS_SNAPSHOT_KEY = "productDesignsV1";

/** Lo que queda guardado en el pedido: alcanza para armar el diseño al aprobarse el pago. */
export type ProductDesignSnapshotV1 = {
  productId: number;
  templateId: string;
  photoIds: number[];
  crops: Array<CanjeCrop | null>;
  alumno: AlumnoDelLibrito | null;
};

/** Plantilla de cada producto con diseño del álbum y cuántas fotos pide. */
export type PlantillaDeProducto = { templateId: string; photoCount: number };

function entero(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function encuadre(raw: unknown): CanjeCrop | null {
  if (!raw || typeof raw !== "object") return null;
  return normalizePhotoCrop(raw);
}

function texto(v: unknown, max = 80): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function leerAlumno(raw: unknown): AlumnoDelLibrito | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const alumno = { nombre: texto(r.nombre), apellido: texto(r.apellido), curso: texto(r.curso) };
  return alumno.nombre || alumno.apellido ? alumno : null;
}

export type ValidacionDeDisenos =
  | { ok: true; designs: ProductDesignSnapshotV1[] }
  | { ok: false; error: string };

/**
 * Revisa en el servidor los libritos que manda la familia: que el producto tenga plantilla, que
 * cada librito traiga una foto distinta del álbum por lugar, y que haya un ítem impreso del
 * producto por librito, sobre su foto de tapa. No hay pack ni snapshot que comparar: lo que se
 * cobra son los ítems; esto sólo dice con qué fotos se arma cada uno.
 */
export function validarDisenosDelPedido(input: {
  raw: unknown;
  alumno: unknown;
  items: Array<{ photoId: number; productId: number | null; quantity: number; tipo: "digital" | "impresa" }>;
  albumPhotoIds: ReadonlySet<number>;
  plantillas: ReadonlyMap<number, PlantillaDeProducto>;
}): ValidacionDeDisenos {
  if (input.raw == null) return { ok: true, designs: [] };
  if (!Array.isArray(input.raw)) return { ok: false, error: "Los libritos del pedido vinieron mal armados." };
  if (input.raw.length > 20) return { ok: false, error: "Demasiados libritos en un mismo pedido." };
  const alumno = leerAlumno(input.alumno);
  const designs: ProductDesignSnapshotV1[] = [];
  for (const d of input.raw as unknown[]) {
    const r = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    const productId = entero(r.productId);
    const plantilla = productId != null ? input.plantillas.get(productId) : undefined;
    if (productId == null || !plantilla) {
      return { ok: false, error: "Ese producto no tiene diseño en este álbum." };
    }
    const photoIds = Array.isArray(r.photoIds) ? r.photoIds.map(entero) : [];
    if (photoIds.length !== plantilla.photoCount || photoIds.some((x) => x == null)) {
      return { ok: false, error: `Cada librito lleva ${plantilla.photoCount} fotos.` };
    }
    const ids = photoIds as number[];
    if (new Set(ids).size !== ids.length) {
      return { ok: false, error: "Un librito no puede llevar la misma foto dos veces." };
    }
    if (ids.some((id) => !input.albumPhotoIds.has(id))) {
      return { ok: false, error: "Una de las fotos del librito no es de este álbum." };
    }
    const rawCrops = Array.isArray(r.crops) ? r.crops : [];
    designs.push({
      productId,
      templateId: plantilla.templateId,
      photoIds: ids,
      crops: ids.map((_, i) => encuadre(rawCrops[i])),
      alumno,
    });
  }
  if (designs.length > 0 && !alumno) {
    return { ok: false, error: "Escribí el nombre del alumno para el librito." };
  }

  // Un ítem impreso del producto por librito, sobre la foto de tapa: así lo que se cobra y lo que
  // se arma coinciden (un librito sin pagar no se arma, y uno pagado no queda sin fotos).
  const productos = new Set(designs.map((d) => d.productId));
  for (const productId of productos) {
    const tapas = designs.filter((d) => d.productId === productId).map((d) => d.photoIds[0]!).sort((a, b) => a - b);
    const cobradas = input.items
      .filter((it) => it.tipo === "impresa" && it.productId === productId)
      .flatMap((it) => Array.from({ length: Math.max(0, Math.floor(it.quantity)) }, () => it.photoId))
      .sort((a, b) => a - b);
    if (tapas.length !== cobradas.length || tapas.some((t, i) => t !== cobradas[i])) {
      return { ok: false, error: "Los libritos no coinciden con lo que se cobra. Volvé a armar el pedido." };
    }
  }
  return { ok: true, designs };
}

export function readProductDesignsFromSnapshot(snapshot: unknown): ProductDesignSnapshotV1[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const raw = (snapshot as Record<string, unknown>)[PRODUCT_DESIGNS_SNAPSHOT_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d) => {
    const r = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    const productId = entero(r.productId);
    const templateId = typeof r.templateId === "string" && r.templateId ? r.templateId : null;
    const photoIds = Array.isArray(r.photoIds) ? r.photoIds.map(entero).filter((x): x is number => x != null) : [];
    if (productId == null || !templateId || photoIds.length === 0) return [];
    const rawCrops = Array.isArray(r.crops) ? r.crops : [];
    return [{ productId, templateId, photoIds, crops: photoIds.map((_, i) => encuadre(rawCrops[i])), alumno: leerAlumno(r.alumno) }];
  });
}

/**
 * Nombre como lo espera el armado de textos del librito («Apellido, Nombre»): con la coma no hay
 * que adivinar dónde termina el apellido.
 */
export function nombreParaElPadron(alumno: AlumnoDelLibrito): string {
  return [alumno.apellido, alumno.nombre].filter(Boolean).join(", ");
}
