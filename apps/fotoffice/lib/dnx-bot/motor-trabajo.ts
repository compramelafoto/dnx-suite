import { z } from "@repo/dnx-bot";
import {
  formatCuantoCobroCurrency,
  parseCuantoCobroAmount,
  type CuantoCobroAssignmentActivity,
  type CuantoCobroPriceBuildUp,
  type CuantoCobroProfileInput,
} from "@repo/cuanto-cobro-core";
import { extrasDelPerfil } from "@/lib/precios/perfil-datos";
import { CAMARA_PRINCIPAL, camarasDelPerfil, estudioActivo } from "@/lib/precios/estudio";
import { resumirPerfil } from "@/lib/precios/resumen";
import { resumenDelPrecioCompleto } from "@/lib/presupuestos/precio-completo";
import { entradaDelMotor, recalcularItemCalculo } from "@/lib/presupuestos/calculo-cuanto-cobro";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import {
  ajustesVacios,
  armarItemsDelAsistente,
  conAsignaciones,
  correrMotor,
  trabajoVacio,
  type AjustesTrabajo,
  type AsignacionPanel,
  type TrabajoPanel,
} from "@/lib/presupuestos/panel-cuanto-cobro";
import type { TarjetaCalculo } from "./motor";

/**
 * Capa determinística de DNX Bot, parte del trabajo (spec §5.5 y §6.2). PURA. No tiene fórmulas:
 * cada concepto pasa por `armarItemsDelAsistente`, el mismo adaptador del botón «Armar con
 * ¿Cuánto Cobro?» del editor, así el borrador del bot se reabre en el panel de siempre. Un precio
 * total elegido a mano se reparte entre los conceptos y cada ítem se recalcula con
 * `recalcularItemCalculo` (lo mismo que hace el servidor al guardar) como precio ajustado.
 * Los totales son sumas de lo que devolvió el motor por concepto.
 */

// ── Entrada que puede llenar el modelo ─────────────────────────────────────────────────────────

const horas = z.string().regex(/^\d{1,4}([.,]\d{1,2})?$/).describe("Horas, sólo el número (\"8\", \"1,5\").");
const monto = z.string().regex(/^\d{1,12}$/).describe("Monto en pesos, sólo dígitos (sin $, puntos ni comas).");
const pct = z.string().regex(/^\d{1,3}([.,]\d{1,2})?$/).describe("Porcentaje, sólo el número (\"30\").");

