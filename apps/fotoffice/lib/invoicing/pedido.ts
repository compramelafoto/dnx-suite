import {
  CBTE_FACTURA_C,
  CBTE_NOTA_CREDITO_C,
  CONDICION_IVA_RECEPTOR,
  DOC_TIPO,
  TOPE_CONSUMIDOR_FINAL_ANONIMO_ARS,
  type CbteTipo,
  type Concepto,
} from "./constants";
import { el } from "./xml";

/**
 * El pedido `FECAESolicitar` de un comprobante clase C, y sus validaciones previas.
 *
 * En un comprobante C no se discrimina IVA: todo el importe va como neto, sin alícuotas
 * (manual del desarrollador WSFEv1, comprobantes C). Módulo PURO.
 */

export type ComprobanteAsociado = {
  tipo: CbteTipo;
  ptoVta: number;
  numero: number;
  /** CUIT del emisor del comprobante asociado (el mismo que emite la nota de crédito). */
  cuit: string;
  /** AAAAMMDD */
  fecha: string;
};

export type DatosComprobante = {
  cuitEmisor: string;
  ptoVta: number;
  cbteTipo: CbteTipo;
  numero: number;
  concepto: Concepto;
  docTipo: number;
  /** Sólo dígitos; "0" para un consumidor final sin identificar. */
  docNro: string;
  condicionIvaReceptorId: number;
  /** AAAAMMDD, en fecha de Argentina. */
  fecha: string;
  totalCentavos: number;
  /** Con servicios (concepto 2 o 3): período facturado y vencimiento del pago, AAAAMMDD. */
  servicio: { desde: string; hasta: string; vtoPago: string } | null;
  asociado: ComprobanteAsociado | null;
};

export type Auth = { token: string; sign: string; cuit: string };

/** 12345 centavos → "123.45". */
export function importe(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0) throw new Error("Importe inválido");
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

/** Fecha de Argentina AAAAMMDD. */
export function fechaArca(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}${p.month}${p.day}`;
}

/** "2026-10-25" (el valor de un `<input type=date>`) → "20261025". */
export function deInputFecha(v: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.replace(/-/g, "") : null;
}

/** "20261025" → "2026-10-25". */
export function aIsoFecha(v: string): string {
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(aIsoFecha(b)) - Date.parse(aIsoFecha(a))) / 86_400_000);
}

/** Dígito verificador de CUIT/CUIL. */
export function cuitValido(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(cuit[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto;
  return dv !== 10 && dv === Number(cuit[10]);
}

/**
 * Las reglas que ARCA rechazaría, dichas antes y en criollo. Devuelve la lista de problemas
 * (vacía = se puede mandar). `hoy` es AAAAMMDD de Argentina.
 */
export function validarComprobante(d: DatosComprobante, hoy: string): string[] {
  const errores: string[] = [];
  if (!cuitValido(d.cuitEmisor)) errores.push("El CUIT del negocio no es válido. Revisalo en Configuración → Facturación.");
  if (!Number.isInteger(d.ptoVta) || d.ptoVta < 1 || d.ptoVta > 99998) errores.push("El punto de venta no es válido.");
  if (!Number.isInteger(d.totalCentavos) || d.totalCentavos <= 0) errores.push("El total tiene que ser mayor a cero.");
  if (!/^\d{8}$/.test(d.fecha)) errores.push("La fecha del comprobante no es válida.");

  // Ventana de fechas de ARCA: hasta 5 días antes o después con productos, 10 con servicios.
  if (/^\d{8}$/.test(d.fecha)) {
    const margen = d.concepto === 1 ? 5 : 10;
    if (Math.abs(diasEntre(hoy, d.fecha)) > margen) {
      errores.push(`La fecha del comprobante no puede estar a más de ${margen} días de hoy.`);
    }
  }

  if (d.concepto !== 1) {
    const s = d.servicio;
    if (!s || !/^\d{8}$/.test(s.desde) || !/^\d{8}$/.test(s.hasta) || !/^\d{8}$/.test(s.vtoPago)) {
      errores.push("Con servicios hay que poner desde y hasta cuándo se prestaron y cuándo vence el pago.");
    } else {
      if (s.desde > s.hasta) errores.push("La fecha de inicio del servicio no puede ser posterior a la de fin.");
      if (s.vtoPago < d.fecha) errores.push("El vencimiento del pago no puede ser anterior a la fecha del comprobante.");
    }
  }

  if (d.docTipo === DOC_TIPO.SIN_IDENTIFICAR) {
    if (d.docNro !== "0") errores.push("Un consumidor final sin identificar va sin número de documento.");
    if (d.condicionIvaReceptorId !== CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL!) {
      errores.push("Sin documento, el receptor sólo puede ser consumidor final.");
    }
    if (d.totalCentavos >= TOPE_CONSUMIDOR_FINAL_ANONIMO_ARS * 100) {
      errores.push("Por este importe ARCA exige identificar al comprador con su DNI, CUIT o CUIL.");
    }
  } else if (d.docTipo === DOC_TIPO.CUIT || d.docTipo === DOC_TIPO.CUIL) {
    if (!cuitValido(d.docNro)) errores.push("El CUIT o CUIL del comprador no es válido.");
  } else if (d.docTipo === DOC_TIPO.DNI) {
    if (!/^\d{7,8}$/.test(d.docNro)) errores.push("El DNI del comprador tiene que tener 7 u 8 números.");
  } else if (d.docTipo === DOC_TIPO.PASAPORTE) {
    if (!/^\d{1,15}$/.test(d.docNro)) errores.push("El pasaporte tiene que ser sólo números.");
  } else {
    errores.push("El tipo de documento del comprador no es válido.");
  }

  // Un responsable inscripto, un monotributista o un exento necesitan CUIT para que la factura
  // les sirva (y ARCA lo valida contra el padrón).
  const conCuit = [CONDICION_IVA_RECEPTOR.RESPONSABLE_INSCRIPTO, CONDICION_IVA_RECEPTOR.MONOTRIBUTO, CONDICION_IVA_RECEPTOR.EXENTO];
  if (conCuit.includes(d.condicionIvaReceptorId) && d.docTipo !== DOC_TIPO.CUIT) {
    errores.push("A un responsable inscripto, monotributista o exento se le factura con su CUIT.");
  }

  if (d.cbteTipo === CBTE_NOTA_CREDITO_C) {
    if (!d.asociado) errores.push("La nota de crédito tiene que decir qué factura corrige.");
  } else if (d.cbteTipo !== CBTE_FACTURA_C) {
    errores.push("Este tipo de comprobante no se emite desde FOTOFFICE.");
  }
  return errores;
}

/** El detalle `FECAEDetRequest`, en el orden exacto del WSDL. */
export function detalleXml(d: DatosComprobante): string {
  const total = importe(d.totalCentavos);
  const s = d.concepto === 1 ? null : d.servicio;
  return (
    "<ar:FECAEDetRequest>" +
    el("ar:Concepto", d.concepto) +
    el("ar:DocTipo", d.docTipo) +
    el("ar:DocNro", d.docNro) +
    el("ar:CbteDesde", d.numero) +
    el("ar:CbteHasta", d.numero) +
    el("ar:CbteFch", d.fecha) +
    el("ar:ImpTotal", total) +
    el("ar:ImpTotConc", "0.00") +
    el("ar:ImpNeto", total) +
    el("ar:ImpOpEx", "0.00") +
    el("ar:ImpTrib", "0.00") +
    el("ar:ImpIVA", "0.00") +
    (s ? el("ar:FchServDesde", s.desde) + el("ar:FchServHasta", s.hasta) + el("ar:FchVtoPago", s.vtoPago) : "") +
    el("ar:MonId", "PES") +
    el("ar:MonCotiz", "1") +
    el("ar:CondicionIVAReceptorId", d.condicionIvaReceptorId) +
    (d.asociado
      ? "<ar:CbtesAsoc><ar:CbteAsoc>" +
        el("ar:Tipo", d.asociado.tipo) +
        el("ar:PtoVta", d.asociado.ptoVta) +
        el("ar:Nro", d.asociado.numero) +
        el("ar:Cuit", d.asociado.cuit) +
        el("ar:CbteFch", d.asociado.fecha) +
        "</ar:CbteAsoc></ar:CbtesAsoc>"
      : "") +
    "</ar:FECAEDetRequest>"
  );
}

export const NS_WSFE = "http://ar.gov.afip.dif.FEV1/";

export function sobreWsfe(operacion: string, cuerpo: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${NS_WSFE}">` +
    `<soap:Body><ar:${operacion}>${cuerpo}</ar:${operacion}></soap:Body></soap:Envelope>`
  );
}

