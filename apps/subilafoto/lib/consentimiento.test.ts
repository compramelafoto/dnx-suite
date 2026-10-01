import { describe, expect, test } from "vitest";
import { hashDeIp, tieneConsentimientoVigente } from "./consentimiento";
import { VERSION_DE_TERMINOS } from "./legal/contenido";

const VIEJA = "2026-01-01";

describe("consentimiento del invitado", () => {
  test("quien nunca aceptó tiene que aceptar", () => {
    expect(tieneConsentimientoVigente([], VERSION_DE_TERMINOS)).toBe(false);
  });

  test("quien aceptó la versión vigente no vuelve a ver el cartel", () => {
    expect(
      tieneConsentimientoVigente(
        [{ documentVersion: VERSION_DE_TERMINOS, accepted: true }],
        VERSION_DE_TERMINOS,
      ),
    ).toBe(true);
  });

  test("quien aceptó una versión anterior tiene que aceptar de nuevo", () => {
    // El texto cambió: lo que aceptó ya no es lo que dice hoy. Es el motivo
    // entero por el que se guarda la versión y no sólo un "sí".
    expect(
      tieneConsentimientoVigente([{ documentVersion: VIEJA, accepted: true }], VERSION_DE_TERMINOS),
    ).toBe(false);
  });

  test("un rechazo guardado no vale como aceptación", () => {
    expect(
      tieneConsentimientoVigente(
        [{ documentVersion: VERSION_DE_TERMINOS, accepted: false }],
        VERSION_DE_TERMINOS,
      ),
    ).toBe(false);
  });

  test("alcanza con que una de las que tiene sea la vigente y aceptada", () => {
    expect(
      tieneConsentimientoVigente(
        [
          { documentVersion: VIEJA, accepted: true },
          { documentVersion: VERSION_DE_TERMINOS, accepted: false },
          { documentVersion: VERSION_DE_TERMINOS, accepted: true },
        ],
        VERSION_DE_TERMINOS,
      ),
    ).toBe(true);
  });
});

describe("hash de la dirección IP", () => {
  test("la misma IP da siempre el mismo hash", () => {
    expect(hashDeIp("190.1.2.3")).toBe(hashDeIp("190.1.2.3"));
  });

  test("dos IP distintas dan hashes distintos", () => {
    expect(hashDeIp("190.1.2.3")).not.toBe(hashDeIp("190.1.2.4"));
  });

  test("el hash no deja leer la IP", () => {
    // Se guarda para poder frenar abusos, no para saber dónde vive nadie. Si el
    // hash contuviera la IP, guardarlo así no protegería nada.
    const h = hashDeIp("190.1.2.3");
    expect(h).not.toContain("190");
    expect(h).toHaveLength(64);
  });

  test("sin IP no inventa un hash", () => {
    expect(hashDeIp(null)).toBeNull();
    expect(hashDeIp("")).toBeNull();
    expect(hashDeIp("   ")).toBeNull();
  });
});
