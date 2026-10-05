import { describe, expect, it } from "vitest";
import {
  anniversariesToday,
  argentinaToday,
  birthdaysToday,
  buildOccasionEmail,
  daysUntil,
  efemeridesForToday,
  isMilestone,
  isOccasionWindow,
  isValidMonthDay,
  nextOccurrence,
  renderTemplate,
  sameDayOfYear,
  yearsSince,
} from "./occasions";
import { OCCASION_CATALOG, mergeOccasions } from "./occasions-catalog";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("hoy en Argentina", () => {
  it("lunes 0:30 UTC sigue siendo domingo en Argentina", () => {
    expect(argentinaToday(new Date("2026-10-12T00:30:00Z"))).toEqual({ y: 2026, m: 10, d: 11 });
  });
  it("ventana desde las 9 AR", () => {
    expect(isOccasionWindow(new Date("2026-10-12T11:59:00Z"))).toBe(false);
    expect(isOccasionWindow(new Date("2026-10-12T12:00:00Z"))).toBe(true);
    expect(isOccasionWindow(new Date("2026-10-13T02:00:00Z"))).toBe(true); // 23 h AR
  });
});

describe("fechas", () => {
  it("29 de febrero se saluda el 28 en años no bisiestos", () => {
    expect(sameDayOfYear(2, 29, { y: 2027, m: 2, d: 28 })).toBe(true);
    expect(sameDayOfYear(2, 29, { y: 2028, m: 2, d: 28 })).toBe(false);
    expect(sameDayOfYear(2, 29, { y: 2028, m: 2, d: 29 })).toBe(true);
  });
  it("valida día y mes", () => {
    expect(isValidMonthDay(2, 29)).toBe(true);
    expect(isValidMonthDay(4, 31)).toBe(false);
    expect(isValidMonthDay(null, 3)).toBe(false);
    expect(isValidMonthDay(13, 1)).toBe(false);
  });
  it("años cumplidos y redondos", () => {
    expect(yearsSince(d("1964-07-18"), { y: 2026, m: 7, d: 18 })).toBe(62);
    expect(yearsSince(d("1964-07-18"), { y: 2026, m: 7, d: 17 })).toBe(61);
    expect([1, 2, 5, 10, 11, 25].map(isMilestone)).toEqual([true, false, true, true, false, true]);
  });
  it("próxima vez y días que faltan", () => {
    const hoy = { y: 2026, m: 10, d: 5 };
    expect(nextOccurrence(12, 24, hoy)).toEqual({ y: 2026, m: 12, d: 24 });
    expect(nextOccurrence(3, 24, hoy)).toEqual({ y: 2027, m: 3, d: 24 });
    expect(nextOccurrence(10, 5, hoy)).toEqual(hoy);
    expect(daysUntil({ y: 2026, m: 10, d: 7 }, hoy)).toBe(2);
  });
});

describe("a quién le toca hoy", () => {
  const socios = [
    { id: "a", email: "a@x.com", firstName: "Ana", date: d("1990-10-05") },
    { id: "b", email: "b@x.com", firstName: "Beto", date: d("2025-10-05") },
    { id: "c", email: "c@x.com", firstName: "Caro", date: d("2016-10-05") },
    { id: "e", email: "e@x.com", firstName: "Eva", date: d("2026-10-05") },
    { id: "f", email: "f@x.com", firstName: "Fede", date: d("2000-10-06") },
  ];
  const hoy = { y: 2026, m: 10, d: 5 };
  it("cumpleaños", () => {
    expect(birthdaysToday(socios, hoy).map((s) => s.id)).toEqual(["a", "b", "c", "e"]);
  });
  it("aniversario: 1 año o más; sólo redondos si se pide", () => {
    expect(anniversariesToday(socios, hoy, false).map((s) => s.id)).toEqual(["a", "b", "c"]);
    // a: 36 (no), b: 1 (sí), c: 10 (sí)
    expect(anniversariesToday(socios, hoy, true).map((s) => s.id)).toEqual(["b", "c"]);
  });
  it("efemérides: encendidas, con fecha y de hoy", () => {
    const todas = mergeOccasions([
      { ...OCCASION_CATALOG.find((o) => o.key === "navidad")!, enabled: true },
      { ...OCCASION_CATALOG.find((o) => o.key === "dia-camarografo")!, enabled: true }, // sin fecha
      { key: "propia-x", kind: "EFEMERIDE", enabled: true, month: 12, day: 24, title: "Propia", subject: "s", message: "m", imageUrl: null, specialties: [], milestonesOnly: false },
    ]);
    expect(efemeridesForToday(todas, { y: 2026, m: 12, d: 24 }).map((o) => o.key)).toEqual(["navidad", "propia-x"]);
    expect(efemeridesForToday(todas, { y: 2026, m: 12, d: 25 })).toEqual([]);
  });
});

