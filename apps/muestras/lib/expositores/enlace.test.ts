import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), update: vi.fn() },
  culturalExhibitorLink: { create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sinPermiso = vi.hoisted(() => ({ caps: new Set<string>() }));
vi.mock("@/lib/equipo/permisos", async (original) => {
  const real = await original<typeof import("@/lib/equipo/permisos")>();
  return { ...real, puede: (u: Parameters<typeof real.puede>[0], cap: Parameters<typeof real.puede>[1], rol: Parameters<typeof real.puede>[2]) => !sinPermiso.caps.has(cap) && real.puede(u, cap, rol) };
});

const { cambiarEstadoEnlace, crearEnlaceExpositores, guardarEnlaceExpositores, renovarEnlaceExpositores } = await import("./enlace");
const { resetRateLimit } = await import("@/lib/limite");
const { addArDays, toArDay, visibilityFromPreset } = await import("@repo/muestras");

const DIA = 86_400_000;
const dueno = { id: 7, esSuperAdmin: false, email: "d@x", name: "Dueña" };
const textos = { id: 9, esSuperAdmin: false, email: "t@x", name: "Tere" };
const miembros: Record<number, string> = { 8: "CO_ORGANIZER", 9: "TEXT_EDITOR" };
let muestra: Record<string, unknown>;
const base = () => ({
  id: "a1", slug: "silos", type: "MUESTRA", reviewStatus: "DRAFT", isCancelled: false,
  startsAt: new Date(Date.now() + 10 * DIA), endsAt: new Date(Date.now() + 40 * DIA),
  galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", visibility: null, exhibitorLink: null as null | { id: string; status: string },
});
function fd(o: Record<string, string>) {
  const f = new FormData();
  f.set("activityId", "a1");
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const escrituraDeMuestra = () => db.culturalActivity.update.mock.calls[0]?.[0].data;
const enlaceCreado = () => db.culturalExhibitorLink.create.mock.calls[0]?.[0].data;

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = dueno;
  sinPermiso.caps.clear();
  muestra = base();
  db.culturalActivity.findUnique.mockImplementation(async (q: { select: Record<string, unknown> }) =>
    q.select.members
      ? {
          proposedByUserId: 7,
          members: miembros[usuarioActual.valor!.id] ? [{ userId: usuarioActual.valor!.id, role: miembros[usuarioActual.valor!.id], status: "ACTIVE" }] : [],
        }
      : muestra,
  );
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.culturalActivity.update.mockResolvedValue({});
  db.culturalExhibitorLink.create.mockResolvedValue({ id: "l1" });
  db.culturalExhibitorLink.update.mockResolvedValue({});
});

