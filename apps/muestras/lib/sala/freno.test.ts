import { beforeEach, describe, expect, it } from "vitest";
import { LIMITES_PUBLICOS, frenarPorIp, resetRateLimit } from "@/lib/limite";
import type { PaseDeSala } from "./consultas";
import { frenarEnSala } from "./freno";

const actividad = { id: "a1", slug: "silos", title: "Silos", galleryMode: "FULL", visibility: null, startsAt: new Date(), endsAt: new Date() };
const conPase = (huella: string): PaseDeSala => ({ actividad, pase: { v: 1, a: "a1", exp: Date.now() + 1000, w: ["w1"] }, equipo: false, huella });

beforeEach(() => resetRateLimit());

describe("frenarEnSala", () => {
  it("cuenta por pase: en el mismo Wi-Fi, el tope de un teléfono no frena a otro", () => {
    for (let i = 0; i < LIMITES_PUBLICOS.vistaSala.limit; i++) expect(frenarEnSala("vistaSala", conPase("uno"), "1.1.1.1")).toBe(true);
    expect(frenarEnSala("vistaSala", conPase("uno"), "1.1.1.1")).toBe(false);
    expect(frenarEnSala("vistaSala", conPase("dos"), "1.1.1.1")).toBe(true);
  });
  it("sin pase (o el equipo), por IP", () => {
    const sinPase: PaseDeSala = { actividad, pase: null, equipo: true, huella: null };
    for (let i = 0; i < LIMITES_PUBLICOS.vistaSala.limit; i++) frenarEnSala("vistaSala", sinPase, "1.1.1.1");
    expect(frenarEnSala("vistaSala", sinPase, "1.1.1.1")).toBe(false);
    expect(frenarEnSala("vistaSala", sinPase, "2.2.2.2")).toBe(true);
  });
  it("el tope por IP de la red es alto (al menos 1000 cada 10 minutos)", () => {
    expect(LIMITES_PUBLICOS.vistaSalaRed.limit).toBeGreaterThanOrEqual(1000);
    expect(LIMITES_PUBLICOS.imagenSalaRed.limit).toBeGreaterThanOrEqual(1000);
    for (let i = 0; i < 1000; i++) expect(frenarPorIp("vistaSalaRed", "1.1.1.1").allowed).toBe(true);
  });
});
