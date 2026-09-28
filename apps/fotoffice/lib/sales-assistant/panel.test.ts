import { describe, expect, it } from "vitest";
import { MIN_MINUTOS_ENTRE_CORRIDAS } from "./constants";
import {
  MIN_MINUTOS_ENTRE_REANALISIS,
  ajustesSchema,
  conexionSchema,
  embudosElegidos,
  minutosParaActualizar,
  puedeReanalizar,
  sugerenciaEditable,
} from "./panel";

describe("minutosParaActualizar", () => {
  const ahora = new Date("2026-09-28T15:00:00Z");

  it("sin corrida previa se puede actualizar ya", () => {
    expect(minutosParaActualizar(null, ahora)).toBe(0);
  });

  it("una corrida de hace 3 minutos obliga a esperar el resto, redondeado para arriba", () => {
    const hace3 = new Date(ahora.getTime() - 3 * 60_000);
    expect(minutosParaActualizar(hace3, ahora)).toBe(MIN_MINUTOS_ENTRE_CORRIDAS - 3);
    const haceCasi = new Date(ahora.getTime() - (MIN_MINUTOS_ENTRE_CORRIDAS * 60_000 - 10_000));
    expect(minutosParaActualizar(haceCasi, ahora)).toBe(1);
  });

  it("pasado el tope ya se puede", () => {
    const antes = new Date(ahora.getTime() - MIN_MINUTOS_ENTRE_CORRIDAS * 60_000);
    expect(minutosParaActualizar(antes, ahora)).toBe(0);
  });
});

describe("conexionSchema", () => {
  it("se queda con el subdominio aunque peguen la dirección entera", () => {
    const r = conexionSchema.parse({
      subdomain: " https://DNXfotografia.alboomcrm.com/#/leads ",
      username: "yo@dnx.com",
      password: "",
    });
    expect(r.subdomain).toBe("dnxfotografia");
  });

  it("rechaza un subdominio con caracteres raros", () => {
    const r = conexionSchema.safeParse({ subdomain: "dnx foto", username: "yo", password: "x" });
    expect(r.success).toBe(false);
  });

  it("exige el usuario", () => {
    const r = conexionSchema.safeParse({ subdomain: "dnx", username: "  ", password: "x" });
    expect(r.success).toBe(false);
  });
});

describe("ajustesSchema", () => {
  const base = { pipelinesIncluded: ["Embudo de Ventas DNX 2022"], signature: "Dani de DNX", voiceNotes: "", waitDays: "3", staleDays: "120" };

  it("convierte los números del formulario y deja en null lo vacío", () => {
    const r = ajustesSchema.parse(base);
    expect(r.waitDays).toBe(3);
    expect(r.staleDays).toBe(120);
    expect(r.voiceNotes).toBeNull();
  });

  it("respeta los topes de días", () => {
    expect(ajustesSchema.safeParse({ ...base, waitDays: "0" }).success).toBe(false);
    expect(ajustesSchema.safeParse({ ...base, waitDays: "31" }).success).toBe(false);
    expect(ajustesSchema.safeParse({ ...base, staleDays: "29" }).success).toBe(false);
    expect(ajustesSchema.safeParse({ ...base, staleDays: "366" }).success).toBe(false);
  });
});

describe("embudosElegidos", () => {
  it("recorta, saca vacíos y repetidos: sync compara contra el nombre recortado", () => {
    expect(embudosElegidos([" Ventas ", "Ventas", "", "Workshops"])).toEqual(["Ventas", "Workshops"]);
  });
});

describe("sugerenciaEditable", () => {
  it("sólo se resuelve lo que sigue vigente", () => {
    expect(sugerenciaEditable("PENDIENTE")).toBe(true);
    expect(sugerenciaEditable("POSPUESTA")).toBe(true);
  });

  it("lo enviado, descartado o reemplazado ya no se toca", () => {
    expect(sugerenciaEditable("ENVIADA")).toBe(false);
    expect(sugerenciaEditable("DESCARTADA")).toBe(false);
    expect(sugerenciaEditable("REEMPLAZADA")).toBe(false);
  });
});

describe("puedeReanalizar", () => {
  const ahora = new Date("2026-09-28T15:00:00Z");

  it("sin sugerencias previas se puede", () => {
    expect(puedeReanalizar(null, ahora)).toBe(true);
  });

  it("recién analizada, no", () => {
    expect(puedeReanalizar(new Date(ahora.getTime() - 30_000), ahora)).toBe(false);
  });

  it("pasado el tope, sí", () => {
    expect(puedeReanalizar(new Date(ahora.getTime() - MIN_MINUTOS_ENTRE_REANALISIS * 60_000), ahora)).toBe(true);
  });
});
