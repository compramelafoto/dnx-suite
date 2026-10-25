import {
  CONDICION_IVA_LABELS,
  CONDICION_IVA_RECEPTOR,
  DOC_TIPO,
  DOC_TIPO_DE_CLIENTE,
  type Concepto,
} from "./constants";
import { deInputFecha } from "./pedido";

/**
 * Del formulario «Facturar» a los datos del comprobante: el receptor, el concepto y las fechas.
 * Módulo PURO.
 */

export type Receptor = {
  docTipo: number;
  docNro: string;
  nombre: string;
  /** El texto de FOTOFFICE: CONSUMIDOR_FINAL, MONOTRIBUTO, ... */
  ivaCondition: string;
  condicionIvaId: number;
  domicilio: string | null;
};

export const CONSUMIDOR_FINAL: Receptor = {
  docTipo: DOC_TIPO.SIN_IDENTIFICAR,
  docNro: "0",
  nombre: "Consumidor final",
  ivaCondition: "CONSUMIDOR_FINAL",
  condicionIvaId: CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL!,
  domicilio: null,
};

export type ClienteFiscal = {
  nombre: string;
  docType: string | null;
  docNumber: string | null;
  ivaCondition: string;
  domicilio: string | null;
};

/** Lo que se le propone a la persona: los datos del cliente si los tiene, si no consumidor final. */
export function receptorSugerido(c: ClienteFiscal | null): Receptor {
  if (!c) return CONSUMIDOR_FINAL;
  const docTipo = c.docType ? DOC_TIPO_DE_CLIENTE[c.docType] : undefined;
  const docNro = (c.docNumber ?? "").replace(/\D/g, "");
  const condicion = CONDICION_IVA_RECEPTOR[c.ivaCondition] !== undefined ? c.ivaCondition : "CONSUMIDOR_FINAL";
  if (!docTipo || !docNro) {
    return condicion === "CONSUMIDOR_FINAL" ? { ...CONSUMIDOR_FINAL, nombre: c.nombre || CONSUMIDOR_FINAL.nombre } : {
      ...CONSUMIDOR_FINAL,
      nombre: c.nombre,
      ivaCondition: condicion,
      condicionIvaId: CONDICION_IVA_RECEPTOR[condicion]!,
      domicilio: c.domicilio,
    };
  }
  return { docTipo, docNro, nombre: c.nombre, ivaCondition: condicion, condicionIvaId: CONDICION_IVA_RECEPTOR[condicion]!, domicilio: c.domicilio };
}

export type FormularioFactura = {
  anonimo: boolean;
  docTipo: string;
  docNro: string;
  nombre: string;
  ivaCondition: string;
  domicilio: string;
  concepto: string;
  fecha: string;
  servDesde: string;
  servHasta: string;
  vtoPago: string;
};

export type DatosFormulario = {
  receptor: Receptor;
  concepto: Concepto;
  /** AAAAMMDD */
  fecha: string;
  servicio: { desde: string; hasta: string; vtoPago: string } | null;
};

/** Lee el formulario. Los errores van en criollo; las reglas de ARCA las aplica `validarComprobante`. */
export function leerFormulario(f: FormularioFactura): { ok: true; datos: DatosFormulario } | { ok: false; error: string } {
  const concepto = Number(f.concepto);
  if (concepto !== 1 && concepto !== 2 && concepto !== 3) return { ok: false, error: "Elegí qué se factura: productos, servicios o ambos." };
  const fecha = deInputFecha(f.fecha);
  if (!fecha) return { ok: false, error: "La fecha del comprobante no es válida." };
  let servicio: DatosFormulario["servicio"] = null;
  if (concepto !== 1) {
    const desde = deInputFecha(f.servDesde);
    const hasta = deInputFecha(f.servHasta);
    const vto = deInputFecha(f.vtoPago);
    if (!desde || !hasta || !vto) return { ok: false, error: "Con servicios hay que completar desde, hasta y el vencimiento del pago." };
    servicio = { desde, hasta, vtoPago: vto };
  }
  let receptor: Receptor;
  if (f.anonimo) {
    receptor = CONSUMIDOR_FINAL;
  } else {
    const docTipo = Number(f.docTipo);
    if (![DOC_TIPO.CUIT, DOC_TIPO.CUIL, DOC_TIPO.DNI, DOC_TIPO.PASAPORTE].includes(docTipo as 80)) {
      return { ok: false, error: "Elegí el tipo de documento del comprador, o marcá «Consumidor final sin identificar»." };
    }
    const docNro = f.docNro.replace(/\D/g, "");
    if (!docNro) return { ok: false, error: "Falta el número de documento del comprador." };
    const nombre = f.nombre.trim().slice(0, 200);
    if (!nombre) return { ok: false, error: "Falta el nombre o la razón social del comprador." };
    const cond = f.ivaCondition;
    if (CONDICION_IVA_RECEPTOR[cond] === undefined || !CONDICION_IVA_LABELS[cond]) return { ok: false, error: "Elegí la condición frente al IVA del comprador." };
    receptor = {
      docTipo,
      docNro,
      nombre,
      ivaCondition: cond,
      condicionIvaId: CONDICION_IVA_RECEPTOR[cond]!,
      domicilio: f.domicilio.trim().slice(0, 300) || null,
    };
  }
  return { ok: true, datos: { receptor, concepto: concepto as Concepto, fecha, servicio } };
}

export type RenglonFactura = { description: string; qty: number; unitPriceMinor: number; lineTotalMinor: number };

/**
 * Los renglones de una venta. Si hubo descuento, va como renglón aparte en negativo para que la
 * suma cierre con el total cobrado (que es lo que se factura).
 */
export function renglonesDeVenta(items: RenglonFactura[], totalMinor: number): RenglonFactura[] {
  const suma = items.reduce((a, i) => a + i.lineTotalMinor, 0);
  const out = [...items];
  if (suma !== totalMinor) {
    const dif = totalMinor - suma;
    out.push({ description: dif < 0 ? "Descuento" : "Ajuste", qty: 1, unitPriceMinor: dif, lineTotalMinor: dif });
  }
  return out;
}
