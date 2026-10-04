// lib/course-classroom/email.test.ts
import { describe, expect, it } from "vitest";
import { buildClassroomAccessEmailBody, enlaceDelAula, escaparHtml } from "./email";

const input = {
  studentName: "Ana <b>Pérez</b>",
  courseTitle: "Retrato con luz natural",
  enlace: "https://fotoffice.com/aula/abc123",
  expiresAt: new Date(Date.UTC(2027, 9, 4, 2)),
};
const firma = { html: "<p>Firma SFPR</p>", text: "Firma SFPR" };

describe("correo con el enlace al aula", () => {
  it("arma el enlace sin barras dobles", () => {
    expect(enlaceDelAula("https://fotoffice.com/", "tok")).toBe("https://fotoffice.com/aula/tok");
  });

  it("lleva el enlace en las dos variantes", () => {
    const { html, text } = buildClassroomAccessEmailBody(input, null);
    expect(html).toContain('href="https://fotoffice.com/aula/abc123"');
    expect(text).toContain("https://fotoffice.com/aula/abc123");
  });

  it("escapa el nombre que escribió el alumno: el formulario es público", () => {
    const { html } = buildClassroomAccessEmailBody(input, null);
    expect(html).not.toContain("<b>Pérez</b>");
    expect(html).toContain("Ana &lt;b&gt;Pérez&lt;/b&gt;");
  });

  it("dice hasta cuándo, en fecha argentina", () => {
    const { text } = buildClassroomAccessEmailBody(input, null);
    expect(text).toContain("3 de octubre de 2027");
  });

  it("la firma entra una sola vez en cada variante", () => {
    const { html, text } = buildClassroomAccessEmailBody(input, firma);
    expect(html.split("Firma SFPR").length - 1).toBe(1);
    expect(text.split("Firma SFPR").length - 1).toBe(1);
  });

  it("escaparHtml cubre comillas", () => {
    expect(escaparHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });

  it("el reenvío no dice que el pago fue aprobado y avisa que el enlace anterior no sirve", () => {
    const { html, text } = buildClassroomAccessEmailBody({ ...input, courseTitle: "Retrato <i>", reenvio: true }, null);
    expect(html).toContain("Te mandamos un enlace nuevo para entrar a <strong>Retrato &lt;i&gt;</strong>. El anterior ya no funciona.");
    expect(text).toContain("Te mandamos un enlace nuevo para entrar a Retrato <i>. El anterior ya no funciona.");
    expect(html).not.toContain("Tu pago fue aprobado");
    expect(text).not.toContain("Tu pago fue aprobado");
  });

  it("sin reenvío sigue diciendo que el pago fue aprobado", () => {
    expect(buildClassroomAccessEmailBody(input, null).text).toContain("Tu pago fue aprobado");
  });
});
