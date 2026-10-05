import { describe, expect, it } from "vitest";
import {
  MAX_HANDLING_NOTE,
  bpsToPercentText,
  minorToEditableText,
  parsePercentToBps,
  parseShippingArsToMinor,
  parseShippingSettingsForm,
  settingsAfterCorreoDisconnect,
} from "./settings-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) fd.append(k, valor);
  }
  return fd;
}

// Como lo manda la pantalla: casilla tildada = "on" y después su respaldo "off".
const ON = ["on", "off"];
const OFF = "off";

const base = {
  pickupEnabled: ON,
  homeDeliveryEnabled: ON,
  branchDeliveryEnabled: OFF,
  source: "TABLE",
  tableAsFallback: ON,
  originPostalCode: " S2000ABC ",
  surchargeKind: "NONE",
  surchargeValue: "",
  packagingGrams: "200",
  defaultUnitGrams: "500",
  boxLengthCm: "30",
  boxWidthCm: "20",
  boxHeightCm: "10",
  handlingNote: "  Despachamos en 48 h hábiles ",
};

const sinCorreo = { correoActive: false, previous: null };
const conCorreo = { correoActive: true, previous: null };

describe("parseShippingSettingsForm", () => {
  it("todo completo → valores normalizados", () => {
    expect(parseShippingSettingsForm(form(base), sinCorreo)).toEqual({
      ok: true,
      values: {
        pickupEnabled: true,
        homeDeliveryEnabled: true,
        branchDeliveryEnabled: false,
        source: "TABLE",
        tableAsFallback: true,
        originPostalCode: "2000",
        surchargeKind: "NONE",
        surchargeValue: 0,
        packagingGrams: 200,
        defaultUnitGrams: 500,
        boxLengthCm: 30,
        boxWidthCm: 20,
        boxHeightCm: 10,
        handlingNote: "Despachamos en 48 h hábiles",
      },
    });
  });

  it("sin ningún método activo → error", () => {
    const r = parseShippingSettingsForm(
      form({ ...base, pickupEnabled: OFF, homeDeliveryEnabled: OFF, branchDeliveryEnabled: OFF }),
      sinCorreo,
    );
    expect(r).toEqual({ ok: false, error: "Dejá activa al menos una forma de entrega: retiro, domicilio o sucursal." });
  });

  it("sólo retiro, sin CP de origen → se guarda", () => {
    const r = parseShippingSettingsForm(form({ ...base, homeDeliveryEnabled: OFF, originPostalCode: "" }), sinCorreo);
    expect(r.ok && r.values.originPostalCode).toBe(null);
  });

  it("domicilio sin CP de origen → error", () => {
    const r = parseShippingSettingsForm(form({ ...base, originPostalCode: "" }), sinCorreo);
    expect(r).toEqual({ ok: false, error: "Para enviar a domicilio o a sucursal falta el código postal de origen." });
  });

  it("CP de origen inválido → error aunque no se use", () => {
    const r = parseShippingSettingsForm(form({ ...base, homeDeliveryEnabled: OFF, originPostalCode: "abc" }), sinCorreo);
    expect(r).toEqual({ ok: false, error: "El código postal de origen no es válido (son 4 números, por ejemplo 2000)." });
  });

  it("sucursal con la tabla como fuente → error", () => {
    const r = parseShippingSettingsForm(form({ ...base, branchDeliveryEnabled: ON }), conCorreo);
    expect(r).toEqual({ ok: false, error: "El envío a sucursal sólo funciona con Correo Argentino como fuente." });
  });

  it("sucursal con Correo como fuente pero sin conexión activa → error", () => {
    const r = parseShippingSettingsForm(
      form({ ...base, branchDeliveryEnabled: ON, source: "CORREO_ARGENTINO" }),
      sinCorreo,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("conectá Correo Argentino");
  });

  it("Correo como fuente sin conexión activa → error", () => {
    const r = parseShippingSettingsForm(form({ ...base, source: "CORREO_ARGENTINO" }), sinCorreo);
    expect(r.ok).toBe(false);
  });

  it("Correo conectado, con sucursal → ok", () => {
    const r = parseShippingSettingsForm(
      form({ ...base, branchDeliveryEnabled: ON, source: "CORREO_ARGENTINO" }),
      conCorreo,
    );
    expect(r.ok && r.values.source).toBe("CORREO_ARGENTINO");
    expect(r.ok && r.values.branchDeliveryEnabled).toBe(true);
  });

  it("fuente desconocida → error", () => {
    const r = parseShippingSettingsForm(form({ ...base, source: "OCA" }), conCorreo);
    expect(r.ok).toBe(false);
  });

  it("recargo en porcentaje: '10' → 1000 bps y '10,5' → 1050", () => {
    const a = parseShippingSettingsForm(form({ ...base, surchargeKind: "PERCENT", surchargeValue: "10" }), sinCorreo);
    expect(a.ok && a.values.surchargeValue).toBe(1000);
    const b = parseShippingSettingsForm(form({ ...base, surchargeKind: "PERCENT", surchargeValue: "10,5" }), sinCorreo);
    expect(b.ok && b.values.surchargeValue).toBe(1050);
  });

  it("recargo en porcentaje inválido o mayor a 100 → error", () => {
    for (const v of ["", "abc", "-5", "101", "10,555"]) {
      const r = parseShippingSettingsForm(form({ ...base, surchargeKind: "PERCENT", surchargeValue: v }), sinCorreo);
      expect(r.ok, v).toBe(false);
    }
  });

  it("recargo fijo en pesos → centavos", () => {
    const r = parseShippingSettingsForm(form({ ...base, surchargeKind: "FIXED", surchargeValue: "$ 1.500,50" }), sinCorreo);
    expect(r.ok && r.values.surchargeValue).toBe(150050);
  });

  it("recargo fijo vacío → error", () => {
    const r = parseShippingSettingsForm(form({ ...base, surchargeKind: "FIXED", surchargeValue: "" }), sinCorreo);
    expect(r.ok).toBe(false);
  });

  it("sin recargo ignora el valor escrito", () => {
    const r = parseShippingSettingsForm(form({ ...base, surchargeKind: "NONE", surchargeValue: "50" }), sinCorreo);
    expect(r.ok && r.values.surchargeValue).toBe(0);
  });

  it("peso por unidad tiene que ser al menos 1", () => {
    const r = parseShippingSettingsForm(form({ ...base, defaultUnitGrams: "0" }), sinCorreo);
    expect(r.ok).toBe(false);
  });

  it("embalaje puede ser 0 pero no negativo ni con decimales", () => {
    expect(parseShippingSettingsForm(form({ ...base, packagingGrams: "0" }), sinCorreo).ok).toBe(true);
    expect(parseShippingSettingsForm(form({ ...base, packagingGrams: "-1" }), sinCorreo).ok).toBe(false);
    expect(parseShippingSettingsForm(form({ ...base, packagingGrams: "1,5" }), sinCorreo).ok).toBe(false);
  });

  it("los lados de la caja van de 1 a 150 cm", () => {
    expect(parseShippingSettingsForm(form({ ...base, boxLengthCm: "150" }), sinCorreo).ok).toBe(true);
    expect(parseShippingSettingsForm(form({ ...base, boxLengthCm: "151" }), sinCorreo).ok).toBe(false);
    expect(parseShippingSettingsForm(form({ ...base, boxWidthCm: "0" }), sinCorreo).ok).toBe(false);
    expect(parseShippingSettingsForm(form({ ...base, boxHeightCm: "" }), sinCorreo).ok).toBe(false);
  });

  it("aviso vacío → null; más largo que el máximo → error", () => {
    const a = parseShippingSettingsForm(form({ ...base, handlingNote: "  " }), sinCorreo);
    expect(a.ok && a.values.handlingNote).toBe(null);
    const b = parseShippingSettingsForm(form({ ...base, handlingNote: "x".repeat(MAX_HANDLING_NOTE + 1) }), sinCorreo);
    expect(b.ok).toBe(false);
  });
});

describe("parsePercentToBps", () => {
  it("acepta coma o punto y hasta dos decimales", () => {
    expect(parsePercentToBps("0")).toBe(0);
    expect(parsePercentToBps("12.25")).toBe(1225);
    expect(parsePercentToBps(" 7,5 % ")).toBe(750);
    expect(parsePercentToBps("100")).toBe(10000);
  });

  it("rechaza lo que no es un porcentaje válido", () => {
    expect(parsePercentToBps("")).toBe(null);
    expect(parsePercentToBps("1,2,3")).toBe(null);
    expect(parsePercentToBps("1.234")).toBe(null);
    expect(parsePercentToBps("-1")).toBe(null);
  });
});

describe("textos para volver a editar", () => {
  it("bpsToPercentText y minorToEditableText vuelven a parsear al mismo número", () => {
    for (const bps of [0, 1000, 1050, 1225, 10000, 5]) {
      expect(parsePercentToBps(bpsToPercentText(bps))).toBe(bps);
    }
    expect(bpsToPercentText(1050)).toBe("10,5");
    expect(minorToEditableText(150050)).toBe("1500,50");
    expect(minorToEditableText(150000)).toBe("1500");
    expect(minorToEditableText(5)).toBe("0,05");
  });
});

describe("conexión de Correo vencida (NEEDS_RECONSENT)", () => {
  const vencida = { correoActive: false, previous: { source: "CORREO_ARGENTINO" as const, branchDeliveryEnabled: true } };

  it("si Correo y sucursal ya estaban guardados, se puede cambiar lo demás", () => {
    const r = parseShippingSettingsForm(
      form({ ...base, source: "CORREO_ARGENTINO", branchDeliveryEnabled: ON, handlingNote: "Nuevo aviso" }),
      vencida,
    );
    expect(r.ok && r.values.handlingNote).toBe("Nuevo aviso");
  });

  it("pasar a Correo sin conexión activa → error", () => {
    const antes = { correoActive: false, previous: { source: "TABLE" as const, branchDeliveryEnabled: false } };
    expect(parseShippingSettingsForm(form({ ...base, source: "CORREO_ARGENTINO" }), antes).ok).toBe(false);
  });

  it("prender sucursal sin conexión activa → error aunque la fuente ya fuera Correo", () => {
    const antes = { correoActive: false, previous: { source: "CORREO_ARGENTINO" as const, branchDeliveryEnabled: false } };
    const r = parseShippingSettingsForm(form({ ...base, source: "CORREO_ARGENTINO", branchDeliveryEnabled: ON }), antes);
    expect(r.ok).toBe(false);
  });
});

describe("parseShippingArsToMinor", () => {
  it("punto + 1 o 2 dígitos al final es decimal; punto + 3 dígitos es miles", () => {
    expect(parseShippingArsToMinor("3500.50")).toBe(350050);
    expect(parseShippingArsToMinor("3500.5")).toBe(350050);
    expect(parseShippingArsToMinor("3.500")).toBe(350000);
    expect(parseShippingArsToMinor("3.500.50")).toBe(350050);
    expect(parseShippingArsToMinor("$ 1.500,50")).toBe(150050);
    expect(parseShippingArsToMinor("1500")).toBe(150000);
    expect(parseShippingArsToMinor("")).toBe(null);
  });

  it("el recargo fijo lo usa", () => {
    const r = parseShippingSettingsForm(form({ ...base, surchargeKind: "FIXED", surchargeValue: "3500.50" }), sinCorreo);
    expect(r.ok && r.values.surchargeValue).toBe(350050);
  });
});

describe("settingsAfterCorreoDisconnect", () => {
  it("sin Correo ni sucursal no toca nada", () => {
    expect(
      settingsAfterCorreoDisconnect({ source: "TABLE", branchDeliveryEnabled: false, pickupEnabled: false, homeDeliveryEnabled: true }),
    ).toBe(null);
  });

  it("vuelve a la tabla y apaga sucursal; si queda todo apagado, prende el retiro", () => {
    expect(
      settingsAfterCorreoDisconnect({ source: "CORREO_ARGENTINO", branchDeliveryEnabled: true, pickupEnabled: false, homeDeliveryEnabled: false }),
    ).toEqual({ data: { source: "TABLE", branchDeliveryEnabled: false, pickupEnabled: true }, pickupForced: true });
    expect(
      settingsAfterCorreoDisconnect({ source: "CORREO_ARGENTINO", branchDeliveryEnabled: true, pickupEnabled: false, homeDeliveryEnabled: true }),
    ).toEqual({ data: { source: "TABLE", branchDeliveryEnabled: false }, pickupForced: false });
  });
});
