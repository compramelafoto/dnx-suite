import { describe, expect, it } from "vitest";
import { buildTeamInvitationEmail, buildTeamInvitationUrl } from "./invitation-email";

const BASE = {
  organizationName: "Club <SFPR>",
  roleLabel: "Equipo",
  inviterName: "Ana & Co",
  url: "https://app.test/invitacion/equipo/abc",
  signature: { html: "<p>firma</p>", text: "firma-texto" },
};

describe("email de invitación de equipo", () => {
  it("el asunto lleva la organización", () => {
    expect(buildTeamInvitationEmail(BASE).subject).toBe(
      "Club <SFPR>: te invitaron a sumarte al equipo",
    );
  });

  it("html y texto llevan url, rol y vencimiento", () => {
    const { html, text } = buildTeamInvitationEmail(BASE);
    for (const b of [html, text]) {
      expect(b).toContain(BASE.url);
      expect(b).toContain("Equipo");
      expect(b).toContain("vence en 7 días");
    }
    expect(text).toContain("firma-texto");
    expect(html).toContain("fo-signature");
  });

  it("escapa el HTML de organización e invitante", () => {
    const { html } = buildTeamInvitationEmail(BASE);
    expect(html).toContain("Club &lt;SFPR&gt;");
    expect(html).toContain("Ana &amp; Co");
    expect(html).not.toContain("<SFPR>");
  });

  it("sin firma no hay fo-signature", () => {
    const { html } = buildTeamInvitationEmail({ ...BASE, signature: null });
    expect(html).not.toContain("fo-signature");
  });
});

describe("buildTeamInvitationUrl", () => {
  it("falla sin APP_URL", () => {
    expect(buildTeamInvitationUrl("x", {})).toEqual({ ok: false });
  });
  it("arma la url con el token escapado", () => {
    expect(buildTeamInvitationUrl("abc+", { APP_URL: "https://app.test/" })).toEqual({
      ok: true,
      url: "https://app.test/invitacion/equipo/abc%2B",
    });
  });
});
