/**
 * El código QR de la RG 4892: un JSON con los datos del comprobante, en base64, al final de
 * `https://www.afip.gob.ar/fe/qr/?p=`. Quien lo escanea ve el comprobante en el sitio de ARCA.
 * Módulo PURO.
 */

export const QR_BASE_URL = "https://www.afip.gob.ar/fe/qr/?p=";

export type DatosQr = {
  /** AAAAMMDD */
  fecha: string;
  cuit: string;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  totalCentavos: number;
  tipoDocRec: number;
  /** "0" para consumidor final sin identificar. */
  nroDocRec: string;
  cae: string;
};

/** La carga útil, con los nombres y tipos exactos de la especificación (versión 1). */
export function cargaQr(d: DatosQr): Record<string, string | number> {
  const carga: Record<string, string | number> = {
    ver: 1,
    fecha: `${d.fecha.slice(0, 4)}-${d.fecha.slice(4, 6)}-${d.fecha.slice(6, 8)}`,
    cuit: Number(d.cuit),
    ptoVta: d.ptoVta,
    tipoCmp: d.tipoCmp,
    nroCmp: d.nroCmp,
    importe: d.totalCentavos / 100,
    moneda: "PES",
    ctz: 1,
  };
  // Sin receptor identificado los campos del documento son opcionales: se omiten.
  if (d.nroDocRec !== "0") {
    carga.tipoDocRec = d.tipoDocRec;
    carga.nroDocRec = Number(d.nroDocRec);
  }
  carga.tipoCodAut = "E";
  carga.codAut = Number(d.cae);
  return carga;
}

export function urlQr(d: DatosQr): string {
  return QR_BASE_URL + Buffer.from(JSON.stringify(cargaQr(d)), "utf8").toString("base64");
}
