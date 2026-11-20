import { describe, expect, it } from "vitest";
import { cualSeguimiento, enviadosPorCorreo, marcaDe, seguirEnLaVentana, textoSeguimientoEnVentana, tipoDeEvento, ultimoSeguimiento } from "./seguimiento-whatsapp";

const AHORA = new Date("2026-11-20T13:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);
const BASE = { enviadaEn: hace(3), ahora: AHORA, yaEnviados: 0, respondioDespues: false, abierta: true, atiendePersona: false };

describe("cualSeguimiento", () => {
  it("a los 2, 7 y 12 días; nunca un cuarto", () => {
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(1.9) })).toBeNull();
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(2) })).toBe(1);
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(6), yaEnviados: 1 })).toBeNull();
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(7), yaEnviados: 1 })).toBe(2);
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(12), yaEnviados: 2 })).toBe(3);
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(20), yaEnviados: 3 })).toBeNull();
  });

  it("si uno no salió a tiempo, sale el que corresponde a hoy (no dos juntos)", () => {
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(8), yaEnviados: 0 })).toBe(2);
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(9), yaEnviados: 2 })).toBeNull();
    expect(ultimoSeguimiento([marcaDe(2)])).toBe(2);
    expect(ultimoSeguimiento([marcaDe(1), marcaDe(3), null])).toBe(3);
  });

  it("no insiste si el cliente respondió, si la cotización ya no está abierta, si la atiende una persona o si pasaron más de 30 días", () => {
    expect(cualSeguimiento({ ...BASE, respondioDespues: true })).toBeNull();
    expect(cualSeguimiento({ ...BASE, abierta: false })).toBeNull();
    expect(cualSeguimiento({ ...BASE, atiendePersona: true })).toBeNull();
    expect(cualSeguimiento({ ...BASE, enviadaEn: hace(31) })).toBeNull();
  });
});

describe("textos", () => {
  it("el tipo de evento en criollo", () => {
    expect(tipoDeEvento("15 años")).toBe("tus 15");
    expect(tipoDeEvento("Casamientos")).toBe("tu casamiento");
    expect(tipoDeEvento("Bautismo")).toBe("tu bautismo");
    expect(tipoDeEvento(null)).toBe("tu evento");
  });

  it("la marca del chat dice cuál seguimiento salió", () => {
    expect(marcaDe(1)).toBe("Seguimiento de cotización 1 enviado por WhatsApp");
  });
});

describe("seguimiento de la cotización dentro de la ventana de 24 h (sin plantilla)", () => {
  const H = 3_600_000;
  const ultimo = new Date("2026-11-20T12:00:00Z");
  const base = { ultimoEntranteEn: ultimo, enviadaEn: new Date(ultimo.getTime() + H), ahora: new Date(ultimo.getTime() + 22 * H), yaEnviados: 0, abierta: true };

  it("sale si la cotización salió después del último mensaje del cliente y hace al menos 12 h", () => {
    expect(seguirEnLaVentana(base)).toBe(true);
    expect(seguirEnLaVentana({ ...base, enviadaEn: new Date(ultimo.getTime() + 15 * H) })).toBe(false);
  });

  it("no sale si el cliente escribió después, si ya hubo un seguimiento o si la cotización ya no está abierta", () => {
    expect(seguirEnLaVentana({ ...base, enviadaEn: new Date(ultimo.getTime() - H) })).toBe(false);
    expect(seguirEnLaVentana({ ...base, yaEnviados: 1 })).toBe(false);
    expect(seguirEnLaVentana({ ...base, abierta: false })).toBe(false);
  });

  it("el texto es de persona: pregunta si la pudo ver, con el enlace y sin hablar de botones", () => {
    const t = textoSeguimientoEnVentana("Cristina Pérez", "15 años", "https://dnx.com/presupuesto/abc");
    expect(t).toBe("¡Hola Cristina! ¿Pudiste ver la cotización para tus 15? Si tenés alguna duda o querés cambiar algo, contame por acá y lo vemos 😊\nhttps://dnx.com/presupuesto/abc");
    expect(t).not.toMatch(/bot[oó]n/i);
    expect(textoSeguimientoEnVentana(null, null, "https://x")).toMatch(/^¡Hola! ¿Pudiste ver la cotización para tu evento\?/);
  });
});

describe("enviadosPorCorreo", () => {
  it("cuenta sólo las marcas de correo", () => {
    expect(enviadosPorCorreo(["Seguimiento de cotización 1 enviado por WhatsApp", "Seguimiento de cotización 2 enviado por correo", null])).toBe(1);
  });
});
