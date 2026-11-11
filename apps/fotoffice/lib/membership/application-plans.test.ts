import { describe, expect, it } from "vitest";
import {
  applyPlanToSimpleForm,
  choosePlan,
  defaultPlanId,
  includedCreditsLabel,
  offeredPlans,
  parseBoxAddress,
  portalAccessText,
  type ApplicationPlanCandidate,
} from "./application-plans";
import { withSimpleFormDefaults } from "./enrollment";
import { parseApplication } from "./application";

function categoria(over: Partial<ApplicationPlanCandidate> & { id: string }): ApplicationPlanCandidate {
  return {
    name: over.id,
    description: null,
    order: 0,
    isActive: true,
    offeredInOnlineApplication: false,
    selfRenew: false,
    includesMonthlyBox: false,
    bookingCreditsPerPayment: 0,
    bookingCreditLabel: null,
    ...over,
  };
}

// El VIP de la barbería: la única categoría de las altas, con cortes y renovación sin deuda.
const VIP = categoria({
  id: "vip",
  name: "VIP",
  selfRenew: true,
  bookingCreditsPerPayment: 4,
  bookingCreditLabel: "cortes",
});
const CON_BOX = categoria({ id: "box", name: "Club con BOX", order: 2, offeredInOnlineApplication: true, includesMonthlyBox: true });
const SIN_BOX = categoria({ id: "online", name: "Club online", order: 1, offeredInOnlineApplication: true });

const DATOS = { firstName: "Ana", lastName: "Pérez", email: "ana@test.com", phone: "341 555 0000" };
const DOMICILIO = { address: "San Martín 1234", city: "Rosario", province: "Santa Fe", postalCode: "2000" };

describe("qué planes se ofrecen en el alta", () => {
  it("una sola categoría de altas, sin otras marcadas: ese único plan, como hoy", () => {
    const planes = offeredPlans([VIP, categoria({ id: "general" })], "vip");
    expect(planes.map((p) => p.id)).toEqual(["vip"]);
  });

  it("suma las marcadas, en el orden de la categoría", () => {
    const planes = offeredPlans([CON_BOX, VIP, SIN_BOX], "vip");
    expect(planes.map((p) => p.id)).toEqual(["vip", "online", "box"]);
  });

  it("las inactivas no se ofrecen, aunque estén marcadas o sean la de las altas", () => {
    const planes = offeredPlans(
      [{ ...VIP, isActive: false }, { ...SIN_BOX, isActive: false }, CON_BOX],
      "vip",
    );
    expect(planes.map((p) => p.id)).toEqual(["box"]);
  });

  it("sin categoría de altas ni marcadas, no hay planes", () => {
    expect(offeredPlans([categoria({ id: "general" })], null)).toEqual([]);
  });

  it("ante un empate de orden, por nombre", () => {
    const planes = offeredPlans(
      [
        categoria({ id: "b", name: "Plata", offeredInOnlineApplication: true }),
        categoria({ id: "a", name: "Oro", offeredInOnlineApplication: true }),
      ],
      null,
    );
    expect(planes.map((p) => p.name)).toEqual(["Oro", "Plata"]);
  });
});

describe("plan marcado al entrar", () => {
  const planes = offeredPlans([VIP, SIN_BOX, CON_BOX], "vip");

  it("respeta ?plan= si se ofrece", () => {
    expect(defaultPlanId(planes, "vip", "box")).toBe("box");
  });

  it("un ?plan= que no se ofrece se ignora", () => {
    expect(defaultPlanId(planes, "vip", "otra-institucion")).toBe("vip");
  });

  it("sin ?plan=, la categoría de las altas; sin ella, el primero", () => {
    expect(defaultPlanId(planes, "vip", undefined)).toBe("vip");
    expect(defaultPlanId(planes, null, undefined)).toBe("vip");
    expect(defaultPlanId([], null, "box")).toBeNull();
  });
});

