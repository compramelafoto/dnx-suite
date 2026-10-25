import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: async () => ({ plural: "socios" }) }));

const V = await import("./valores");
const M = V.MENSAJES_VALORES;

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const OTRO = { ...CTX, workspaceId: "ws-2", userLabel: "Intrusa" };

function sembrar() {
  B.agregar("client", { id: "c1", workspaceId: "ws-1" });
  B.agregar("client", { id: "c2", workspaceId: "ws-1" });
  B.agregar("client", { id: "cx", workspaceId: "ws-2" });
  B.agregar("member", { id: "m1", workspaceId: "ws-1" });
  B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1" });
  const f = (id: string, extra: Record<string, unknown>) =>
    B.agregar("fotofficeCustomField", { id, workspaceId: "ws-1", entityType: "CLIENTE", key: id, name: id, ...extra });
  f("enlace", { name: "Archivos", type: "ENLACE", order: 0 });
  f("estilo", { name: "Estilo", type: "LISTA", order: 1 });
  f("monto", { name: "Monto", type: "NUMERO", order: 2 });
  f("fecha", { name: "Boda", type: "FECHA", order: 3 });
  f("vip", { name: "VIP", type: "SI_NO", order: 4 });
  f("dni", { name: "DNI", type: "TEXTO", order: 5, required: true });
  f("viejo", { name: "Viejo", type: "TEXTO", order: 6, archivedAt: new Date("2026-01-01T00:00:00Z") });
  B.agregar("fotofficeCustomFieldOption", { id: "o-clasico", fieldId: "estilo", label: "Clásico", order: 0 });
  B.agregar("fotofficeCustomFieldOption", { id: "o-moderno", fieldId: "estilo", label: "Moderno", order: 1 });
  B.agregar("fotofficeCustomFieldOption", { id: "o-retro", fieldId: "estilo", label: "Retro", order: 2, archivedAt: new Date() });
  // Campo de otro workspace.
  B.agregar("fotofficeCustomField", { id: "ajeno", workspaceId: "ws-2", entityType: "CLIENTE", key: "x", name: "Ajeno", type: "TEXTO" });
  B.agregar("fotofficeCustomValue", { workspaceId: "ws-2", fieldId: "ajeno", entityType: "CLIENTE", entityId: "cx", valueText: "secreto" });
}

const valores = () => B.datos.fotofficeCustomValue.filter((v) => v.workspaceId === "ws-1");
const historial = () => B.datos.fotofficeCustomValueChange;

beforeEach(() => {
  B.vaciar();
  sembrar();
});

describe("registroDelWorkspace", () => {
  it("cada tipo mira su tabla y su workspace", async () => {
    expect(await V.registroDelWorkspace("ws-1", "CLIENTE", "c1")).toBe(true);
    expect(await V.registroDelWorkspace("ws-1", "CLIENTE", "cx")).toBe(false);
    expect(await V.registroDelWorkspace("ws-1", "SOCIO", "m1")).toBe(true);
    expect(await V.registroDelWorkspace("ws-1", "SOCIO", "c1")).toBe(false);
    expect(await V.registroDelWorkspace("ws-1", "CONSULTA", "l1")).toBe(true);
    expect(await V.registroDelWorkspace("ws-2", "CONSULTA", "l1")).toBe(false);
    expect(await V.registroDelWorkspace("ws-1", "PRESUPUESTO", "c1")).toBe(false);
  });
});

describe("guardar y leer", () => {
  it("guarda cada tipo y lo lee en lote con su forma normalizada", async () => {
    const r = await V.guardarValores(CTX, "CLIENTE", "c1", {
      enlace: "https://drive.example.com/x", estilo: "o-moderno", monto: "1500,50", fecha: "2026-11-20",
      vip: "si", dni: " 30111222 ",
    });
    expect(r).toEqual({ ok: true });
    await V.guardarValores(CTX, "CLIENTE", "c2", { dni: "1", vip: "no" });
    const m = await V.valoresDe("ws-1", "CLIENTE", ["c1", "c2", "cx", "c1"]);
    expect(Object.fromEntries(m.get("c1")!)).toEqual({
      enlace: { texto: "https://drive.example.com/x" }, estilo: { opcionId: "o-moderno" }, monto: { numero: "1500.5" },
      fecha: { fecha: "2026-11-20" }, vip: { booleano: true }, dni: { texto: "30111222" },
    });
    expect(Object.fromEntries(m.get("c2")!)).toEqual({ dni: { texto: "1" }, vip: { booleano: false } });
    expect(m.has("cx")).toBe(false);
    expect(valores().find((v) => v.fieldId === "fecha")!.valueDate).toEqual(new Date("2026-11-20T00:00:00.000Z"));
    expect(valores().every((v) => v.updatedByUserId === 7 && v.workspaceId === "ws-1" && v.entityType === "CLIENTE")).toBe(true);
  });

  it("valoresDe sin ids no consulta", async () => {
    expect((await V.valoresDe("ws-1", "CLIENTE", [])).size).toBe(0);
  });
});

