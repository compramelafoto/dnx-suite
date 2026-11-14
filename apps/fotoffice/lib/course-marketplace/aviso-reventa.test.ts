import { describe, expect, it } from "vitest";
import {
  buildAvisoInvitacionACompartirEmail,
  buildAvisoPedidoDeReventaEmail,
  buildAvisoRespuestaInvitacionEmail,
  buildAvisoRespuestaReventaEmail,
} from "./aviso-reventa";

const enlace = "https://fotoffice.com/dashboard/mercado-de-cursos/acuerdos";

describe("aviso al dueño: alguien quiere vender tu curso", () => {
  const input = { revendedor: "Fotoclub <Norte>", curso: "Retrato", porcentaje: "30%", sugerido: "25%", enlace };

  it("dice quién, qué curso, cuánto pide, cuánto sugeriste y lleva el enlace", () => {
    const { subject, html, text } = buildAvisoPedidoDeReventaEmail(input);
    expect(subject).toBe("Fotoclub <Norte> quiere vender Retrato");
    expect(text).toContain("30%");
    expect(text).toContain("25%");
    expect(html).toContain(`href="${enlace}"`);
  });

  it("escapa lo que viene de afuera", () => {
    expect(buildAvisoPedidoDeReventaEmail(input).html).toContain("Fotoclub &lt;Norte&gt;");
  });
});

describe("aviso al revendedor: respuesta a tu pedido", () => {
  it("aprobado y rechazado dicen cosas distintas", () => {
    expect(buildAvisoRespuestaReventaEmail({ dueno: "SFPR", curso: "Retrato", aprobado: true, enlace }).subject).toBe("SFPR aprobó tu pedido para vender Retrato");
    expect(buildAvisoRespuestaReventaEmail({ dueno: "SFPR", curso: "Retrato", aprobado: false, enlace }).subject).toBe("SFPR rechazó tu pedido para vender Retrato");
  });
});

describe("aviso al invitado: te comparten un curso", () => {
  const input = { dueno: "DNX <Estudio>", curso: "Fotografía Inicial", porcentaje: "10%", regalado: false, gratisSocios: false, enlace };
  it("con porcentaje, dice cuánto se queda y escapa el nombre", () => {
    const c = buildAvisoInvitacionACompartirEmail(input);
    expect(c.subject).toBe("DNX <Estudio> te comparte el curso Fotografía Inicial");
    expect(c.text).toContain("el 10% de cada venta");
    expect(c.text).not.toContain("gratis");
    expect(c.html).toContain("DNX &lt;Estudio&gt;");
    expect(c.html).toContain(`href="${enlace}"`);
  });
  it("regalado y gratis para socios lo dice", () => {
    const c = buildAvisoInvitacionACompartirEmail({ ...input, regalado: true, gratisSocios: true });
    expect(c.text).toContain("te quedás con todo");
    expect(c.text).toContain("socios activos lo pueden tomar gratis");
  });
});

describe("aviso al dueño: respuesta a tu invitación", () => {
  it("aceptado y rechazado dicen cosas distintas", () => {
    expect(buildAvisoRespuestaInvitacionEmail({ invitado: "SOYBELUZ", curso: "Retrato", aceptado: true, enlace }).subject).toBe("SOYBELUZ aceptó tu curso Retrato");
    expect(buildAvisoRespuestaInvitacionEmail({ invitado: "SOYBELUZ", curso: "Retrato", aceptado: false, enlace }).subject).toBe("SOYBELUZ rechazó tu curso Retrato");
  });
});
