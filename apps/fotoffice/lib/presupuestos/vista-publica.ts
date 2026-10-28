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
import { condicionesDeInstantanea } from "@/lib/pedidos/opciones-pago";
import { opcionesPublicas, type OpcionPublica } from "./opciones-pago";
import type { TotalesGuardados } from "./versiones";
import type { FichaDeLaVista } from "./ficha-publica";
import { alternativaElegidaId, alternativasGuardadas, alternativaPrincipal, itemsDeAlternativa, pagoDeAlternativa } from "./alternativas";

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

/** Una opción del presupuesto (Básico, Premium…) como la ve el cliente. Sin costos. */
export type AlternativaDeLaVista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  masElegida: boolean;
  items: ItemDeLaVista[];
  totales: VistaPublica["totales"];
  /** Las formas de pago de ESTA opción (calculadas sobre su total al enviar). */
  opcionesPago: OpcionPublica[];
  cobro: VistaPublica["cobro"];
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
  /**
   * Condiciones de cobro congeladas al enviar (etapa B): IVA, seña, descuento por transferencia y
   * política de cancelación. null en las versiones sin ellas (todo como antes).
   */
  cobro: {
    ivaPorcentaje: number;
    iva: number;
    totalConIva: number;
    senaPorcentaje: number;
    descuentoTransferencia: number;
    politicaCancelacion: string | null;
  } | null;
  /** La organización puede cobrar con Mercado Pago (si no, sólo se ofrecen transferencia o efectivo). */
  mercadoPago: boolean;
  /** Aceptado y con pedido: el enlace del pedido (para pagar la seña). */
  pedidoUrl: string | null;
  /**
   * Presupuesto con opciones y todavía sin elegir: cada opción con lo suyo ([] si no tiene opciones
   * o ya se aceptó). Con opciones, `items`, `totales`, `opcionesPago` y `cobro` de arriba son los de
   * la principal o, aceptado, los de la elegida.
   */
  alternativas: AlternativaDeLaVista[];
  /** Aceptado con opciones: el nombre de la que eligió el cliente. */
  alternativaElegida: string | null;
  /** Para quién es y de qué evento (ver `armarFicha`); null si no se pudo leer. */
  ficha: FichaDeLaVista | null;
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

function totalesDe(t: Partial<TotalesGuardados> | null | undefined): VistaPublica["totales"] {
  return {
    subtotal: numero(t?.subtotal),
    descuentos: numero(t?.descuentoItems) + numero(t?.descuentoGlobal),
    total: numero(t?.total),
    opcionales: numero(t?.opcionales?.total),
    cantidadOpcionales: numero(t?.opcionales?.cantidad),
  };
}

function cobroDe(paymentOptions: unknown): VistaPublica["cobro"] {
  const c = condicionesDeInstantanea(paymentOptions);
  return c
    ? {
        ivaPorcentaje: c.ivaPorcentaje,
        iva: c.iva,
        totalConIva: c.total,
        senaPorcentaje: c.senaPorcentaje,
        descuentoTransferencia: c.descuentoTransferenciaPorcentaje,
        politicaCancelacion: c.politicaCancelacion,
      }
    : null;
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
  /** Por omisión, sí (como antes de la etapa B). */
  mercadoPago?: boolean;
  pedidoUrl?: string | null;
  ficha?: FichaDeLaVista | null;
}): VistaPublica {
  const t = args.version.totals;
  const renglones = t?.renglones ?? {};
  const mercadoPago = args.mercadoPago !== false;
  // La forma de pago ya elegida se busca entre todas (aunque hoy no haya Mercado Pago).
  const todas = opcionesPublicas(args.version.paymentOptions);
  const opcionesPago = opcionesPublicas(args.version.paymentOptions, { mercadoPago });
  const elegida = todas.find((o) => o.id === args.version.chosenPaymentOptionId)?.etiqueta ?? null;
  const item = (i: ItemPresupuesto): ItemDeLaVista => ({
    id: i.id,
    nombre: i.nombre,
    descripcion: i.descripcion,
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    descuento: i.descuento ? { tipo: i.descuento.tipo, valor: i.descuento.valor } : null,
    neto: numero(renglones[i.id]?.neto),
    seccion: i.seccion,
    opcional: i.opcional,
  });
  // Opciones: aceptado, sólo la elegida (como un presupuesto común); si no, todas lado a lado.
  const alternativas = alternativasGuardadas(t);
  const idElegida = alternativaElegidaId(t);
  const principal = alternativaPrincipal(alternativas);
  const idQueVale = idElegida ?? principal?.id ?? null;
  const itemsArriba = idQueVale ? itemsDeAlternativa(args.version.items, idQueVale) : args.version.items;
  const aElegir =
    idElegida || args.estado === "ACEPTADO"
      ? []
      : alternativas.map((a) => {
          const pago = pagoDeAlternativa(args.version.paymentOptions, a.id);
          return {
            id: a.id,
            nombre: a.nombre,
            descripcion: a.descripcion,
            masElegida: a.masElegida,
            items: itemsDeAlternativa(args.version.items, a.id).map(item),
            totales: totalesDe(a.totales),
            opcionesPago: opcionesPublicas(pago, { mercadoPago }),
            cobro: cobroDe(pago),
          };
        });
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
    items: itemsArriba.map(item),
    totales: totalesDe(t),
    vence: ddmmaaaa(args.validUntil),
    condiciones: args.version.terms,
    propuestaPago: args.version.paymentProposal,
    opcionesPago,
    aceptacion:
      args.estado === "ACEPTADO" && args.version.acceptedAt
        ? { fecha: fechaHoraBA.format(args.version.acceptedAt).replace(",", ""), nombre: args.version.acceptedName ?? "", opcion: elegida }
        : null,
    cobro: cobroDe(args.version.paymentOptions),
    mercadoPago,
    pedidoUrl: args.estado === "ACEPTADO" ? (args.pedidoUrl ?? null) : null,
    alternativas: aElegir,
    alternativaElegida: idElegida ? (alternativas.find((a) => a.id === idElegida)?.nombre ?? null) : null,
    ficha: args.ficha ?? null,
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
