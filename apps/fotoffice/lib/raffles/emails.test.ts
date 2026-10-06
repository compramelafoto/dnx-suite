import { describe, expect, it } from "vitest";
import { buildResultsEmail, buildSponsorNoticeEmail, buildWinnerNoticeEmail } from "./emails";

const VENCE = new Date("2026-10-15T23:59:59Z");

const premio = {
  raffleTitle: "Sorteo de septiembre",
  prizeTitle: "Mochila para equipo fotográfico",
  prizeConditions: "Se retira personalmente, con carnet de socio.",
  partnerName: "Casa de Fotografía Norte",
  partnerEmail: "ventas@casanorte.com.ar",
  partnerAddress: "San Martín 1234, Rosario",
  partnerPhone: "341 555-0198",
  partnerHours: "Lunes a viernes de 9 a 18",
  pickupDeadline: VENCE,
  institutionName: "Sociedad de Fotógrafos Profesionales de Rosario",
  signature: null,
};

describe("el aviso al ganador", () => {
  const email = buildWinnerNoticeEmail({ ...premio, winnerFirstName: "Ana" });

  it("le dice qué ganó en el asunto", () => {
    expect(email.subject).toContain("Mochila para equipo fotográfico");
  });

  it("lo saluda por su nombre", () => {
    expect(email.text).toContain("Hola Ana");
  });

  it("dice hasta cuándo tiene, con la fecha escrita en castellano", () => {
    expect(email.text).toContain("15 de octubre de 2026");
  });

  it("avisa que si no va a tiempo pierde el premio", () => {
    expect(email.text.toLowerCase()).toMatch(/pierde|perdés|no vas/);
  });

  it("le pide coordinar la entrega con el aliado y le da todos sus datos de contacto", () => {
    expect(email.text.toLowerCase()).toContain("coordiná");
    expect(email.text).toContain("Casa de Fotografía Norte");
    expect(email.text).toContain("ventas@casanorte.com.ar");
    expect(email.text).toContain("San Martín 1234, Rosario");
    expect(email.text).toContain("341 555-0198");
    expect(email.text).toContain("Lunes a viernes de 9 a 18");
  });

  it("le aclara que el envío, si hace falta, lo paga el ganador", () => {
    expect(email.text).toContain("el costo del envío lo pagás vos");
  });

  it("no le dice que vaya al local: el aliado puede estar en otra ciudad", () => {
    expect(email.text).not.toContain("Lo retirás en");
  });

  it("le recuerda llevar el carnet", () => {
    expect(email.text.toLowerCase()).toContain("carnet");
  });

  it("incluye las condiciones del premio cuando las hay", () => {
    expect(email.text).toContain("Se retira personalmente, con carnet de socio.");
  });

  it("sin dirección cargada, no deja un renglón vacío ni escribe null", () => {
    const sinDatos = buildWinnerNoticeEmail({
      ...premio,
      winnerFirstName: "Ana",
      partnerEmail: null,
      partnerAddress: null,
      partnerPhone: null,
      partnerHours: null,
    });
    expect(sinDatos.text).not.toContain("null");
    expect(sinDatos.text).not.toMatch(/\n\s*\n\s*\n/);
  });

  it("no le habla de padrones, tandas ni estados internos", () => {
    const t = email.text.toLowerCase();
    for (const jerga of ["padrón", "workspace", "drand", "tanda", "ganado", "award"]) {
      expect(t).not.toContain(jerga);
    }
  });

  it("el HTML escapa lo que viene de la base", () => {
    const conComillas = buildWinnerNoticeEmail({
      ...premio,
      winnerFirstName: "Ana",
      partnerName: 'Casa "Norte" & Cía',
    });
    expect(conComillas.html).toContain("&quot;");
    expect(conComillas.html).toContain("&amp;");
  });
});