describe("crearEnlaceExpositores", () => {
  it("el rol de textos no crea (la muestra 'no existe' para él)", async () => {
    usuarioActual.valor = textos;
    expect(await crearEnlaceExpositores(fd({ visibilidadConfirmada: "1", preset: "PREVIEW" }))).toEqual({ ok: false, errores: ["No encontramos esa muestra entre las tuyas."] });
    expect(db.culturalExhibitorLink.create).not.toHaveBeenCalled();
  });

  it("sin ajuste y sin el permiso de visibilidad: no crea ni elige la visibilidad", async () => {
    sinPermiso.caps.add("visibility");
    expect(await crearEnlaceExpositores(fd({ visibilidadConfirmada: "1", preset: "OPEN" }))).toEqual({
      ok: false, errores: ["Quien organiza la muestra tiene que elegir primero qué se ve online, en Visibilidad."],
    });
    expect(db.culturalExhibitorLink.create).not.toHaveBeenCalled();
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });

  it("con ajuste ya elegido, el permiso de visibilidad no hace falta", async () => {
    sinPermiso.caps.add("visibility");
    muestra = { ...base(), visibility: visibilityFromPreset("PREVIEW", "s") };
    expect(await crearEnlaceExpositores(fd({}))).toEqual({ ok: true });
    expect(db.culturalExhibitorLink.create).toHaveBeenCalled();
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });

  it("sin ajuste y sin confirmar la visibilidad: no crea", async () => {
    expect(await crearEnlaceExpositores(fd({ preset: "PREVIEW" }))).toEqual({ ok: false, errores: ["Elegí qué se ve online antes de generar el enlace."] });
    expect(db.culturalExhibitorLink.create).not.toHaveBeenCalled();
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });

  it("con la sugerencia confirmada guarda 'Adelanto' (3, siempre las mismas) y el enlace", async () => {
    expect(await crearEnlaceExpositores(fd({ visibilidadConfirmada: "1", preset: "PREVIEW", maxWorksPerExhibitor: "3" }))).toEqual({ ok: true });
    const v = escrituraDeMuestra().visibility;
    expect(v.preset).toBe("PREVIEW");
    expect(v.online).toMatchObject({ exhibited: "RANDOM", randomCount: 3, rotation: "FIXED" });
    expect(v.online.seed).not.toBe("legado");
    expect(enlaceCreado()).toMatchObject({ activityId: "a1", status: "OPEN", maxWorksPerExhibitor: 3, createdByUserId: 7 });
    expect(enlaceCreado().token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("con otra elección (para cada visitante, 5) guarda esa", async () => {
    await crearEnlaceExpositores(fd({
      visibilidadConfirmada: "1", preset: "CUSTOM", onlineExhibited: "RANDOM", randomCount: "5", rotation: "PER_VISIT", artists: "1",
      profileExhibited: "LIKE_ONLINE", roomExhibited: "ARTIST", roomPortfolio: "1", roomOtherExhibitions: "1", roomBuy: "1", revealAfterClose: "1",
    }));
    expect(escrituraDeMuestra().visibility.online).toMatchObject({ exhibited: "RANDOM", randomCount: 5, rotation: "PER_VISIT" });
  });

  it("con visibility ya cargada no la pide ni la toca", async () => {
    muestra = { ...base(), visibility: visibilityFromPreset("SURPRISE", "s") };
    expect(await crearEnlaceExpositores(fd({ maxWorksPerExhibitor: "3" }))).toEqual({ ok: true });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
    expect(db.culturalExhibitorLink.create).toHaveBeenCalledTimes(1);
  });

  it("si ya existe no duplica; si otra pestaña lo creó a la vez (P2002), tampoco falla", async () => {
    muestra = { ...base(), visibility: visibilityFromPreset("SURPRISE", "s"), exhibitorLink: { id: "l1", status: "OPEN" } };
    expect(await crearEnlaceExpositores(fd({}))).toEqual({ ok: true });
    expect(db.culturalExhibitorLink.create).not.toHaveBeenCalled();
    muestra = { ...base(), visibility: visibilityFromPreset("SURPRISE", "s") };
    db.culturalExhibitorLink.create.mockRejectedValue(Object.assign(new Error("único"), { code: "P2002" }));
    expect(await crearEnlaceExpositores(fd({}))).toEqual({ ok: true });
  });

  it("sin tope, vacío → null; 400 → mensaje", async () => {
    muestra = { ...base(), visibility: visibilityFromPreset("SURPRISE", "s") };
    await crearEnlaceExpositores(fd({ sinTope: "1", maxWorksPerExhibitor: "3" }));
    expect(enlaceCreado().maxWorksPerExhibitor).toBeNull();
    expect(await crearEnlaceExpositores(fd({ maxWorksPerExhibitor: "400" }))).toEqual({ ok: false, errores: ["Las obras por expositor van de 1 a 300."] });
  });

  it("cancelada o cerrada: no", async () => {
    muestra = { ...base(), isCancelled: true };
    expect(await crearEnlaceExpositores(fd({ visibilidadConfirmada: "1", preset: "PREVIEW" }))).toEqual({ ok: false, errores: ["La muestra está cancelada."] });
    muestra = { ...base(), startsAt: new Date(Date.now() - 40 * DIA), endsAt: new Date(Date.now() - 2 * DIA) };
    expect((await crearEnlaceExpositores(fd({ visibilidadConfirmada: "1", preset: "PREVIEW" }))).ok).toBe(false);
    expect(db.culturalExhibitorLink.create).not.toHaveBeenCalled();
  });
});

describe("guardarEnlaceExpositores", () => {
  beforeEach(() => {
    muestra = { ...base(), visibility: visibilityFromPreset("PREVIEW", "s"), exhibitorLink: { id: "l1", status: "OPEN" } };
  });

  it("topes vacíos → null; fecha al fin del día argentino; instrucciones", async () => {
    const dia = addArDays(toArDay(new Date()), 5);
    expect(await guardarEnlaceExpositores(fd({ maxWorksPerExhibitor: "", maxExhibitors: "", closesDay: dia, instructions: " Se entregan enmarcadas. " }))).toEqual({ ok: true });
    const data = db.culturalExhibitorLink.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ maxWorksPerExhibitor: null, maxExhibitors: null, instructions: "Se entregan enmarcadas." });
    expect(toArDay(data.closesAt)).toBe(dia);
  });

  it("tope 400 o fecha después del cierre → mensaje y no escribe", async () => {
    expect(await guardarEnlaceExpositores(fd({ maxWorksPerExhibitor: "400" }))).toEqual({ ok: false, errores: ["Las obras por expositor van de 1 a 300."] });
    const despues = addArDays(toArDay(new Date(Date.now() + 40 * DIA)), 1);
    expect(await guardarEnlaceExpositores(fd({ closesDay: despues }))).toEqual({ ok: false, errores: ["La fecha límite tiene que ser antes de que cierre la muestra."] });
    expect(db.culturalExhibitorLink.update).not.toHaveBeenCalled();
  });

  it("sin enlace todavía", async () => {
    muestra = { ...base(), visibility: visibilityFromPreset("PREVIEW", "s") };
    expect(await guardarEnlaceExpositores(fd({}))).toEqual({ ok: false, errores: ["Primero generá el enlace."] });
  });
});

describe("renovar y cambiar de estado", () => {
  beforeEach(() => {
    muestra = { ...base(), visibility: visibilityFromPreset("PREVIEW", "s"), exhibitorLink: { id: "l1", status: "OPEN" } };
  });

  it("renovar cambia el token y avisa", async () => {
    const r = await renovarEnlaceExpositores("a1");
    expect(r).toEqual({ ok: true, aviso: "El enlace anterior dejó de andar. Mandá el nuevo a quienes todavía no se sumaron." });
    const data = db.culturalExhibitorLink.update.mock.calls[0]![0].data;
    expect(data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(data.rotatedAt).toBeInstanceOf(Date);
  });

  it("cerrar y abrir; cancelada no se reabre ni se renueva", async () => {
    expect(await cambiarEstadoEnlace("a1", "CLOSED")).toEqual({ ok: true });
    expect(db.culturalExhibitorLink.update.mock.calls[0]![0].data).toEqual({ status: "CLOSED" });
    muestra = { ...muestra, isCancelled: true };
    expect(await cambiarEstadoEnlace("a1", "OPEN")).toEqual({ ok: false, errores: ["La muestra está cancelada."] });
    expect(await renovarEnlaceExpositores("a1")).toEqual({ ok: false, errores: ["La muestra está cancelada."] });
    expect(await cambiarEstadoEnlace("a1", "CLOSED")).toEqual({ ok: true });
  });

  it("textos: 404 en todo", async () => {
    usuarioActual.valor = textos;
    expect((await renovarEnlaceExpositores("a1")).ok).toBe(false);
    expect((await cambiarEstadoEnlace("a1", "CLOSED")).ok).toBe(false);
    expect(db.culturalExhibitorLink.update).not.toHaveBeenCalled();
  });
});
