import { describe, expect, it } from "vitest";
import { buildEnrollmentEmailBody } from "./email";
import { renderEmailSignature } from "@repo/communications/signature";

const input = {
  to: "socio@example.com",
  studentName: "Juan",
  courseTitle: "Iluminación I",
  instanceLabel: "Marzo 2026",
  startDateTime: new Date("2026-03-01T14:00:00Z"),
  endDateTime: new Date("2026-03-01T18:00:00Z"),
  locationName: "Sede SFPR",
  locationAddress: "Calle 123",
  classroomLink: null,
  classroomCode: null,
  classroomInstructions: null,
};

const signature = renderEmailSignature({
  organizationName: "SFPR",
  email: "info@sfpr.test",
  institutionalNote: "Asociación Civil",
});

describe("firma en el email de cursos", () => {
  it("aparece UNA sola vez en el HTML", () => {
    const { html } = buildEnrollmentEmailBody(input, signature);
    expect((html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
  });

  it("aparece UNA sola vez en el texto plano", () => {
    const { text } = buildEnrollmentEmailBody(input, signature);
    expect(text.split("Asociación Civil").length - 1).toBe(1);
  });

  it("no duplica el cierre: el del template sigue siendo el único", () => {
    const { html } = buildEnrollmentEmailBody(input, signature);
    expect((html.match(/Gracias por elegirnos/g) ?? []).length).toBe(1);
  });

  it("el cuerpo conserva los datos del curso", () => {
    const { html, text } = buildEnrollmentEmailBody(input, signature);
    for (const body of [html, text]) {
      expect(body).toContain("Iluminación I");
      expect(body).toContain("Marzo 2026");
      expect(body).toContain("Sede SFPR");
      expect(body).toContain("Juan");
    }
  });

  it("sin firma el email sigue armándose", () => {
    const { html, text } = buildEnrollmentEmailBody(input, null);
    expect(html).toContain("Iluminación I");
    expect(text).toContain("Iluminación I");
    expect(html).not.toContain('id="fo-signature"');
  });

  it("el texto plano no arrastra marcado del HTML", () => {
    const { text } = buildEnrollmentEmailBody(input, signature);
    expect(text).not.toMatch(/<div|<p>|<strong|<table|<br>/i);
  });
});
