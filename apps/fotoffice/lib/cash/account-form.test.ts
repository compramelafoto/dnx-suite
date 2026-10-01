import { describe, expect, it } from "vitest";
import { parseAccountForm } from "./account-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("parseAccountForm", () => {
  it("una cuenta con nombre y tipo alcanza", () => {
    const r = parseAccountForm(form({ name: "Efectivo Sucursal Centro", kind: "EFECTIVO" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.name).toBe("Efectivo Sucursal Centro");
    expect(r.values.kind).toBe("EFECTIVO");
  });

  it("por omisión es efectivo: es la caja que la gente tiene en la cabeza", () => {
    const r = parseAccountForm(form({ name: "Caja chica" }));
    expect(r.ok).toBe(true);
    expect(r.ok && r.values.kind).toBe("EFECTIVO");
  });

  it("un nombre de menos de dos letras se rechaza", () => {
    expect(parseAccountForm(form({ name: " x " }))).toEqual({
      ok: false,
      error: "Poné un nombre para la cuenta.",
    });
  });

  it("un tipo inventado se rechaza en vez de guardarse", () => {
    expect(parseAccountForm(form({ name: "Cripto", kind: "BITCOIN" }))).toEqual({
      ok: false,
      error: "Esa cuenta tiene que ser de efectivo o digital.",
    });
  });

  it("las casillas ausentes son false, no undefined", () => {
    const r = parseAccountForm(form({ name: "Banco", kind: "DIGITAL" }));
    expect(r.ok && r.values.isDefault).toBe(false);
    expect(r.ok && r.values.isActive).toBe(true);
  });
});
