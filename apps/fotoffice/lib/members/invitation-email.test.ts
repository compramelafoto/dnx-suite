import { describe, expect, it } from "vitest";
import { renderEmailSignature } from "@repo/communications/signature";
import { buildInvitationEmailBody } from "./invitation-email";

const signature = renderEmailSignature({
  organizationName: "Club SFPR",
  email: "info@sfpr.test",
  institutionalNote: "marca-de-firma",
});

const BASE = {
  memberFirstName: "Juan",
  institution: "Club SFPR",
  invitationUrl: "https://fotoffice.com/invitacion/abc123",
  signature,
};

describe("email de invitación", () => {
  it("usa el asunto acordado", () => {
    expect(buildInvitationEmailBody(BASE).subject).toBe(
      "Club SFPR te invita a acceder a FotoOffice",
    );
  });

  it("saluda al socio por su nombre", () => {
    const { html, text } = buildInvitationEmailBody(BASE);
    for (const body of [html, text]) expect(body).toContain("Juan");
  });

  it("identifica a la institución y explica para qué sirve", () => {
    const { html, text } = buildInvitationEmailBody(BASE);
    for (const body of [html, text]) {
      expect(body).toContain("Club SFPR");
      expect(body).toContain("activar tu acceso a FotoOffice");
      expect(body).toContain("pone a disposición de sus socios");
    }
  });

  it("lleva el botón con el enlace", () => {
    const { html, text } = buildInvitationEmailBody(BASE);
    expect(html).toContain("Activar mi acceso");
    expect(html).toContain("https://fotoffice.com/invitacion/abc123");
    // En texto plano el enlace va escrito: no hay botón donde hacer clic.
    expect(text).toContain("https://fotoffice.com/invitacion/abc123");
  });

  it("avisa el vencimiento de 72 horas", () => {
    const { html, text } = buildInvitationEmailBody(BASE);
    for (const body of [html, text]) expect(body).toContain("72 horas");
  });

  it("incluye el aviso para ignorarlo", () => {
    const { html, text } = buildInvitationEmailBody(BASE);
    for (const body of [html, text]) expect(body.toLowerCase()).toContain("ignorá");
  });

  it("la firma aparece UNA sola vez en HTML y en texto", () => {
    const { html, text } = buildInvitationEmailBody(BASE);
    expect((html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
    expect(text.split("marca-de-firma").length - 1).toBe(1);
  });

  it("sin firma cargada el email igual se arma", () => {
    const { html, text } = buildInvitationEmailBody({ ...BASE, signature: null });
    expect(html).not.toContain('id="fo-signature"');
    expect(text).toContain("Activar mi acceso");
  });

  /** Nada de vocabulario interno: quien lo recibe no sabe qué es un workspace ni un token. */
  it.each(["workspace", "Member", "token", "memberId", "userId"])(
    "no menciona %s",
    (word) => {
      const { subject, html, text } = buildInvitationEmailBody(BASE);
      const haystack = `${subject} ${html} ${text}`.toLowerCase();
      expect(haystack).not.toContain(word.toLowerCase());
    },
  );

  /** Hoy no hay pagos ni comprobantes: prometerlos sería mentir. */
  it.each(["pagos", "comprobantes", "beneficios", "cuotas"])(
    "no promete la función %s",
    (word) => {
      const { html, text } = buildInvitationEmailBody(BASE);
      expect(`${html} ${text}`.toLowerCase()).not.toContain(word);
    },
  );

  it("escapa el nombre del socio y de la institución en el HTML", () => {
    const { html } = buildInvitationEmailBody({
      ...BASE,
      memberFirstName: '<script>alert(1)</script>',
      institution: "Foto & Video",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Foto &amp; Video");
  });

  it("el texto plano no arrastra marcado", () => {
    const { text } = buildInvitationEmailBody(BASE);
    expect(text).not.toMatch(/<div|<p>|<a |<table|<br\s*\/?>/i);
  });
});
