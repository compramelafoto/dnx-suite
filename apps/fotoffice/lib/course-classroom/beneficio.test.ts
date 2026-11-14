import { describe, expect, it } from "vitest";
import { MENSAJES_DE_BENEFICIO, mensajeDeBeneficio, puedeAnotarseGratis } from "./beneficio";

const curso = { freeForMembers: true, status: "PUBLISHED", deliveryMode: "RECORDED", workspaceId: "ws-1", unicoBeneficiario: true };
const base = { esSocioActivo: true, curso, workspaceDelSocio: "ws-1", yaTieneAcceso: false };

describe("quién se anota gratis", () => {
  it("socio activo, curso grabado publicado y gratis para socios de su institución", () => {
    expect(puedeAnotarseGratis(base)).toEqual({ ok: true });
  });

  it.each([
    ["no es socio activo", { esSocioActivo: false }, "no-socio"],
    ["el curso no es gratis para socios", { curso: { ...curso, freeForMembers: false } }, "no-gratis"],
    ["el curso tiene otros beneficiarios", { curso: { ...curso, unicoBeneficiario: false } }, "no-gratis"],
    ["el curso no está publicado", { curso: { ...curso, status: "DRAFT" } }, "no-disponible"],
    ["el curso no es grabado", { curso: { ...curso, deliveryMode: "PRESENCIAL" } }, "no-disponible"],
    ["es de otra institución", { workspaceDelSocio: "ws-2" }, "otra-institucion"],
    ["ya lo tiene", { yaTieneAcceso: true }, "ya-lo-tiene"],
    ["el curso no existe", { curso: null }, "no-disponible"],
  ])("no puede si %s", (_motivo, cambio, codigo) => {
    const r = puedeAnotarseGratis({ ...base, ...cambio });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.codigo).toBe(codigo);
      expect(r.motivo).toBe(MENSAJES_DE_BENEFICIO[r.codigo]);
    }
  });
});

describe("gratis por un curso compartido", () => {
  const ajeno = { ...curso, workspaceId: "ws-dnx", freeForMembers: false };
  it("el socio del espacio al que se lo compartieron gratis lo toma, aunque el dueño no lo regale a los suyos", () => {
    expect(puedeAnotarseGratis({ ...base, curso: ajeno, compartidoGratisCon: new Set(["ws-1"]) })).toEqual({ ok: true });
  });
  it("si el dueño sumó beneficiarios después de compartirlo, ya no es gratis", () => {
    const r = puedeAnotarseGratis({ ...base, curso: { ...ajeno, unicoBeneficiario: false }, compartidoGratisCon: new Set(["ws-1"]) });
    expect(r.ok === false && r.codigo).toBe("no-gratis");
  });
  it("sin acuerdo gratis con su espacio, es de otra institución", () => {
    const r = puedeAnotarseGratis({ ...base, curso: ajeno, compartidoGratisCon: new Set(["ws-9"]) });
    expect(r.ok === false && r.codigo).toBe("otra-institucion");
  });
  it("igual exige socio activo, curso publicado y que no lo tenga", () => {
    const con = { curso: ajeno, compartidoGratisCon: new Set(["ws-1"]) };
    const r1 = puedeAnotarseGratis({ ...base, ...con, esSocioActivo: false });
    const r2 = puedeAnotarseGratis({ ...base, ...con, curso: { ...ajeno, status: "DRAFT" } });
    const r3 = puedeAnotarseGratis({ ...base, ...con, yaTieneAcceso: true });
    expect([r1, r2, r3].map((r) => (r.ok ? "ok" : r.codigo))).toEqual(["no-socio", "no-disponible", "ya-lo-tiene"]);
  });
});

describe("mensajes del aviso", () => {
  it("traduce un código conocido", () => {
    expect(mensajeDeBeneficio("ya-lo-tiene")).toBe("Ya tenés este curso.");
  });

  it.each([undefined, "", "Tu cuenta fue bloqueada, llamá al 0800", "toString", "__proto__"])(
    "un código desconocido (%s) no tiene mensaje",
    (codigo) => {
      expect(mensajeDeBeneficio(codigo)).toBeNull();
    },
  );
});