export const esquemaTrabajoBot = z
  .object({
    nombre: z.string().min(1).max(120).describe("Nombre del concepto como lo diría el presupuesto (\"Cobertura\", \"Álbum\")."),
    tipo: z
      .enum(["own-service", "physical-product", "outsourced", "expense"])
      .optional()
      .describe("own-service = horas propias (por omisión); physical-product = álbum, impresiones; outsourced = trabajo tercerizado; expense = gasto o viático."),
    cantidad: z.string().regex(/^\d{1,6}$/).optional().describe("Unidades que cubre (informativo)."),
    horasCobertura: horas.optional(),
    horasEdicion: horas.optional(),
    horasEntrega: horas.optional(),
    horasViaje: horas.optional(),
    disparosEstimados: z
      .string()
      .regex(/^\d{1,7}$/)
      .optional()
      .describe("Sólo servicio propio: el MÁXIMO de disparos que planea para ESTE trabajo. Con la cámara del perfil, el motor calcula el desgaste de este trabajo. Es un dato del trabajo, nunca del perfil."),
    costoDirecto: monto.optional().describe("Costos directos del servicio propio que no son un concepto aparte (insumos). Los viáticos, el asistente y los productos van como conceptos propios, para que se vean en el desglose."),
    costoProveedor: monto.optional().describe("Producto (physical-product): lo que cobra el proveedor por unidad (laboratorio, imprenta)."),
    horasDiseno: horas.optional().describe("Producto: horas propias de diseño o producción."),
    costoEnvio: monto.optional().describe("Producto: envío por unidad."),
    costoEmbalaje: monto.optional().describe("Producto: embalaje por unidad."),
    costoTercerizado: monto.optional().describe("Tercerizado (outsourced): lo que cobra quien lo hace (segundo fotógrafo, asistente, video, maquillaje)."),
    horasGestion: horas.optional().describe("Tercerizado: horas propias de gestión."),
    costoGasto: monto.optional().describe("Gasto o viático (expense): combustible, peajes, estacionamiento, comida, alojamiento… Uno por concepto."),
    margenDeseado: pct
      .optional()
      .describe(
        "Producto o tercerizado: % de ganancia sobre su costo (lo que dijo la persona). El motor no tiene un % por omisión: sin este dato la ganancia del producto es 0 %. En gastos no se usa.",
      ),
    horasCliente: horas.optional().describe("Horas con el cliente (ventas, reuniones, coordinación) del trabajo entero: van sólo en el primer concepto."),
    asignaciones: z
      .array(
        z.object({
          persona: z.string().min(1).max(60).describe("Nombre de la persona del estudio (como figura en el perfil). Para el dueño: \"yo\"."),
          actividad: z.enum(["cobertura", "edicion", "entrega", "viaje", "diseno", "gestion"]),
          horas,
        }),
      )
      .max(30)
      .optional()
      .describe("Sólo con «Mi estudio»: quién hace cada parte, en horas-persona (dos fotógrafos 6 h = una asignación de 6 h para cada uno). Lo que no se asigna va al valor hora del estudio. Las horas de esa actividad son la suma de lo asignado: no las mandes aparte."),
    camara: z.string().min(1).max(60).optional().describe("Nombre de otra cámara del perfil (por ejemplo, la de carnets). Sin este dato, la principal."),
    disparosPor: z.enum(["unidad", "trabajo"]).optional().describe("unidad (por omisión): disparos × cantidad, como un carnet. trabajo: los disparos del trabajo entero."),
  })
  .describe("Un concepto del trabajo. Todo número tiene que haberlo dicho la persona: si falta, dejalo vacío.");

export type TrabajoBot = z.infer<typeof esquemaTrabajoBot>;

export const esquemaAjustesBot = z
  .object({
    fechaEvento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Fecha del evento AAAA-MM-DD. Con ella el motor sabe si es sábado, domingo o feriado (recargo) y cuántos meses faltan (inflación)."),
    expres: z.boolean().optional().describe("true si pidió entrega exprés."),
    distanciaKm: z.string().regex(/^\d{1,4}$/).optional().describe("Distancia de IDA al evento, en km (sólo el número)."),
    zona: z.string().min(1).max(60).optional().describe("Zona de viáticos del perfil, por su nombre (si cobra por zonas)."),
    seguroEvento: monto.optional().describe("Seguro que pide el lugar del evento (costo del trabajo, sin ganancia)."),
    fotosRetoque: z.string().regex(/^\d{1,5}$/).optional().describe("Cantidad de fotos a retocar."),
    sinComision: z.boolean().optional().describe("true sólo si para ESTE trabajo no se suma la comisión del medio de pago."),
  })
  .describe("Datos del trabajo entero que cambian el precio. Sólo lo que dijo la persona.");

export type AjustesBot = z.infer<typeof esquemaAjustesBot>;

export const esquemaCotizacion = z.object({
  tipoDeTrabajo: z.string().min(1).max(80).describe("Tipo de trabajo (\"Casamiento\", \"Quince\", \"Retrato corporativo\")."),
  conceptos: z.array(esquemaTrabajoBot).min(1).max(10),
  ajustes: esquemaAjustesBot.optional(),
  precioTotalElegido: monto.optional().describe("Sólo si la persona fija un total a mano (\"dejalo en 1.100.000\" → \"1100000\")."),
  parcial: z
    .boolean()
    .optional()
    .describe("true si todavía faltan grupos de la entrevista (horas, disparos, costos variables): el resultado se muestra como PARCIAL y no se puede pasar a un presupuesto."),
});

export type Cotizacion = z.infer<typeof esquemaCotizacion>;

const ACTIVIDAD: Record<string, CuantoCobroAssignmentActivity> = {
  cobertura: "coverage",
  edicion: "editing",
  entrega: "delivery",
  viaje: "travel",
  diseno: "production",
  gestion: "management",
};

const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");

