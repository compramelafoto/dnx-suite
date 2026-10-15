import { describe, expect, it } from "vitest";
import { DEFAULT_RETURNS_POLICY } from "./constants";
import {
  MAX_PICKUP_ADDRESS,
  MAX_RETURNS_POLICY,
  effectiveReturnsPolicy,
  parseSettingsForm,
} from "./settings-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) fd.append(k, valor);
  }
  return fd;
}

// Como lo manda la pantalla: la casilla tildada manda "on" y después su respaldo "off".
const abierta = {
  isOpen: ["on", "off"],
  pickupAddress: "San Martín 1234, Rosario",
  pickupHours: "Lunes a viernes de 10 a 18",
  pickupInstructions: "Tocá el timbre del estudio",
  returnsPolicy: "",
  notifyEmail: "tienda@ejemplo.com",
};

describe("parseSettingsForm", () => {
  it("abrir con todo completo → valores normalizados", () => {
    expect(parseSettingsForm(form(abierta))).toEqual({
      ok: true,
      values: {
        isOpen: true,
        pickupAddress: "San Martín 1234, Rosario",
        pickupHours: "Lunes a viernes de 10 a 18",
        pickupInstructions: "Tocá el timbre del estudio",
        returnsPolicy: null,
        notifyEmail: "tienda@ejemplo.com",
      },
    });
  });

  it("abrir sin dirección de retiro → error", () => {
    const r = parseSettingsForm(form({ ...abierta, pickupAddress: "   " }));
    expect(r).toEqual({ ok: false, error: "Para abrir la tienda falta la dirección de retiro." });
  });

  it("abrir sin email de avisos → error", () => {
    const r = parseSettingsForm(form({ ...abierta, notifyEmail: "" }));
    expect(r).toEqual({ ok: false, error: "Para abrir la tienda falta un email válido para los avisos de pedidos." });
  });

  it("abrir con un email inválido → error", () => {
    const r = parseSettingsForm(form({ ...abierta, notifyEmail: "no-es-un-email" }));
    expect(r.ok).toBe(false);
  });

  it("cerrada se puede guardar a medio completar, sin dirección ni email", () => {
    const r = parseSettingsForm(form({ isOpen: "off", pickupAddress: "", notifyEmail: "" }));
    expect(r).toEqual({
      ok: true,
      values: {
        isOpen: false,
        pickupAddress: null,
        pickupHours: null,
        pickupInstructions: null,
        returnsPolicy: null,
        notifyEmail: null,
      },
    });
  });

  it("cerrada con un email escrito mal → error igual (no se guarda basura)", () => {
    const r = parseSettingsForm(form({ isOpen: "off", notifyEmail: "mal@" }));
    expect(r).toEqual({ ok: false, error: "El email de avisos no es válido." });
  });

  it("el email se guarda en minúsculas", () => {
    const r = parseSettingsForm(form({ ...abierta, notifyEmail: "  Tienda@Ejemplo.COM " }));
    expect(r.ok && r.values.notifyEmail).toBe("tienda@ejemplo.com");
  });

  it("política vacía → null; escrita → se conserva", () => {
    const vacia = parseSettingsForm(form({ ...abierta, returnsPolicy: "  " }));
    expect(vacia.ok && vacia.values.returnsPolicy).toBeNull();
    const propia = parseSettingsForm(form({ ...abierta, returnsPolicy: "Sin cambios en ropa interior." }));
    expect(propia.ok && propia.values.returnsPolicy).toBe("Sin cambios en ropa interior.");
  });

  it("textos demasiado largos → error", () => {
    expect(parseSettingsForm(form({ ...abierta, pickupAddress: "x".repeat(MAX_PICKUP_ADDRESS + 1) })).ok).toBe(false);
    expect(parseSettingsForm(form({ ...abierta, returnsPolicy: "x".repeat(MAX_RETURNS_POLICY + 1) })).ok).toBe(false);
  });
});

describe("effectiveReturnsPolicy", () => {
  it("sin política propia, la página pública muestra la de siempre", () => {
    expect(effectiveReturnsPolicy(null)).toBe(DEFAULT_RETURNS_POLICY);
    expect(effectiveReturnsPolicy("   ")).toBe(DEFAULT_RETURNS_POLICY);
  });

  it("con política propia, muestra la propia", () => {
    expect(effectiveReturnsPolicy("La nuestra.")).toBe("La nuestra.");
  });
});
