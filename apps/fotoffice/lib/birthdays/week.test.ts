import { describe, expect, it } from "vitest";
import { birthdayWeekDays, buildBirthdaysOfWeek, type BirthdayMemberInput } from "./week";

const socio = (id: string, fecha: string, extra: Partial<BirthdayMemberInput> = {}): BirthdayMemberInput => ({
  id,
  firstName: "Ana",
  lastName: id,
  birthDate: new Date(`${fecha}T00:00:00Z`),
  instagram: null,
  photoUrl: null,
  ...extra,
});

// Miércoles 7 de octubre de 2026, 23:30 en Argentina (ya jueves 8 en UTC).
const MIERCOLES_NOCHE = new Date("2026-10-08T02:30:00Z");

describe("birthdayWeekDays", () => {
  it("va de lunes a domingo en hora argentina, no en UTC", () => {
    const dias = birthdayWeekDays(MIERCOLES_NOCHE).map((d) => d.toISOString().slice(0, 10));
    expect(dias).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
  });

  it("cruza el fin de año", () => {
    const dias = birthdayWeekDays(new Date("2026-12-31T15:00:00Z")).map((d) => d.toISOString().slice(0, 10));
    expect(dias[0]).toBe("2026-12-28");
    expect(dias[6]).toBe("2027-01-03");
  });
});

describe("buildBirthdaysOfWeek", () => {
  it("toma sólo los de la semana, ordenados por día, y marca hoy y los pasados", () => {
    const r = buildBirthdaysOfWeek({
      members: [
        socio("Viernes", "1980-10-09"),
        socio("Lunes", "1975-10-05"),
        socio("Miercoles", "1990-10-07"),
        socio("Afuera", "1990-10-12"),
      ],
      now: MIERCOLES_NOCHE,
    });
    expect(r.map((c) => [c.dayLabel, c.isPast, c.isToday])).toEqual([
      ["Lunes 5", true, false],
      ["Miércoles 7", false, true],
      ["Viernes 9", false, false],
    ]);
  });

  it("arma el enlace de Instagram con lo que haya cargado el socio, y lo omite si es inválido", () => {
    const r = buildBirthdaysOfWeek({
      members: [
        socio("A", "1980-10-06", { instagram: "https://www.instagram.com/Juan.Foto/?hl=es" }),
        socio("B", "1980-10-06", { instagram: "@maria_ph" }),
        socio("C", "1980-10-06", { instagram: "no es un usuario!" }),
      ],
      now: MIERCOLES_NOCHE,
    });
    expect(r.map((c) => c.instagramUrl)).toEqual([
      "https://instagram.com/juan.foto",
      "https://instagram.com/maria_ph",
      null,
    ]);
  });

  it("festeja el 29 de febrero el 28 en los años no bisiestos", () => {
    const r = buildBirthdaysOfWeek({
      members: [socio("Bisiesto", "1988-02-29")],
      now: new Date("2027-02-26T15:00:00Z"),
    });
    expect(r.map((c) => c.dayLabel)).toEqual(["Domingo 28"]);
  });

  it("reconoce al socio que mira", () => {
    const r = buildBirthdaysOfWeek({
      members: [socio("Yo", "1980-10-08")],
      now: MIERCOLES_NOCHE,
      viewerMemberId: "Yo",
    });
    expect(r[0].isViewer).toBe(true);
  });
});