/**
 * Lo de «Mi estudio» de un concepto del bot: personas y cámara van por NOMBRE; si no están en el perfil,
 * error (no se inventa). Devuelve el trabajo del panel con asignaciones (horas = suma de lo asignado).
 */
export function estudioBotAPanel(t: TrabajoBot, panel: TrabajoPanel, perfil: CuantoCobroProfileInput): { ok: true; trabajo: TrabajoPanel } | { ok: false; error: string } {
  let out = panel;
  if (t.asignaciones?.length) {
    const estudio = estudioActivo(perfil);
    if (!estudio) return { ok: false, error: "Para asignar horas a personas, el perfil tiene que tener «Mi estudio» encendido." };
    const asignaciones: AsignacionPanel[] = [];
    for (const a of t.asignaciones) {
      const n = sinTildes(a.persona);
      const persona =
        ["yo", "dueno", "duena", "yo mismo", "yo misma"].includes(n) ? estudio.people.find((p) => p.role === "owner") : estudio.people.find((p) => sinTildes(p.name) === n);
      if (!persona) return { ok: false, error: `«${a.persona}» no está en el equipo de Mi estudio: usá un nombre del perfil.` };
      if (persona.employmentType === "per-job") {
        return { ok: false, error: `${persona.name} cobra por trabajo: cargala como concepto tercerizado (outsourced) con lo que cobra.` };
      }
      asignaciones.push({ persona: persona.id, actividad: ACTIVIDAD[a.actividad]!, horas: a.horas.replace(",", ".") });
    }
    out = conAsignaciones(out, asignaciones);
  }
  if (t.camara) {
    const camara = camarasDelPerfil(perfil).find((c) => sinTildes(c.name) === sinTildes(t.camara!));
    if (!camara) return { ok: false, error: `La cámara «${t.camara}» no está en el perfil (Configuración → Precios → Equipamiento).` };
    out = { ...out, camara: camara.id === CAMARA_PRINCIPAL ? "" : camara.id };
  }
  if (t.disparosPor === "trabajo") out = { ...out, disparosPor: "job" };
  return { ok: true, trabajo: out };
}

export function trabajoBotAPanel(t: TrabajoBot): TrabajoPanel {
  const h = (v: string | undefined) => (v ?? "").replace(",", ".");
  return {
    ...trabajoVacio(t.nombre),
    tipo: t.tipo ?? "own-service",
    cantidad: t.cantidad ?? "1",
    horasCobertura: h(t.horasCobertura),
    horasEdicion: h(t.horasEdicion),
    horasEntrega: h(t.horasEntrega),
    horasViaje: h(t.horasViaje),
    disparosEstimados: t.disparosEstimados ?? "",
    costoDirecto: t.costoDirecto ?? "",
    costoProveedor: t.costoProveedor ?? "",
    horasDiseno: h(t.horasDiseno),
    costoEnvio: t.costoEnvio ?? "",
    costoEmbalaje: t.costoEmbalaje ?? "",
    costoTercerizado: t.costoTercerizado ?? "",
    horasGestion: h(t.horasGestion),
    costoGasto: t.costoGasto ?? "",
    margenDeseado: h(t.margenDeseado),
    horasCliente: h(t.horasCliente),
  };
}

/** Los ajustes del bot como los del panel. La zona va por nombre: si no está en el perfil, error (no se inventa). */
export function ajustesBotAPanel(a: AjustesBot | undefined, perfil: CuantoCobroProfileInput): { ok: true; ajustes: AjustesTrabajo | undefined } | { ok: false; error: string } {
  if (!a) return { ok: true, ajustes: undefined };
  let zonaId = "";
  if (a.zona) {
    const zonas = extrasDelPerfil(perfil).travelZones;
    const z = zonas.find((x) => x.name.trim().toLocaleLowerCase("es") === a.zona!.trim().toLocaleLowerCase("es"));
    if (!z) {
      return {
        ok: false,
        error: zonas.length
          ? `La zona «${a.zona}» no está en tu perfil. Tus zonas son: ${zonas.map((x) => x.name).join(", ")}.`
          : "Tu perfil no tiene zonas de viáticos: cargalas en Configuración → Precios o decime los km.",
      };
    }
    zonaId = z.id;
  }
  return {
    ok: true,
    ajustes: {
      ...ajustesVacios(),
      fechaEvento: a.fechaEvento ?? "",
      expres: a.expres === true,
      distanciaKm: a.distanciaKm ?? "",
      zonaId,
      seguroEvento: a.seguroEvento ?? "",
      fotosRetoque: a.fotosRetoque ?? "",
      sinComision: a.sinComision === true,
    },
  };
}