describe("aislamiento", () => {
  it("un valor de otro workspace no se lee", async () => {
    expect((await V.valoresDe("ws-1", "CLIENTE", ["cx"])).size).toBe(0);
  });

  it("no se escribe sobre un registro de otro workspace ni con un campo ajeno", async () => {
    expect(await V.guardarValores(CTX, "CLIENTE", "cx", { ajeno: "pisado", dni: "1" })).toEqual({ ok: false, error: M.noEncontrado });
    // Registro propio con el id de un campo de otro workspace: se ignora.
    expect(await V.guardarValores(CTX, "CLIENTE", "c1", { ajeno: "pisado", dni: "1" })).toEqual({ ok: true });
    expect(await V.guardarValores(OTRO, "CLIENTE", "c1", { ajeno: "pisado" })).toEqual({ ok: false, error: M.noEncontrado });
    expect(B.datos.fotofficeCustomValue.map((v) => [v.fieldId, v.valueText])).toEqual([["ajeno", "secreto"], ["dni", "1"]]);
    expect(historial().map((h) => h.fieldId)).toEqual(["dni"]);
  });

  it("sin `operar` no toca nada", async () => {
    expect(await V.guardarValores({ ...CTX, role: "COLLABORATOR" }, "CLIENTE", "c1", { dni: "1" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(valores()).toHaveLength(0);
  });
});

describe("validación", () => {
  it("obligatorio vacío → error de ese campo, y nada se escribe", async () => {
    const r = await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "  ", enlace: "https://x.com" });
    expect(r).toEqual({ ok: false, error: M.revisar, errores: { dni: "Este dato es obligatorio." } });
    expect(valores()).toHaveLength(0);
  });

  it("un obligatorio que no vino se exige contra lo guardado (marcado obligatorio después de abrir el formulario)", async () => {
    // El formulario se abrió sin "vip" obligatorio; mientras, alguien lo marcó.
    B.datos.fotofficeCustomField.find((f) => f.id === "vip")!.required = true;
    const r = await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1", enlace: "https://x.com" });
    expect(r).toEqual({ ok: false, error: M.revisar, errores: { vip: "Este dato es obligatorio." } });
    expect(valores()).toHaveLength(0);
    // Si ya tenía valor guardado, no hace falta mandarlo.
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: "vip", entityType: "CLIENTE", entityId: "c1", valueBool: true });
    expect(await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1" })).toEqual({ ok: true });
    // Y un obligatorio vacío frena aunque la entrada no traiga ningún campo conocido.
    expect(await V.guardarValores(CTX, "CLIENTE", "c2", {})).toMatchObject({ ok: false, errores: { dni: M.obligatorio, vip: M.obligatorio } });
  });

  it("errores por campo con el motivo de cada tipo", async () => {
    const r = await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1", enlace: "drive.com", monto: "doce", fecha: "2026-02-30" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errores!).sort()).toEqual(["enlace", "fecha", "monto"]);
  });

  it("una opción archivada no se acepta como valor nuevo, pero sí se conserva la que ya tenía", async () => {
    const r = await V.guardarValores(CTX, "CLIENTE", "c1", { estilo: "o-retro", dni: "1" });
    expect(r).toEqual({ ok: false, error: M.revisar, errores: { estilo: "Elegí una de las opciones de la lista." } });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: "estilo", entityType: "CLIENTE", entityId: "c2", optionId: "o-retro" });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: "dni", entityType: "CLIENTE", entityId: "c2", valueText: "2" });
    expect(await V.guardarValores(CTX, "CLIENTE", "c2", { estilo: "o-retro" })).toEqual({ ok: true });
    expect(historial()).toHaveLength(0);
  });

  it("una opción de otro campo se rechaza", async () => {
    B.agregar("fotofficeCustomField", { id: "otra-lista", workspaceId: "ws-1", entityType: "CLIENTE", key: "ol", name: "OL", type: "LISTA" });
    B.agregar("fotofficeCustomFieldOption", { id: "o-otra", fieldId: "otra-lista", label: "Otra" });
    expect(await V.guardarValores(CTX, "CLIENTE", "c1", { estilo: "o-otra", dni: "1" })).toMatchObject({ ok: false, errores: { estilo: expect.any(String) } });
  });

  it("los campos archivados no se editan", async () => {
    expect(await V.guardarValores(CTX, "CLIENTE", "c1", { viejo: "nuevo", dni: "1" })).toEqual({ ok: true });
    expect(valores().map((v) => v.fieldId)).toEqual(["dni"]);
    B.datos.fotofficeCustomValue = B.datos.fotofficeCustomValue.filter((v) => v.fieldId !== "dni");
    expect(valores()).toHaveLength(0);
  });
});

