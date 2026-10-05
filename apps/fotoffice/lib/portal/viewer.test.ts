import { describe, expect, it, vi } from "vitest";

// `viewer.ts` importa `server-only` y `@repo/db`; los dos se simulan: acá sólo se prueba la
// decisión, con las dependencias inyectadas.
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("./access", () => ({ loadPortalContext: vi.fn() }));

const { resolvePortalViewer } = await import("./viewer");
type ViewerDeps = import("./viewer").ViewerDeps;

const socio = {
  member: { id: "m1", firstName: "Ana", lastName: "Paz", memberNumber: "12", joinedAt: new Date(0), categoryName: null },
  workspace: { id: "ws-1", name: "SFPR" },
};
const alumno = { fullName: "Ana Paz", workspace: { id: "ws-1", name: "SFPR" } };

function deps(s: unknown, a: unknown): ViewerDeps {
  return { cargarSocio: vi.fn().mockResolvedValue(s), cargarAlumno: vi.fn().mockResolvedValue(a) };
}

describe("quién mira el portal", () => {
  it("el socio activo es socio, tenga o no cursos", async () => {
    const d = deps(socio, alumno);
    expect(await resolvePortalViewer(7, d)).toEqual({ kind: "MEMBER", context: socio });
    expect(d.cargarAlumno).not.toHaveBeenCalled();
  });

  it("sin ficha de socio pero con cursos es alumno", async () => {
    expect(await resolvePortalViewer(7, deps(null, alumno))).toEqual({
      kind: "STUDENT",
      userId: 7,
      fullName: "Ana Paz",
      workspace: { id: "ws-1", name: "SFPR" },
    });
  });

  it("sin nada, no entra", async () => {
    expect(await resolvePortalViewer(7, deps(null, null))).toBeNull();
  });
});
