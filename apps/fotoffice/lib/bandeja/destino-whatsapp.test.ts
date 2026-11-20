import { describe, expect, it } from "vitest";
import { elegirDestinoWhatsapp, necesitaPlantillas } from "./destino-whatsapp";

const ahora = new Date("2026-11-20T12:00:00Z");
const hace = (horas: number) => new Date(ahora.getTime() - horas * 3_600_000);
const base = { waId: "5493402560626", puedeUsarBandeja: true, hayPlantillas: false, ahora };

describe("elegirDestinoWhatsapp", () => {
  it("dentro de las 24 h va a la Bandeja", () => {
    expect(elegirDestinoWhatsapp({ ...base, chat: { id: "c1", ultimoEntranteEn: hace(3) } })).toEqual({ tipo: "bandeja", href: "/bandeja/c1" });
  });
  it("pasadas las 24 h y sin plantillas va a WhatsApp Web", () => {
    expect(elegirDestinoWhatsapp({ ...base, chat: { id: "c1", ultimoEntranteEn: hace(30) } })).toEqual({ tipo: "web", href: "https://wa.me/5493402560626" });
  });
  it("pasadas las 24 h con plantillas aprobadas va a la Bandeja", () => {
    expect(elegirDestinoWhatsapp({ ...base, hayPlantillas: true, chat: { id: "c1", ultimoEntranteEn: hace(30) } }).tipo).toBe("bandeja");
  });
  it("sin chat o sin permiso va a WhatsApp Web", () => {
    expect(elegirDestinoWhatsapp({ ...base, chat: null }).tipo).toBe("web");
    expect(elegirDestinoWhatsapp({ ...base, puedeUsarBandeja: false, chat: { id: "c1", ultimoEntranteEn: hace(1) } }).tipo).toBe("web");
  });
  it("un chat en el que el cliente nunca escribió cuenta como fuera de la ventana", () => {
    expect(elegirDestinoWhatsapp({ ...base, chat: { id: "c1", ultimoEntranteEn: null } }).tipo).toBe("web");
  });
});

describe("necesitaPlantillas", () => {
  it("sólo con chat, permiso y fuera de la ventana", () => {
    expect(necesitaPlantillas({ id: "c", ultimoEntranteEn: hace(30) }, true, ahora)).toBe(true);
    expect(necesitaPlantillas({ id: "c", ultimoEntranteEn: hace(2) }, true, ahora)).toBe(false);
    expect(necesitaPlantillas(null, true, ahora)).toBe(false);
    expect(necesitaPlantillas({ id: "c", ultimoEntranteEn: hace(30) }, false, ahora)).toBe(false);
  });
});
