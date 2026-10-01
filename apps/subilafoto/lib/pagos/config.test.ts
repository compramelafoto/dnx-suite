import { describe, expect, test } from "vitest";
import { leerConfigDePagos } from "./config";

const COMPLETO = {
  SUBILAFOTO_MP_CLIENT_ID: "cid",
  SUBILAFOTO_MP_CLIENT_SECRET: "secreto",
  SUBILAFOTO_MP_REDIRECT_URI: "https://subilafoto.com/api/pagos/conectar/retorno",
};

describe("la configuración de Mercado Pago", () => {
  test("con las tres variables, queda configurada", () => {
    const c = leerConfigDePagos(COMPLETO);
    expect(c.configured).toBe(true);
    expect(c.missing).toEqual([]);
  });

  test("dice exactamente cuál falta, para poder decírselo al operador", () => {
    const sinSecreto = { ...COMPLETO, SUBILAFOTO_MP_CLIENT_SECRET: undefined };
    const c = leerConfigDePagos(sinSecreto);
    expect(c.configured).toBe(false);
    expect(c.missing).toEqual(["SUBILAFOTO_MP_CLIENT_SECRET"]);
  });

  test("sin nada, las nombra a las tres", () => {
    expect(leerConfigDePagos({}).missing).toHaveLength(3);
  });

  test("una variable con espacios es una variable vacía", () => {
    // Pasa al pegar en el panel de Vercel. Sin esto, la configuración parece
    // completa y el intercambio del código falla con un error que no dice nada.
    expect(leerConfigDePagos({ ...COMPLETO, SUBILAFOTO_MP_CLIENT_ID: "   " }).configured).toBe(
      false,
    );
  });

  test("recorta los espacios de los valores buenos", () => {
    expect(leerConfigDePagos({ ...COMPLETO, SUBILAFOTO_MP_CLIENT_ID: "  cid  " }).clientId).toBe(
      "cid",
    );
  });
});