export function authXml(a: Auth): string {
  return "<ar:Auth>" + el("ar:Token", a.token) + el("ar:Sign", a.sign) + el("ar:Cuit", a.cuit) + "</ar:Auth>";
}

/** El sobre completo de `FECAESolicitar` para un comprobante. */
export function sobreFecaeSolicitar(auth: Auth, d: DatosComprobante): string {
  return sobreWsfe(
    "FECAESolicitar",
    authXml(auth) +
      "<ar:FeCAEReq><ar:FeCabReq>" +
      el("ar:CantReg", 1) +
      el("ar:PtoVta", d.ptoVta) +
      el("ar:CbteTipo", d.cbteTipo) +
      "</ar:FeCabReq><ar:FeDetReq>" +
      detalleXml(d) +
      "</ar:FeDetReq></ar:FeCAEReq>",
  );
}

/** Lo mismo que va en el sobre, en JSON: lo que se guarda como "pedido crudo" (sin token ni sign). */
export function pedidoComoJson(d: DatosComprobante): Record<string, unknown> {
  return {
    FeCabReq: { CantReg: 1, PtoVta: d.ptoVta, CbteTipo: d.cbteTipo },
    FECAEDetRequest: {
      Concepto: d.concepto,
      DocTipo: d.docTipo,
      DocNro: d.docNro,
      CbteDesde: d.numero,
      CbteHasta: d.numero,
      CbteFch: d.fecha,
      ImpTotal: importe(d.totalCentavos),
      ImpTotConc: "0.00",
      ImpNeto: importe(d.totalCentavos),
      ImpOpEx: "0.00",
      ImpTrib: "0.00",
      ImpIVA: "0.00",
      ...(d.concepto !== 1 && d.servicio
        ? { FchServDesde: d.servicio.desde, FchServHasta: d.servicio.hasta, FchVtoPago: d.servicio.vtoPago }
        : {}),
      MonId: "PES",
      MonCotiz: "1",
      CondicionIVAReceptorId: d.condicionIvaReceptorId,
      ...(d.asociado ? { CbtesAsoc: [{ Tipo: d.asociado.tipo, PtoVta: d.asociado.ptoVta, Nro: d.asociado.numero, Cuit: d.asociado.cuit, CbteFch: d.asociado.fecha }] } : {}),
    },
  };
}
