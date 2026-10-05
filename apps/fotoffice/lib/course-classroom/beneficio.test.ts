import { describe, expect, it } from "vitest";
import { puedeAnotarseGratis } from "./beneficio";

const curso = { freeForMembers: true, status: "PUBLISHED", deliveryMode: "RECORDED", workspaceId: "ws-1" };
const base = { esSocioActivo: true, curso, workspaceDelSocio: "ws-1", yaTieneAcceso: false };

describe("quién se anota gratis", () => {
  it("socio activo, curso grabado publicado y gratis para socios de su institución", () => {
    expect(puedeAnotarseGratis(base)).toEqual({ ok: true });
  });

  it.each([
    ["no es socio activo", { esSocioActivo: false }],
    ["el curso no es gratis para socios", { curso: { ...curso, freeForMembers: false } }],
    ["el curso no está publicado", { curso: { ...curso, status: "DRAFT" } }],
    ["el curso no es grabado", { curso: { ...curso, deliveryMode: "PRESENCIAL" } }],
    ["es de otra institución", { workspaceDelSocio: "ws-2" }],
    ["ya lo tiene", { yaTieneAcceso: true }],
    ["el curso no existe", { curso: null }],
  ])("no puede si %s", (_motivo, cambio) => {
    expect(puedeAnotarseGratis({ ...base, ...cambio }).ok).toBe(false);
  });
});
