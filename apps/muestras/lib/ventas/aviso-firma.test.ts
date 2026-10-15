import { describe, expect, it } from "vitest";
import { firmarAviso, verificarAviso } from "./aviso-firma";

/**
 * Vector fijo: el mismo en `apps/compramelafoto/lib/dnx-payments/aviso-muestras.test.ts`. Si cambia
 * acá, el aviso de CLF deja de verificar: las dos copias tienen que firmar exactamente igual.
 */
const SECRETO = "muestras-aviso-test";
const T = 1760000000;
const CUERPO = '{"providerOrderId":"ORDTST01ABC"}';
const FIRMA = "t=1760000000,v1=34d01d20f565cec491c2f4ef14aed21211567adf8a0f910c58f2ee5799597c4e";

describe("firma del aviso de pagos", () => {
  it("vector fijo", () => {
    expect(firmarAviso(SECRETO, T, CUERPO)).toBe(FIRMA);
    expect(verificarAviso(SECRETO, FIRMA, CUERPO, T + 10)).toBe("ok");
  });
  it("vencido pasados 5 minutos (para los dos lados)", () => {
    expect(verificarAviso(SECRETO, FIRMA, CUERPO, T + 301)).toBe("vencido");
    expect(verificarAviso(SECRETO, FIRMA, CUERPO, T - 301)).toBe("vencido");
    expect(verificarAviso(SECRETO, FIRMA, CUERPO, T + 300)).toBe("ok");
  });
  it("cuerpo, firma o secreto alterados", () => {
    expect(verificarAviso(SECRETO, FIRMA, '{"providerOrderId":"ORDTST01ABD"}', T)).toBe("invalido");
    expect(verificarAviso("otro", FIRMA, CUERPO, T)).toBe("invalido");
    expect(verificarAviso(SECRETO, FIRMA.replace("v1=3", "v1=4"), CUERPO, T)).toBe("invalido");
    expect(verificarAviso(SECRETO, "t=1760000000", CUERPO, T)).toBe("invalido");
    expect(verificarAviso(SECRETO, null, CUERPO, T)).toBe("invalido");
    expect(verificarAviso(SECRETO, `t=1760000001,v1=${FIRMA.slice(-64)}`, CUERPO, T)).toBe("invalido");
  });
  it("sin secreto no se acepta nada", () => {
    expect(verificarAviso("", FIRMA, CUERPO, T)).toBe("sin-configurar");
    expect(verificarAviso(undefined, FIRMA, CUERPO, T)).toBe("sin-configurar");
  });
});
