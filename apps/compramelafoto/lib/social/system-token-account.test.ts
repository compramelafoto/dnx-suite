import { describe, expect, it } from "vitest";
import { elegirCuentaInstagram } from "./system-token-account";

describe("elegirCuentaInstagram", () => {
  it("toma la cuenta de Instagram vinculada a la página", () => {
    expect(
      elegirCuentaInstagram([
        { id: "1", name: "Compramelafoto", instagram_business_account: { id: "17841416206768989", username: "compramelafoto" } },
      ]),
    ).toEqual({ igUserId: "17841416206768989", username: "compramelafoto", pageName: "Compramelafoto" });
  });

  it("si hay varias, prefiere @compramelafoto aunque no sea la primera", () => {
    const r = elegirCuentaInstagram([
      { name: "Otra", instagram_business_account: { id: "111", username: "otra_cuenta" } },
      { name: "CLF", instagram_business_account: { id: "222", username: "CompraMeLaFoto" } },
    ]);
    expect(r?.igUserId).toBe("222");
  });

  it("ignora páginas sin Instagram y devuelve null si ninguna tiene", () => {
    expect(elegirCuentaInstagram([{ name: "Sin IG" }, { name: "Nula", instagram_business_account: null }])).toBeNull();
  });
});
