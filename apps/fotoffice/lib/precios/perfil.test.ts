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
    expect(await guardarPerfilPrecios(DUENO, perfil)).toEqual({ ok: true });
    const leido = await leerPerfilPrecios(DUENO);
    expect(leido?.perfil).toEqual(perfil);
    expect(leido?.source).toBe("manual");
    expect(leido?.actualizado).toBeInstanceOf(Date);
    const fila = B.datos.fotofficePerfilPrecios[0]!;
    expect(fila).toMatchObject({ workspaceId: "ws-1", schemaVersion: 1, updatedByUserId: 1 });
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

describe("perfil de precios para el sistema", () => {
  it("sin permisos devuelve el perfil guardado, o null si no hay", async () => {
    expect(await leerPerfilPreciosDelSistema("ws-1")).toBeNull();
    const perfil = createBaseCompleteProfile();
    await guardarPerfilPrecios(DUENO, perfil);
    expect(await leerPerfilPreciosDelSistema("ws-1")).toEqual(perfil);
    expect(await leerPerfilPreciosDelSistema("ws-2")).toBeNull();
  });
});
