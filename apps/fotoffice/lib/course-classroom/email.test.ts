// lib/course-classroom/email.test.ts
import { describe, expect, it } from "vitest";
import {
  buildBienvenidaAlumnoEmailBody,
  buildClassroomAccessEmailBody,
  buildCursoEnTuPortalEmailBody,
  enlaceDelAula,
  escaparHtml,
} from "./email";

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

describe("correo: el curso ya está en tu portal", () => {
  const base = {
    studentName: "Ana <b>",
    courseTitle: "Retrato",
    portalUrl: "https://fotoffice.com/portal/cursos",
    expiresAt: new Date(Date.UTC(2027, 9, 4, 2)),
    invitacion: null,
  };

  it("lleva el botón al portal y el vencimiento en fecha argentina", () => {
    const { html, text } = buildCursoEnTuPortalEmailBody(base, null);
    expect(html).toContain('href="https://fotoffice.com/portal/cursos"');
    expect(text).toContain("https://fotoffice.com/portal/cursos");
    expect(text).toContain("3 de octubre de 2027");
    expect(html).toContain("Ana &lt;b&gt;");
  });

  it("sin vencimiento (beneficio) no inventa una fecha", () => {
    const { text } = buildCursoEnTuPortalEmailBody({ ...base, expiresAt: null }, null);
    expect(text).not.toMatch(/hasta el/);
  });

  it("con invitación, suma la línea para asociarse", () => {
    const { html, text } = buildCursoEnTuPortalEmailBody(
      { ...base, invitacion: { institucion: "SFPR", url: "https://fotoffice.com/w/sfpr/asociarse" } },
      null,
    );
    expect(html).toContain('href="https://fotoffice.com/w/sfpr/asociarse"');
    expect(text).toContain("Hacete socio de SFPR");
  });
});

describe("correo: bienvenida con creación de contraseña", () => {
  const base = {
    studentName: "Ana",
    courseTitle: "Retrato",
    crearContrasenaUrl: "https://fotoffice.com/recuperar/tok",
    loginUrl: "https://fotoffice.com/login?next=/portal/cursos",
    expiresAt: new Date(Date.UTC(2027, 9, 4, 2)),
    invitacion: null,
  };

  it("lleva el botón para crear la contraseña y la alternativa de entrar", () => {
    const { html, text } = buildBienvenidaAlumnoEmailBody(base, null);
    expect(html).toContain('href="https://fotoffice.com/recuperar/tok"');
    expect(html).toContain('href="https://fotoffice.com/login?next=/portal/cursos"');
    expect(text).toContain("Crear mi contraseña");
    expect(text).toContain("Google");
  });

  it("la firma entra una sola vez", () => {
    const firma = { html: "<p>Firma SFPR</p>", text: "Firma SFPR" };
    const { html, text } = buildBienvenidaAlumnoEmailBody(base, firma);
    expect(html.split("Firma SFPR").length - 1).toBe(1);
    expect(text.split("Firma SFPR").length - 1).toBe(1);
  });
});
