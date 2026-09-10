import { describe, expect, it } from "vitest";
import { parsePrizeForm } from "./prize-form";

const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

const completo = {
  order: "1",
  title: "Mochila para equipo fotográfico",
  description: "Modelo 30 litros.",
  conditions: "Se retira en la sede, con carnet.",
  pickupInstructions: "Martes y jueves de 18 a 20.",
  pickupDeadline: "2026-10-31",
  estimatedValue: "120000",
  partnerId: "pt-1",
  partnerName: "Casa de Fotografía Norte",
};

describe("el formulario del premio", () => {
  it("acepta un premio completo", () => {
    const r = parsePrizeForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.title).toBe("Mochila para equipo fotográfico");
    expect(r.values.order).toBe(1);
    expect(r.values.partnerId).toBe("pt-1");
    expect(r.values.partnerNameSnapshot).toBe("Casa de Fotografía Norte");
  });

  it("exige título", () => {
    expect(parsePrizeForm(form({ ...completo, title: "" })).ok).toBe(false);
  });

  it("el orden tiene que ser un entero positivo: entra en la cuenta del ganador", () => {
    expect(parsePrizeForm(form({ ...completo, order: "0" })).ok).toBe(false);
    expect(parsePrizeForm(form({ ...completo, order: "-1" })).ok).toBe(false);
    expect(parsePrizeForm(form({ ...completo, order: "1.5" })).ok).toBe(false);
  });

  it("el valor estimado se guarda en centavos", () => {
    const r = parsePrizeForm(form({ ...completo, estimatedValue: "120000" }));
    expect(r.ok && r.values.estimatedValueMinor).toBe(12_000_000);
  });

  it("acepta el valor escrito como se escribe en Argentina", () => {
    const r = parsePrizeForm(form({ ...completo, estimatedValue: "120.000,50" }));
    expect(r.ok && r.values.estimatedValueMinor).toBe(12_000_050);
  });

  it("el valor estimado es opcional", () => {
    const r = parsePrizeForm(form({ ...completo, estimatedValue: "" }));
    expect(r.ok && r.values.estimatedValueMinor).toBe(null);
  });

  it("un premio sin aliado es válido: la institución también pone premios propios", () => {
    const r = parsePrizeForm(form({ ...completo, partnerId: "", partnerName: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.partnerId).toBe(null);
      expect(r.values.partnerNameSnapshot).toBe(null);
    }
  });

  it("un aliado sin nombre no se acepta: quedaría un premio de nadie", () => {
    expect(parsePrizeForm(form({ ...completo, partnerName: "" })).ok).toBe(false);
  });

  it("una marca sin ficha en Partners se puede nombrar igual", () => {
    const r = parsePrizeForm(form({ ...completo, partnerId: "", partnerName: "Óptica del Centro" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.partnerId).toBe(null);
      expect(r.values.partnerNameSnapshot).toBe("Óptica del Centro");
    }
  });

  it("el plazo de retiro es opcional y se lee al final del día", () => {
    const r = parsePrizeForm(form(completo));
    expect(r.ok).toBe(true);
    // 31/10 a las 23:59:59.999 en Buenos Aires (UTC−3).
    if (r.ok) expect(r.values.pickupDeadline?.toISOString()).toBe("2026-11-01T02:59:59.999Z");
  });

  it("sin plazo de retiro, queda en nulo", () => {
    const r = parsePrizeForm(form({ ...completo, pickupDeadline: "" }));
    expect(r.ok && r.values.pickupDeadline).toBe(null);
  });
});

describe("los datos del local donde se retira", () => {
  const conLocal = () =>
    form({
      ...completo,
      partnerEmail: "aliado@ejemplo.com",
      partnerAddress: "San Martín 1234, Rosario",
      partnerPhone: "341 555-0198",
      partnerHours: "Lunes a viernes de 9 a 18",
    });

  it("se guardan junto al premio, como instantáneas", () => {
    const r = parsePrizeForm(conLocal());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.partnerEmailSnapshot).toBe("aliado@ejemplo.com");
    expect(r.values.partnerAddressSnapshot).toBe("San Martín 1234, Rosario");
    expect(r.values.partnerPhoneSnapshot).toBe("341 555-0198");
    expect(r.values.partnerHoursSnapshot).toBe("Lunes a viernes de 9 a 18");
  });

  it("todos son opcionales: hay premios que pone la propia institución", () => {
    const r = parsePrizeForm(form(completo));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.partnerEmailSnapshot).toBe(null);
  });

  it("un correo mal escrito se rechaza: un aviso que nunca llega es peor que ninguno", () => {
    const r = parsePrizeForm(form({ ...completo, partnerEmail: "aliado.ejemplo.com" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/correo/i);
  });
});
