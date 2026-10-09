import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { MARCA, REGION_SALTO, regionTabla } from "./formato";
import { aWinAnsi, construirPdf, enmascararCorreo, fechaHoraAR, nombreArchivoPdf, navegadorResumido, type EntradaPdf } from "./pdf-documento";
import { pngConTrazo } from "./png-prueba";

async function textoDe(bytes: Uint8Array): Promise<string[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(Buffer.from(bytes), "application/pdf");
  const paginas: string[] = [];
  for (let i = 0; i < doc.countPages(); i++) paginas.push(doc.loadPage(i).toStructuredText("").asText());
  return paginas;
}

const FIRMANTE = {
  orden: 1, nombre: "Gómez, Ana", documento: "DNI 30.123.456", email: "daniel@gmail.com", nombreEscrito: "Ana Gómez",
  firmaPng: pngConTrazo() as Uint8Array, firmadoEn: new Date("2026-10-09T18:30:00.000Z"), verificadoEn: new Date("2026-10-09T18:25:00.000Z"),
  ipHash: "abcdef0123456789abcdef", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
};

function entrada(texto: string, extra: Partial<EntradaPdf> = {}): EntradaPdf {
  return {
    organizacion: "DNX Estudio", numero: "CON-0007", nombre: "Contrato de servicios", version: 2, texto,
    huellaTexto: "a".repeat(64),
    empresa: { nombre: "DNX Estudio SRL", firmaImagen: pngConTrazo() as Uint8Array },
    firmantes: [FIRMANTE], generadoEn: new Date("2026-10-09T18:31:00.000Z"), ...extra,
  };
}

describe("utilidades", () => {
  it("enmascara el correo", () => {
    expect(enmascararCorreo("daniel@gmail.com")).toBe("d***@gmail.com");
    expect(enmascararCorreo("raro")).toBe("***");
  });
  it("hora de Argentina (UTC-3)", () => {
    expect(fechaHoraAR(new Date("2026-10-09T18:30:00.000Z"))).toBe("09/10/2026 15:30");
    expect(fechaHoraAR(new Date("2026-10-10T01:30:00.000Z"))).toBe("09/10/2026 22:30");
  });
  it("nombre de archivo seguro", () => {
    expect(nombreArchivoPdf("CON/0007 \"x\"")).toBe("contrato-CON-0007-x.pdf");
    expect(nombreArchivoPdf("///")).toBe("contrato-firmado.pdf");
  });
  it("navegador recortado", () => {
    expect(navegadorResumido(null)).toBe("no disponible");
    expect(navegadorResumido("x".repeat(300)).length).toBeLessThanOrEqual(90);
  });
});

describe("WinAnsi", () => {
  it("deja pasar acentos y eñe y reemplaza lo que no se puede dibujar", async () => {
    const pdf = await PDFDocument.create();
    const f = await pdf.embedFont(StandardFonts.Helvetica);
    const m = { permitidos: new Set(f.getCharacterSet()), reemplazados: 0 };
    expect(aWinAnsi("Cláusula séptima: ¿año, niño, pingüino? € “comillas” — ok", m)).toBe("Cláusula séptima: ¿año, niño, pingüino? € “comillas” — ok");
    expect(m.reemplazados).toBe(0);
    expect(aWinAnsi("日本 ✓ 😀", m)).toBe("?? ? ?");
    expect(m.reemplazados).toBe(5 - 1);
    expect(aWinAnsi("a\tb\u0000c", m)).toBe("a bc");
  });
  it("un texto con caracteres raros igual genera el PDF y la constancia lo avisa", async () => {
    const r = await construirPdf(entrada("Hola ✓ mundo 日本"));
    expect(r.reemplazados).toBe(3);
    const t = (await textoDe(r.bytes)).join("\n");
    expect(t).toContain("reemplazaron");
  });
});

