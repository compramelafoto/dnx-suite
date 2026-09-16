import { describe, expect, test } from "vitest";
import {
  SUBILAFOTO_PRODUCTO,
  SUBILAFOTO_PRODUCT_KEY,
  perfilDesdeReferencia,
  referenciaDelVendedor,
} from "./constantes";

describe("la referencia del vendedor en la capa financiera", () => {
  test("lleva prefijo de producto y vuelve entera", () => {
    const ref = referenciaDelVendedor("perfil-123");
    expect(ref).toContain(SUBILAFOTO_PRODUCT_KEY);
    expect(perfilDesdeReferencia(ref)).toBe("perfil-123");
  });

  test("una referencia de otro producto no se lee como propia", () => {
    // `organizationRef` es único en toda la suite. Sin el prefijo, un vendedor de
    // SubiLaFoto podría chocar con un workspace de FotoOffice con el mismo id.
    expect(perfilDesdeReferencia("fotoffice-workspace:123")).toBeNull();
    expect(perfilDesdeReferencia("lab:123")).toBeNull();
    expect(perfilDesdeReferencia("")).toBeNull();
  });

  test("una referencia sin identificador no vale", () => {
    expect(perfilDesdeReferencia("subilafoto-seller:")).toBeNull();
    expect(perfilDesdeReferencia("subilafoto-seller:   ")).toBeNull();
  });
});

describe("qué capacidades se le dan a la cuenta conectada", () => {
  test("cobrador, no receptor de reparto", () => {
    // Con marketplace_fee el vendedor cobra y la plataforma retiene. No hay
    // reparto 1:N todavía, así que marcarlo como receptor sería mentir sobre
    // lo que esa cuenta puede hacer.
    expect(SUBILAFOTO_PRODUCTO.capabilities).toEqual(["COLLECTOR"]);
    expect(SUBILAFOTO_PRODUCTO.capabilities).not.toContain("SPLIT_RECEIVER");
  });

  test("se identifica con su propia clave de producto", () => {
    expect(SUBILAFOTO_PRODUCTO.key).toBe("subilafoto");
    expect(SUBILAFOTO_PRODUCTO.nombre).toBe("SubiLaFoto");
  });
});
