import { describe, expect, it } from "vitest";
import { buildAvisoBeneficiarioEmail } from "./aviso-beneficiario";

describe("aviso: te sumaron como beneficiario", () => {
  const input = { dueno: "SFPR <b>", curso: "Retrato", porcentaje: "50%", rol: "Docente", enlace: "https://fotoffice.com/dashboard/cursos-compartidos" };

  it("dice quién, qué curso, cuánto y lleva el enlace", () => {
    const { subject, html, text } = buildAvisoBeneficiarioEmail(input);
    expect(subject).toBe("Te sumaron como beneficiario de Retrato");
    expect(text).toContain("50%");
    expect(text).toContain("Docente");
    expect(html).toContain('href="https://fotoffice.com/dashboard/cursos-compartidos"');
  });

  it("escapa lo que viene de afuera", () => {
    expect(buildAvisoBeneficiarioEmail(input).html).toContain("SFPR &lt;b&gt;");
  });
});
