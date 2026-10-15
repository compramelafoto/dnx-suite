/**
 * Lo que ve el cliente en el enlace público de un presupuesto (spec etapa 2 §3.3). Módulo PURO.
 *
 * `armarVistaPublica` copia campo por campo SÓLO lo que se puede mostrar: nombre, descripción,
 * cantidad, precio, descuento, neto, sección y si es opcional. Nunca la instantánea del cálculo,
 * el modo de precio, el producto del catálogo, ni `costSnapshot` (que ni se lee de la base). De
 * las opciones de pago, sólo nombre, cuotas, importe por cuota, total y nota (`opcionesPublicas`). Así,
 * aunque mañana se sumen campos internos al ítem, no llegan solos a la página.
 */
import type { Descuento, ItemPresupuesto } from "./constantes";
import { opcionesPublicas, type OpcionPublica } from "./opciones-pago";
import type { TotalesGuardados } from "./versiones";

/** El estado del enlace. REEMPLAZADO nunca llega a la vista: la página redirige a la vigente. */
export type EstadoDelEnlace = "ACTIVO" | "VENCIDO" | "ACEPTADO" | "RECHAZADO" | "REEMPLAZADO";
export type EstadoDeLaVista = Exclude<EstadoDelEnlace, "REEMPLAZADO">;

export type ItemDeLaVista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: Descuento | null;
  neto: number;
  seccion: string | null;
  opcional: boolean;
};

export type VistaPublica = {
  estado: EstadoDeLaVista;
  organizacion: { nombre: string; logoUrl: string | null; whatsappUrl: string | null; email: string | null };
  numero: string | null;
  version: number;
  items: ItemDeLaVista[];
  totales: { subtotal: number; descuentos: number; total: number; opcionales: number; cantidadOpcionales: number };
  /** Último día de validez, "dd/mm/aaaa". */
  vence: string | null;
  condiciones: string | null;
  propuestaPago: string | null;
  /** Opciones de pago congeladas en la versión (vacío si se envió antes de tenerlas). */
  opcionesPago: OpcionPublica[];
  /** Sólo si ESTA versión se aceptó. `opcion`: la forma de pago elegida, o null. */
  aceptacion: { fecha: string; nombre: string; opcion: string | null } | null;
};

const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const fechaHoraBA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "aaaa-mm-dd" de una columna DATE → "dd/mm/aaaa". */
function ddmmaaaa(fecha: Date | null): string | null {
  return fecha ? fecha.toISOString().slice(0, 10).split("-").reverse().join("/") : null;
}

export function armarVistaPublica(args: {
  estado: EstadoDeLaVista;
  organizacion: VistaPublica["organizacion"];
  numero: string | null;
  version: {
    number: number;
    items: readonly ItemPresupuesto[];
    totals: TotalesGuardados | null;
    terms: string | null;
    paymentProposal: string | null;
    paymentOptions?: unknown;
    chosenPaymentOptionId?: string | null;
    acceptedAt: Date | null;
    acceptedName: string | null;
  };
  validUntil: Date | null;
}): VistaPublica {
  const t = args.version.totals;
  const renglones = t?.renglones ?? {};
  const opcionesPago = opcionesPublicas(args.version.paymentOptions);
  const elegida = opcionesPago.find((o) => o.id === args.version.chosenPaymentOptionId)?.etiqueta ?? null;
  return {
    estado: args.estado,
    organizacion: {
      nombre: args.organizacion.nombre,
      logoUrl: args.organizacion.logoUrl,
      whatsappUrl: args.organizacion.whatsappUrl,
      email: args.organizacion.email,
    },
    numero: args.numero,
    version: args.version.number,
    items: args.version.items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      descuento: i.descuento ? { tipo: i.descuento.tipo, valor: i.descuento.valor } : null,
      neto: numero(renglones[i.id]?.neto),
      seccion: i.seccion,
      opcional: i.opcional,
    })),
    totales: {
      subtotal: numero(t?.subtotal),
      descuentos: numero(t?.descuentoItems) + numero(t?.descuentoGlobal),
      total: numero(t?.total),
      opcionales: numero(t?.opcionales?.total),
      cantidadOpcionales: numero(t?.opcionales?.cantidad),
    },
    vence: ddmmaaaa(args.validUntil),
    condiciones: args.version.terms,
    propuestaPago: args.version.paymentProposal,
    opcionesPago,
    aceptacion:
      args.estado === "ACEPTADO" && args.version.acceptedAt
        ? { fecha: fechaHoraBA.format(args.version.acceptedAt).replace(",", ""), nombre: args.version.acceptedName ?? "", opcion: elegida }
        : null,
  };
}

/**
 * Robots que abren los enlaces para armar la vista previa (WhatsApp, redes, buscadores): su
 * visita no cuenta como "visto" (si no, mandar el enlace por WhatsApp lo marcaría visto al toque).
 */
export function esRobot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /bot\b|bot\/|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|linkedin|embedly|vkshare|google-inspectiontool|headlesschrome/i.test(userAgent);
}