describe("el aviso al aliado que dona el premio", () => {
  const email = buildSponsorNoticeEmail({
    ...premio,
    winnerFullName: "Ana Díaz",
    winnerMemberNumber: "114",
    winnerEmail: "ana.diaz@example.com",
    winnerPhone: "341 600-1234",
    receiptEmail: "sfprosario@gmail.com",
  });

  it("le pasa el correo y el teléfono del ganador para coordinar la entrega", () => {
    expect(email.text).toContain("ana.diaz@example.com");
    expect(email.text).toContain("341 600-1234");
    expect(email.text.toLowerCase()).toContain("coordinar la entrega");
  });

  it("aclara que el envío, si hace falta, lo paga el ganador", () => {
    expect(email.text).toContain("el costo del envío lo paga el ganador");
  });

  it("sin contacto del ganador, ofrece a la institución como intermediaria", () => {
    const sinContacto = buildSponsorNoticeEmail({
      ...premio,
      winnerFullName: "Ana Díaz",
      winnerMemberNumber: "114",
      receiptEmail: "sfprosario@gmail.com",
    });
    expect(sinContacto.text).toContain("No tenemos su correo ni su teléfono");
    expect(sinContacto.text).not.toContain("null");
  });

  it("dice quién ganó, con nombre y número de socio", () => {
    expect(email.text).toContain("Ana Díaz");
    expect(email.text).toContain("114");
  });

  it("dice qué ganó y hasta cuándo tiene para retirarlo", () => {
    expect(email.text).toContain("Mochila para equipo fotográfico");
    expect(email.text).toContain("15 de octubre de 2026");
  });

  it("avisa que pasada esa fecha el premio se pierde", () => {
    expect(email.text.toLowerCase()).toMatch(/pierde|vencid|ya no/);
  });

  it("pide el remito por correo, y dice a cuál", () => {
    expect(email.text.toLowerCase()).toContain("remito");
    expect(email.text).toContain("sfprosario@gmail.com");
  });

  it("aclara que puede ser una foto o un PDF sin valor comercial", () => {
    const t = email.text.toLowerCase();
    expect(t).toMatch(/foto|pdf/);
    expect(t).toMatch(/sin valor comercial|costo \$?\s?0/);
  });

  it("pide el comprobante para después de la entrega, no antes", () => {
    expect(email.text.toLowerCase()).toMatch(/cuando le entreguen/);
  });

  it("el asunto identifica el premio y la institución", () => {
    expect(email.subject).toContain("Mochila para equipo fotográfico");
  });
});

describe("buildResultsEmail", () => {
  const base = {
    raffleTitle: "Sorteo del Mes!",
    winners: [
      { prizeTitle: "Limpieza de sensor", partnerName: "Tecnoflash", winnerName: "Daniel Andrés C. · Socio N° 556" },
      { prizeTitle: "50% en cursos", partnerName: null, winnerName: "Ana D. · Socio N° 12" },
    ],
    publicUrl: "https://fotoffice.com/w/sfpr/sorteos/abc",
    recipientFirstName: "Laura",
    memberWordPlural: "socios",
    signature: null,
  };

  it("lista a cada ganador con su premio y el enlace a la página pública", () => {
    const m = buildResultsEmail({ ...base, participated: true });
    expect(m.subject).toBe("Resultados de Sorteo del Mes!");
    expect(m.text).toContain("Limpieza de sensor (lo dona Tecnoflash): Daniel Andrés C. · Socio N° 556");
    expect(m.text).toContain("https://fotoffice.com/w/sfpr/sorteos/abc");
    expect(m.html).toContain("Ver el sorteo");
  });

  it("al que no participó le dice por qué y cómo entrar en el próximo", () => {
    expect(buildResultsEmail({ ...base, participated: false }).text).toContain("ponete al día");
    expect(buildResultsEmail({ ...base, participated: true }).text).not.toContain("ponete al día");
  });

  it("escapa lo que viene de la base", () => {
    const m = buildResultsEmail({
      ...base,
      participated: true,
      winners: [{ prizeTitle: "<b>x</b>", partnerName: null, winnerName: "A" }],
    });
    expect(m.html).not.toContain("<b>x</b>");
  });
});
