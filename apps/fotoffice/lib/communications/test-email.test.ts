import { describe, expect, it } from "vitest";
import { renderEmailSignature } from "@repo/communications/signature";
import { buildTestEmailBody } from "./test-email";

const signature = renderEmailSignature({
  organizationName: "Club SFPR",
  email: "info@sfpr.test",
  institutionalNote: "Asociación Civil",
});

const BASE = {
  workspaceName: "Club SFPR",
  signature,
  sentAt: new Date("2026-08-22T15:30:00Z"),
};

describe("cuerpo del email de prueba", () => {
  it("usa el asunto acordado, con el nombre del workspace", () => {
    const { subject } = buildTestEmailBody(BASE);
    expect(subject).toBe("Prueba de configuración de email — Club SFPR");
  });

  it("deja claro que es una prueba de configuración", () => {
    const { html, text } = buildTestEmailBody(BASE);
    for (const body of [html, text]) {
      expect(body.toLowerCase()).toContain("prueba");
      expect(body.toLowerCase()).toContain("configuración");
    }
  });

  it("incluye la firma UNA sola vez en el HTML", () => {
    const { html } = buildTestEmailBody(BASE);
    expect((html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
  });

  it("incluye la firma UNA sola vez en el texto plano", () => {
    const { text } = buildTestEmailBody(BASE);
    expect(text.split("Asociación Civil").length - 1).toBe(1);
  });

  it("sin firma el email igual se arma", () => {
    const { html, text } = buildTestEmailBody({ ...BASE, signature: null });
    expect(html).not.toContain('id="fo-signature"');
    expect(html.toLowerCase()).toContain("prueba");
    expect(text.toLowerCase()).toContain("prueba");
  });

  it("el texto plano no arrastra marcado", () => {
    const { text } = buildTestEmailBody(BASE);
    expect(text).not.toMatch(/<div|<p>|<strong|<table|<br\s*\/?>/i);
  });

  /**
   * El nombre del workspace lo escribe un administrador y termina dentro del HTML del
   * email. Se escapa, igual que hace el renderer de la firma con sus propios campos.
   */
  it("escapa el nombre del workspace en el HTML", () => {
    const { html } = buildTestEmailBody({
      ...BASE,
      workspaceName: '<script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("el asunto no se escapa: no es HTML", () => {
    const { subject } = buildTestEmailBody({ ...BASE, workspaceName: "Foto & Video" });
    expect(subject).toBe("Prueba de configuración de email — Foto & Video");
  });

  it("informa la fecha del envío", () => {
    const { html, text } = buildTestEmailBody(BASE);
    for (const body of [html, text]) expect(body).toContain("2026");
  });
});
