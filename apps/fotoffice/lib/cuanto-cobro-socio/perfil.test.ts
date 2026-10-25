import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ socios: new Map<number, { workspace: { id: string; name: string } }>() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/portal/access", () => ({
  loadPortalContext: async (userId: number) => {
    const s = H.socios.get(userId);
    return s ? { member: { id: `m-${userId}` }, workspace: s.workspace } : null;
  },
}));

const { accesoCuantoCobroSocio, leerPerfilSocio, guardarPerfilSocio, copiarPerfilDelPortal, hayPerfilDelPortalParaCopiar } = await import("./perfil");
const { leerPerfilPrecios, guardarPerfilPrecios } = await import("@/lib/precios/perfil");
const { CUANTO_COBRO_SOCIO_MODULE_KEY } = await import("./constants");

const SFPR = { id: "ws_sfpr_seed", name: "SFPR" };
const OTRA = { id: "ws-otra", name: "Otra" };
const niveles = { quotes: "MANAGE" };
const DUENA = { workspaceId: "ws-negocio", userId: 10, userLabel: "Ana", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
const EQUIPO = { workspaceId: "ws-negocio", userId: 10, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: niveles } as never };

function encender(workspaceId: string, enabled = true) {
  B.agregar("workspaceFeatureModule", { workspaceId, moduleKey: CUANTO_COBRO_SOCIO_MODULE_KEY, enabled });
}

beforeEach(() => {
  B.vaciar();
  H.socios.clear();
});

describe("acceso a ¿Cuánto Cobro? del portal", () => {
  it("quien no es socio activo no entra", async () => {
    expect(await accesoCuantoCobroSocio(10)).toBeNull();
  });

  it("el socio entra sólo si su institución encendió el módulo", async () => {
    H.socios.set(10, { workspace: SFPR });
    H.socios.set(11, { workspace: OTRA });
    expect(await accesoCuantoCobroSocio(10)).toBeNull();
    encender(SFPR.id);
    expect((await accesoCuantoCobroSocio(10))?.workspace.id).toBe(SFPR.id);
    // Encender en la SFPR no lo abre en otra institución.
    expect(await accesoCuantoCobroSocio(11)).toBeNull();
  });

  it("un módulo apagado (fila con enabled false) no abre", async () => {
    H.socios.set(10, { workspace: SFPR });
    encender(SFPR.id, false);
    expect(await accesoCuantoCobroSocio(10)).toBeNull();
  });
});

describe("perfil personal del socio", () => {
  it("se guarda por persona y no cuelga de ninguna institución", async () => {
    const perfil = createBaseCompleteProfile();
    expect(await guardarPerfilSocio(10, perfil)).toEqual({ ok: true, actualizado: expect.any(Date) });
    expect((await leerPerfilSocio(10))?.perfil).toEqual(perfil);
    expect(await leerPerfilSocio(11)).toBeNull();
    const fila = B.datos.fotofficePerfilPreciosSocio[0]!;
    expect(fila).toMatchObject({ userId: 10, schemaVersion: 1 });
    expect(fila).not.toHaveProperty("workspaceId");
    // Y no toca el perfil de ningún negocio.
    expect(B.datos.fotofficePerfilPrecios).toHaveLength(0);
  });

  it("guardar dos veces deja una sola fila", async () => {
    await guardarPerfilSocio(10, createBaseCompleteProfile());
    await guardarPerfilSocio(10, createBaseCompleteProfile());
    expect(B.datos.fotofficePerfilPreciosSocio).toHaveLength(1);
  });

  it("datos inválidos no se guardan", async () => {
    const r = await guardarPerfilSocio(10, "no es un perfil");
    expect(r.ok).toBe(false);
    expect(B.datos.fotofficePerfilPreciosSocio).toHaveLength(0);
  });

  it("«Mi estudio» no viaja al perfil del socio", async () => {
    const perfil = { ...createBaseCompleteProfile(), studioStructure: { enabled: true } };
    await guardarPerfilSocio(10, perfil);
    expect(B.datos.fotofficePerfilPreciosSocio[0]!.profileData).not.toHaveProperty("studioStructure");
  });

  it("no pisa un perfil que cambió en otra pestaña", async () => {
    const primero = await guardarPerfilSocio(10, createBaseCompleteProfile(), { esperado: null });
    expect(primero.ok).toBe(true);
    // Otra pestaña que también arrancó sin perfil.
    expect(await guardarPerfilSocio(10, createBaseCompleteProfile(), { esperado: null })).toMatchObject({ ok: false, conflicto: true });
    // Una versión vieja tampoco.
    expect(await guardarPerfilSocio(10, createBaseCompleteProfile(), { esperado: new Date("2020-01-01") })).toMatchObject({ ok: false, conflicto: true });
    // Con la versión vigente, sí.
    if (!primero.ok) return;
    expect(await guardarPerfilSocio(10, createBaseCompleteProfile(), { esperado: primero.actualizado })).toMatchObject({ ok: true });
  });
});

describe("copiar el perfil del portal al negocio", () => {
  it("lo ofrece sólo si el negocio no tiene perfil y la persona tiene el suyo", async () => {
    expect(await hayPerfilDelPortalParaCopiar(DUENA)).toBe(false);
    await guardarPerfilSocio(10, createBaseCompleteProfile());
    expect(await hayPerfilDelPortalParaCopiar(DUENA)).toBe(true);
    expect(await hayPerfilDelPortalParaCopiar(EQUIPO)).toBe(false);
    await guardarPerfilPrecios(DUENA, createBaseCompleteProfile());
    expect(await hayPerfilDelPortalParaCopiar(DUENA)).toBe(false);
  });

  it("copia el perfil con origen «portal» y deja el del portal como estaba", async () => {
    const perfil = createBaseCompleteProfile();
    await guardarPerfilSocio(10, perfil);
    expect(await copiarPerfilDelPortal(DUENA)).toMatchObject({ ok: true });
    const negocio = await leerPerfilPrecios(DUENA);
    expect(negocio?.source).toBe("portal");
    expect(negocio?.perfil).toEqual(perfil);
    expect((await leerPerfilSocio(10))?.perfil).toEqual(perfil);
  });

  it("nunca pisa un perfil que el negocio ya tiene", async () => {
    const delNegocio = { ...createBaseCompleteProfile(), businessRent: "123456" };
    await guardarPerfilPrecios(DUENA, delNegocio);
    await guardarPerfilSocio(10, createBaseCompleteProfile());
    expect(await copiarPerfilDelPortal(DUENA)).toEqual({ ok: false, error: "Tu negocio ya tiene un perfil de precios: no lo pisamos." });
    expect((await leerPerfilPrecios(DUENA))?.perfil.businessRent).toBe("123456");
  });

  it("sin permiso de configurar o sin perfil propio, no copia", async () => {
    await guardarPerfilSocio(10, createBaseCompleteProfile());
    expect((await copiarPerfilDelPortal(EQUIPO)).ok).toBe(false);
    B.vaciar();
    expect(await copiarPerfilDelPortal(DUENA)).toEqual({ ok: false, error: "No encontramos tu perfil de ¿Cuánto Cobro? del portal." });
  });
});
