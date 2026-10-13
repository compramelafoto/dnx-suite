import { describe, expect, it } from "vitest";
import { buildInstitutionSummaryEmail } from "./institution-email";

const base = {
  raffleTitle: "Sorteo del Mes!",
  drawsAt: new Date("2026-10-11T23:00:00Z"),
  entrantsCount: 28,
  pickupDeadline: new Date("2026-10-26T23:00:01Z"),
  memberWord: "socio",
  memberWordPlural: "socios",
  adminUrl: "https://fotoffice.com/sorteos/r-1",
  signature: null,
  prizes: [
    {
      prizeTitle: "Limpieza de sensor",
      partnerName: "Tecnoflash",
      winnerFullName: "Diego Luis Rovere",
      winnerMemberNumber: "565",
      winnerEmail: "fotorovere@yahoo.com.ar",
      winnerPhone: "341 555-1234",
      winnerNotified: true,
      winnerNoticeError: null,
      sponsorNotified: true,
      sponsorNoticeError: null,
    },
    {
      prizeTitle: "Porta tapa de lente de cuero",
      partnerName: "Proyecto Design",
      winnerFullName: "Gabriel Villagomez",
      winnerMemberNumber: "714",
      winnerEmail: null,
      winnerPhone: null,
      winnerNotified: false,
      winnerNoticeError: "El socio no tiene correo cargado. Hay que avisarle por teléfono.",
      sponsorNotified: false,
      sponsorNoticeError: "El aliado no tiene correo cargado en el premio.",
    },
  ],
};

describe("el resumen del sorteo para la institución", () => {
  const correo = buildInstitutionSummaryEmail(base);

  it("dice en el asunto qué sorteo y que trae los ganadores", () => {
    expect(correo.subject).toBe("Ganadores de Sorteo del Mes!");
  });

  it("cuenta cuándo se hizo y entre cuántos, en hora argentina", () => {
    expect(correo.text).toContain("11 de octubre de 2026");
    expect(correo.text).toContain("entre 28 socios al día");
  });

  it("trae a cada ganador con su número y sus datos de contacto completos", () => {
    expect(correo.text).toContain("Limpieza de sensor (lo dona Tecnoflash)");
    expect(correo.text).toContain("Diego Luis Rovere, socio N° 565");
    expect(correo.text).toContain("fotorovere@yahoo.com.ar");
    expect(correo.text).toContain("341 555-1234");
  });

  it("dice si al ganador y al aliado ya se les avisó", () => {
    expect(correo.text).toContain("Ya le avisamos por correo al ganador y a Tecnoflash.");
  });

  it("si un aviso no salió, lo marca y dice por qué, para que alguien llame", () => {
    expect(correo.text).toContain("No le pudimos avisar al ganador: El socio no tiene correo cargado.");
    expect(correo.text).toContain("No le pudimos avisar a Proyecto Design: El aliado no tiene correo cargado");
    expect(correo.html).toContain("No le pudimos avisar");
  });

  it("si al ganador le falta el contacto, lo dice en vez de dejar un hueco", () => {
    expect(correo.text).toContain("Sin correo ni teléfono cargados.");
  });

  it("dice hasta cuándo se retira y qué hacer con los remitos", () => {
    expect(correo.text).toContain("26 de octubre de 2026");
    expect(correo.text).toContain("remito");
  });

  it("lleva al sorteo en el panel", () => {
    expect(correo.html).toContain("https://fotoffice.com/sorteos/r-1");
  });

  it("escapa lo que viene de la base", () => {
    const raro = buildInstitutionSummaryEmail({
      ...base,
      prizes: [{ ...base.prizes[0], winnerFullName: "<b>Ana</b>" }],
    });
    expect(raro.html).not.toContain("<b>Ana</b>");
    expect(raro.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  });
});
