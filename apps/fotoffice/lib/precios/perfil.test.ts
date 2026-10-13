import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { leerPerfilPrecios, guardarPerfilPrecios, leerPerfilPreciosDelSistema } = await import("./perfil");

const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
const EQUIPO = { workspaceId: "ws-1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: niveles } as never };
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "VIEW" } } as never };
const SIN_PERMISO = "Sólo el dueño o un administrador pueden configurar los precios.";

beforeEach(() => {
  B.vaciar();
});

describe("perfil de precios", () => {
  it("sin perfil guardado devuelve null", async () => {
    expect(await leerPerfilPrecios(DUENO)).toBeNull();
  });

  it("guarda y vuelve a leer el mismo perfil con fuente manual", async () => {
    const perfil = createBaseCompleteProfile();
    expect(await guardarPerfilPrecios(DUENO, perfil)).toEqual({ ok: true, actualizado: expect.any(Date) });
    const leido = await leerPerfilPrecios(DUENO);
    expect(leido?.perfil).toEqual(perfil);
    expect(leido?.source).toBe("manual");
    expect(leido?.actualizado).toBeInstanceOf(Date);
    const fila = B.datos.fotofficePerfilPrecios[0]!;
    expect(fila).toMatchObject({ workspaceId: "ws-1", schemaVersion: 1, updatedByUserId: 1 });
  });

  it("con source dnx-bot guarda ese origen; sin opción, manual", async () => {
    expect(await guardarPerfilPrecios(DUENO, createBaseCompleteProfile(), { source: "dnx-bot" })).toMatchObject({ ok: true });
    expect((await leerPerfilPrecios(DUENO))?.source).toBe("dnx-bot");
    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    expect((await leerPerfilPrecios(DUENO))?.source).toBe("manual");
  });

  it("un origen desconocido no se guarda", async () => {
    const r = await guardarPerfilPrecios(DUENO, createBaseCompleteProfile(), { source: "otro" as never });
    expect(r.ok).toBe(false);
    expect(B.datos.fotofficePerfilPrecios).toHaveLength(0);
  });

  it("guardar dos veces deja una sola fila", async () => {
    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    expect(B.datos.fotofficePerfilPrecios).toHaveLength(1);
  });

  it.each([["EQUIPO", EQUIPO], ["LECTOR", LECTOR]])("%s: no guarda ni lee", async (_n, ctx) => {
    const r = await guardarPerfilPrecios(ctx, createBaseCompleteProfile());
    expect(r).toEqual({ ok: false, error: SIN_PERMISO });
    expect(B.datos.fotofficePerfilPrecios).toHaveLength(0);

    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    const original = B.tablas.fotofficePerfilPrecios.findUnique;
    const espia = vi.fn(original);
    B.tablas.fotofficePerfilPrecios.findUnique = espia as never;
    try {
      expect(await leerPerfilPrecios(ctx)).toBeNull();
      expect(espia).not.toHaveBeenCalled();
    } finally {
      B.tablas.fotofficePerfilPrecios.findUnique = original;
    }
  });

  it("otro workspace no ve el perfil", async () => {
    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    expect(await leerPerfilPrecios({ ...DUENO, workspaceId: "ws-2" })).toBeNull();
  });

  it("datos inválidos: devuelve el error de validación y no escribe", async () => {
    const r = await guardarPerfilPrecios(DUENO, "no es un perfil");
    expect(r.ok).toBe(false);
    expect(B.datos.fotofficePerfilPrecios).toHaveLength(0);
  });

  it("falla de la base: error genérico", async () => {
    const original = B.tablas.fotofficePerfilPrecios.upsert;
    B.tablas.fotofficePerfilPrecios.upsert = (async () => {
      throw new Error("boom");
    }) as never;
    try {
      expect(await guardarPerfilPrecios(DUENO, createBaseCompleteProfile())).toEqual({ ok: false, error: "No se pudo guardar el perfil." });
    } finally {
      B.tablas.fotofficePerfilPrecios.upsert = original;
    }
  });
});

describe("guardar con la versión que se cargó (concurrencia optimista)", () => {
  const CAMBIO_BOT = "El perfil cambió mientras lo tenías abierto (lo guardó DNX Bot). Recargá para ver los datos nuevos.";
  const CAMBIO = "El perfil cambió mientras lo tenías abierto. Recargá para ver los datos nuevos.";

  it("con la versión vigente guarda y devuelve la nueva", async () => {
    const primero = await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    if (!primero.ok) throw new Error("no guardó");
    await new Promise((r) => setTimeout(r, 2));
    const segundo = await guardarPerfilPrecios(DUENO, createBaseCompleteProfile({ businessSoftware: "1" }), { esperado: primero.actualizado });
    expect(segundo).toMatchObject({ ok: true });
    expect((await leerPerfilPrecios(DUENO))?.perfil.businessSoftware).toBe("1");
    if (segundo.ok) expect(segundo.actualizado.getTime()).toBeGreaterThan(primero.actualizado.getTime());
  });

  it("si lo guardó DNX Bot mientras el formulario estaba abierto: no pisa y lo dice", async () => {
    const cargado = await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    if (!cargado.ok) throw new Error("no guardó");
    await new Promise((r) => setTimeout(r, 2));
    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile({ businessSoftware: "999" }), { source: "dnx-bot", esperado: cargado.actualizado });
    const viejo = await guardarPerfilPrecios(DUENO, createBaseCompleteProfile({ businessSoftware: "5" }), { esperado: cargado.actualizado });
    expect(viejo).toEqual({ ok: false, error: CAMBIO_BOT, conflicto: true });
    expect((await leerPerfilPrecios(DUENO))?.perfil.businessSoftware).toBe("999");
  });

  it("si lo cambió otra persona, el mismo freno con el texto general", async () => {
    const cargado = await guardarPerfilPrecios(DUENO, createBaseCompleteProfile());
    if (!cargado.ok) throw new Error("no guardó");
    await new Promise((r) => setTimeout(r, 2));
    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile({ businessSoftware: "2" }));
    expect(await guardarPerfilPrecios(DUENO, createBaseCompleteProfile(), { esperado: cargado.actualizado })).toEqual({ ok: false, error: CAMBIO, conflicto: true });
  });

  it("el formulario se abrió sin perfil (esperado null) y mientras tanto se creó uno: no lo pisa", async () => {
    await guardarPerfilPrecios(DUENO, createBaseCompleteProfile({ businessSoftware: "7" }), { source: "dnx-bot" });
    expect(await guardarPerfilPrecios(DUENO, createBaseCompleteProfile(), { esperado: null })).toEqual({ ok: false, error: CAMBIO_BOT, conflicto: true });
    expect(B.datos.fotofficePerfilPrecios).toHaveLength(1);
  });

  it("sin perfil y esperado null: lo crea", async () => {
    expect(await guardarPerfilPrecios(DUENO, createBaseCompleteProfile(), { esperado: null })).toMatchObject({ ok: true });
    expect(B.datos.fotofficePerfilPrecios).toHaveLength(1);
  });
});

describe("perfil de precios para el sistema", () => {
  it("sin permisos devuelve el perfil guardado, o null si no hay", async () => {
    expect(await leerPerfilPreciosDelSistema("ws-1")).toBeNull();
    const perfil = createBaseCompleteProfile();
    await guardarPerfilPrecios(DUENO, perfil);
    expect(await leerPerfilPreciosDelSistema("ws-1")).toEqual(perfil);
    expect(await leerPerfilPreciosDelSistema("ws-2")).toBeNull();
  });
});