describe("construirPdf", () => {
  it("se arma, se vuelve a leer y trae número, acentos, firmas y constancia", async () => {
    const texto = ["# CONTRATO DE SERVICIOS", "", "Entre **DNX Estudio** y Ana Gómez, se acuerda la cobertura fotográfica del año.", "", "## Cláusula primera", "", "El niño pingüino."].join("\n");
    const r = await construirPdf(entrada(texto));
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(r.paginas);
    expect(r.paginas).toBe(2);
    const [p1, p2] = await textoDe(r.bytes);
    expect(p1).toContain("Contrato CON-0007");
    expect(p1).toContain("Cláusula primera");
    expect(p1).toContain("pingüino");
    expect(p1).toContain("Página 1 de 2");
    expect(p1).toContain("Ana Gómez");
    expect(p1).toContain("Firmó el 09/10/2026 15:30");
    expect(p1).toContain("Por la empresa");
    expect(p2).toContain("Hoja de constancia");
    expect(p2).toContain("a".repeat(64));
    expect(p2).toContain("d***@gmail.com");
    expect(p2).not.toContain("daniel@gmail.com");
    expect(p2).toContain("abcdef012345");
    expect(p2).not.toContain("abcdef0123456");
    expect(p2).toContain("Ley 25.506");
    expect(p2).toContain("no tiene firma digital con certificado");
    expect(p2).toContain("Página 2 de 2");
    expect(p2).toContain("Versión del texto firmada: 2");
  });

  it("el salto de página es real y una tabla larga sigue en la página siguiente con su encabezado", async () => {
    const filas = [["Ítem", "Cantidad", "Total"], ...Array.from({ length: 60 }, (_, i) => [`Servicio ${i + 1}`, "1", "$ 1.000"])];
    const texto = `Primera página${REGION_SALTO}Segunda página\n\n${regionTabla(filas)}\n\nFin`;
    const r = await construirPdf(entrada(texto));
    const t = await textoDe(r.bytes);
    expect(t[0]).toContain("Primera página");
    expect(t[0]).not.toContain("Segunda página");
    expect(t[1]).toContain("Segunda página");
    expect(t[1]).toContain("Servicio 1");
    expect(r.paginas).toBeGreaterThanOrEqual(4);
    // El encabezado se repite en la página de continuación de la tabla.
    expect(t[2]).toContain("Cantidad");
    expect(t.join("\n")).toContain("Servicio 60");
    expect(t.join("\n")).not.toContain(MARCA);
  });

  it("un texto largo se reparte en varias páginas con 'Página n de m'", async () => {
    const texto = Array.from({ length: 80 }, (_, i) => `Párrafo ${i + 1}: ${"texto del contrato ".repeat(12)}`).join("\n\n");
    const r = await construirPdf(entrada(texto));
    expect(r.paginas).toBeGreaterThan(3);
    const t = await textoDe(r.bytes);
    expect(t[1]).toContain(`Página 2 de ${r.paginas}`);
    expect(t.at(-1)).toContain("Hoja de constancia");
  });

  it("dos firmantes y una huella o palabra larguísima no rompen nada", async () => {
    const r = await construirPdf(
      entrada(`Texto ${"x".repeat(400)}`, { firmantes: [FIRMANTE, { ...FIRMANTE, orden: 2, nombre: "Pérez, Luis", firmaPng: null, ipHash: null, userAgent: null, verificadoEn: null }] }),
    );
    const t = (await textoDe(r.bytes)).join("\n");
    expect(t).toContain("Pérez, Luis");
    expect(t).toContain("la imagen de la firma no está disponible");
    expect(t).toContain("Firmante 2");
  });

  it("una imagen de firma corrupta no tira el PDF", async () => {
    const r = await construirPdf(entrada("Hola", { firmantes: [{ ...FIRMANTE, firmaPng: new Uint8Array([1, 2, 3]) }] }));
    expect(r.paginas).toBe(2);
  });
});
