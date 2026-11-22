import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enviar = vi.hoisted(() => vi.fn());
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("./enviar", () => ({ enviar }));

const { avisarAsistencia, avisarLugarLiberado } = await import("./inauguracion");

const muestra = (primaryDiscipline: string | null) => ({
  title: "Rosario", slug: "rosario", openingAt: new Date("2026-11-14T22:00:00Z"), openingEndsAt: null,
  venueName: "Sala", address: "Calle 1", city: "Rosario", primaryDiscipline,
});

beforeEach(() => {
  enviar.mockReset();
  enviar.mockResolvedValue(true);
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("APP_URL", "https://muestrasfotograficas.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("correos de la inauguración con el dominio de la muestra (etapa 2 de arte)", () => {
  it("la invitación de una muestra de PINTURA enlaza a muestrasdearte.com y sale con la marca de arte", async () => {
    await avisarLugarLiberado({ email: "a@x.com", nombre: "Ana", muestra: muestra("PINTURA") });
    const [, , parrafos, enlace, marca] = enviar.mock.calls[0]!;
    expect(enlace).toEqual({ texto: "Ver la invitación", url: "https://muestrasdearte.com/m/rosario/inauguracion" });
    expect(parrafos.join("\n")).toContain("https://muestrasdearte.com/m/rosario/inauguracion/evento.ics");
    expect(marca).toBe("ARTE");
  });
  it("una de fotografía, igual que siempre", async () => {
    await avisarLugarLiberado({ email: "a@x.com", nombre: "Ana", muestra: muestra("FOTOGRAFIA") });
    await avisarAsistencia({ email: "a@x.com", nombre: "Ana", estado: "CONFIRMED", enlace: "https://muestrasfotograficas.com/m/rosario/inauguracion/r/x", muestra: muestra(null) });
    expect(enviar.mock.calls[0]![3]).toEqual({ texto: "Ver la invitación", url: "https://muestrasfotograficas.com/m/rosario/inauguracion" });
    expect(enviar.mock.calls.map((c) => c[4])).toEqual(["FOTOGRAFIA", "FOTOGRAFIA"]);
  });
});
