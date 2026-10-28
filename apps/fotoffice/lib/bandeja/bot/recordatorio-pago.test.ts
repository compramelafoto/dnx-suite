import { describe, expect, it } from "vitest";
import { MARCA_RECORDATORIO, textoDelRecordatorio, tocaRecordar } from "./recordatorio-pago";

const AHORA = new Date("2026-10-29T15:00:00Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

describe("tocaRecordar", () => {
  it("sólo al final de la ventana de 24 h (la última vez que se puede escribir sin plantilla)", () => {
    expect(tocaRecordar(hace(19), AHORA)).toBe(false);
    expect(tocaRecordar(hace(20), AHORA)).toBe(true);
    expect(tocaRecordar(hace(23), AHORA)).toBe(true);
    expect(tocaRecordar(hace(23.6), AHORA)).toBe(false);
    expect(tocaRecordar(null, AHORA)).toBe(false);
  });
});

describe("textoDelRecordatorio", () => {
  it("pedido del catálogo: el número, lo que falta pagar y el enlace", () => {
    const t = textoDelRecordatorio("Daniel Cuart", { tipo: "PEDIDO", numero: "2026-0042", aPagar: 43000, url: "https://fotoffice.com/p/tok", creado: AHORA });
    expect(t).toContain("¡Hola Daniel!");
    expect(t).toContain("2026-0042");
    expect(t).toContain("43.000");
    expect(t).toContain("https://fotoffice.com/p/tok");
  });

  it("copias: ofrece mandar el enlace de nuevo (el de Mercado Pago no se guarda)", () => {
    const t = textoDelRecordatorio(null, { tipo: "IMPRESION", numero: 12, aPagar: 5000, creado: AHORA });
    expect(t.startsWith("¡Hola!")).toBe(true);
    expect(t).toContain("N° 12");
    expect(t).toContain("5.000");
    expect(t).toContain("enlace");
  });

  it("la marca del chat dice qué pedido se recordó", () => {
    expect(MARCA_RECORDATORIO).toBe("Recordatorio de pago enviado");
  });
});