// ── Reparto de un total elegido a mano ─────────────────────────────────────────────────────────

/** En proporción al precio sugerido de cada concepto, en pesos enteros; el último absorbe el redondeo. */
export function repartirTotal(sugeridos: readonly number[], total: number): number[] {
  if (sugeridos.length === 0) return [];
  const base = sugeridos.reduce((s, x) => s + Math.max(0, x), 0);
  const partes = sugeridos.map((x) => Math.floor(base > 0 ? (total * Math.max(0, x)) / base : total / sugeridos.length));
  const asignado = partes.slice(0, -1).reduce((s, x) => s + x, 0);
  partes[partes.length - 1] = total - asignado;
  return partes;
}

// ── Cotizar ────────────────────────────────────────────────────────────────────────────────────

export type ResumenCotizacion = {
  conceptos: {
    nombre: string;
    /** "servicio propio" | "producto" | "tercerizado" | "gasto". */
    tipo: string;
    /** Producto o tercerizado: el % de ganancia pedido ("30 %"), o null si no se indicó (el motor usa 0 %). */
    margenPedido: string | null;
    precio: string;
    precioMinimo: string;
    precioRecomendado: string;
    horas: string;
    costo: string;
    ganancia: string;
    gananciaPct: string | null;
    estado: string;
    advertencias: string[];
    /** Mi estudio: horas y costo de cada persona asignada (del motor). */
    quienLoHace?: { nombre: string; horas: string; costo: string; alValorDelEstudio: boolean }[];
  }[];
  total: { recomendado: string; minimo: string; elegido: string; ganancia: string; gananciaPct: string | null; costosVariables: string };
  /**
   * Desgaste de la cámara de este trabajo, del motor: disparos × (valor de reposición / vida útil).
   * `sumado`: si el motor lo sumó al costo del trabajo (siempre, salvo un ítem guardado con el modelo
   * anterior a 10/2026). null si no hay disparos o la cámara no está en el perfil.
   */
  desgasteCamara: { disparos: number; monto: string; sumado: boolean } | null;
  /** Hay un servicio propio sin disparos estimados y la cámara está en el perfil: el desgaste no está contado. */
  faltanDisparos: boolean;
  /** Faltan grupos de la entrevista: no es el precio final. */
  parcial: boolean;
  /** El total quedó a mano (distinto del recomendado). */
  ajustado: boolean;
  /** La ganancia del total es más de `GANANCIA_PARA_REVISAR` veces el costo: casi siempre faltan horas o costos. */
  gananciaParaRevisar: boolean;
  valorHora: string;
  posicionamiento: string;
  /** Precio completo (impuestos, comisión, recargos, viáticos, seña…). null si el perfil y el trabajo no lo encienden. */
  precioCompleto: PrecioCompleto | null;
};

export type PrecioCompleto = {
  /** Lo que paga el cliente (con IVA si es responsable inscripto). */
  total: string;
  iva: string | null;
  /** "domingo", "sábado", "feriado (Navidad)", "día hábil"; null sin fecha. */
  dia: string | null;
  recargos: { etiqueta: string; monto: string } | null;
  viaticos: string | null;
  retoque: { fotos: number; monto: string } | null;
  seguroEvento: string | null;
  inflacion: string | null;
  impuestosYComision: string | null;
  sena: string | null;
  /** Monto de la seña sin el porcentaje, para la tarjeta. */
  senaMonto: string | null;
  senaPct: number | null;
  saldo: string | null;
  horaExtra: string | null;
  teQueda: string;
  descuentoTransferenciaPct: number | null;
  bajoMinimo: boolean;
  minimo: string | null;
  politicaCancelacion: string | null;
  avisos: string[];
};

export type ResultadoCotizacion =
  | { estado: "PERFIL_INCOMPLETO"; faltan: string[] }
  | { estado: "FALTAN_DATOS" | "INVALIDO"; faltan: string[]; error: string }
  | { estado: "OK"; faltan: []; items: ItemPresupuesto[]; resumen: ResumenCotizacion };

