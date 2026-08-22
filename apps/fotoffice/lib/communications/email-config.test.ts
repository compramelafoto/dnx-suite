import { describe, expect, it } from "vitest";
import { resolveEmailConfig } from "./email-config";

const KEY = "RESEND_API_KEY";
const FROM = "FOTOFFICE_NOTIFICATIONS_FROM";

describe("resolveEmailConfig", () => {
  it("devuelve la configuración cuando están las dos variables", () => {
    const result = resolveEmailConfig({ [KEY]: "re_test", [FROM]: "FotoOffice <no-reply@mail.fotoffice.com>" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.apiKey).toBe("re_test");
    expect(result.config.from).toBe("FotoOffice <no-reply@mail.fotoffice.com>");
  });

  it("falla si falta la clave, nombrando solo la variable", () => {
    const result = resolveEmailConfig({ [FROM]: "FotoOffice <no-reply@mail.fotoffice.com>" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([KEY]);
  });

  it("falla si falta el remitente en vez de inventar uno", () => {
    const result = resolveEmailConfig({ [KEY]: "re_test" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([FROM]);
  });

  it("informa las dos cuando faltan ambas", () => {
    const result = resolveEmailConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([KEY, FROM]);
  });

  it("trata los valores en blanco como ausentes", () => {
    const result = resolveEmailConfig({ [KEY]: "   ", [FROM]: "\t\n" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([KEY, FROM]);
  });

  it("recorta espacios alrededor de los valores válidos", () => {
    const result = resolveEmailConfig({ [KEY]: "  re_test  ", [FROM]: "  a@mail.fotoffice.com  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.apiKey).toBe("re_test");
    expect(result.config.from).toBe("a@mail.fotoffice.com");
  });

  /**
   * El motivo por el que existe este módulo: el remitente por defecto anterior apuntaba a
   * `fotoffice.app`, un dominio no verificado en Resend. Un envío con ese remitente se
   * rechaza, así que preferimos fallar de forma explícita antes que sustituirlo en silencio.
   */
  it("nunca devuelve un remitente por defecto", () => {
    const result = resolveEmailConfig({ [KEY]: "re_test" });
    expect(JSON.stringify(result)).not.toContain("@");
  });
});
