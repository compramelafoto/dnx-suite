import { describe, expect, it } from "vitest";
import { buildAvisoPedidoDeReventaEmail, buildAvisoRespuestaReventaEmail } from "./aviso-reventa";

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
