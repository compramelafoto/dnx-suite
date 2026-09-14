import { describe, expect, it, vi } from "vitest";
import { PUBLIC_FORM_LIMIT, decidirEnvio, hashOrigen } from "./rate-limit";

/**
 * El freno del formulario público.
 *
 * Hoy NINGÚN formulario público de FotoOffice tiene uno — el de asociarse tampoco. Este es el
 * primero. Un formulario abierto a internet sin límite es una invitación a llenarlo de basura,
 * y cada fila falsa es trabajo de secretaría después.
 *
 * La decisión es pura: recibe cuántos envíos hubo en la ventana y responde. Quién los cuenta
 * es problema del repositorio, y así el caso que importa se puede probar sin base de datos.
 */
describe("decidirEnvio", () => {
  it("el primero entra", () => {
    expect(decidirEnvio({ recientes: 0 })).toEqual({ ok: true });
  });

  it("hasta el tope, entra", () => {
    expect(decidirEnvio({ recientes: PUBLIC_FORM_LIMIT - 1 })).toEqual({ ok: true });
  });

  it("llegado al tope, se rechaza", () => {
    const r = decidirEnvio({ recientes: PUBLIC_FORM_LIMIT });
    expect(r.ok).toBe(false);
  });

  it("el mensaje no dice cuántos van ni cuánto falta", () => {
    // Decirle a quien automatiza envíos cuál es el tope y cuándo se libera le facilita el
    // trabajo. A una persona real le alcanza con saber que espere un rato.
    const r = decidirEnvio({ recientes: PUBLIC_FORM_LIMIT + 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toMatch(/\d/);
      expect(r.error.toLowerCase()).toContain("más tarde");
    }
  });

  it("el tope se puede ajustar por llamada", () => {
    expect(decidirEnvio({ recientes: 2, tope: 5 })).toEqual({ ok: true });
    expect(decidirEnvio({ recientes: 5, tope: 5 }).ok).toBe(false);
  });
});

/**
 * `hashOrigen`: sin sal real, el hash de una IP se revierte por fuerza bruta en minutos —hay
 * unos 4.300 millones de IPv4 posibles—. Antes que guardar algo que aparenta proteger y no
 * protege, se descarta el origen y el freno por correo sigue funcionando solo.
 */
describe("hashOrigen", () => {
  it("con la sal vacía, no calcula nada: devuelve null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(hashOrigen("190.1.2.3", "")).toBe(null);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("con una sal de solo espacios, tampoco: devuelve null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(hashOrigen("190.1.2.3", "   ")).toBe(null);
    warn.mockRestore();
  });

  it("con sal real, devuelve un hash de 64 caracteres", () => {
    const hash = hashOrigen("190.1.2.3", "una-sal-de-verdad");
    expect(hash).toHaveLength(64);
  });

  it("la misma IP con sales distintas da hashes distintos", () => {
    const a = hashOrigen("190.1.2.3", "sal-a");
    const b = hashOrigen("190.1.2.3", "sal-b");
    expect(a).not.toBe(b);
  });

  it("sin IP (vacía o nula), devuelve null", () => {
    expect(hashOrigen("", "una-sal-de-verdad")).toBe(null);
    expect(hashOrigen(null, "una-sal-de-verdad")).toBe(null);
    expect(hashOrigen(undefined, "una-sal-de-verdad")).toBe(null);
  });
});
