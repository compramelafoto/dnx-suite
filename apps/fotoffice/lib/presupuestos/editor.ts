/**
 * Editor de presupuestos: los datos que la página le pasa al navegador y las cuentas del editor.
 * Módulo PURO (lo importan la página y el componente del navegador).
 *
 * Regla de costos (R4): los costos del catálogo, la instantánea del cálculo y el perfil de
 * ¿Cuánto Cobro? viajan SÓLO dentro de `internos`, y `armarDatosEditor` sólo lo arma con
 * `veCostos`. Sin permiso la clave ni existe: el navegador no recibe nada que mostrar ni que
 * esconder.
 */
import { itemSinDatosInternos, type Descuento, type ItemPresupuesto } from "./constantes";
import { costosDeVersion, type CostoDeCatalogo, type CostosVersion } from "./costos";
import type { OpcionesPagoEditor } from "./opciones-pago";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import type { TotalesPresupuesto } from "./totales";

/** Un producto del catálogo, como lo ofrece el buscador del editor (sin costos). */
export type ProductoParaEditor = {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Pesos. */
  precio: number;
  enLista: boolean;
  esCombo: boolean;
  /** Combo: suma de los componentes y lo que se ahorra (pesos); null si no es combo. */
  sumaComponentes: number | null;
  ahorro: number | null;
};

/** Lo interno, sólo para quien tiene `configurar`. */
export type InternosEditor = {
  /** Costos de cada producto ofrecido (clave = id del producto). */
  costosCatalogo: Record<string, CostoDeCatalogo>;
  /** Perfil de ¿Cuánto Cobro? del workspace (Configuración → Precios), o null si todavía no lo cargaron. */
  perfil: CuantoCobroProfileInput | null;
};

export type DatosEditor = {
  presupuestoId: string;
  versionNumero: number;
  items: ItemPresupuesto[];
  descuento: Descuento | null;
  condiciones: string | null;
  propuestaPago: string | null;
  catalogo: ProductoParaEditor[];
  /** Opciones de pago editables (etapa 3), con lo necesario para la vista previa. */
  opcionesPago?: OpcionesPagoEditor;
  /** Sólo con `veCostos`; si no, la clave no está. */
  internos?: InternosEditor;
};

type BorradorParaEditor = {
  id: string;
  number: number;
  items: readonly ItemPresupuesto[];
  totals: { descuento?: Descuento | null } | null;
  terms: string | null;
  paymentProposal: string | null;
};

/**
 * Lo que la página pasa al editor. Sin `veCostos`, los ítems salen sin la instantánea del cálculo
 * (aunque la lectura ya los haya limpiado, se limpian otra vez acá) y no hay `internos`.
 */
export function armarDatosEditor(args: {
  presupuestoId: string;
  borrador: BorradorParaEditor;
  catalogo: ProductoParaEditor[];
  veCostos: boolean;
  costosCatalogo?: Record<string, CostoDeCatalogo>;
  perfil?: CuantoCobroProfileInput | null;
  opcionesPago?: OpcionesPagoEditor;
}): DatosEditor {
  const { borrador, veCostos } = args;
  const items: ItemPresupuesto[] = veCostos
    ? borrador.items.map((i) => ({ ...i }))
    : borrador.items.map((i) => ({ ...itemSinDatosInternos(i), productId: i.productId ?? null, calculo: null }));
  const datos: DatosEditor = {
    presupuestoId: args.presupuestoId,
    versionNumero: borrador.number,
    items,
    descuento: borrador.totals?.descuento ?? null,
    condiciones: borrador.terms,
    propuestaPago: borrador.paymentProposal,
    catalogo: args.catalogo.map((p) => ({ ...p })),
  };
  if (args.opcionesPago) datos.opcionesPago = args.opcionesPago;
  if (veCostos) datos.internos = { costosCatalogo: args.costosCatalogo ?? {}, perfil: args.perfil ?? null };
  return datos;
}

// --- Ítems ----------------------------------------------------------------------------------------

export function itemDesdeProducto(p: ProductoParaEditor, clave: string, seccion: string | null = null): ItemPresupuesto {
  return {
    id: clave,
    productId: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    cantidad: 1,
    precioUnitario: p.precio,
    descuento: null,
    modoPrecio: "LISTA",
    calculo: null,
    seccion,
    opcional: false,
  };
}

export function itemLibre(clave: string, seccion: string | null = null): ItemPresupuesto {
  return {
    id: clave,
    productId: null,
    nombre: "",
    descripcion: null,
    cantidad: 1,
    precioUnitario: 0,
    descuento: null,
    modoPrecio: "LISTA",
    calculo: null,
    seccion,
    opcional: false,
  };
}

/** Busca en el catálogo por nombre o descripción, sin tildes ni mayúsculas. */
export function buscarEnCatalogo(catalogo: readonly ProductoParaEditor[], texto: string, tope = 20): ProductoParaEditor[] {
  const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = normal(texto.trim());
  const lista = q ? catalogo.filter((p) => normal(`${p.nombre} ${p.descripcion ?? ""}`).includes(q)) : catalogo;
  return [...lista].sort((a, b) => Number(b.enLista) - Number(a.enLista) || a.nombre.localeCompare(b.nombre, "es")).slice(0, tope);
}

/**
 * Lo que el editor manda a `guardarBorradorAction`. De un ítem de ¿Cuánto Cobro? sólo viaja la
 * entrada del motor (el servidor recalcula todo lo demás, R2) y la marca `precioAjustado`: true si
 * la persona tocó el precio del renglón (manda su precio), false si sigue al motor. Todo eso sólo
 * si quien guarda ve el cálculo; sin permiso viaja sin cálculo y el servidor usa la entrada
 * guardada y compara el precio con el sugerido guardado (`recalcularItemCalculo`).
 */
export function itemsParaGuardar(items: readonly ItemPresupuesto[], conCalculo: boolean, ajustados: ReadonlySet<string> = new Set()): unknown[] {
  return items.map((i) => ({
    ...i,
    calculo: conCalculo && i.modoPrecio === "CALCULO" && i.calculo ? { entrada: i.calculo.entrada, precioAjustado: ajustados.has(i.id) } : null,
  }));
}

/** Los ítems calculados cuyo precio ya estaba ajustado a mano (el elegido no es el sugerido). */
export function ajustadosIniciales(items: readonly ItemPresupuesto[]): Set<string> {
  return new Set(
    items
      .filter((i) => i.modoPrecio === "CALCULO" && i.calculo && Math.abs(i.calculo.precioElegido - i.calculo.precioSugerido) >= 0.005)
      .map((i) => i.id),
  );
}

/** Costo y margen en vivo (sólo con `internos`). */
export function costosEnVivo(items: readonly ItemPresupuesto[], totales: TotalesPresupuesto, internos: InternosEditor): CostosVersion {
  return costosDeVersion(items, totales, new Map(Object.entries(internos.costosCatalogo)));
}

/** "$ 1.234.567" (es-AR, sin decimales). */
export function pesos(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Math.round(n));
}

let contador = 0;
/** Clave de renglón nueva (no es un id de la base). */
export function nuevaClave(): string {
  contador += 1;
  return `r${Date.now().toString(36)}${contador.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
