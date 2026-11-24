import { describe, expect, it } from "vitest";
import { artDateKey, MAX_STORIES_PER_DAY } from "./album-stories-plan";
import { decideWelcome, planWelcomeSlots, WELCOMES_PER_DAY } from "./welcome-stories-plan";
import { welcomeNameLine } from "./welcome-story-template";

const base = {
  role: "PHOTOGRAPHER",
  isBlocked: false,
  logoUrl: "https://cdn/logo.png",
  handle: "fotografa",
  hasRealAlbum: true,
  alreadyGenerated: false,
};

const horaArt = (d: Date) => (d.getUTCHours() + 21) % 24;

describe("decideWelcome", () => {
  it("entra con logo, Instagram y un álbum real", () => {
    expect(decideWelcome(base)).toEqual({ eligible: true });
  });
  it("sin logo o sin Instagram no hay placa", () => {
    expect(decideWelcome({ ...base, logoUrl: null })).toEqual({ eligible: false, reason: "NO_LOGO" });
    expect(decideWelcome({ ...base, logoUrl: "  " })).toEqual({ eligible: false, reason: "NO_LOGO" });
    expect(decideWelcome({ ...base, handle: null })).toEqual({ eligible: false, reason: "NO_INSTAGRAM" });
  });
  it("una sola vez, solo fotógrafos, no bloqueados ni con solo álbumes de prueba", () => {
    expect(decideWelcome({ ...base, alreadyGenerated: true })).toMatchObject({ reason: "ALREADY_GENERATED" });
    expect(decideWelcome({ ...base, role: "CUSTOMER" })).toMatchObject({ reason: "NOT_PHOTOGRAPHER" });
    expect(decideWelcome({ ...base, role: "LAB_PHOTOGRAPHER" })).toEqual({ eligible: true });
    expect(decideWelcome({ ...base, isBlocked: true })).toMatchObject({ reason: "BLOCKED" });
    expect(decideWelcome({ ...base, hasRealAlbum: false })).toMatchObject({ reason: "ONLY_TEST_ALBUMS" });
  });
});

describe("planWelcomeSlots", () => {
  // Martes 24/11/2026, 08:00 ART (la hora del cron).
  const now = new Date("2026-11-24T08:00:00-03:00");

  it("como mucho 3 por día, a las 11, 16 y 20 h", () => {
    const s = planWelcomeSlots([], [], now, 11);
    expect(s).toHaveLength(11);
    const porDia = new Map<string, number[]>();
    for (const d of s) porDia.set(artDateKey(d), [...(porDia.get(artDateKey(d)) ?? []), horaArt(d)]);
    for (const horas of porDia.values()) {
      expect(horas.length).toBeLessThanOrEqual(WELCOMES_PER_DAY);
      for (const h of horas) expect([11, 16, 20]).toContain(h);
    }
    expect(porDia.get("2026-11-24")).toEqual([11, 16, 20]);
    expect(porDia.size).toBe(4);
  });

  it("cuenta las bienvenidas ya agendadas y no repite horario", () => {
    const ya = [new Date("2026-11-24T11:00:00-03:00"), new Date("2026-11-24T16:00:00-03:00")];
    const s = planWelcomeSlots(ya, ya, now, 2);
    expect(s.map((d) => [artDateKey(d), horaArt(d)])).toEqual([
      ["2026-11-24", 20],
      ["2026-11-25", 11],
    ]);
  });

  it("respeta el tope diario común de historias", () => {
    // Un día lleno de historias de álbumes: la bienvenida pasa al siguiente.
    const lleno: Date[] = [];
    for (let k = 0; k < MAX_STORIES_PER_DAY; k++) lleno.push(new Date(new Date("2026-11-24T10:00:00-03:00").getTime() + k));
    const s = planWelcomeSlots(lleno, [], now, 1);
    expect(artDateKey(s[0]!)).toBe("2026-11-25");
  });

  it("no agenda horarios que ya pasaron", () => {
    const tarde = new Date("2026-11-24T17:00:00-03:00");
    const s = planWelcomeSlots([], [], tarde, 2);
    expect(s.map((d) => [artDateKey(d), horaArt(d)])).toEqual([
      ["2026-11-24", 20],
      ["2026-11-25", 11],
    ]);
  });
});

describe("welcomeNameLine", () => {
  it("une nombre y ciudad, sin huecos", () => {
    expect(welcomeNameLine("Rocío Cerdá", "Rosario")).toBe("Rocío Cerdá · Rosario");
    expect(welcomeNameLine("Rocío Cerdá", null)).toBe("Rocío Cerdá");
    expect(welcomeNameLine(null, " ")).toBe("");
    expect(welcomeNameLine("Yael Yospa", "Municipio de Posadas")).toBe("Yael Yospa · Posadas");
  });
});