const ESTADO: Record<string, string> = {
  loss: "pierde plata",
  tight: "ajustado",
  profitable: "rentable",
  unknown: "sin datos",
};

/** Más de 3 veces el costo (300 %) no es imposible, pero casi siempre es un dato que falta: se pide revisar. */
export const GANANCIA_PARA_REVISAR = 3;

/** Desgaste de la cámara de cada ítem, tal como lo da el motor con la entrada guardada. */
function desgasteDe(items: ItemPresupuesto[]): { disparos: number; informativo: number; cobrado: number; camara: boolean } {
  const out = { disparos: 0, informativo: 0, cobrado: 0, camara: false };
  for (const it of items) {
    const entrada = it.calculo ? entradaDelMotor(it.calculo.entrada) : null;
    const r = entrada ? correrMotor(entrada) : null;
    if (!r || r.status !== "complete") continue;
    out.disparos += r.cameraWearSummary.totalJobShots;
    out.informativo += r.cameraWearSummary.totalCameraWearInformative;
    out.cobrado += r.cameraWearSummary.totalCameraWearCharged;
    out.camara = out.camara || r.cameraWearSummary.isCameraConfigured;
  }
  return out;
}

const porcentaje = (p: number | null) => (p === null || !Number.isFinite(p) ? null : `${Math.round(p * 100)} %`);
const horasTexto = (h: number) => `${Math.round(h * 10) / 10} h`;

const TIPO: Record<string, string> = { "own-service": "servicio propio", "physical-product": "producto", outsourced: "tercerizado", expense: "gasto" };

type ExtraResumen = {
  faltanDisparos: boolean;
  parcial: boolean;
  conceptos: { tipo: string; margen: string | null }[];
  perfil: CuantoCobroProfileInput;
};

function textoDia(d: CuantoCobroPriceBuildUp["day"]): string | null {
  if (!d) return null;
  if (d.dayType === "holiday") return `feriado (${d.holidayName ?? "feriado"})`;
  return d.dayType === "sunday" ? "domingo" : d.dayType === "saturday" ? "sábado" : "día hábil";
}

/** El precio completo del trabajo, sumando el desglose de cada ítem. Con total a mano, la seña y el IVA van sobre ese total. */
function precioCompletoDe(items: ItemPresupuesto[], ajustado: boolean, perfil: CuantoCobroProfileInput, $: (n: number) => string): PrecioCompleto | null {
  const resumen = resumenDelPrecioCompleto(items, perfil);
  if (!resumen) return null;
  const { lineas, trabajo: r } = resumen;
  const primera = lineas[0]!;
  let sinIva = r.priceWithoutVat;
  let iva = r.iva;
  let total = r.total;
  let deducciones = r.grossIncomeTax + r.commission;
  let sena = r.deposit;
  if (ajustado) {
    sinIva = Math.round(items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0));
    iva = Math.round((sinIva * primera.ivaPercent) / 100);
    total = sinIva + iva;
    deducciones = r.priceWithoutVat > 0 ? Math.round((sinIva * (r.grossIncomeTax + r.commission)) / r.priceWithoutVat) : 0;
    sena = r.deposit ? { percent: r.deposit.percent, amount: Math.round((total * r.deposit.percent) / 100) } : null;
  }
  const minimo = r.minimumJobPrice;
  const bajoMinimo = minimo !== null && sinIva < minimo;
  const partesRecargo = [
    primera.daySurchargePercent > 0 ? `${textoDia(primera.day)} ${primera.daySurchargePercent} %` : null,
    primera.expressSurchargePercent > 0 ? `exprés ${primera.expressSurchargePercent} %` : null,
  ].filter(Boolean);
  const viaje = lineas.find((l) => l.travel)?.travel ?? null;
  const retoque = lineas.find((l) => l.retouch)?.retouch ?? null;
  const inflacion = lineas.find((l) => l.inflation)?.inflation ?? null;
  return {
    total: $(total),
    iva: iva > 0 ? `${$(iva)} (${primera.ivaPercent} %)` : null,
    dia: textoDia(primera.day),
    recargos: r.surchargeAmount > 0 && partesRecargo.length ? { etiqueta: `Recargos (${partesRecargo.join(" + ")})`, monto: $(r.surchargeAmount) } : null,
    viaticos: viaje ? `${$(viaje.cost)} (${viaje.zoneName ? `${viaje.zoneName}, ` : ""}${viaje.km} km)` : null,
    retoque: retoque ? { fotos: retoque.photos, monto: $(retoque.price) } : null,
    seguroEvento: r.eventInsurance > 0 ? $(r.eventInsurance) : null,
    inflacion: inflacion ? `${$(r.inflationAmount)} (${inflacion.months} ${inflacion.months === 1 ? "mes" : "meses"} al ${inflacion.monthlyPercent} %)` : null,
    impuestosYComision: deducciones > 0 ? $(deducciones) : null,
    sena: sena ? `${$(sena.amount)} (${sena.percent} %)` : null,
    senaMonto: sena ? $(sena.amount) : null,
    senaPct: sena ? sena.percent : null,
    saldo: sena ? $(total - sena.amount) : null,
    horaExtra: r.overtimeHourPrice ? $(r.overtimeHourPrice) : null,
    teQueda: $(sinIva - deducciones),
    descuentoTransferenciaPct: r.suggestedTransferDiscountPercent,
    bajoMinimo,
    minimo: minimo !== null ? $(minimo) : null,
    politicaCancelacion: r.cancellationPolicy,
    avisos: r.warnings.filter((w) => !/precio mínimo/.test(w)),
  };
}

