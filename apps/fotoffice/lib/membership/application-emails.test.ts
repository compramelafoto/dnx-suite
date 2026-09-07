import { describe, expect, it } from "vitest";
import { renderEmailSignature } from "@repo/communications/signature";
import {
  buildApplicationAlertEmail,
  buildApplicationApprovedEmail,
  buildApplicationExpiredEmail,
  buildApplicationReceivedEmail,
  buildApplicationRejectedEmail,
  buildApplicationReminderEmail,
  buildMembershipWelcomeEmail,
  type EmailBody,
} from "./application-emails";

const signature = renderEmailSignature({
  organizationName: "Club SFPR",
  email: "info@sfpr.test",
  institutionalNote: "marca-de-firma",
});

const APROBADA = {
  firstName: "Ana",
  institution: "Club SFPR",
  memberNumber: "735",
  activationUrl: "https://fotoffice.com/invitacion/abc123",
  totalLabel: "$24.000",
  duesCount: 3,
  deadlineLabel: "6 de octubre",
  includesPrintedCard: false,
  activationTtlLabel: "14 días",
  signature,
};

const todos: Array<[string, EmailBody]> = [
  ["recibida", buildApplicationReceivedEmail({ firstName: "Ana", institution: "Club SFPR", signature })],
  [
    "aviso a la Secretaría",
    buildApplicationAlertEmail({
      applicantName: "Ana Pérez",
      institution: "Club SFPR",
      inboxUrl: "https://fotoffice.com/members/solicitudes",
      signature,
    }),
  ],
  ["aprobada", buildApplicationApprovedEmail(APROBADA)],
  [
    "rechazada",
    buildApplicationRejectedEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      reason: "Falta el certificado de alumno regular.",
      signature,
    }),
  ],
  [
    "recordatorio",
    buildApplicationReminderEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      totalLabel: "$24.000",
      daysLeft: 7,
      deadlineLabel: "6 de octubre",
      access: { kind: "PORTAL", url: "https://fotoffice.com/portal/cuotas" },
      signature,
    }),
  ],
  [
    "vencida",
    buildApplicationExpiredEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      applyUrl: "https://fotoffice.com/w/sfpr/asociarse",
      signature,
    }),
  ],
  [
    "bienvenida",
    buildMembershipWelcomeEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      memberNumber: "735",
      cardUrl: "https://fotoffice.com/portal/carnet",
      needsPhotoForPrintedCard: false,
      hasAccount: true,
      signature,
    }),
  ],
];

describe("los emails del circuito, todos", () => {
  it.each(todos)("«%s» nombra a la institución", (_nombre, body) => {
    for (const parte of [body.subject, body.html, body.text]) {
      expect(parte).toContain("Club SFPR");
    }
  });

  /**
   * El vocabulario interno es la forma más fácil de que un email institucional se lea como un
   * volcado de la base. Quien lo recibe no sabe qué es un workspace ni le importa.
   */
  it.each(todos)("«%s» no filtra vocabulario interno", (_nombre, body) => {
    for (const parte of [body.subject, body.html, body.text]) {
      const texto = parte.toLowerCase();
      for (const palabra of [
        "workspace",
        "membershipapplication",
        "aprobada_impaga",
        "pendiente_pago",
        "token",
        "prisma",
        "null",
        "undefined",
      ]) {
        expect(texto).not.toContain(palabra);
      }
    }
  });

  it.each(todos)("«%s» lleva la firma una sola vez y en las dos versiones", (_nombre, body) => {
    expect(body.html.split("marca-de-firma").length - 1).toBe(1);
    expect(body.text).toContain("marca-de-firma");
  });

  it.each(todos)("«%s» manda texto plano sin marcado", (_nombre, body) => {
    expect(body.text).not.toContain("<p>");
    expect(body.text).not.toContain("<div>");
    expect(body.text).not.toContain("&amp;");
  });

  /** El asunto viaja como encabezado: escaparlo le mostraría entidades al destinatario. */
  it("el asunto no se escapa", () => {
    const body = buildApplicationReceivedEmail({
      firstName: "Ana",
      institution: "Luz & Sombra",
      signature: null,
    });
    expect(body.subject).toContain("Luz & Sombra");
    expect(body.subject).not.toContain("&amp;");
  });

  it("el cuerpo HTML sí se escapa", () => {
    const body = buildApplicationRejectedEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      reason: '<script>alert("x")</script>',
      signature: null,
    });
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("&lt;script&gt;");
  });

  it("sin firma cargada, el email sale igual", () => {
    const body = buildApplicationReceivedEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      signature: null,
    });
    expect(body.html).toContain("Club SFPR");
    expect(body.html).not.toContain("fo-signature");
  });
});