describe("historial", () => {
  it("sin cambios no deja historial", async () => {
    await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1", monto: "12,50", vip: "si" });
    const antes = historial().length;
    expect(await V.guardarValores(CTX, "CLIENTE", "c1", { dni: " 1 ", monto: "12.5", vip: "si", enlace: "" })).toEqual({ ok: true });
    expect(historial()).toHaveLength(antes);
  });

  it("un cambio deja una fila con antes y después legibles", async () => {
    await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1", estilo: "o-clasico", fecha: "2026-11-20", monto: "3" });
    B.datos.fotofficeCustomValueChange.length = 0;
    await V.guardarValores({ ...CTX, userId: 9, userLabel: "Beto" }, "CLIENTE", "c1", {
      dni: "1", estilo: "o-moderno", fecha: "2026-12-01", monto: "3",
    });
    const filas = historial().map(({ fieldId, before, after, actorLabel, actorUserId, entityId, entityType, workspaceId }) => ({
      fieldId, before, after, actorLabel, actorUserId, entityId, entityType, workspaceId,
    }));
    const base = { actorLabel: "Beto", actorUserId: 9, entityId: "c1", entityType: "CLIENTE", workspaceId: "ws-1" };
    expect(filas).toEqual([
      { ...base, fieldId: "estilo", before: "Clásico", after: "Moderno" },
      { ...base, fieldId: "fecha", before: "20/11/2026", after: "01/12/2026" },
    ]);
  });

  it("vaciar un campo borra el valor y deja la línea con después vacío", async () => {
    await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1", vip: "no" });
    await V.guardarValores(CTX, "CLIENTE", "c1", { vip: null });
    expect(valores().map((v) => v.fieldId)).toEqual(["dni"]);
    expect(historial().at(-1)).toMatchObject({ fieldId: "vip", before: "No", after: null });
  });

  it("si falla a mitad, no queda nada a medias", async () => {
    const original = B.tablas.fotofficeCustomValueChange.createMany;
    B.tablas.fotofficeCustomValueChange.createMany = async () => {
      throw new Error("caída");
    };
    try {
      await expect(V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1" })).rejects.toThrow("caída");
    } finally {
      B.tablas.fotofficeCustomValueChange.createMany = original;
    }
    expect(valores()).toHaveLength(0);
  });

  it("cambiosDe: del más nuevo al más viejo, con el nombre del campo, sólo del workspace y paginado", async () => {
    const t = (s: string) => new Date(`2026-10-0${s}T12:00:00Z`);
    const h = (id: string, fieldId: string, d: string, ws = "ws-1") =>
      B.agregar("fotofficeCustomValueChange", { id, workspaceId: ws, entityType: "CLIENTE", entityId: "c1", fieldId, before: "a", after: "b", actorLabel: "Ana", createdAt: t(d) });
    h("h1", "dni", "1");
    h("h2", "estilo", "2");
    h("h3", "borrado", "3");
    h("hx", "dni", "4", "ws-2");
    const todos = await V.cambiosDe("ws-1", "CLIENTE", "c1", { take: 10 });
    expect(todos.cambios.map((c) => [c.id, c.campo])).toEqual([["h3", "Campo borrado"], ["h2", "Estilo"], ["h1", "DNI"]]);
    expect(todos.siguiente).toBeNull();
    const pagina = await V.cambiosDe("ws-1", "CLIENTE", "c1", { take: 1, antesDe: { fecha: t("3"), id: "h3" } });
    expect(pagina.cambios.map((c) => c.id)).toEqual(["h2"]);
    expect(pagina.siguiente).toEqual({ fecha: t("2"), id: "h2" });
    expect(await V.cambiosDe("ws-1", "SOCIO", "c1", { take: 10 })).toEqual({ cambios: [], siguiente: null });
  });

  it("cambiosDe no pierde filas de un mismo guardado al cortar la página", async () => {
    await V.guardarValores(CTX, "CLIENTE", "c1", { dni: "1", vip: "si", monto: "5" });
    expect(historial()).toHaveLength(3);
    // Un solo createMany: en la base real comparten la fecha.
    const misma = new Date("2026-10-01T15:00:00Z");
    for (const h of historial()) h.createdAt = misma;
    const p1 = await V.cambiosDe("ws-1", "CLIENTE", "c1", { take: 2 });
    expect(p1.cambios).toHaveLength(2);
    expect(p1.siguiente).not.toBeNull();
    const p2 = await V.cambiosDe("ws-1", "CLIENTE", "c1", { take: 2, antesDe: p1.siguiente! });
    expect(p2.cambios).toHaveLength(1);
    expect(p2.siguiente).toBeNull();
    expect(new Set([...p1.cambios, ...p2.cambios].map((c) => c.fieldId))).toEqual(new Set(["dni", "vip", "monto"]));
  });
});