function resumir(items: ItemPresupuesto[], ajustado: boolean, extra: ExtraResumen): ResumenCotizacion {
  const calc = items.map((i) => i.calculo!);
  const moneda = calc[0]?.moneda || "ARS";
  const $ = (n: number) => formatCuantoCobroCurrency(n, moneda);
  const suma = (f: (c: (typeof calc)[number]) => number) => calc.reduce((s, c) => s + f(c), 0);
  const d = desgasteDe(items);
  const costoBase = suma((c) => c.costoBase);
  const ganancia = suma((c) => c.margenElegido);
  return {
    conceptos: items.map((it, i) => {
      const c = it.calculo!;
      const e = extra.conceptos[i];
      return {
        nombre: it.nombre,
        tipo: TIPO[e?.tipo ?? "own-service"] ?? "servicio propio",
        margenPedido: e?.margen ?? null,
        precio: $(c.precioElegido),
        precioMinimo: $(c.precioMinimo),
        precioRecomendado: $(c.precioSugerido),
        horas: horasTexto(c.horasTotales),
        costo: $(c.costoBase),
        ganancia: $(c.margenElegido),
        gananciaPct: porcentaje(c.margenElegidoProporcion),
        estado: ESTADO[c.estadoRentabilidad] ?? c.estadoRentabilidad,
        advertencias: c.advertencias,
        ...(c.porPersona?.length
          ? { quienLoHace: c.porPersona.map((x) => ({ nombre: x.nombre, horas: horasTexto(x.horas), costo: $(x.costo), alValorDelEstudio: x.alValorDelEstudio })) }
          : {}),
      };
    }),
    total: {
      recomendado: $(suma((c) => c.precioSugerido)),
      minimo: $(suma((c) => c.precioMinimo)),
      elegido: $(suma((c) => c.precioElegido)),
      ganancia: $(ganancia),
      gananciaPct: porcentaje(costoBase > 0 ? ganancia / costoBase : null),
      costosVariables: $(suma((c) => c.costosVariables)),
    },
    desgasteCamara: d.disparos > 0 && d.camara ? { disparos: d.disparos, monto: $(d.cobrado > 0 ? d.cobrado : d.informativo), sumado: d.cobrado > 0 } : null,
    // Sin cámara en el perfil los disparos no cambian nada: no se avisa.
    faltanDisparos: extra.faltanDisparos && d.camara,
    parcial: extra.parcial,
    ajustado,
    gananciaParaRevisar: costoBase > 0 && ganancia / costoBase > GANANCIA_PARA_REVISAR,
    valorHora: $(calc[0]?.valorHora ?? 0),
    posicionamiento: calc[0]?.posicionamiento ?? "",
    precioCompleto: precioCompletoDe(items, ajustado, extra.perfil, $),
  };
}

