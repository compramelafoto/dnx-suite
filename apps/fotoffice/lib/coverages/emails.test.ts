import { describe, expect, it } from "vitest";
import {
  buildInfoRequestedEmail,
  buildRequestApprovedEmail,
  buildRequestReceivedEmail,
  buildRequestRejectedEmail,
} from "./emails";

const contexto = { organizationName: "FOTOPOSITIVA", signature: null };
const base = {
  context: contexto,
  publicCode: "SC-2026-0042",
  eventTitle: "Jornada solidaria para familias",
  contactName: "María",
  trackingUrl: "https://fotoffice.com/sc/UN-TOKEN-LARGO",
};

/**
 * Los correos del circuito.
 *
 * Armado puro: devuelve asunto, HTML y texto, y no envía nada. Así se puede probar lo que
 * importa —que el enlace esté, que el motivo del rechazo se comunique, que no se filtre nada
 * interno— sin un proveedor de correo de por medio.
 */
describe("buildRequestReceivedEmail", () => {
  it("lleva el código en el asunto: es lo que la persona va a buscar después", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.subject).toContain("SC-2026-0042");
  });

  it("incluye el enlace de seguimiento", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.html).toContain(base.trackingUrl);
    expect(m.text).toContain(base.trackingUrl);
  });

  it("no promete que la cobertura se va a hacer", () => {
    // Una solicitud es un pedido, no un alta. Prometer acá deja a la coordinación pagando un
    // compromiso que nunca tomó.
    const m = buildRequestReceivedEmail(base);
    expect(m.text.toLowerCase()).not.toContain("confirmada");
    expect(m.text.toLowerCase()).toContain("vamos a revisar");
  });
});

describe("buildInfoRequestedEmail", () => {
  it("dice qué falta, con las palabras de quien lo pidió", () => {
    const m = buildInfoRequestedEmail({
      ...base,
      infoRequested: "¿Cuántas personas esperan y hay luz artificial en el salón?",
    });
    expect(m.text).toContain("¿Cuántas personas esperan");
    expect(m.html).toContain(base.trackingUrl);
  });
});

describe("buildRequestApprovedEmail", () => {
  it("avisa que se aprobó y que todavía falta armar el equipo", () => {
    const m = buildRequestApprovedEmail(base);
    expect(m.subject).toContain("SC-2026-0042");
    expect(m.text.toLowerCase()).toContain("equipo");
  });
});

describe("buildRequestRejectedEmail", () => {
  it("comunica el motivo tal como se escribió", () => {
    const m = buildRequestRejectedEmail({
      ...base,
      reason: "La fecha ya pasó cuando recibimos el pedido.",
    });
    expect(m.text).toContain("La fecha ya pasó cuando recibimos el pedido.");
  });

  it("no manda el enlace de seguimiento en un rechazo", () => {
    // El circuito terminó. Un enlace que lleva a una pantalla sin nada que hacer solo invita a
    // volver a mirar un "no".
    const m = buildRequestRejectedEmail({ ...base, reason: "No corresponde." });
    expect(m.html).not.toContain(base.trackingUrl);
  });
});
