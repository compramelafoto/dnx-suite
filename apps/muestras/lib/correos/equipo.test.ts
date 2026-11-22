import { beforeEach, describe, expect, it, vi } from "vitest";

const enviar = vi.hoisted(() => vi.fn());
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("./enviar", () => ({
  enviar,
  origenDeCorreo: (pd: string | null | undefined) => (pd && pd !== "FOTOGRAFIA" ? "https://muestrasdearte.com" : "https://muestrasfotograficas.com"),
}));

const { avisarInvitacionEquipo } = await import("./equipo");
const p = { email: "a@x.com", token: "tok", muestra: "M", rol: "TEXT_EDITOR" as const, invita: "Dani", invitedAt: new Date("2026-11-01T12:00:00Z") };

beforeEach(() => {
  enviar.mockReset();
  enviar.mockResolvedValue(true);
});

describe("avisarInvitacionEquipo con la casa de la muestra (etapa 2 de arte)", () => {
  it("arte: enlace de muestrasdearte.com, texto y marca de arte", async () => {
    expect((await avisarInvitacionEquipo({ ...p, primaryDiscipline: "PINTURA" })).url).toBe("https://muestrasdearte.com/panel/equipo/invitacion/tok");
    const [, , parrafos, , marca] = enviar.mock.calls[0]!;
    expect(parrafos.join(" ")).toContain("en Muestras de Arte, con el rol");
    expect(marca).toBe("ARTE");
  });
  it("fotografía: como siempre", async () => {
    expect((await avisarInvitacionEquipo({ ...p, primaryDiscipline: "FOTOGRAFIA" })).url).toBe("https://muestrasfotograficas.com/panel/equipo/invitacion/tok");
    expect(enviar.mock.calls[0]![4]).toBe("FOTOGRAFIA");
    expect(enviar.mock.calls[0]![2].join(" ")).toContain("en Muestras Fotográficas, con el rol");
  });
});
