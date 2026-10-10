import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findUnique: vi.fn(), update: vi.fn() } }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { guardarVisibilidad, volverASortear } = await import("./acciones");
const { revalidatePath } = await import("next/cache");
const { resetRateLimit } = await import("@/lib/limite");
const { visibilityFromPreset } = await import("@repo/muestras");

const dueno = { id: 7, esSuperAdmin: false, email: "d@x", name: "Dueña" };
const co = { id: 8, esSuperAdmin: false, email: "c@x", name: "Co" };
const textos = { id: 9, esSuperAdmin: false, email: "t@x", name: "Tere" };
const ajeno = { id: 10, esSuperAdmin: false, email: "a@x", name: "Ajeno" };
const miembros: Record<number, string> = { 8: "CO_ORGANIZER", 9: "TEXT_EDITOR" };

let guardada: unknown = null;
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  guardada = null;
  usuarioActual.valor = co;
  db.culturalActivity.findUnique.mockImplementation(async (q: { select: Record<string, unknown> }) =>
    q.select.members
      ? {
          proposedByUserId: 7,
          members: miembros[usuarioActual.valor!.id] ? [{ userId: usuarioActual.valor!.id, role: miembros[usuarioActual.valor!.id], status: "ACTIVE" }] : [],
        }
      : { id: "a1", slug: "silos", type: "MUESTRA", galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", visibility: guardada },
  );
  db.culturalActivity.update.mockResolvedValue({});
});

describe("guardarVisibilidad", () => {
  it("sin sesión → 'Tenés que ingresar.'", async () => {
    usuarioActual.valor = null;
    expect(await guardarVisibilidad(fd({ activityId: "a1", preset: "OPEN" }))).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });

  it("rol de textos: no puede y no escribe; ajeno: no existe", async () => {
    usuarioActual.valor = textos;
    expect(await guardarVisibilidad(fd({ activityId: "a1", preset: "OPEN" }))).toEqual({ ok: false, errores: ["No podés cambiar la visibilidad de esta muestra."] });
    usuarioActual.valor = ajeno;
    expect(await guardarVisibilidad(fd({ activityId: "a1", preset: "OPEN" }))).toEqual({ ok: false, errores: ["No encontramos esa muestra entre las tuyas."] });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });

  it("coorganización escribe visibility y un galleryMode coherente, con el registro del cambio", async () => {
    expect(await guardarVisibilidad(fd({ activityId: "a1", preset: "OPEN" }))).toEqual({ ok: true, preset: "OPEN" });
    const data = db.culturalActivity.update.mock.calls[0]![0].data;
    expect(data.visibility.preset).toBe("OPEN");
    expect(data.galleryMode).toBe("FULL");
    expect(data.lastEditedByUserId).toBe(8);
    expect(revalidatePath).toHaveBeenCalledWith("/m/silos", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/fotografos", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("la dueña también; 'Sorpresa total' → galleryMode de destacadas", async () => {
    usuarioActual.valor = dueno;
    await guardarVisibilidad(fd({ activityId: "a1", preset: "SURPRISE" }));
    expect(db.culturalActivity.update.mock.calls[0]![0].data.galleryMode).toBe("HIGHLIGHTS_UNTIL_CLOSED");
  });

  it("la semilla del legado se reemplaza; una propia se conserva", async () => {
    await guardarVisibilidad(fd({ activityId: "a1", preset: "PREVIEW" }));
    const seed = db.culturalActivity.update.mock.calls[0]![0].data.visibility.online.seed;
    expect(seed).not.toBe("legado");
    expect(seed).toMatch(/^[A-Za-z0-9_-]{16}$/);
    guardada = visibilityFromPreset("PREVIEW", "propia");
    await guardarVisibilidad(fd({ activityId: "a1", preset: "PREVIEW" }));
    expect(db.culturalActivity.update.mock.calls[1]![0].data.visibility.online.seed).toBe("propia");
  });

  it("id raro: no consulta", async () => {
    expect((await guardarVisibilidad(fd({ activityId: "a 1", preset: "OPEN" }))).ok).toBe(false);
    expect(db.culturalActivity.findUnique).not.toHaveBeenCalled();
  });
});

describe("volverASortear", () => {
  it("cambia sólo la semilla", async () => {
    guardada = visibilityFromPreset("PREVIEW", "vieja");
    expect(await volverASortear("a1")).toEqual({ ok: true, preset: "PREVIEW" });
    const v = db.culturalActivity.update.mock.calls[0]![0].data.visibility;
    expect(v.online.seed).not.toBe("vieja");
    expect({ ...v, online: { ...v.online, seed: "vieja" } }).toEqual(visibilityFromPreset("PREVIEW", "vieja"));
  });
  it("sin obras al azar fijas no sortea; textos no puede", async () => {
    guardada = visibilityFromPreset("SURPRISE", "s");
    expect((await volverASortear("a1")).ok).toBe(false);
    usuarioActual.valor = textos;
    guardada = visibilityFromPreset("PREVIEW", "s");
    expect(await volverASortear("a1")).toEqual({ ok: false, errores: ["No podés cambiar la visibilidad de esta muestra."] });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
});
