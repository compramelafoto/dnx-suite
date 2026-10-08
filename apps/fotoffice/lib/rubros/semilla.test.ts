import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const S = await import("./semilla");
const R = await import("./repositorio");
const { SLUG_DNX } = await import("@/lib/slug-dnx");

function categoria(id: string, name: string, kind: "INGRESO" | "EGRESO", ws = "ws-1") {
  return B.agregar("cashCategory", { id, workspaceId: ws, name, kind });
}

const nombre = (id: string | null) => B.datos.cashCategory.find((c) => c.id === id)?.name ?? null;

beforeEach(() => B.vaciar());

describe("PLAN_DNX", () => {
  it("tiene los nombres sin código, con tildes, y los padres antes que sus hijos", () => {
    const nombres = S.PLAN_DNX.map((i) => i.name);
    expect(nombres).toContain("Sesión fotográfica");
    expect(nombres).toContain("Videógrafos Freelancers");
    expect(nombres).toContain("Estudio Fotográfico");
    expect(nombres.every((n) => !/^\d/.test(n))).toBe(true);
    const vistos = new Set<string>();
    for (const i of S.PLAN_DNX) {
      if (i.parentCode) expect(vistos.has(i.parentCode)).toBe(true);
      vistos.add(i.code);
    }
    expect(S.PLAN_DNX).toHaveLength(1 + 7 + 1 + 3 + 1 + 6);
  });
});

describe("sembrarPlanDnx", () => {
  it("sólo para DNX", async () => {
    expect((await S.sembrarPlanDnx("ws-1", "otro-estudio")).ok).toBe(false);
    expect(B.datos.cashCategory).toHaveLength(0);
  });

  it("crea el plan con códigos y padres de un solo nivel", async () => {
    const r = await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    expect(r).toMatchObject({ ok: true, creadas: 19 });
    const rubros = await R.listarRubros("ws-1");
    const por = (code: string) => rubros.find((x) => x.code === code)!;
    expect(por("3.1")).toMatchObject({ name: "Estudio Fotográfico", kind: "INGRESO", parentCategoryId: null });
    expect(por("3.1.3")).toMatchObject({ name: "Sesión fotográfica", kind: "INGRESO", parentCategoryId: por("3.1").id });
    expect(por("4.0.2")).toMatchObject({ name: "Impresiones", kind: "EGRESO", parentCategoryId: por("4.0").id });
    expect(por("4.1.9")).toMatchObject({ name: "Viajes", kind: "EGRESO", parentCategoryId: por("4.1").id });
    expect(nombre(por("4.1.3").parentCategoryId)).toBe("Costos Directos");
  });

  it("es idempotente: apretar dos veces no duplica nada", async () => {
    await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    const r = await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    expect(r).toMatchObject({ ok: true, creadas: 0, completadas: 0 });
    expect(B.datos.cashCategory).toHaveLength(19);
    expect(B.datos.fotofficeRubro).toHaveLength(19);
  });

  it("reusa la categoría que ya existe por nombre y le completa el perfil", async () => {
    categoria("bodas-vieja", "bodas", "INGRESO");
    categoria("bodas-egreso", "Bodas", "EGRESO"); // Del otro lado: no se toca.
    await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    expect(B.datos.cashCategory.filter((c) => c.kind === "INGRESO" && String(c.name).toLowerCase() === "bodas")).toHaveLength(1);
    const perfil = B.datos.fotofficeRubro.find((p) => p.categoryId === "bodas-vieja");
    expect(perfil).toMatchObject({ code: "3.1.1" });
    expect(nombre(perfil!.parentCategoryId as string)).toBe("Estudio Fotográfico");
    expect(B.datos.fotofficeRubro.find((p) => p.categoryId === "bodas-egreso")).toBeUndefined();
  });

  it("no pisa un código ni un padre que alguien ya cargó", async () => {
    categoria("bodas", "Bodas", "INGRESO");
    categoria("otro-padre", "Mis eventos", "INGRESO");
    B.agregar("fotofficeRubro", { workspaceId: "ws-1", categoryId: "bodas", code: "9.9", parentCategoryId: "otro-padre" });
    const r = await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    expect(r).toMatchObject({ ok: true, respetadas: 1 });
    expect(B.datos.fotofficeRubro.find((p) => p.categoryId === "bodas")).toMatchObject({
      code: "9.9",
      parentCategoryId: "otro-padre",
    });
  });

  it("completa sólo lo vacío: código cargado y padre vacío", async () => {
    categoria("bodas", "Bodas", "INGRESO");
    B.agregar("fotofficeRubro", { workspaceId: "ws-1", categoryId: "bodas", code: "B1" });
    await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    const p = B.datos.fotofficeRubro.find((x) => x.categoryId === "bodas")!;
    expect(p.code).toBe("B1");
    expect(nombre(p.parentCategoryId as string)).toBe("Estudio Fotográfico");
  });

  it("no arma dos niveles: si el padre del plan ya está dentro de otro, el hijo queda sin padre", async () => {
    categoria("estudio", "Estudio Fotográfico", "INGRESO");
    categoria("raiz", "Todo", "INGRESO");
    B.agregar("fotofficeRubro", { workspaceId: "ws-1", categoryId: "estudio", parentCategoryId: "raiz" });
    await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    const bodas = B.datos.cashCategory.find((c) => c.name === "Bodas")!;
    expect(B.datos.fotofficeRubro.find((p) => p.categoryId === bodas.id)).toMatchObject({ code: "3.1.1", parentCategoryId: null });
  });

  it("no toca otros workspaces", async () => {
    categoria("bodas-ws2", "Bodas", "INGRESO", "ws-2");
    await S.sembrarPlanDnx("ws-1", SLUG_DNX);
    expect(B.datos.fotofficeRubro.find((p) => p.categoryId === "bodas-ws2")).toBeUndefined();
    expect(B.datos.cashCategory.filter((c) => c.workspaceId === "ws-1")).toHaveLength(19);
  });
});