describe("aprobación", () => {
  it("dice el número de socio, el total y la fecha límite", () => {
    const { html, text } = buildApplicationApprovedEmail(APROBADA);
    for (const body of [html, text]) {
      expect(body).toContain("735");
      expect(body).toContain("$24.000");
      expect(body).toContain("6 de octubre");
      expect(body).toContain("tus primeras 3 cuotas");
    }
  });

  it("lleva el enlace de activación, que es lo único que le permite pagar", () => {
    const { html, text } = buildApplicationApprovedEmail(APROBADA);
    expect(html).toContain("https://fotoffice.com/invitacion/abc123");
    expect(text).toContain("https://fotoffice.com/invitacion/abc123");
  });

  it("menciona la credencial impresa solo si la pagó", () => {
    const con = buildApplicationApprovedEmail({ ...APROBADA, includesPrintedCard: true });
    expect(con.text).toContain("credencial impresa");
    expect(buildApplicationApprovedEmail(APROBADA).text).not.toContain("credencial impresa");
  });

  it("con una sola cuota no dice «tus primeras 1 cuotas»", () => {
    const uno = buildApplicationApprovedEmail({ ...APROBADA, duesCount: 1 });
    expect(uno.text).toContain("tu primera cuota");
    expect(uno.text).not.toContain("1 cuotas");
  });

  it("avisa las dos consecuencias: que el enlace vence y que el plazo vence", () => {
    const { text } = buildApplicationApprovedEmail(APROBADA);
    expect(text).toContain("El enlace vence en 14 días");
    expect(text).toContain("queda sin efecto");
  });
});

describe("rechazo", () => {
  it("transcribe el motivo tal cual", () => {
    const { html, text } = buildApplicationRejectedEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      reason: "Falta el certificado de alumno regular.",
      signature,
    });
    for (const body of [html, text]) {
      expect(body).toContain("Falta el certificado de alumno regular.");
    }
  });

  it("no cierra la puerta: dice cómo volver a intentarlo", () => {
    const { text } = buildApplicationRejectedEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      reason: "Falta el certificado.",
      signature: null,
    });
    expect(text).toContain("respondé este correo");
  });
});

describe("recordatorio", () => {
  it("dice cuántos días quedan en el asunto", () => {
    const body = buildApplicationReminderEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      totalLabel: "$24.000",
      daysLeft: 7,
      deadlineLabel: "6 de octubre",
      access: { kind: "PORTAL", url: "https://fotoffice.com/portal/cuotas" },
      signature: null,
    });
    expect(body.subject).toContain("Te quedan 7 días");
  });

  it("con un día no dice «1 días»", () => {
    const body = buildApplicationReminderEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      totalLabel: "$24.000",
      daysLeft: 1,
      deadlineLabel: "6 de octubre",
      access: { kind: "PORTAL", url: "https://fotoffice.com/portal/cuotas" },
      signature: null,
    });
    expect(body.subject).toContain("Te queda un día");
    expect(body.subject).not.toContain("1 días");
  });

  /**
   * A quien no activó su cuenta el enlace de la aprobación ya se le venció: mandarlo al portal
   * lo dejaría frente a un login que no puede pasar.
   */
  it("a quien no activó su cuenta le ofrece activarla, no entrar", () => {
    const body = buildApplicationReminderEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      totalLabel: "$24.000",
      daysLeft: 3,
      deadlineLabel: "6 de octubre",
      access: { kind: "INVITACION", url: "https://fotoffice.com/invitacion/nuevo" },
      signature: null,
    });
    expect(body.html).toContain("Activar mi cuenta y pagar");
    expect(body.text).toContain("https://fotoffice.com/invitacion/nuevo");
  });
});

describe("bienvenida", () => {
  it("confirma el pago y da el número de socio", () => {
    const body = buildMembershipWelcomeEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      memberNumber: "735",
      cardUrl: "https://fotoffice.com/portal/carnet",
      needsPhotoForPrintedCard: false,
      hasAccount: true,
      signature: null,
    });
    expect(body.subject).toContain("Ya sos socio de Club SFPR");
    expect(body.text).toContain("735");
    expect(body.text).toContain("Registramos tu pago");
  });

  it("a quien no activó su cuenta le dice cómo hacerlo, en vez de mandarlo a una pantalla que no puede abrir", () => {
    const sinCuenta = buildMembershipWelcomeEmail({
      firstName: "Ana",
      institution: "Club SFPR",
      memberNumber: "735",
      cardUrl: "https://fotoffice.com/portal/carnet",
      needsPhotoForPrintedCard: false,
      hasAccount: false,
      signature: null,
    });
    expect(sinCuenta.text).toContain("activar tu cuenta");
  });

  it("pide la foto solo si pagó la credencial impresa y todavía no la subió", () => {
    const base = {
      firstName: "Ana",
      institution: "Club SFPR",
      memberNumber: "735",
      cardUrl: "https://fotoffice.com/portal/carnet",
      hasAccount: true,
      signature: null,
    };
    expect(
      buildMembershipWelcomeEmail({ ...base, needsPhotoForPrintedCard: true }).text,
    ).toContain("tu foto");
    expect(
      buildMembershipWelcomeEmail({ ...base, needsPhotoForPrintedCard: false }).text,
    ).not.toContain("tu foto");
  });
});
