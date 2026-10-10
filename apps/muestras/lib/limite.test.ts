import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_WORKS } from "@repo/muestras";
import {
  LIMITES, LIMITES_POR_MUESTRA, LIMITES_PUBLICOS, checkRateLimit, frenarPorIp, frenarPorMuestra, frenarPorUsuario, huellaDeIp,
  ipDeLaPeticion, MAX_ENTRADAS, resetRateLimit, tamanoDelFreno,
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
    expect(a).toBe(huellaDeIp("181.1.2.3"));
    expect(a).not.toBe(huellaDeIp("181.1.2.4"));
  });
});

describe("huella con sal fija", () => {
  it("es el sha256 de sal + IP en base64url, cortado a 22", () => {
    const esperado = createHash("sha256").update("s").update("181.1.2.3").digest("base64url").slice(0, 22);
    expect(huellaDeIp("181.1.2.3", "s")).toBe(esperado);
    expect(huellaDeIp("181.1.2.3", "s")).toHaveLength(22);
  });
});

describe("tope de tamaño del freno", () => {
  it("nunca pasa de MAX_ENTRADAS: se van las claves más viejas", () => {
    resetRateLimit();
    for (let i = 0; i < MAX_ENTRADAS + 50; i++) checkRateLimit({ key: `k${i}`, limit: 5, windowMs: 60_000 });
    expect(tamanoDelFreno()).toBeLessThanOrEqual(MAX_ENTRADAS);
    // La más vieja se fue (vuelve a empezar en 1); la más nueva sigue contando.
    expect(checkRateLimit({ key: "k0", limit: 5, windowMs: 60_000 }).remaining).toBe(4);
    expect(checkRateLimit({ key: `k${MAX_ENTRADAS + 49}`, limit: 5, windowMs: 60_000 }).remaining).toBe(3);
    resetRateLimit();
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

describe("frenos de difusión y equipo (etapa 5)", () => {
  it("invitar al equipo 30 por hora y aceptar 20 por hora, por persona", () => {
    expect(LIMITES.invitarEquipo).toEqual({ limit: 30, windowMs: 60 * 60_000 });
    expect(LIMITES.aceptarEquipo).toEqual({ limit: 20, windowMs: 60 * 60_000 });
    for (let i = 0; i < 30; i++) expect(frenarPorUsuario("invitarEquipo", 1).allowed).toBe(true);
    expect(frenarPorUsuario("invitarEquipo", 1).allowed).toBe(false);
    expect(frenarPorUsuario("invitarEquipo", 2).allowed).toBe(true);
  });
});

describe("frenos de la asistencia (etapa 5)", () => {
  it("por IP y por muestra, con los topes del diseño", () => {
    expect(LIMITES_PUBLICOS.asistencia).toEqual({ limit: 10, windowMs: 10 * 60_000 });
    expect(LIMITES_PUBLICOS.asistenciaConsultas).toEqual({ limit: 120, windowMs: 10 * 60_000 });
    expect(LIMITES_PUBLICOS.miAsistencia).toEqual({ limit: 30, windowMs: 10 * 60_000 });
    expect(LIMITES_POR_MUESTRA.asistencia).toEqual({ limit: 300, windowMs: 60 * 60_000 });
    for (let i = 0; i < 10; i++) expect(frenarPorIp("asistencia", "1.1.1.1", "m1").allowed).toBe(true);
    expect(frenarPorIp("asistencia", "1.1.1.1", "m1").allowed).toBe(false);
    expect(frenarPorIp("asistencia", "1.1.1.1", "m2").allowed).toBe(true);
  });
});

describe("frenos de la sorpresa (etapa 6)", () => {
  it("anticipo: 60 cada 10 minutos por IP", () => {
    expect(LIMITES_PUBLICOS.anticipo).toEqual({ limit: 60, windowMs: 10 * 60_000 });
    for (let i = 0; i < 60; i++) expect(frenarPorIp("anticipo", "1.1.1.1").allowed).toBe(true);
    expect(frenarPorIp("anticipo", "1.1.1.1").allowed).toBe(false);
    expect(frenarPorIp("anticipo", "2.2.2.2").allowed).toBe(true);
  });
  it("guardar la visibilidad: 60 por hora por persona", () => {
    expect(LIMITES.guardarVisibilidad).toEqual({ limit: 60, windowMs: 60 * 60_000 });
  });
  it("portfolio: 300 por hora por persona", () => {
    expect(LIMITES.guardarPortfolio).toEqual({ limit: 300, windowMs: 60 * 60_000 });
  });
  it("enlace de expositores: 30 por hora por persona", () => {
    expect(LIMITES.enlaceExpositores).toEqual({ limit: 30, windowMs: 60 * 60_000 });
  });
  it("sumarse como expositor: 20 por hora por persona; la página del enlace, 60 cada 10 minutos por IP", () => {
    expect(LIMITES.sumarseExpositor).toEqual({ limit: 20, windowMs: 60 * 60_000 });
    expect(LIMITES_PUBLICOS.paginaExpositores).toEqual({ limit: 60, windowMs: 10 * 60_000 });
  });
  it("obras de quien expone: guardar 300 por hora y enviar 60 por hora", () => {
    expect(LIMITES.guardarObraExpositor).toEqual({ limit: 300, windowMs: 60 * 60_000 });
    expect(LIMITES.enviarObraExpositor).toEqual({ limit: 60, windowMs: 60 * 60_000 });
  });
  it("revisar expositores: 600 cada 10 minutos por persona", () => {
    expect(LIMITES.revisarExpositores).toEqual({ limit: 600, windowMs: 10 * 60_000 });
  });
  it("vista de sala 300 e imágenes de sala 600, cada 10 minutos por IP", () => {
    expect(LIMITES_PUBLICOS.vistaSala).toEqual({ limit: 300, windowMs: 10 * 60_000 });
    expect(LIMITES_PUBLICOS.imagenSala).toEqual({ limit: 600, windowMs: 10 * 60_000 });
  });
});