describe("texto", () => {
  it("reemplaza variables y saca la coma si no hay nombre", () => {
    expect(renderTemplate("¡Feliz cumpleaños, {nombre}!", { nombre: "Ana", institucion: "SFPR" })).toBe("¡Feliz cumpleaños, Ana!");
    expect(renderTemplate("¡Feliz cumpleaños, {nombre}!", { nombre: null, institucion: "SFPR" })).toBe("¡Feliz cumpleaños!");
    expect(renderTemplate("Hoy cumplís {años} en {institucion}", { nombre: null, institucion: "SFPR", anios: 1 })).toBe(
      "Hoy cumplís 1 año en SFPR",
    );
    expect(renderTemplate("{años}", { nombre: null, institucion: "S", anios: 10 })).toBe("10 años");
  });

  it("el catálogo no deja variables sin reemplazar", () => {
    for (const o of OCCASION_CATALOG) {
      const t = renderTemplate(`${o.subject}\n${o.message}`, { nombre: "Ana", institucion: "SFPR", anios: 5 });
      expect(t, o.key).not.toMatch(/\{[^}]+\}/);
    }
  });

  it("el correo escapa el texto, arma párrafos y lleva la baja", () => {
    const m = buildOccasionEmail({
      brand: { name: "SFPR", logoUrl: null, accentColor: null },
      occasion: { title: "Navidad", subject: "¡Feliz Navidad, {nombre}!", message: "Hola <b>{nombre}</b>\n\nSegundo", imageUrl: "https://x.com/n.jpg" },
      vars: { nombre: "Ana", institucion: "SFPR" },
      signature: null,
      footer: { reason: "Sos socio.", unsubscribeUrl: "https://f.com/correo/baja?t=1" },
    });
    expect(m.subject).toBe("¡Feliz Navidad, Ana!");
    expect(m.html).toContain("Hola &lt;b&gt;Ana&lt;/b&gt;");
    expect(m.html).toContain("Segundo</p>");
    expect(m.html).toContain("https://x.com/n.jpg");
    expect(m.text).toContain("https://f.com/correo/baja?t=1");
  });
});

describe("catálogo", () => {
  it("las fechas del oficio dudosas vienen sin fecha y todo apagado", () => {
    for (const k of ["dia-fotografo", "dia-reportero-grafico", "dia-camarografo", "dia-trabajador-prensa"]) {
      const o = OCCASION_CATALOG.find((x) => x.key === k)!;
      expect(o.month).toBeNull();
      expect(o.hint).toBeTruthy();
    }
    expect(OCCASION_CATALOG.every((o) => !o.enabled)).toBe(true);
    expect(new Set(OCCASION_CATALOG.map((o) => o.key)).size).toBe(OCCASION_CATALOG.length);
  });
  it("lo guardado pisa al catálogo pero no su tipo", () => {
    const [nav] = mergeOccasions([{ ...OCCASION_CATALOG.find((o) => o.key === "birthday")!, enabled: true, kind: "EFEMERIDE" }]);
    expect(nav.key).toBe("birthday");
    expect(nav.enabled).toBe(true);
    expect(nav.kind).toBe("BIRTHDAY");
  });
});
