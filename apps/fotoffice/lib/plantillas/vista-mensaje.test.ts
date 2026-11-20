import { describe, expect, it } from "vitest";
import { estadoLegible, LARGO_RECORTE, recortar, tituloDeMensaje, vistaDeMensaje } from "./vista-mensaje";

const FILA = {
  id: "m1", channel: "EMAIL", status: "SENT", automatic: false, toAddress: "a@x.test", subject: "Hola", body: "Texto",
  errorCode: null, actorLabel: "Ana", createdAt: new Date("2026-10-01T15:00:00.000Z"),
};

describe("vista de un mensaje registrado", () => {
  it("estado legible: enviado, abierto en WhatsApp y falló con motivo (nunca el detalle)", () => {
    expect(estadoLegible("SENT", null)).toBe("Enviado");
    expect(estadoLegible("OPENED_WHATSAPP", null)).toBe("Abierto en WhatsApp");
    expect(estadoLegible("FAILED", "CONFIGURATION_ERROR")).toBe("Falló: el envío de correos no está configurado");
    expect(estadoLegible("FAILED", "PROVIDER_REJECTED:422:validation_error")).toBe("Falló: el proveedor de correo lo rechazó");
    expect(estadoLegible("FAILED", "INTERNAL_ERROR")).toBe("Falló: no se pudo conectar con el proveedor de correo");
    expect(estadoLegible("FAILED", null)).toBe("Falló");
  });

  it("automático: quien es «Automático»; manual: la etiqueta de quien envió", () => {
    expect(vistaDeMensaje(FILA, "Gracias")).toMatchObject({ quien: "Ana", plantilla: "Gracias", fecha: "2026-10-01T15:00:00.000Z" });
    expect(vistaDeMensaje({ ...FILA, automatic: true, actorLabel: null }, null)).toMatchObject({ quien: "Automático", automatico: true });
    expect(vistaDeMensaje({ ...FILA, actorLabel: null }, null).quien).toBe("Sistema");
  });

  it("WhatsApp sin asunto; título por canal y estado", () => {
    const wa = vistaDeMensaje({ ...FILA, channel: "WHATSAPP", subject: null, status: "OPENED_WHATSAPP" }, null);
    expect(wa.asunto).toBeNull();
    expect(tituloDeMensaje(wa)).toBe("WhatsApp abierto");
    expect(tituloDeMensaje(vistaDeMensaje(FILA, null))).toBe("Correo enviado");
    expect(tituloDeMensaje(vistaDeMensaje({ ...FILA, status: "FAILED" }, null))).toBe("Correo que falló");
  });

  it("recorta el cuerpo largo sin cortar una palabra; el corto queda entero", () => {
    expect(recortar("corto")).toBeNull();
    const largo = "palabra ".repeat(60);
    const r = recortar(largo)!;
    expect(r.length).toBeLessThanOrEqual(LARGO_RECORTE + 1);
    expect(r.endsWith("palabra…")).toBe(true);
    expect(recortar("x".repeat(400))).toBe(`${"x".repeat(LARGO_RECORTE)}…`);
  });
});

describe("seguimiento del correo (avisos de Resend)", () => {
  const base = {
    id: "m1", channel: "EMAIL", status: "SENT", automatic: true, toAddress: "a@b.com", subject: "Hola", body: "x", errorCode: null, actorLabel: null,
    createdAt: new Date("2026-11-20T12:00:00Z"),
  };
  it("dice si lo abrió (con día y hora de Argentina) o si sólo le llegó", () => {
    expect(vistaDeMensaje({ ...base, openedAt: new Date("2026-11-21T18:30:00Z") }, null).estado).toBe("Enviado · lo abrió el 21/11 a las 15:30");
    expect(vistaDeMensaje({ ...base, deliveredAt: new Date("2026-11-20T12:01:00Z") }, null).estado).toBe("Enviado · le llegó, todavía sin abrir");
    expect(vistaDeMensaje(base, null).estado).toBe("Enviado");
  });
  it("un correo que falló o un WhatsApp no llevan esa aclaración", () => {
    expect(vistaDeMensaje({ ...base, status: "FAILED", openedAt: new Date() }, null).estado).not.toMatch(/abrió/);
    expect(vistaDeMensaje({ ...base, channel: "WHATSAPP", status: "OPENED_WHATSAPP", openedAt: new Date() }, null).estado).toBe("Abierto en WhatsApp");
  });
});
