import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const P = await import("./plantillas");
const S = await import("./semillas");
const { MENSAJES_CONTRATO: M } = await import("./acceso");
const { CUERPO_PLANTILLA_MODELO, NOMBRE_PLANTILLA_MODELO } = await import("./modelo");
const { revisarPlantillaContrato } = await import("./variables");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (role: string, contracts: Nivel = "MANAGE", workspaceId = "ws-1") => ({ workspaceId, userId: 1, userLabel: "Ana", role, acceso: { role, levels: { contracts } } as never });
const DUENO = ctx("WORKSPACE_OWNER");
const STAFF = ctx("STAFF");
const CUERPO = "# Contrato\n\nEntre [empresa_nombre] y [contratante1_nombre].";

beforeEach(() => B.vaciar());

describe("plantillas de contrato", () => {
  it("crea con orden creciente, activa por omisión, y lista en orden", async () => {
    const a = await P.crearPlantilla(DUENO, { name: "  Boda ", body: CUERPO });
    const b = await P.crearPlantilla(DUENO, { name: "Cumple", body: CUERPO, isActive: false });
    expect(a.ok && b.ok).toBe(true);
    expect(B.datos.fotofficeContratoPlantilla.map((p) => [p.name, p.order, p.isActive])).toEqual([["Boda", 0, true], ["Cumple", 1, false]]);
    expect((await P.listarPlantillas(DUENO)).map((p) => p.name)).toEqual(["Boda", "Cumple"]);
  });

  it("rechaza nombre vacío o largo, texto vacío, nombre repetido (sin mayúsculas) y variables desconocidas", async () => {
    expect(await P.crearPlantilla(DUENO, { name: " ", body: CUERPO })).toEqual({ ok: false, error: M.plantillaNombre });
    expect(await P.crearPlantilla(DUENO, { name: "x".repeat(121), body: CUERPO })).toEqual({ ok: false, error: M.plantillaNombre });
    expect(await P.crearPlantilla(DUENO, { name: "A", body: "  " })).toEqual({ ok: false, error: M.plantillaCuerpo });
    expect(await P.crearPlantilla(DUENO, null)).toEqual({ ok: false, error: M.datosInvalidos });
    await P.crearPlantilla(DUENO, { name: "Boda", body: CUERPO });
    expect(await P.crearPlantilla(DUENO, { name: "BODA", body: CUERPO })).toEqual({ ok: false, error: M.plantillaRepetida });
    const mala = await P.crearPlantilla(DUENO, { name: "Mala", body: "Hola [no_existe] y [si:contratante1_nombre]sin cerrar" });
    expect(mala.ok).toBe(false);
    expect(!mala.ok && mala.error).toContain(M.plantillaVariables);
    expect(!mala.ok && mala.error).toContain("[no_existe]");
    expect(B.datos.fotofficeContratoPlantilla).toHaveLength(1);
  });

  it("tiene un tope de 50 plantillas", async () => {
    for (let i = 0; i < 50; i++) B.agregar("fotofficeContratoPlantilla", { id: `p${i}`, workspaceId: "ws-1", name: `P${i}`, body: CUERPO });
    expect(await P.crearPlantilla(DUENO, { name: "Una más", body: CUERPO })).toEqual({ ok: false, error: M.plantillaTope });
  });

  it("sólo `configurar` escribe; Ver y Gestionar leen únicamente las activas", async () => {
    expect(await P.crearPlantilla(STAFF, { name: "A", body: CUERPO })).toEqual({ ok: false, error: M.sinPermiso });
    B.agregar("fotofficeContratoPlantilla", { id: "p1", workspaceId: "ws-1", name: "Activa", body: CUERPO, order: 0 });
    B.agregar("fotofficeContratoPlantilla", { id: "p2", workspaceId: "ws-1", name: "Apagada", body: CUERPO, order: 1, isActive: false });
    expect(await P.editarPlantilla(STAFF, "p1", { name: "X" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await P.eliminarPlantilla(STAFF, "p1")).toEqual({ ok: false, error: M.sinPermiso });
    expect((await P.listarPlantillas(STAFF)).map((p) => p.name)).toEqual(["Activa"]);
    expect((await P.listarPlantillas(ctx("STAFF", "VIEW"))).map((p) => p.name)).toEqual(["Activa"]);
    expect((await P.listarPlantillas(ctx("STAFF", "NONE")))).toEqual([]);
    expect(await P.leerPlantilla(STAFF, "p2")).toBeNull();
    expect((await P.leerPlantilla(DUENO, "p2"))?.name).toBe("Apagada");
    expect((await P.listarPlantillas(DUENO)).map((p) => p.name)).toEqual(["Activa", "Apagada"]);
  });

  it("edita nombre, texto, activa y orden; revalida el texto y el nombre repetido", async () => {
    B.agregar("fotofficeContratoPlantilla", { id: "p1", workspaceId: "ws-1", name: "Uno", body: CUERPO });
    B.agregar("fotofficeContratoPlantilla", { id: "p2", workspaceId: "ws-1", name: "Dos", body: CUERPO });
    expect(await P.editarPlantilla(DUENO, "p1", { name: "Uno bis", body: "Nuevo [fecha_hoy]", isActive: false, order: "7" })).toEqual({ ok: true });
    expect(B.datos.fotofficeContratoPlantilla[0]).toMatchObject({ name: "Uno bis", body: "Nuevo [fecha_hoy]", isActive: false, order: 7 });
    expect(await P.editarPlantilla(DUENO, "p1", { name: "dos" })).toEqual({ ok: false, error: M.plantillaRepetida });
    expect(await P.editarPlantilla(DUENO, "p1", { name: "Uno bis" })).toEqual({ ok: true });
    expect(await P.editarPlantilla(DUENO, "p1", { order: -1 })).toEqual({ ok: false, error: M.plantillaOrden });
    expect(await P.editarPlantilla(DUENO, "p1", { isActive: "si" })).toEqual({ ok: false, error: M.datosInvalidos });
    const mala = await P.editarPlantilla(DUENO, "p1", { body: "[xxx]" });
    expect(!mala.ok && mala.error).toContain("[xxx]");
    expect(await P.editarPlantilla(DUENO, "nada", { name: "A" })).toEqual({ ok: false, error: M.plantillaNoExiste });
  });

  it("no toca plantillas de otro workspace", async () => {
    B.agregar("fotofficeContratoPlantilla", { id: "ajena", workspaceId: "ws-2", name: "Ajena", body: CUERPO });
    expect(await P.editarPlantilla(DUENO, "ajena", { name: "Mía" })).toEqual({ ok: false, error: M.plantillaNoExiste });
    expect(await P.eliminarPlantilla(DUENO, "ajena")).toEqual({ ok: false, error: M.plantillaNoExiste });
    expect(await P.leerPlantilla(DUENO, "ajena")).toBeNull();
    expect(await P.listarPlantillas(DUENO)).toEqual([]);
    expect(B.datos.fotofficeContratoPlantilla).toHaveLength(1);
  });

  it("elimina la propia", async () => {
    B.agregar("fotofficeContratoPlantilla", { id: "p1", workspaceId: "ws-1", name: "Uno", body: CUERPO });
    expect(await P.eliminarPlantilla(DUENO, "p1")).toEqual({ ok: true });
    expect(B.datos.fotofficeContratoPlantilla).toHaveLength(0);
  });
});

describe("plantilla modelo de DNX", () => {
  it("el texto usa sólo variables válidas, está marcado como modelo y habla de firma electrónica", () => {
    expect(revisarPlantillaContrato(CUERPO_PLANTILLA_MODELO)).toEqual({ ok: true });
    expect(CUERPO_PLANTILLA_MODELO).toContain("MODELO PARA REEMPLAZAR");
    expect(NOMBRE_PLANTILLA_MODELO).toBe("Contrato de eventos (modelo)");
    expect(CUERPO_PLANTILLA_MODELO.toLowerCase()).not.toContain("firma digital");
    for (const v of ["contratante1_nombre", "contratante2_nombre", "pedido_items", "pedido_cuotas", "pedido_total", "evento_fecha", "salto_de_pagina", "empresa_cuit"]) {
      expect(CUERPO_PLANTILLA_MODELO).toContain(`[${v}]`);
    }
  });

  it("se siembra sólo en DNX, una vez, y no vuelve si la organización ya tiene plantillas", async () => {
    expect(await S.asegurarPlantillaModeloDnx("ws-1", "otra-institucion")).toBe(0);
    expect(await S.asegurarPlantillaModeloDnx("ws-1", null)).toBe(0);
    expect(B.datos.fotofficeContratoPlantilla).toHaveLength(0);
    expect(await S.asegurarPlantillaModeloDnx("ws-1", "dnxestudio")).toBe(1);
    expect(await S.asegurarPlantillaModeloDnx("ws-1", "dnxestudio")).toBe(0);
    expect(B.datos.fotofficeContratoPlantilla).toHaveLength(1);
    expect(B.datos.fotofficeContratoPlantilla[0]).toMatchObject({ name: NOMBRE_PLANTILLA_MODELO, isActive: true });
    // Si la borra o la renombra, no vuelve a aparecer.
    B.datos.fotofficeContratoPlantilla[0].name = "Mi contrato";
    expect(await S.asegurarPlantillaModeloDnx("ws-1", "dnxestudio")).toBe(0);
    expect(B.datos.fotofficeContratoPlantilla).toHaveLength(1);
  });
});
