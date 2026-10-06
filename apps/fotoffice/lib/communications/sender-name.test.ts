import { describe, expect, it } from "vitest";
import { buildFromHeader, extractAddress, sanitizeDisplayName, sanitizeReplyTo } from "./sender-name";

describe("remitente por institución", () => {
  it("cambia el nombre y conserva la casilla verificada", () => {
    expect(buildFromHeader("FOTOFFICE <avisos@mail.fotoffice.com>", "SFPR")).toBe('"SFPR" <avisos@mail.fotoffice.com>');
  });

  it("acepta un remitente pelado", () => {
    expect(buildFromHeader("avisos@mail.fotoffice.com", "SFPR")).toBe('"SFPR" <avisos@mail.fotoffice.com>');
  });

  it("sin nombre deja el remitente del entorno", () => {
    expect(buildFromHeader("FOTOFFICE <avisos@mail.fotoffice.com>", null)).toBe("FOTOFFICE <avisos@mail.fotoffice.com>");
    expect(buildFromHeader("FOTOFFICE <avisos@mail.fotoffice.com>", "   ")).toBe("FOTOFFICE <avisos@mail.fotoffice.com>");
  });

  it("si no reconoce la casilla, no toca nada", () => {
    expect(buildFromHeader("algo raro", "SFPR")).toBe("algo raro");
    expect(extractAddress("Nombre <no-es-correo>")).toBeNull();
  });

  it("no deja inyectar cabeceras ni comillas en el nombre", () => {
    expect(sanitizeDisplayName('SFPR"\r\nBcc: x@y.com <')).toBe("SFPR Bcc: x@y.com");
    expect(buildFromHeader("a@b.com", 'Soc "X"')).toBe('"Soc X" <a@b.com>');
  });

  it("reply-to sólo si es una casilla válida", () => {
    expect(sanitizeReplyTo(" sfprosario@gmail.com ")).toBe("sfprosario@gmail.com");
    expect(sanitizeReplyTo("no")).toBeNull();
    expect(sanitizeReplyTo(null)).toBeNull();
  });
});
