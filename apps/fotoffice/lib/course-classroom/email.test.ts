// lib/course-classroom/email.test.ts
import { describe, expect, it } from "vitest";
import {
  buildBienvenidaAlumnoEmailBody,
  buildCursoEnTuPortalEmailBody,
  escaparHtml,
} from "./email";

describe("escapar HTML", () => {
  it("escaparHtml cubre comillas", () => {
    expect(escaparHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
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
