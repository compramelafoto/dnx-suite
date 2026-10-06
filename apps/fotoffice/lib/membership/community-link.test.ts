import { describe, expect, it } from "vitest";
import { parseWhatsappGroupUrl, safeWhatsappGroupUrl } from "./community-link";

describe("el enlace al grupo de WhatsApp", () => {
  it("acepta el enlace de invitación de la SFPR", () => {
    expect(parseWhatsappGroupUrl("https://chat.whatsapp.com/CpeHaezJTKkEDkwaMjAbcA")).toEqual({
      ok: true,
      value: "https://chat.whatsapp.com/CpeHaezJTKkEDkwaMjAbcA",
    });
  });

  it("acepta el que se copia sin https ni con espacios", () => {
    expect(parseWhatsappGroupUrl("  chat.whatsapp.com/CpeHaezJTKkEDkwaMjAbcA ")).toEqual({
      ok: true,
      value: "https://chat.whatsapp.com/CpeHaezJTKkEDkwaMjAbcA",
    });
  });

  it("vacío es que no hay grupo", () => {
    expect(parseWhatsappGroupUrl("")).toEqual({ ok: true, value: null });
  });

  it("no acepta otra cosa que un grupo de WhatsApp", () => {
    expect(parseWhatsappGroupUrl("https://malo.com/chat.whatsapp.com/abc").ok).toBe(false);
    expect(parseWhatsappGroupUrl("http://chat.whatsapp.com/CpeHaezJTKkEDkwaMjAbcA").ok).toBe(false);
    expect(parseWhatsappGroupUrl("https://wa.me/5493410000000").ok).toBe(false);
    expect(parseWhatsappGroupUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("lo guardado que no cumple la regla no se muestra", () => {
    expect(safeWhatsappGroupUrl("https://otro.com")).toBe(null);
    expect(safeWhatsappGroupUrl(null)).toBe(null);
  });
});
