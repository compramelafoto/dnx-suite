import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULO_CAJA_PEDIDOS } from "@/lib/pedidos/constantes";
import { MODULO_CAJA_PAGOS_INFORMES, MODULOS_CAJA_DE_PEDIDOS } from "./constantes";

describe("constantes de informes", () => {
  it("el módulo de pagos coincide con el de cuentas-pagar.ts", () => {
    const fuente = readFileSync(join(__dirname, "..", "pedidos", "cuentas-pagar.ts"), "utf8");
    expect(fuente).toContain(`export const MODULO_CAJA_PAGOS = "${MODULO_CAJA_PAGOS_INFORMES}"`);
  });
  it("la base devengada excluye los dos orígenes de pedidos", () => {
    expect(MODULOS_CAJA_DE_PEDIDOS).toEqual([MODULO_CAJA_PEDIDOS, "pedidos-pagos"]);
    expect(MODULO_CAJA_PEDIDOS).toBe("pedidos");
  });
});