/**
 * El precio de un trabajo descripto en palabras. Sin perfil completo no hay precio. Los ítems que
 * devuelve son exactamente los que agregaría el panel (`armarItemsDelAsistente`): ítems CALCULO
 * con su instantánea y la entrada del motor, listos para el borrador.
 */
export function cotizar(
  perfil: CuantoCobroProfileInput,
  c: Cotizacion,
  opciones: { nuevaClave: () => string; ahora?: Date; seccion?: string | null },
): ResultadoCotizacion {
  const p = resumirPerfil(perfil);
  if (!p.completo) return { estado: "PERFIL_INCOMPLETO", faltan: p.faltan };

  const aj = ajustesBotAPanel(c.ajustes, perfil);
  if (!aj.ok) return { estado: "INVALIDO", faltan: [], error: aj.error };
  const paneles: TrabajoPanel[] = [];
  for (const t of c.conceptos) {
    const e = estudioBotAPanel(t, trabajoBotAPanel(t), perfil);
    if (!e.ok) return { estado: "INVALIDO", faltan: [], error: e.error };
    paneles.push(e.trabajo);
  }
  const r = armarItemsDelAsistente(perfil, paneles, c.tipoDeTrabajo, {
    nuevaClave: opciones.nuevaClave,
    ahora: opciones.ahora,
    seccion: opciones.seccion ?? null,
    ajustes: aj.ajustes,
  });
  if (!r.ok) return { estado: r.faltan.length ? "FALTAN_DATOS" : "INVALIDO", faltan: r.faltan, error: r.error };

  const extra: ExtraResumen = {
    faltanDisparos: c.conceptos.some((t) => (t.tipo ?? "own-service") === "own-service" && !t.disparosEstimados),
    parcial: c.parcial === true,
    conceptos: c.conceptos.map((t) => {
      const tipo = t.tipo ?? "own-service";
      const conMargen = tipo === "physical-product" || tipo === "outsourced";
      return { tipo, margen: conMargen && t.margenDeseado ? `${t.margenDeseado} %` : null };
    }),
    perfil,
  };
  if (c.precioTotalElegido === undefined) return { estado: "OK", faltan: [], items: r.items, resumen: resumir(r.items, false, extra) };

  const total = parseCuantoCobroAmount(c.precioTotalElegido) ?? 0;
  if (!(total > 0)) return { estado: "INVALIDO", faltan: [], error: "El precio elegido tiene que ser mayor que cero." };
  const partes = repartirTotal(r.items.map((i) => i.calculo!.precioSugerido), total);
  const items: ItemPresupuesto[] = [];
  for (let i = 0; i < r.items.length; i += 1) {
    const it = r.items[i]!;
    const entrada = entradaDelMotor(it.calculo!.entrada);
    if (!entrada) return { estado: "INVALIDO", faltan: [], error: "Los datos del cálculo de ¿Cuánto Cobro? no son válidos." };
    const re = recalcularItemCalculo({ ...it, precioUnitario: partes[i]! }, entrada, opciones.ahora, { precioAjustado: true });
    if (!re.ok) return { estado: "INVALIDO", faltan: re.faltan, error: `${it.nombre}: ${re.error}` };
    items.push(re.item);
  }
  return { estado: "OK", faltan: [], items, resumen: resumir(items, true, extra) };
}

// ── Tarjeta «cálculo» ──────────────────────────────────────────────────────────────────────────

