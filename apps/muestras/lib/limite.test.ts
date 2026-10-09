import { beforeEach, describe, expect, it } from "vitest";
import { MAX_WORKS } from "@repo/muestras";
import {
  LIMITES, LIMITES_POR_MUESTRA, LIMITES_PUBLICOS, checkRateLimit, frenarPorIp, frenarPorMuestra, frenarPorUsuario, huellaDeIp,
  ipDeLaPeticion, resetRateLimit,
} from "./limite";

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

describe("tope de fichas", () => {
  it("alcanza para bajar la ficha de cada obra de una muestra llena y el PDF completo en dos tamaños", () => {
    for (let i = 0; i < MAX_WORKS + 2; i++) expect(frenarPorUsuario("fichas", 1).allowed).toBe(true);
  });
  it("sigue teniendo tope", () => {
    for (let i = 0; i < LIMITES.fichas.limit; i++) frenarPorUsuario("fichas", 1);
    expect(frenarPorUsuario("fichas", 1).allowed).toBe(false);
  });
});

describe("frenarPorIp", () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
  it("toma el primer valor de x-forwarded-for", () => expect(ipDeLaPeticion(h({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3"));
  it("si no hay, usa x-real-ip", () => expect(ipDeLaPeticion(h({ "x-real-ip": "2800:810::1" }))).toBe("2800:810::1"));
  it("lo que no parece una IP cae en el balde común", () => {
    expect(ipDeLaPeticion(h({}))).toBe("sin-ip");
    expect(ipDeLaPeticion(h({ "x-forwarded-for": "<script>" }))).toBe("sin-ip");
  });
  it("cuenta por IP: el tope de una no frena a otra", () => {
    for (let i = 0; i < LIMITES_PUBLICOS.buscarCerca.limit; i++) expect(frenarPorIp("buscarCerca", "1.1.1.1").allowed).toBe(true);
    expect(frenarPorIp("buscarCerca", "1.1.1.1").allowed).toBe(false);
    expect(frenarPorIp("buscarCerca", "2.2.2.2").allowed).toBe(true);
  });
});


describe("huella de IP", () => {
  it("no es la IP, es estable y distingue IPs", () => {
    const a = huellaDeIp("181.1.2.3");
    expect(a).not.toContain("181");
    expect(a).toBe(huellaDeIp("181.1.2.3"));
    expect(a).not.toBe(huellaDeIp("181.1.2.4"));
  });
});

describe("frenos de la sala", () => {
  it("el libro se cuenta por IP y por muestra", () => {
    for (let i = 0; i < LIMITES_PUBLICOS.libro.limit; i++) expect(frenarPorIp("libro", "1.1.1.1", "m1").allowed).toBe(true);
    expect(frenarPorIp("libro", "1.1.1.1", "m1").allowed).toBe(false);
    expect(frenarPorIp("libro", "1.1.1.1", "m2").allowed).toBe(true);
  });
  it("tope por muestra para todas las IPs juntas", () => {
    for (let i = 0; i < LIMITES_POR_MUESTRA.libro.limit; i++) expect(frenarPorMuestra("libro", "m1").allowed).toBe(true);
    expect(frenarPorMuestra("libro", "m1").allowed).toBe(false);
  });
});
