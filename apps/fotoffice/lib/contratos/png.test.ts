import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { FIRMA_MAX_BYTES } from "./constantes";
import { bytesDeDataUrlPng, ERROR_FIRMA_FORMATO, ERROR_FIRMA_PESADA, ERROR_FIRMA_VACIA, revisarPngFirma } from "./png";
import { aDataUrl, crearPng, NEGRO, pngConTrazo, pngVacio, TRANSPARENTE } from "./png-prueba";

describe("bytesDeDataUrlPng", () => {
  it("acepta un data URL de PNG y devuelve los bytes", () => {
    const png = pngConTrazo();
    expect(Buffer.from(bytesDeDataUrlPng(aDataUrl(png))!).equals(png)).toBe(true);
  });
  it("rechaza lo que no tiene esa forma", () => {
    for (const malo of [null, 5, "", "hola", "data:image/jpeg;base64,AAAA", "data:image/png;base64,", "data:image/png;base64,%%%%", "data:text/html;base64,AAAA", `data:image/png;base64,${"A".repeat(400_000)}`]) {
      expect(bytesDeDataUrlPng(malo), String(malo).slice(0, 30)).toBeNull();
    }
  });
});

describe("revisarPngFirma", () => {
  it("acepta una firma con trazo", () => {
    const r = revisarPngFirma(pngConTrazo());
    expect(r).toMatchObject({ ok: true, ancho: 600, alto: 200 });
    expect(r.ok && r.pixeles).toBeGreaterThan(150);
  });

  it("rechaza el lienzo vacío (transparente) y el blanco", () => {
    expect(revisarPngFirma(pngVacio())).toEqual({ ok: false, error: ERROR_FIRMA_VACIA });
    const blanco = crearPng(600, 200, () => [255, 255, 255, 255]);
    expect(revisarPngFirma(blanco)).toEqual({ ok: false, error: ERROR_FIRMA_VACIA });
  });

  it("rechaza un punto suelto y un lienzo pintado entero", () => {
    const punto = crearPng(600, 200, (x, y) => (x > 100 && x < 108 && y > 100 && y < 108 ? NEGRO : TRANSPARENTE));
    expect(revisarPngFirma(punto)).toEqual({ ok: false, error: ERROR_FIRMA_VACIA });
    const lleno = crearPng(600, 200, () => NEGRO);
    expect(revisarPngFirma(lleno)).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
  });

  it("rechaza lo que no es PNG, el truncado y los formatos que no genera un canvas", () => {
    const png = pngConTrazo();
    expect(revisarPngFirma(Buffer.from("GIF89a" + "x".repeat(100)))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
    expect(revisarPngFirma(png.subarray(0, 40))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
    expect(revisarPngFirma(png.subarray(0, png.length - 20))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
    expect(revisarPngFirma(crearPng(600, 200, () => NEGRO, { color: 2 }))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
    expect(revisarPngFirma(crearPng(600, 200, () => NEGRO, { sinIend: true }))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
  });

  it("rechaza dimensiones fuera de rango y datos que no coinciden con el encabezado", () => {
    expect(revisarPngFirma(pngConTrazo(20, 20))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
    expect(revisarPngFirma(pngConTrazo(5000, 100))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
    // Encabezado de 600×200 pero con datos de más: la descompresión topa en el tamaño esperado.
    const buena = pngConTrazo();
    const ihdrFalso = Buffer.from(buena);
    ihdrFalso.writeUInt32BE(100, 16 + 4); // alto = 100: sobran datos
    expect(revisarPngFirma(ihdrFalso)).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
  });

  it("rechaza lo que pesa más de 200 KB", () => {
    const ruido = Buffer.alloc(FIRMA_MAX_BYTES + 1, 7);
    expect(revisarPngFirma(ruido)).toEqual({ ok: false, error: ERROR_FIRMA_PESADA });
  });

  it("una bomba de descompresión no se infla (tope de salida)", () => {
    const base = pngConTrazo(600, 200);
    // Mismo encabezado, pero un IDAT que al descomprimir da muchísimo más de lo esperado.
    const bomba = deflateSync(Buffer.alloc(50_000_000, 0));
    expect(bomba.length).toBeLessThan(FIRMA_MAX_BYTES);
    const partes = [base.subarray(0, 33)];
    const idat = Buffer.concat([Buffer.alloc(4), Buffer.from("IDAT"), bomba, Buffer.alloc(4)]);
    idat.writeUInt32BE(bomba.length, 0);
    const iend = Buffer.concat([Buffer.alloc(4), Buffer.from("IEND"), Buffer.alloc(4)]);
    expect(revisarPngFirma(Buffer.concat([...partes, idat, iend]))).toEqual({ ok: false, error: ERROR_FIRMA_FORMATO });
  });
});
