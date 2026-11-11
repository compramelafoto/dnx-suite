import { describe, expect, it } from "vitest";
import { puedeMirar } from "./visibilidad";

const PUBLICO = { visibility: "PUBLICA" as const, workspaceId: "ws_soybeluz" };
const CLUB = { visibility: "SOCIOS" as const, workspaceId: "ws_soybeluz" };

describe("quién puede mirar", () => {
  it("lo público lo mira cualquiera, incluso sin sesión", () => {
    expect(puedeMirar(PUBLICO, { tipo: "ANONIMO" })).toBe(true);
    expect(puedeMirar(PUBLICO, { tipo: "SOCIA", workspaceId: "otro", activa: false })).toBe(true);
  });

  it("la clase del Club la mira una persona socia activa de ese espacio", () => {
    expect(puedeMirar(CLUB, { tipo: "SOCIA", workspaceId: "ws_soybeluz", activa: true })).toBe(true);
  });

  it("no la mira alguien sin sesión", () => {
    expect(puedeMirar(CLUB, { tipo: "ANONIMO" })).toBe(false);
  });

  it("no la mira una persona socia dada de baja o suspendida", () => {
    expect(puedeMirar(CLUB, { tipo: "SOCIA", workspaceId: "ws_soybeluz", activa: false })).toBe(false);
  });

  it("no la mira una persona socia activa de OTRA institución", () => {
    expect(puedeMirar(CLUB, { tipo: "SOCIA", workspaceId: "ws_otra", activa: true })).toBe(false);
  });

  it("el equipo del espacio la puede revisar; el de otro, no", () => {
    expect(puedeMirar(CLUB, { tipo: "EQUIPO", workspaceId: "ws_soybeluz" })).toBe(true);
    expect(puedeMirar(CLUB, { tipo: "EQUIPO", workspaceId: "ws_otra" })).toBe(false);
  });
});