function filasDelPrecioCompleto(p: PrecioCompleto | null): { etiqueta: string; valor: string }[] {
  if (!p) return [];
  return [
    { etiqueta: "Total para el cliente", valor: p.total },
    ...(p.iva ? [{ etiqueta: "IVA", valor: p.iva }] : []),
    ...(p.recargos ? [{ etiqueta: p.recargos.etiqueta, valor: p.recargos.monto }] : []),
    ...(p.viaticos ? [{ etiqueta: "Viáticos", valor: p.viaticos }] : []),
    ...(p.retoque ? [{ etiqueta: `Retoque (${p.retoque.fotos} fotos)`, valor: p.retoque.monto }] : []),
    ...(p.seguroEvento ? [{ etiqueta: "Seguro del evento", valor: p.seguroEvento }] : []),
    ...(p.inflacion ? [{ etiqueta: "Ajuste por inflación", valor: p.inflacion }] : []),
    ...(p.impuestosYComision ? [{ etiqueta: "Ingresos Brutos y comisión", valor: p.impuestosYComision }] : []),
    ...(p.senaMonto ? [{ etiqueta: `Seña (${p.senaPct} %)`, valor: p.senaMonto }] : []),
    ...(p.saldo ? [{ etiqueta: "Saldo", valor: p.saldo }] : []),
    ...(p.horaExtra ? [{ etiqueta: "Hora extra", valor: p.horaExtra }] : []),
    { etiqueta: "Te queda", valor: p.teQueda },
  ];
}

function avisosDelPrecioCompleto(p: PrecioCompleto | null): string[] {
  if (!p) return [];
  return [
    ...(p.bajoMinimo && p.minimo ? [`El total queda por debajo de tu precio mínimo por trabajo (${p.minimo}).`] : []),
    ...(p.descuentoTransferenciaPct ? [`La comisión está sumada al precio: podés ofrecer un descuento por transferencia del ${p.descuentoTransferenciaPct} %.`] : []),
    ...p.avisos,
  ];
}

export function tarjetaDeCotizacion(r: ResumenCotizacion, tipoDeTrabajo: string): TarjetaCalculo {
  const t = r.total;
  const filas = [
    { etiqueta: "Precio", valor: t.elegido },
    ...(r.ajustado ? [{ etiqueta: "Recomendado", valor: t.recomendado }] : []),
    { etiqueta: "Mínimo para no perder", valor: t.minimo },
    { etiqueta: "Ganancia", valor: t.gananciaPct ? `${t.ganancia} (${t.gananciaPct})` : t.ganancia },
    { etiqueta: "Valor hora", valor: r.valorHora },
    { etiqueta: "Costos variables", valor: t.costosVariables },
    ...(r.desgasteCamara
      ? [{ etiqueta: `Desgaste de cámara (${r.desgasteCamara.disparos} disparos)`, valor: `${r.desgasteCamara.monto} (${r.desgasteCamara.sumado ? "sumado" : "no sumado"})` }]
      : []),
    // Subtotal de cada concepto: precio, con su costo y su ganancia (la cuenta del motor).
    ...r.conceptos.map((c) => ({ etiqueta: c.nombre, valor: `${c.precio} (costo ${c.costo} + ganancia ${c.ganancia})` })),
    // Mi estudio: quién hizo cada parte, con sus horas y su costo (del motor).
    ...r.conceptos.flatMap((c) => (c.quienLoHace ?? []).map((q) => ({ etiqueta: `${c.nombre} · ${q.nombre}`, valor: `${q.horas}: ${q.costo}` }))),
    // Precio completo: del total al cliente a lo que te queda (todo del motor).
    ...filasDelPrecioCompleto(r.precioCompleto),
  ].slice(0, 20);
  const avisos = [
    ...avisosDelPrecioCompleto(r.precioCompleto),
    // Sólo un aviso: el número es el del motor, tal cual.
    ...(r.faltanDisparos ? ["Faltan los disparos estimados del trabajo: el desgaste de la cámara no está contado."] : []),
    ...(r.gananciaParaRevisar ? ["La ganancia es más de 3 veces el costo: revisá que las horas y los costos del trabajo estén completos."] : []),
    ...r.conceptos.filter((c) => c.estado === "pierde plata").map((c) => `${c.nombre}: con este precio pierde plata.`),
    ...r.conceptos
      .filter((c) => (c.tipo === "producto" || c.tipo === "tercerizado") && c.margenPedido === null)
      .map((c) => `${c.nombre}: sin % de ganancia sobre el ${c.tipo} (no se indicó; queda en 0 %).`),
    ...new Set(r.conceptos.flatMap((c) => c.advertencias)),
  ].slice(0, 6);
  return { titulo: `¿Cuánto cobro? · ${tipoDeTrabajo}${r.parcial ? " (parcial)" : ""}`.slice(0, 80), filas, avisos };
}
