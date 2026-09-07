import { describe, expect, it } from "vitest";
import { institutionReplyTo } from "./reply-to";

describe("institutionReplyTo", () => {
  it("arma nombre y dirección", () => {
    expect(institutionReplyTo({ organizationName: "SFPR", contactEmail: "sfpr@example.com" })).toBe(
      "SFPR <sfpr@example.com>",
    );
  });

  it("sin dirección de contacto no hay cabecera", () => {
    expect(institutionReplyTo({ organizationName: "SFPR", contactEmail: null })).toBeNull();
    expect(institutionReplyTo({ organizationName: "SFPR", contactEmail: "   " })).toBeNull();
  });

  it("sin nombre manda la dirección sola, no una cabecera vacía", () => {
    expect(institutionReplyTo({ organizationName: null, contactEmail: "sfpr@example.com" })).toBe(
      "sfpr@example.com",
    );
  });

  it("entrecomilla el nombre que llevaría coma o punto", () => {
    expect(
      institutionReplyTo({ organizationName: "Sociedad, A.C.", contactEmail: "a@b.com" }),
    ).toBe('"Sociedad, A.C." <a@b.com>');
  });

  it("escapa las comillas del nombre en vez de romper la cabecera", () => {
    expect(institutionReplyTo({ organizationName: 'La "Foto"', contactEmail: "a@b.com" })).toBe(
      '"La \\"Foto\\"" <a@b.com>',
    );
  });

  it("descarta cualquier salto de línea: es lo que permitiría inyectar cabeceras", () => {
    expect(
      institutionReplyTo({ organizationName: "SFPR", contactEmail: "a@b.com\r\nBcc: x@y.com" }),
    ).toBeNull();
    expect(
      institutionReplyTo({ organizationName: "SFPR\nBcc: x@y.com", contactEmail: "a@b.com" }),
    ).toBe("a@b.com");
  });

  it("descarta direcciones que el proveedor rechazaría", () => {
    expect(institutionReplyTo({ organizationName: null, contactEmail: "sin-arroba" })).toBeNull();
    expect(institutionReplyTo({ organizationName: null, contactEmail: "a@b" })).toBeNull();
    expect(institutionReplyTo({ organizationName: null, contactEmail: "a b@c.com" })).toBeNull();
    expect(institutionReplyTo({ organizationName: null, contactEmail: "@b.com" })).toBeNull();
    expect(institutionReplyTo({ organizationName: null, contactEmail: "a@b@c.com" })).toBeNull();
  });

  it("recorta los espacios de los dos campos", () => {
    expect(
      institutionReplyTo({ organizationName: "  SFPR  ", contactEmail: "  a@b.com  " }),
    ).toBe("SFPR <a@b.com>");
  });
});
