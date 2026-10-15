import { describe, expect, it } from "vitest";
import { buildDuesReminderEmail, fechaConDiaYHora, type ReminderRaffle } from "./dues-reminder-email";

const sorteo: ReminderRaffle = {
  title: "Sorteo del Mes",
  drawsAtLabel: "domingo 11 de octubre a las 20 h",
  entriesCloseAtLabel: "sábado 10 de octubre a las 20 h",
  prizes: [
    {
      title: "Limpieza de sensor",
      description: null,
      partnerName: "Tecnoflash",
      logoUrl: "https://fotoffice.com/sorteos/aliados/tecnoflash.png",
    },
    { title: "50% de descuento en cursos", description: null, partnerName: "Arte en Foco", logoUrl: null },
  ],
  url: "https://fotoffice.com/portal/sorteos/abc",
};

const base = {
  firstName: "Laura",
  institution: "SFPR",
  current: {
    label: "Cuota de octubre de 2026",
    balanceMinor: 800000,
    dueDateLabel: "10 de octubre",
    monthLabel: "octubre",
  },
  overdue: [],
  duesUrl: "https://fotoffice.com/portal/cuotas",
  raffle: null,
  signature: null,
};

describe("buildDuesReminderEmail", () => {
  it("dice el mes, el vencimiento y el importe", () => {
    const e = buildDuesReminderEmail(base);
    expect(e.subject).toBe("Tu cuota de octubre vence el 10 de octubre");
    expect(e.text).toContain("$ 8.000,00");
  });

  it("suma lo atrasado al total", () => {
    const e = buildDuesReminderEmail({
      ...base,
      overdue: [{ label: "Cuota de septiembre de 2026", balanceMinor: 800000 }],
    });
    expect(e.text).toContain("Cuota de septiembre de 2026 ($ 8.000,00)");
    expect(e.text).toContain("En total son $ 16.000,00");
  });

  it("sin sorteo abierto no menciona sorteos", () => {
    const e = buildDuesReminderEmail(base);
    expect(`${e.subject} ${e.text}`.toLowerCase()).not.toContain("sorte");
  });

  it("con sorteo lista los premios, quién los dona y cuándo cierra", () => {
    const e = buildDuesReminderEmail({ ...base, raffle: sorteo });
    expect(e.subject).toContain("hay sorteo");
    expect(e.text).toContain("1. Limpieza de sensor — lo dona Tecnoflash");
    expect(e.text).toContain("2. 50% de descuento en cursos — lo dona Arte en Foco");
    expect(e.text).toContain("sábado 10 de octubre a las 20 h");
    expect(e.html).toContain('src="https://fotoffice.com/sorteos/aliados/tecnoflash.png"');
  });

  it("un premio sin logo no deja una imagen vacía", () => {
    const e = buildDuesReminderEmail({ ...base, raffle: sorteo });
    expect(e.html.match(/<img /g)).toHaveLength(1);
  });

  it("no promete el premio", () => {
    const texto = buildDuesReminderEmail({ ...base, raffle: sorteo }).text.toLowerCase();
    expect(texto).not.toContain("vas a ganar");
    expect(texto).not.toContain("te llevás");
  });

  it("escapa lo que viene de la base", () => {
    const e = buildDuesReminderEmail({
      ...base,
      raffle: { ...sorteo, prizes: [{ ...sorteo.prizes[0]!, title: "<b>x</b>" }] },
    });
    expect(e.html).not.toContain("<b>x</b>");
  });
});

describe("fechaConDiaYHora", () => {
  it("dice el día de la semana y la hora de Rosario", () => {
    expect(fechaConDiaYHora(new Date("2026-10-11T23:00:00Z"))).toBe("domingo 11 de octubre a las 20 h");
  });

  it("muestra los minutos cuando no es en punto", () => {
    expect(fechaConDiaYHora(new Date("2026-10-11T23:30:00Z"))).toBe("domingo 11 de octubre a las 20:30 h");
  });
});
