import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const A = await import("./ajustes");
const { MENSAJES_GALERIA: M } = await import("./acceso");

const ctx = (role: string, workspaceId = "ws-1") => ({ workspaceId, userId: 1, userLabel: "Ana", role, acceso: { role, levels: { gallery: "MANAGE" } } as never });
const DUENO = ctx("WORKSPACE_OWNER");
const ADMIN = ctx("WORKSPACE_ADMIN");
const STAFF = ctx("STAFF");
const BUENOS = { defaultMessage: "Hola, elegí tus fotos", defaultAllowComments: false, defaultDownloadMode: "NINGUNA" };

beforeEach(() => B.vaciar());

describe("ajustes de galería", () => {
  it("sin fila valen los de fábrica: libre, comentarios sí, descarga de la vista y el mensaje de bienvenida", async () => {
    const a = await A.leerAjustesGaleria("ws-1");
    expect(a).toEqual(A.AJUSTES_GALERIA_DE_FABRICA);
    expect(a).toMatchObject({ defaultSelectionMode: "LIBRE", defaultAllowComments: true, defaultDownloadMode: "VISTA" });
    expect(a.defaultMessage).toMatch(/^Seleccioná las fotos para tu fotolibro/);
  });
  it("guarda con `configurar` (dueño o administrador), y la lectura devuelve lo guardado", async () => {
    expect(await A.guardarAjustesGaleria(DUENO, BUENOS)).toEqual({ ok: true });
    expect(await A.leerAjustesGaleria("ws-1")).toEqual({ defaultMessage: "Hola, elegí tus fotos", defaultSelectionMode: "LIBRE", defaultAllowComments: false, defaultDownloadMode: "NINGUNA" });
    expect(await A.guardarAjustesGaleria(ADMIN, { ...BUENOS, defaultAllowComments: true })).toEqual({ ok: true });
    expect(B.datos.fotofficeGaleriaAjustes).toHaveLength(1);
  });
  it("el modo por cantidad no se guarda como valor por omisión (siempre libre)", async () => {
    await A.guardarAjustesGaleria(DUENO, { ...BUENOS, defaultSelectionMode: "CANTIDAD" });
    expect(B.datos.fotofficeGaleriaAjustes[0]!.defaultSelectionMode).toBe("LIBRE");
  });
  it("mensaje vacío = sin mensaje (no vuelve al de fábrica)", async () => {
    await A.guardarAjustesGaleria(DUENO, { ...BUENOS, defaultMessage: "   " });
    expect((await A.leerAjustesGaleria("ws-1")).defaultMessage).toBeNull();
  });
  it("un integrante con Gestionar pero sin `configurar` no puede; tampoco desde otro workspace", async () => {
    expect(await A.guardarAjustesGaleria(STAFF, BUENOS)).toEqual({ ok: false, error: M.sinPermiso });
    expect(B.datos.fotofficeGaleriaAjustes).toHaveLength(0);
    await A.guardarAjustesGaleria(DUENO, BUENOS);
    // El dueño de otro workspace escribe SU fila, no la de ws-1.
    await A.guardarAjustesGaleria(ctx("WORKSPACE_OWNER", "ws-2"), { ...BUENOS, defaultMessage: "otro" });
    expect((await A.leerAjustesGaleria("ws-1")).defaultMessage).toBe("Hola, elegí tus fotos");
    expect((await A.leerAjustesGaleria("ws-2")).defaultMessage).toBe("otro");
  });
  it("valida la forma de los datos", async () => {
    expect((await A.guardarAjustesGaleria(DUENO, null)).ok).toBe(false);
    expect((await A.guardarAjustesGaleria(DUENO, { ...BUENOS, defaultAllowComments: "si" })).ok).toBe(false);
    expect((await A.guardarAjustesGaleria(DUENO, { ...BUENOS, defaultDownloadMode: "TODO" })).ok).toBe(false);
    expect((await A.guardarAjustesGaleria(DUENO, { ...BUENOS, defaultMessage: "x".repeat(2001) })).ok).toBe(false);
    expect((await A.guardarAjustesGaleria(DUENO, { ...BUENOS, defaultMessage: 5 })).ok).toBe(false);
    expect(B.datos.fotofficeGaleriaAjustes).toHaveLength(0);
  });
});