describe("el plan que manda el formulario", () => {
  const planes = offeredPlans([VIP, SIN_BOX, CON_BOX], "vip");

  it("vale sólo si está entre los ofrecidos", () => {
    expect(choosePlan(planes, "box")).toEqual({ ok: true, plan: expect.objectContaining({ id: "box" }) });
    expect(choosePlan(planes, "inventado")).toEqual({ ok: false, error: expect.stringContaining("no está disponible") });
  });

  it("con varios planes hay que elegir uno", () => {
    expect(choosePlan(planes, "")).toEqual({ ok: false, error: "Elegí un plan." });
  });

  it("con un solo plan no hace falta mandarlo (un formulario viejo sigue andando)", () => {
    const uno = offeredPlans([VIP], "vip");
    expect(choosePlan(uno, undefined)).toEqual({ ok: true, plan: expect.objectContaining({ id: "vip" }) });
  });

  it("sin planes, el alta entra sin categoría, como siempre", () => {
    expect(choosePlan([], "lo-que-sea")).toEqual({ ok: true, plan: null });
  });
});

describe("domicilio del BOX", () => {
  const [conBox] = offeredPlans([CON_BOX], null);
  const [sinBox] = offeredPlans([SIN_BOX], null);

  it("con BOX es obligatorio y queda como domicilio de la solicitud", () => {
    const r = applyPlanToSimpleForm({ ...DATOS, ...DOMICILIO, planId: "box" }, conBox!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = parseApplication(withSimpleFormDefaults(r.raw));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.noticeAddress).toBe("San Martín 1234");
    expect(parsed.data.city).toBe("Rosario");
    expect(parsed.data.province).toBe("Santa Fe");
    expect(parsed.data.postalCode).toBe("2000");
  });

  it("con BOX, cada dato que falta se nombra", () => {
    expect(applyPlanToSimpleForm({ ...DATOS, ...DOMICILIO, address: "  " }, conBox!)).toEqual({
      ok: false,
      error: "Falta la calle y el número.",
    });
    expect(applyPlanToSimpleForm({ ...DATOS, ...DOMICILIO, city: "" }, conBox!)).toEqual({
      ok: false,
      error: "Falta la localidad.",
    });
    expect(applyPlanToSimpleForm({ ...DATOS, ...DOMICILIO, province: "" }, conBox!)).toEqual({
      ok: false,
      error: "Falta la provincia.",
    });
    const sinCp: Record<string, string> = { ...DATOS, ...DOMICILIO };
    delete sinCp.postalCode;
    expect(applyPlanToSimpleForm(sinCp, conBox!)).toEqual({
      ok: false,
      error: "Falta el código postal.",
    });
  });

  it("sin BOX no se pide, y lo que llegue se descarta: el alta queda como siempre", () => {
    const r = applyPlanToSimpleForm({ ...DATOS, ...DOMICILIO, planId: "online" }, sinBox!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.raw).toEqual(DATOS);
    const parsed = parseApplication(withSimpleFormDefaults(r.raw));
    expect(parsed.ok && parsed.data.noticeAddress).toMatch(/No corresponde/);
    expect(parsed.ok && parsed.data.city).toBeNull();
  });

  it("sin plan (institución sin categorías ofrecidas), igual que hoy", () => {
    const r = applyPlanToSimpleForm({ ...DATOS }, null);
    expect(r).toEqual({ ok: true, raw: DATOS });
  });

  it("parseBoxAddress recorta espacios", () => {
    expect(parseBoxAddress({ address: " Mitre 50 ", city: " Funes", province: "Santa Fe ", postalCode: " 2132 " })).toEqual({
      ok: true,
      data: { address: "Mitre 50", city: "Funes", province: "Santa Fe", postalCode: "2132" },
    });
  });
});

describe("textos del portal según el plan", () => {
  const [vip] = offeredPlans([VIP], "vip");

  it("el VIP de la barbería sigue diciendo lo de siempre", () => {
    expect(portalAccessText(vip!)).toBe("el acceso a tu portal, donde ves tus cortes y renovás");
  });

  it("sin turnos incluidos no se mencionan turnos", () => {
    const [sinTurnos] = offeredPlans([CON_BOX], null);
    expect(includedCreditsLabel(sinTurnos!)).toBeNull();
    expect(portalAccessText(sinTurnos!)).toBe("el acceso a tu portal");
  });

  it("con turnos sin nombre propio, se llaman turnos", () => {
    const plan = { bookingCreditsPerPayment: 2, bookingCreditLabel: "  ", selfRenew: false };
    expect(portalAccessText(plan)).toBe("el acceso a tu portal, donde ves tus turnos");
  });

  it("sin plan, sólo el acceso", () => {
    expect(portalAccessText(null)).toBe("el acceso a tu portal");
  });
});