describe("validarPerfilRubro y escribirPerfilRubro", () => {
  it("valida padre del mismo workspace, mismo lado y un solo nivel", async () => {
    categoria("estudio", "Estudio", "INGRESO");
    categoria("isla", "La Isla", "EGRESO");
    categoria("ajeno", "Ajeno", "INGRESO", "ws-2");
    categoria("bodas", "Bodas", "INGRESO");
    B.agregar("fotofficeRubro", { workspaceId: "ws-1", categoryId: "bodas", parentCategoryId: "estudio" });

    const v = (categoryId: string | null, parentCategoryId: unknown, code: unknown = null) =>
      R.validarPerfilRubro("ws-1", categoryId, "INGRESO", { parentCategoryId, code });

    expect(await v(null, "estudio", "3.1.2")).toEqual({ ok: true, valores: { parentCategoryId: "estudio", code: "3.1.2" } });
    expect(await v(null, "", "")).toEqual({ ok: true, valores: { parentCategoryId: null, code: null } });
    expect((await v(null, "ajeno")).ok).toBe(false);
    expect((await v(null, "isla")).ok).toBe(false);
    expect((await v(null, "bodas")).ok).toBe(false); // Bodas ya tiene padre.
    expect((await v("estudio", "estudio")).ok).toBe(false);
    expect((await v(null, "estudio", "3..1")).ok).toBe(false);
    expect((await v(null, 42)).ok).toBe(false);
    // Estudio tiene hijos: no puede quedar dentro de otro ni cambiar de lado.
    categoria("otro", "Otro", "INGRESO");
    expect((await v("estudio", "otro")).ok).toBe(false);
    expect((await R.validarPerfilRubro("ws-1", "estudio", "EGRESO", { parentCategoryId: null, code: null })).ok).toBe(false);
  });

  it("sin padre ni código y sin perfil previo no crea fila; si hay perfil, lo actualiza", async () => {
    categoria("ventas", "Ventas", "INGRESO");
    await R.escribirPerfilRubro("ws-1", "ventas", { parentCategoryId: null, code: null });
    expect(B.datos.fotofficeRubro).toHaveLength(0);
    await R.escribirPerfilRubro("ws-1", "ventas", { parentCategoryId: null, code: "3.2" });
    await R.escribirPerfilRubro("ws-1", "ventas", { parentCategoryId: null, code: "3.3" });
    expect(B.datos.fotofficeRubro).toHaveLength(1);
    expect(B.datos.fotofficeRubro[0]).toMatchObject({ categoryId: "ventas", code: "3.3", workspaceId: "ws-1" });
  });
});
