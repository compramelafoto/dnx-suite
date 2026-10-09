import { beforeEach, describe, expect, it } from "vitest";
import { LIMITES, checkRateLimit, frenarPorUsuario, resetRateLimit } from "./limite";

beforeEach(() => resetRateLimit());

describe("checkRateLimit", () => {
  it("deja pasar hasta el tope y frena el siguiente", () => {
    const pedir = () => checkRateLimit({ key: "k", limit: 2, windowMs: 60_000 });
    expect(pedir().allowed).toBe(true);
    expect(pedir().allowed).toBe(true);
    expect(pedir().allowed).toBe(false);
  });
});

describe("frenarPorUsuario", () => {
  it("cuenta por persona: el tope de una no frena a otra", () => {
    for (let i = 0; i < LIMITES.enviarARevision.limit; i++) expect(frenarPorUsuario("enviarARevision", 1).allowed).toBe(true);
    expect(frenarPorUsuario("enviarARevision", 1).allowed).toBe(false);
    expect(frenarPorUsuario("enviarARevision", 2).allowed).toBe(true);
  });
  it("cada cosa lleva su propio conteo", () => {
    for (let i = 0; i < LIMITES.enviarARevision.limit; i++) frenarPorUsuario("enviarARevision", 1);
    expect(frenarPorUsuario("crearBorrador", 1).allowed).toBe(true);
  });
});
