import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  googleCalendarUrl, openingAtFrom, openingEnd, openingHasTime, openingIcs, openingProblems, openingWhenText,
  promoteFromWaitlist, rsvpCsv, rsvpInput, rsvpPlacement, rsvpProblems, rsvpPurgeDue, rsvpState, rsvpTotals,
} from "./opening";

const a19 = openingAtFrom("2026-11-14", "19:00")!; // sábado, 22:00 UTC

describe("hora de la inauguración", () => {
  it("día y hora en hora argentina", () => {
    expect(a19.toISOString()).toBe("2026-11-14T22:00:00.000Z");
    expect(openingHasTime(a19)).toBe(true);
  });
  it("sin hora (o 00:00, las filas viejas) queda en el día", () => {
    expect(openingAtFrom("2026-11-14", null)!.getTime()).toBe(dayStartAr("2026-11-14").getTime());
    expect(openingHasTime(openingAtFrom("2026-11-14", "00:00"))).toBe(false);
    expect(openingHasTime(null)).toBe(false);
    expect(openingAtFrom("2026-13-01", "19:00")).toBeNull();
  });
  it("fin por defecto, 2 horas", () => {
    expect(openingEnd(a19, null).toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(openingEnd(a19, openingAtFrom("2026-11-14", "21:30")).toISOString()).toBe("2026-11-15T00:30:00.000Z");
    expect(openingEnd(a19, openingAtFrom("2026-11-14", "18:00")).toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });
  it("texto para la invitación", () => {
    expect(openingWhenText(a19, null)).toBe("Sábado 14 de noviembre, 19 h");
    expect(openingWhenText(a19, openingAtFrom("2026-11-14", "21:30"))).toBe("Sábado 14 de noviembre, de 19 a 21:30 h");
    expect(openingWhenText(dayStartAr("2026-11-14"), null)).toBe("Sábado 14 de noviembre");
  });
  it("problemas del formulario", () => {
    const ok = { openingDay: "2026-11-14", openingClock: "19:00", openingEndClock: "", endDay: "2026-12-01" };
    expect(openingProblems(ok)).toEqual([]);
    expect(openingProblems({ ...ok, openingClock: "25:00" })).toEqual(["La hora de la inauguración no es válida (usá 19:30, por ejemplo)."]);
    expect(openingProblems({ ...ok, openingClock: "00:00" })).toEqual(["La inauguración no puede ser a las 00:00. Si no sabés la hora, dejala vacía."]);
    expect(openingProblems({ ...ok, openingDay: "2026-12-02" })).toEqual(["La inauguración no puede ser después del cierre de la muestra."]);
    expect(openingProblems({ ...ok, openingEndClock: "18:00" })).toEqual(["La hora de fin tiene que ser después de la de inicio."]);
    expect(openingProblems({ ...ok, openingDay: "", openingClock: "19:00" })).toEqual(["Para poner la hora, elegí también el día de la inauguración."]);
  });
});

describe("cuándo se puede confirmar", () => {
  const m = {
    type: "MUESTRA", reviewStatus: "APPROVED", isVirtualOnly: false, isCancelled: false, openingAt: a19, rsvpStatus: "OPEN",
  };
  const antes = new Date("2026-11-14T21:59:00Z");
  it("abierta hasta que empieza", () => {
    expect(rsvpState(m, antes)).toBe("OPEN");
    expect(rsvpState(m, a19)).toBe("CLOSED");
  });
  it("cerrada a mano, cancelada o apagada", () => {
    expect(rsvpState({ ...m, rsvpStatus: "CLOSED" }, antes)).toBe("CLOSED");
    expect(rsvpState({ ...m, isCancelled: true }, antes)).toBe("CLOSED");
    expect(rsvpState({ ...m, rsvpStatus: "OFF" }, antes)).toBe("OFF");
  });
  it("sin página: no es muestra, no publicada, virtual o sin hora", () => {
    for (const x of [{ type: "CHARLA" }, { reviewStatus: "DRAFT" }, { isVirtualOnly: true }, { openingAt: dayStartAr("2026-11-14") }, { openingAt: null }]) {
      expect(rsvpState({ ...m, ...x }, antes), JSON.stringify(x)).toBe("UNAVAILABLE");
    }
  });
});

describe("formulario Voy", () => {
  it("limpia y normaliza", () => {
    expect(rsvpInput({ name: "  Ana   Pérez ", email: " ANA@Ejemplo.com ", companions: "2" }))
      .toEqual({ name: "Ana Pérez", email: "ana@ejemplo.com", companions: 2, emailInvalid: false });
    expect(rsvpInput({ name: "Ana", email: "", companions: "" })).toEqual({ name: "Ana", email: null, companions: 0, emailInvalid: false });
    expect(rsvpInput({ name: "Ana", email: "no-es-mail", companions: "1" }).emailInvalid).toBe(true);
  });
  it("problemas", () => {
    const ok = { name: "Ana", email: null, companions: 1, emailInvalid: false };
    expect(rsvpProblems(ok, 3)).toEqual([]);
    expect(rsvpProblems({ ...ok, name: "A" }, 3)).toEqual(["Escribí tu nombre."]);
    expect(rsvpProblems({ ...ok, name: "Ana www.spam.com" }, 3)).toEqual(["El nombre no puede tener enlaces ni direcciones de correo."]);
    expect(rsvpProblems({ ...ok, emailInvalid: true }, 3)).toEqual(["El email no es válido. Si no querés dejarlo, dejá el campo vacío."]);
    expect(rsvpProblems({ ...ok, companions: 4 }, 3)).toEqual(["Podés sumar hasta 3 acompañantes."]);
    expect(rsvpProblems({ ...ok, companions: 1 }, 0)).toEqual(["Esta invitación es personal: no admite acompañantes."]);
    expect(rsvpProblems({ ...ok, companions: Number.NaN }, 3)).toEqual(["Podés sumar hasta 3 acompañantes."]);
  });
});

describe("cupo y lista de espera", () => {
  it("sin cupo, siempre confirmada", () => {
    expect(rsvpPlacement({ capacity: null, confirmedPeople: 999, party: 3 })).toBe("CONFIRMED");
  });
  it("con cupo: entra justo, no entra → espera", () => {
    expect(rsvpPlacement({ capacity: 10, confirmedPeople: 8, party: 2 })).toBe("CONFIRMED");
    expect(rsvpPlacement({ capacity: 10, confirmedPeople: 9, party: 2 })).toBe("WAITLIST");
  });
  it("se libera lugar: en orden, saltando a quien no entra", () => {
    const espera = [{ id: "g4", companions: 3 }, { id: "s1", companions: 0 }, { id: "p2", companions: 1 }];
    expect(promoteFromWaitlist({ capacity: 10, confirmedPeople: 7, waitlist: espera })).toEqual(["s1", "p2"]);
    expect(promoteFromWaitlist({ capacity: 10, confirmedPeople: 6, waitlist: espera })).toEqual(["g4"]);
    expect(promoteFromWaitlist({ capacity: null, confirmedPeople: 6, waitlist: espera })).toEqual(["g4", "s1", "p2"]);
    expect(promoteFromWaitlist({ capacity: 10, confirmedPeople: 12, waitlist: espera })).toEqual([]);
  });
  it("totales", () => {
    expect(rsvpTotals([
      { status: "CONFIRMED", companions: 2 }, { status: "CONFIRMED", companions: 0 },
      { status: "WAITLIST", companions: 1 }, { status: "CANCELLED", companions: 5 },
    ])).toEqual({ confirmed: 2, people: 4, waitlist: 1, waitlistPeople: 2, cancelled: 1 });
  });
});

describe("retención", () => {
  it("se borra a los 30 días del cierre", () => {
    const fin = dayEndAr("2026-11-30");
    expect(rsvpPurgeDue(fin, new Date("2026-12-30T02:00:00Z"))).toBe(false);
    expect(rsvpPurgeDue(fin, new Date("2026-12-31T03:00:00Z"))).toBe(true);
  });
});

describe("calendario", () => {
  const e = {
    id: "ck1", title: "Rosario, en blanco; y negro", openingAt: a19, openingEndsAt: null,
    venue: "Centro Cultural Parque España, Sarmiento y el río, Rosario", note: "Habrá un brindis.",
    url: "https://muestrasfotograficas.com/m/rosario/inauguracion", stamp: new Date("2026-11-01T12:00:00Z"),
  };
  it(".ics con UID estable, horas UTC, escapes y CRLF", () => {
    const ics = openingIcs(e);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("UID:inauguracion-ck1@muestrasfotograficas.com\r\n");
    expect(ics).toContain("DTSTART:20261114T220000Z\r\n");
    expect(ics).toContain("DTEND:20261115T000000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261101T120000Z\r\n");
    expect(ics).toContain("SUMMARY:Inauguración: Rosario\\, en blanco\\; y negro\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Ninguna línea pasa de 75 octetos (las largas se pliegan con CRLF + espacio).
    for (const l of ics.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
  it("enlace a Google Calendar", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261114T220000Z/20261115T000000Z");
    expect(u.searchParams.get("text")).toBe("Inauguración: Rosario, en blanco; y negro");
  });
});

describe("CSV", () => {
  it("con BOM, punto y coma, comillas y sin fórmulas", () => {
    const csv = rsvpCsv([
      { name: "Ana; Pérez", email: "ana@ejemplo.com", companions: 2, status: "CONFIRMED", createdAt: new Date("2026-11-10T21:40:00Z") },
      { name: "=HYPERLINK(\"x\")", email: null, companions: 0, status: "WAITLIST", createdAt: new Date("2026-11-10T22:00:00Z") },
    ]);
    const filas = csv.slice(1).split("\r\n");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(filas[0]).toBe("Nombre;Email;Acompañantes;Personas;Estado;Confirmó el");
    expect(filas[1]).toBe("\"Ana; Pérez\";ana@ejemplo.com;2;3;Confirmada;10/11/2026 18:40");
    expect(filas[2]).toBe("\"'=HYPERLINK(\"\"x\"\")\";;0;1;En lista de espera;10/11/2026 19:00");
  });
  it("neutraliza fórmulas aunque vengan después de espacios o tabulaciones", () => {
    const filas = rsvpCsv(["  =1+1", "\t+SUM(A1)", " -2", "@x", "Ana = Pérez"].map((name) => ({ name, email: null, companions: 0, status: "CONFIRMED", createdAt: new Date("2026-11-10T21:40:00Z") })))
      .slice(1).split("\r\n").slice(1, 6).map((f) => f.split(";")[0]);
    expect(filas).toEqual(["'  =1+1", "'\t+SUM(A1)", "' -2", "'@x", "Ana = Pérez"]);
  });
});
