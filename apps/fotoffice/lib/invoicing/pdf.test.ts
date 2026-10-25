import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { armarPdfComprobante, numeroComprobante, pesos, textoSeguro, type DatosPdf } from "./pdf";
import { urlQr } from "./qr";

async function datos(extra: Partial<DatosPdf> = {}): Promise<DatosPdf> {
  const url = urlQr({ fecha: "20261025", cuit: "20123456786", ptoVta: 3, tipoCmp: 11, nroCmp: 42, totalCentavos: 1500050, tipoDocRec: 99, nroDocRec: "0", cae: "76432109876543" });
  return {
    cbteTipo: 11,
    ptoVta: 3,
    numero: 42,
    fecha: "20261025",
    concepto: 2,
    servicio: { desde: "20261001", hasta: "20261031", vtoPago: "20261105" },
    emisor: { nombreComercial: "DNX Estudio", razonSocial: "Cuart Daniel", cuit: "20123456786", ivaCondition: "MONOTRIBUTO", domicilioFiscal: "Calle Falsa 123, Rosario", ingresosBrutos: null, inicioActividades: "2015-03-01" },
    receptor: { docTipo: 99, docNro: "0", nombre: "Consumidor final", ivaCondition: "CONSUMIDOR_FINAL", domicilio: null },
    renglones: Array.from({ length: 3 }, (_, i) => ({ description: `Sesión de fotos ñandú “${i}”`, qty: 1, unitPriceMinor: 500000, lineTotalMinor: 500000 })),
    totalMinor: 1500050,
    cae: "76432109876543",
    caeVto: "20261104",
    asociado: null,
    esPrueba: true,
    qrPng: new Uint8Array(await QRCode.toBuffer(url, { margin: 1, width: 300 })),
    logo: null,
    ...extra,
  };
}

describe("PDF del comprobante", () => {
  it("formatos", () => {
    expect(numeroComprobante(3, 42)).toBe("00003-00000042");
    expect(pesos(1500050)).toBe("$ 15.000,50");
    expect(pesos(-500)).toBe("-$ 5,00");
    expect(textoSeguro("Ñandú “ok” 漢")).toBe('Ñandú "ok" ?');
  });
  it("arma un PDF válido de una página, y pagina con muchos renglones", async () => {
    const una = await PDFDocument.load(await armarPdfComprobante(await datos()));
    expect(una.getPageCount()).toBe(1);
    expect(una.getTitle()).toBe("FACTURA C 00003-00000042");
    const muchos = await datos({ renglones: Array.from({ length: 60 }, () => ({ description: "x", qty: 1, unitPriceMinor: 1, lineTotalMinor: 1 })) });
    expect((await PDFDocument.load(await armarPdfComprobante(muchos))).getPageCount()).toBeGreaterThan(1);
  });
  it("la nota de crédito dice qué factura corrige", async () => {
    const nc = await PDFDocument.load(await armarPdfComprobante(await datos({ cbteTipo: 13, asociado: { ptoVta: 3, numero: 41 }, esPrueba: false })));
    expect(nc.getTitle()).toBe("NOTA DE CRÉDITO C 00003-00000042");
  });
});
