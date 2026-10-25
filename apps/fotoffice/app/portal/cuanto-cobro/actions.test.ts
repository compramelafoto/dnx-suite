import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  acceso: true,
  guardados: [] as { userId: number; datos: unknown; opciones: unknown }[],
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ id: 42, email: "socia@x.test" }) }));
vi.mock("@/lib/cuanto-cobro-socio/perfil", () => ({
  accesoCuantoCobroSocio: async (userId: number) => (H.acceso && userId === 42 ? { workspace: { id: "ws_sfpr_seed" } } : null),
  guardarPerfilSocio: async (userId: number, datos: unknown, opciones: unknown) => {
    H.guardados.push({ userId, datos, opciones });
    return { ok: true, actualizado: new Date("2026-11-10T15:00:00.000Z") };
  },
}));

const { guardarPerfilSocioAction } = await import("./actions");

beforeEach(() => {
  H.acceso = true;
  H.guardados = [];
});

describe("guardar el perfil de ¿Cuánto Cobro? del portal", () => {
  it("guarda a nombre de quien está en sesión, con la versión que mostró el formulario", async () => {
    expect(await guardarPerfilSocioAction({ a: 1 }, "2026-11-01T10:00:00.000Z")).toEqual({ ok: true, actualizado: "2026-11-10T15:00:00.000Z" });
    expect(H.guardados).toEqual([{ userId: 42, datos: { a: 1 }, opciones: { esperado: new Date("2026-11-01T10:00:00.000Z") } }]);
  });

  it("sin perfil previo pide crear, no pisar", async () => {
    await guardarPerfilSocioAction({}, null);
    expect(H.guardados[0]!.opciones).toEqual({ esperado: null });
  });

  it("si la institución no encendió la sección, no guarda", async () => {
    H.acceso = false;
    expect(await guardarPerfilSocioAction({})).toEqual({ ok: false, error: "¿Cuánto Cobro? no está disponible en tu portal." });
    expect(H.guardados).toEqual([]);
  });

  it("una versión ilegible no llega a guardar", async () => {
    expect((await guardarPerfilSocioAction({}, "ayer")).ok).toBe(false);
    expect(H.guardados).toEqual([]);
  });
});
