import { describe, expect, test } from "vitest";
import { ordenDesdeReferencia, referenciaDeOrden } from "./referencia";

describe("la referencia de la orden", () => {
  test("lleva el prefijo del producto y vuelve entera", () => {
    const r = referenciaDeOrden("cmtz123abc");
    expect(r).toBe("subilafoto-orden-cmtz123abc");
    expect(ordenDesdeReferencia(r)).toBe("cmtz123abc");
  });

  test("una referencia de otro producto no se lee como propia", () => {
    // Es lo que permite atribuir un aviso de pago al producto correcto.
    expect(ordenDesdeReferencia("clickaton-registration-abc")).toBeNull();
    expect(ordenDesdeReferencia("fotoffice-cuota-abc")).toBeNull();
    expect(ordenDesdeReferencia(null)).toBeNull();
    expect(ordenDesdeReferencia("")).toBeNull();
  });

  test("no deja pasar nada que no sea un identificador opaco", () => {
    /*
      La referencia viaja a un tercero y queda en sus reportes. Las guardas del
      paquete pierden fuerza con el prefijo puesto —"Ana Gonzalez" deja de
      parecer un nombre cuando la cadena es "subilafoto-orden-Ana Gonzalez"—,
      así que el id se valida acá antes de armar nada.
    */
    for (const malo of [
      "ana@ejemplo.com",
      "Ana Gonzalez",
      "11 2345 6789",
      "orden con espacios",
      "corto",
      "",
      "tiene/barra",
    ]) {
      expect(() => referenciaDeOrden(malo), malo).toThrow();
    }
  });

  test("un cuid, que es lo que usa la base, pasa sin problema", () => {
    expect(referenciaDeOrden("cmtzuj5rr0001jq046f51k9st")).toBe(
      "subilafoto-orden-cmtzuj5rr0001jq046f51k9st",
    );
  });

  test("una referencia sin identificador no vale", () => {
    expect(ordenDesdeReferencia("subilafoto-orden-")).toBeNull();
    expect(() => referenciaDeOrden("")).toThrow();
  });
});
