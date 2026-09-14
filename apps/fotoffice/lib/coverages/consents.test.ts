import { describe, expect, it } from "vitest";
import {
  CONSENT_KINDS,
  REQUIRED_CONSENTS,
  consentTexts,
  hashConsentText,
  parseConsents,
} from "./consents";

/**
 * Los permisos, uno por uno y con la versión del texto que la persona leyó.
 *
 * No es un checkbox de "acepto todo" a propósito. Autorizar una cobertura, avisar que va a
 * haber menores y permitir que la organización muestre las fotos son tres cosas distintas, con
 * consecuencias distintas, y en el peor momento —cuando alguien reclame— hay que poder decir
 * cuál de las tres dio y qué texto exacto leyó.
 */
describe("consentTexts", () => {
  it("hay un texto por cada permiso del catálogo", () => {
    const textos = consentTexts("v1");
    for (const kind of CONSENT_KINDS) {
      expect(textos[kind].length).toBeGreaterThan(10);
    }
  });

  it("el hash cambia si el texto cambia", () => {
    // Es el punto de todo: si mañana se reescribe un texto, los consentimientos viejos tienen
    // que seguir apuntando al que se firmó.
    expect(hashConsentText("Autorizo la cobertura.")).not.toBe(
      hashConsentText("Autorizo la cobertura fotográfica."),
    );
  });

  it("el mismo texto da siempre el mismo hash", () => {
    expect(hashConsentText("Autorizo")).toBe(hashConsentText("Autorizo"));
  });
});

describe("parseConsents", () => {
  function formularioCompleto(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const kind of REQUIRED_CONSENTS) out[`consent_${kind}`] = "on";
    return out;
  }

  it("con los obligatorios tildados, pasa", () => {
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
  });

  it("falta uno obligatorio: no pasa, y dice cuál", () => {
    const form = formularioCompleto();
    delete form[`consent_${REQUIRED_CONSENTS[0]}`];
    const r = parseConsents(form, "v1");
    expect(r.ok).toBe(false);
  });

  it("guarda la versión y el hash de cada uno", () => {
    const r = parseConsents(formularioCompleto(), "v3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const fila of r.data) {
        expect(fila.textVersion).toBe("v3");
        expect(fila.textHash).toHaveLength(64);
      }
    }
  });

  it("un permiso opcional no tildado se guarda como negado, no se omite", () => {
    // Guardar el "no" importa tanto como el "sí": es la diferencia entre "dijo que no" y
    // "nunca se le preguntó".
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const opcional = r.data.find((c) => !REQUIRED_CONSENTS.includes(c.kind));
      expect(opcional?.granted).toBe(false);
    }
  });

  it("hay una fila por cada permiso del catálogo, siempre", () => {
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(CONSENT_KINDS.length);
  });
});
