import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NuevaPlantilla } from "./definiciones";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "asociado", plural: "asociados", Singular: "Asociado", Plural: "Asociados" }),
}));

const D = await import("./definiciones");
const M = D.MENSAJES_PLANTILLAS;

const ADMIN = { workspaceId: "ws-1", userId: 1, userLabel: "Ana", role: "ADMIN" };
const EQUIPO = { ...ADMIN, role: "STAFF" };
const OTRO = { ...ADMIN, workspaceId: "ws-2" };

const plantillas = () => B.datos.fotofficeMessageTemplate;
const plantilla = (id: string) => plantillas().find((p) => p.id === id)!;

async function crear(datos: Partial<NuevaPlantilla> = {}, ctx = ADMIN) {
  const r = await D.crearPlantilla(ctx, {
    canal: "EMAIL", tipo: "CLIENTE", nombre: "Hola", asunto: "Hola [nombre]", cuerpo: "Hola [nombre]", ...datos,
  });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

function automatico(workspaceId = "ws-1") {
  return B.agregar("fotofficeMessageTemplate", {
    workspaceId, channel: "EMAIL", entityType: "CONSULTA", name: "Respuesta automática a una consulta nueva",
    subject: "Recibimos tu consulta", body: "Hola", systemKey: "CONSULTA_AUTORESPUESTA",
  }).id as string;
}

beforeEach(() => B.vaciar());

describe("permiso", () => {
  it("sin `configurar` ninguna escritura toca la base", async () => {
    const id = await crear();
    automatico();
    const antes = JSON.stringify(B.datos);
    const rs = await Promise.all([
      D.crearPlantilla(EQUIPO, { canal: "EMAIL", tipo: "CLIENTE", nombre: "X", asunto: "a", cuerpo: "b" }),
      D.editarPlantilla(EQUIPO, id, { nombre: "Y" }),
      D.duplicarPlantilla(EQUIPO, id),
      D.reordenarPlantillas(EQUIPO, "EMAIL", [id]),
      D.archivarPlantilla(EQUIPO, id),
      D.desarchivarPlantilla(EQUIPO, id),
      D.borrarPlantilla(EQUIPO, id),
      D.guardarAutomatico(EQUIPO, "CONSULTA_AUTORESPUESTA", { enabled: true, subject: "a", body: "b" }),
    ]);
    for (const r of rs) expect(r).toEqual({ ok: false, error: M.sinPermiso });
    expect(JSON.stringify(B.datos)).toBe(antes);
  });
});

describe("crear, validar y listar", () => {
  it("crea con orden al final por canal y lista la ficha más las GENERAL", async () => {
    const a = await crear({ nombre: "  Gracias   cliente " });
    const b = await crear({ tipo: "GENERAL", nombre: "General" });
    const c = await crear({ tipo: "CONSULTA", nombre: "Consulta" });
    const w = await crear({ canal: "WHATSAPP", asunto: undefined, nombre: "Wsp" });
    expect(plantilla(a)).toMatchObject({ name: "Gracias cliente", order: 0, workspaceId: "ws-1", updatedByUserId: 1 });
    expect([plantilla(b).order, plantilla(c).order, plantilla(w).order]).toEqual([1, 2, 0]);
    expect(plantilla(w).subject).toBeNull();
    const deCliente = await D.listarPlantillas("ws-1", { canal: "EMAIL", tipo: "CLIENTE" });
    expect(deCliente.map((p) => p.name)).toEqual(["Gracias cliente", "General"]);
    const todas = await D.listarPlantillas("ws-1", { canal: "EMAIL" });
    expect(todas.map((p) => p.name)).toEqual(["Gracias cliente", "General", "Consulta"]);
  });

  it("valida nombre, asunto y cuerpo según el canal", async () => {
    const base = { canal: "EMAIL", tipo: "CLIENTE", nombre: "N", asunto: "A", cuerpo: "C" };
    const r = (d: Record<string, unknown>) => D.crearPlantilla(ADMIN, { ...base, ...d } as NuevaPlantilla);
    expect(await r({ nombre: "   " })).toEqual({ ok: false, error: M.nombre });
    expect(await r({ nombre: "x".repeat(81) })).toEqual({ ok: false, error: M.nombre });
    expect(await r({ asunto: "" })).toEqual({ ok: false, error: M.asunto });
    expect(await r({ asunto: "x".repeat(201) })).toEqual({ ok: false, error: M.asunto });
    expect(await r({ cuerpo: " \n " })).toEqual({ ok: false, error: M.cuerpoVacio });
    expect((await r({ cuerpo: "x".repeat(10_001) })).ok).toBe(false);
    expect((await r({ canal: "WHATSAPP", asunto: "no va" })).ok).toBe(false);
    expect((await r({ canal: "WHATSAPP", asunto: null, cuerpo: "x".repeat(4_001) })).ok).toBe(false);
    expect((await r({ canal: "WHATSAPP", asunto: null, cuerpo: "x".repeat(4_000) })).ok).toBe(true);
    expect(await r({ canal: "SMS" })).toEqual({ ok: false, error: M.canalInvalido });
    expect(await r({ tipo: "PRESUPUESTO" })).toEqual({ ok: false, error: M.tipoInvalido });
  });

  it("una variable desconocida se rechaza diciendo cuál y dónde", async () => {
    const r = await D.crearPlantilla(ADMIN, { canal: "EMAIL", tipo: "SOCIO", nombre: "N", asunto: "Hola", cuerpo: "Tu consulta [consulta_numero]" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("[consulta_numero]");
    expect(r.error).toContain("carácter 13");
    expect(r.errores).toEqual([expect.objectContaining({ campo: "cuerpo", variable: "consulta_numero", posicion: 12 })]);
    const s = await D.crearPlantilla(ADMIN, { canal: "EMAIL", tipo: "CLIENTE", nombre: "N", asunto: "Hola [nombrr]", cuerpo: "ok" });
    expect(!s.ok && s.errores?.[0]).toMatchObject({ campo: "asunto", variable: "nombrr" });
    expect(plantillas()).toHaveLength(0);
  });

  it("una GENERAL no acepta variables de consulta ni campos", async () => {
    B.agregar("fotofficeCustomField", { workspaceId: "ws-1", entityType: "CONSULTA", key: "salon", name: "Salón", type: "TEXTO" });
    const g = await D.crearPlantilla(ADMIN, { canal: "WHATSAPP", tipo: "GENERAL", nombre: "N", cuerpo: "[consulta_fecha]" });
    expect(!g.ok && g.errores?.[0]?.variable).toBe("consulta_fecha");
    const gc = await D.crearPlantilla(ADMIN, { canal: "WHATSAPP", tipo: "GENERAL", nombre: "N", cuerpo: "[campo:salon]" });
    expect(gc.ok).toBe(false);
    const c = await D.crearPlantilla(ADMIN, { canal: "WHATSAPP", tipo: "CONSULTA", nombre: "N", cuerpo: "[consulta_fecha] [campo:salon]" });
    expect(c.ok).toBe(true);
  });

  it("los campos de otro workspace no valen", async () => {
    B.agregar("fotofficeCustomField", { workspaceId: "ws-2", entityType: "CLIENTE", key: "ajeno", name: "Ajeno", type: "TEXTO" });
    const r = await D.crearPlantilla(ADMIN, { canal: "WHATSAPP", tipo: "CLIENTE", nombre: "N", cuerpo: "[campo:ajeno]" });
    expect(r.ok).toBe(false);
  });
});

describe("editar", () => {
  it("cambiar la ficha vuelve a validar el cuerpo", async () => {
    const id = await crear({ tipo: "CONSULTA", cuerpo: "Para el [consulta_fecha]" });
    const r = await D.editarPlantilla(ADMIN, id, { tipo: "CLIENTE" });
    expect(!r.ok && r.errores?.[0]?.variable).toBe("consulta_fecha");
    expect(plantilla(id).entityType).toBe("CONSULTA");
    expect(await D.editarPlantilla(ADMIN, id, { tipo: "CLIENTE", cuerpo: "Hola [nombre]", nombre: "Otra" })).toEqual({ ok: true });
    expect(plantilla(id)).toMatchObject({ entityType: "CLIENTE", body: "Hola [nombre]", name: "Otra", channel: "EMAIL" });
  });
});

describe("tope de activas por canal", () => {
  it("100 activas por canal; las archivadas no cuentan y desarchivar lo verifica", async () => {
    for (let i = 0; i < 100; i++) {
      B.agregar("fotofficeMessageTemplate", { workspaceId: "ws-1", channel: "EMAIL", entityType: "GENERAL", name: `p${i}`, subject: "a", body: "b", order: i });
    }
    automatico();
    const r = await D.crearPlantilla(ADMIN, { canal: "EMAIL", tipo: "GENERAL", nombre: "N", asunto: "a", cuerpo: "b" });
    expect(!r.ok && r.error).toContain("100 plantillas activas de Correo");
    // Otro canal y otro workspace no cuentan.
    expect((await D.crearPlantilla(ADMIN, { canal: "WHATSAPP", tipo: "GENERAL", nombre: "N", cuerpo: "b" })).ok).toBe(true);
    expect((await D.crearPlantilla(OTRO, { canal: "EMAIL", tipo: "GENERAL", nombre: "N", asunto: "a", cuerpo: "b" })).ok).toBe(true);
    const primera = plantillas().find((p) => p.name === "p0")!.id as string;
    expect((await D.duplicarPlantilla(ADMIN, primera)).ok).toBe(false);
    expect(await D.archivarPlantilla(ADMIN, primera)).toEqual({ ok: true });
    const nueva = await crear({ tipo: "GENERAL", nombre: "Nueva" });
    expect(plantilla(nueva).order).toBe(100);
    expect((await D.desarchivarPlantilla(ADMIN, primera)).ok).toBe(false);
    await D.archivarPlantilla(ADMIN, nueva);
    expect(await D.desarchivarPlantilla(ADMIN, primera)).toEqual({ ok: true });
    expect(plantilla(primera)).toMatchObject({ archivedAt: null, order: 100 });
  });
});

describe("aislamiento", () => {
  it("ids de otro workspace: no encontrada, sin tocar nada", async () => {
    const ajena = await crear({}, OTRO);
    const antes = JSON.stringify(B.datos);
    const rs = await Promise.all([
      D.editarPlantilla(ADMIN, ajena, { nombre: "Mía" }),
      D.duplicarPlantilla(ADMIN, ajena),
      D.archivarPlantilla(ADMIN, ajena),
      D.desarchivarPlantilla(ADMIN, ajena),
      D.borrarPlantilla(ADMIN, ajena),
    ]);
    for (const r of rs) expect(r).toEqual({ ok: false, error: M.noEncontrada });
    expect(await D.reordenarPlantillas(ADMIN, "EMAIL", [ajena])).toEqual({ ok: false, error: M.ordenDesactualizado });
    expect(JSON.stringify(B.datos)).toBe(antes);
    expect(await D.listarPlantillas("ws-1", { canal: "EMAIL" })).toEqual([]);
    expect(await D.plantillaParaUsar("ws-1", ajena, "EMAIL", "CLIENTE")).toBeNull();
    expect(await D.leerAutomatico("ws-1", "CONSULTA_AUTORESPUESTA")).toBeNull();
  });

  it("plantillaParaUsar: sólo activa, del canal y de la ficha (o GENERAL)", async () => {
    const id = await crear({ tipo: "CONSULTA" });
    expect(await D.plantillaParaUsar("ws-1", id, "EMAIL", "CONSULTA")).not.toBeNull();
    expect(await D.plantillaParaUsar("ws-1", id, "EMAIL", "CLIENTE")).toBeNull();
    expect(await D.plantillaParaUsar("ws-1", id, "WHATSAPP", "CONSULTA")).toBeNull();
    await D.archivarPlantilla(ADMIN, id);
    expect(await D.plantillaParaUsar("ws-1", id, "EMAIL", "CONSULTA")).toBeNull();
    expect(await D.plantillaParaUsar("ws-1", automatico(), "EMAIL", "CONSULTA")).toBeNull();
  });
});

describe("duplicar, reordenar, borrar y archivar", () => {
  it("duplica al final con 'Copia de'", async () => {
    const a = await crear({ nombre: "x".repeat(80) });
    const r = await D.duplicarPlantilla(ADMIN, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(plantilla(r.id)).toMatchObject({ order: 1, body: plantilla(a).body, subject: plantilla(a).subject });
    expect((plantilla(r.id).name as string).startsWith("Copia de x")).toBe(true);
    expect((plantilla(r.id).name as string).length).toBe(80);
  });

  it("reordena sólo con la lista completa de activas del canal", async () => {
    const a = await crear({ nombre: "A" });
    const b = await crear({ nombre: "B" });
    expect(await D.reordenarPlantillas(ADMIN, "EMAIL", [a])).toEqual({ ok: false, error: M.ordenDesactualizado });
    expect(await D.reordenarPlantillas(ADMIN, "EMAIL", [b, a])).toEqual({ ok: true });
    expect((await D.listarPlantillas("ws-1", { canal: "EMAIL" })).map((p) => p.name)).toEqual(["B", "A"]);
  });

  it("borra si nunca se usó; si se usó, pide archivarla", async () => {
    const libre = await crear({ nombre: "Libre" });
    const usada = await crear({ nombre: "Usada" });
    B.agregar("fotofficeMessage", {
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: usada, toAddress: "x", body: "b", status: "SENT",
    });
    expect(await D.contarUsosPorPlantilla("ws-1", [libre, usada])).toEqual({ [usada]: 1 });
    expect(await D.borrarPlantilla(ADMIN, usada)).toEqual({ ok: false, error: "Esta plantilla ya se usó: archivala." });
    expect(await D.borrarPlantilla(ADMIN, libre)).toEqual({ ok: true });
    expect(plantillas().map((p) => p.name)).toEqual(["Usada"]);
    expect(await D.archivarPlantilla(ADMIN, usada)).toEqual({ ok: true });
    expect(plantilla(usada).archivedAt).toBeInstanceOf(Date);
    expect(await D.listarPlantillas("ws-1", { canal: "EMAIL" })).toEqual([]);
    expect((await D.listarPlantillas("ws-1", { canal: "EMAIL", incluirArchivadas: true })).map((p) => p.name)).toEqual(["Usada"]);
  });
});

describe("mensaje automático", () => {
  it("no se lista, no se edita como común, no se archiva, duplica ni borra", async () => {
    const id = automatico();
    expect(await D.listarPlantillas("ws-1", { canal: "EMAIL", incluirArchivadas: true })).toEqual([]);
    for (const r of [
      await D.editarPlantilla(ADMIN, id, { nombre: "x" }),
      await D.duplicarPlantilla(ADMIN, id),
      await D.archivarPlantilla(ADMIN, id),
      await D.desarchivarPlantilla(ADMIN, id),
      await D.borrarPlantilla(ADMIN, id),
    ]) {
      expect(r).toEqual({ ok: false, error: M.esAutomatico });
    }
    expect(plantilla(id)).toMatchObject({ archivedAt: null, name: "Respuesta automática a una consulta nueva" });
  });

  it("guardarAutomatico valida como Consulta/Correo, guarda el interruptor y lo crea si falta", async () => {
    const mal = await D.guardarAutomatico(ADMIN, "CONSULTA_AUTORESPUESTA", { enabled: true, subject: "Hola", body: "[socio_numero]" });
    expect(!mal.ok && mal.errores?.[0]?.variable).toBe("socio_numero");
    expect(await D.guardarAutomatico(ADMIN, "OTRA", { enabled: true, subject: "a", body: "b" })).toEqual({ ok: false, error: M.noEncontrada });
    expect(await D.guardarAutomatico(ADMIN, "CONSULTA_AUTORESPUESTA", { enabled: "sí", subject: "a", body: "b" })).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await D.guardarAutomatico(ADMIN, "CONSULTA_AUTORESPUESTA", { enabled: true, subject: "Gracias", body: "Hola [nombre], tu consulta [consulta_numero]" })).toEqual({ ok: true });
    expect(await D.leerAutomatico("ws-1", "CONSULTA_AUTORESPUESTA")).toMatchObject({
      enabled: true, subject: "Gracias", channel: "EMAIL", entityType: "CONSULTA", clave: "CONSULTA_AUTORESPUESTA",
    });
    expect(await D.guardarAutomatico(ADMIN, "CONSULTA_AUTORESPUESTA", { enabled: false, subject: "Otra", body: "b" })).toEqual({ ok: true });
    expect(plantillas()).toHaveLength(1);
    expect(plantillas()[0]).toMatchObject({ enabled: false, subject: "Otra", systemKey: "CONSULTA_AUTORESPUESTA" });
    // El de otro workspace no se toca.
    expect(await D.leerAutomatico("ws-2", "CONSULTA_AUTORESPUESTA")).toBeNull();
  });
});
