import { describe, expect, it } from "vitest";
import {
  buildInfoRequestedEmail,
  buildRequestApprovedEmail,
  buildRequestReceivedEmail,
  buildRequestRejectedEmail,
  contactGreetingName,
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

  it("sin URL de seguimiento, no muestra un botón que no lleva a ningún lado", () => {
    // Pasa cuando no se pudo rotar el enlace por falta de `appUrl` (ver `debeRotarEnlace`).
    // Un botón sin destino, y la línea de "copiá y pegá esta dirección" sin dirección debajo,
    // son peor que no mostrar nada.
    const m = buildRequestReceivedEmail({ ...base, trackingUrl: "" });
    expect(m.html).not.toContain("Ver cómo va tu pedido");
    expect(m.html).not.toContain("copiá y pegá");
    expect(m.text).not.toContain("Ver cómo va tu pedido");
  });

  it("una URL con sólo espacios se trata igual que vacía", () => {
    const m = buildRequestReceivedEmail({ ...base, trackingUrl: "   " });
    expect(m.html).not.toContain("Ver cómo va tu pedido");
    expect(m.html).not.toContain("copiá y pegá");
    expect(m.text).not.toContain("Ver cómo va tu pedido");
  });

  it("con una URL real, el botón y la frase de copiar sí aparecen", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.html).toContain("Ver cómo va tu pedido");
    expect(m.html).toContain("copiá y pegá");
    expect(m.text).toContain("Ver cómo va tu pedido");
    expect(m.text).toContain(base.trackingUrl);
  });

  it("el saludo nunca repite la palabra «Hola»", () => {
    // `compose` siempre antepone "Hola" al nombre que le llega (ver más arriba, `saludo`). Si
    // `contactGreetingName` volviera a usar "Hola" como valor por omisión en vez de "Equipo"
    // (por ejemplo, para una solicitud sin nombre de contacto ni razón social), el correo
    // saldría literalmente "Hola Hola,". Se prueba con el resultado real de esa función, no con
    // un literal escrito a mano, para que este caso se rompa si alguien vuelve a tocarla.
    const nombre = contactGreetingName({ firstName: null, lastName: null, businessName: null });
    const m = buildRequestReceivedEmail({ ...base, contactName: nombre });
    expect(m.text).not.toContain("Hola Hola");
    expect(m.html).not.toContain("Hola Hola");
    expect(m.text).toContain("Hola Equipo,");
  });
});

describe("contactGreetingName", () => {
  it("con nombre y apellido, saluda a la persona", () => {
    expect(
      contactGreetingName({ firstName: "María", lastName: "Pérez", businessName: "FOTOPOSITIVA" }),
    ).toBe("María Pérez");
  });

  it("sin nombre pero con razón social, cae a la razón social", () => {
    expect(
      contactGreetingName({ firstName: null, lastName: null, businessName: "FOTOPOSITIVA" }),
    ).toBe("FOTOPOSITIVA");
  });

  it("sin nombre ni razón social, cae a «Equipo» y nunca a «Hola»", () => {
    const nombre = contactGreetingName({ firstName: null, lastName: null, businessName: null });
    expect(nombre).toBe("Equipo");
    expect(nombre).not.toBe("Hola");
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
