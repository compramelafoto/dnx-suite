import { beforeEach, describe, expect, it, vi } from "vitest";

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
const S = await import("./semillas");
const M = D.MENSAJES_CAMPOS;

const ADMIN = { workspaceId: "ws-1", userId: 1, userLabel: "Ana", role: "ADMIN" };
const EQUIPO = { ...ADMIN, role: "STAFF" };
const OTRO = { ...ADMIN, workspaceId: "ws-2" };

const campos = () => B.datos.fotofficeCustomField;
const campo = (id: string) => campos().find((c) => c.id === id)!;

async function crear(nombre: string, tipo = "TEXTO", ctx = ADMIN, entityType = "CLIENTE", extra: Record<string, unknown> = {}) {
  const r = await D.crearCampo(ctx, entityType, { nombre, tipo, ...extra });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

beforeEach(() => B.vaciar());

describe("permiso", () => {
  it("sin `configurar` ninguna escritura toca la base", async () => {
    const id = await crear("Algo");
    const antes = JSON.stringify(B.datos);
    const rs = await Promise.all([
      D.crearCampo(EQUIPO, "CLIENTE", { nombre: "X", tipo: "TEXTO" }),
      D.editarCampo(EQUIPO, id, { nombre: "Y" }),
      D.reordenarCampos(EQUIPO, "CLIENTE", [id]),
      D.archivarCampo(EQUIPO, id),
      D.desarchivarCampo(EQUIPO, id),
      D.borrarCampo(EQUIPO, id),
      D.crearOpcion(EQUIPO, id, "a"),
      D.renombrarOpcion(EQUIPO, "o", "a"),
      D.archivarOpcion(EQUIPO, "o"),
      D.reordenarOpciones(EQUIPO, id, []),
    ]);
    for (const r of rs) expect(r).toEqual({ ok: false, error: M.sinPermiso });
    expect(JSON.stringify(B.datos)).toBe(antes);
  });
});

describe("crear y listar", () => {
  it("crea con clave estable, orden al final y opciones de Lista", async () => {
    const a = await crear("Archivos del cliente", "ENLACE");
    const b = await crear("Estilo", "LISTA", ADMIN, "CLIENTE", { opciones: ["Clásico", " Moderno  ok "], obligatorio: true, enListado: true });
    expect(campo(a)).toMatchObject({ key: "archivos_del_cliente", order: 0, workspaceId: "ws-1", required: false });
    expect(campo(b)).toMatchObject({ key: "estilo", order: 1, required: true, showInList: true });
    const lista = await D.listarCampos("ws-1", "CLIENTE");
    expect(lista.map((c) => c.name)).toEqual(["Archivos del cliente", "Estilo"]);
    expect(lista[1]!.opciones.map((o) => o.label)).toEqual(["Clásico", "Moderno ok"]);
  });

  it("claves únicas con sufijo, también contra archivados; otro tipo de registro no choca", async () => {
    const a = await crear("Estilo");
    await D.archivarCampo(ADMIN, a);
    const b = await crear("estilo!");
    const c = await crear("ESTILO");
    const d = await crear("Estilo", "TEXTO", ADMIN, "SOCIO");
    expect([campo(b).key, campo(c).key, campo(d).key]).toEqual(["estilo_2", "estilo_3", "estilo"]);
  });

  it("la clave con sufijo no pasa de 40", async () => {
    const largo = "a".repeat(55);
    await crear(largo);
    const id = await crear(largo);
    expect(campo(id).key).toBe(`${"a".repeat(38)}_2`);
  });

  it("valida nombre, tipo y tipo de registro", async () => {
    expect(await D.crearCampo(ADMIN, "CLIENTE", { nombre: " ", tipo: "TEXTO" })).toEqual({ ok: false, error: "Poné un nombre para el campo." });
    expect(await D.crearCampo(ADMIN, "CLIENTE", { nombre: "x".repeat(61), tipo: "TEXTO" })).toMatchObject({ ok: false });
    expect(await D.crearCampo(ADMIN, "CLIENTE", { nombre: "X", tipo: "MONEDA" })).toEqual({ ok: false, error: M.tipoInvalido });
    expect(await D.crearCampo(ADMIN, "PRESUPUESTO", { nombre: "X", tipo: "TEXTO" })).toEqual({ ok: false, error: M.tipoRegistroInvalido });
    expect(await D.crearCampo(ADMIN, "CLIENTE", { nombre: "X", tipo: "LISTA", opciones: ["a", "A"] })).toEqual({ ok: false, error: M.opcionRepetida });
    expect(campos()).toHaveLength(0);
  });

  it("aislamiento: no lista, no edita, no archiva ni borra campos de otro workspace", async () => {
    const ajeno = await crear("Ajeno", "LISTA", OTRO, "CLIENTE", { opciones: ["uno"] });
    const opcion = B.datos.fotofficeCustomFieldOption[0]!.id as string;
    expect(await D.listarCampos("ws-1", "CLIENTE", { incluirArchivados: true })).toEqual([]);
    expect(await D.editarCampo(ADMIN, ajeno, { nombre: "Mío" })).toEqual({ ok: false, error: M.noEncontrado });
    expect(await D.archivarCampo(ADMIN, ajeno)).toEqual({ ok: false, error: M.noEncontrado });
    expect(await D.borrarCampo(ADMIN, ajeno)).toEqual({ ok: false, error: M.noEncontrado });
    expect(await D.crearOpcion(ADMIN, ajeno, "dos")).toEqual({ ok: false, error: M.noEncontrado });
    expect(await D.renombrarOpcion(ADMIN, opcion, "dos")).toEqual({ ok: false, error: M.opcionNoEncontrada });
    expect(await D.archivarOpcion(ADMIN, opcion)).toEqual({ ok: false, error: M.opcionNoEncontrada });
    expect(campo(ajeno)).toMatchObject({ name: "Ajeno", archivedAt: null });
    expect(B.datos.fotofficeCustomFieldOption[0]).toMatchObject({ label: "uno", archivedAt: null });
  });
});

describe("tope de 40 activos", () => {
  it("el 41 se rechaza con el plural del registro; archivar libera lugar; desarchivar respeta el tope", async () => {
    for (let i = 0; i < 40; i++) await crear(`Campo ${i}`, "TEXTO", ADMIN, "SOCIO");
    expect(await D.crearCampo(ADMIN, "SOCIO", { nombre: "Otro", tipo: "TEXTO" })).toEqual({
      ok: false, error: "Ya hay 40 campos activos para asociados. Archivá alguno.",
    });
    expect(await D.crearCampo(ADMIN, "CLIENTE", { nombre: "Otro", tipo: "TEXTO" })).toMatchObject({ ok: true });
    const primero = campos().find((c) => c.name === "Campo 0")!.id as string;
    await D.archivarCampo(ADMIN, primero);
    const nuevo = await crear("Otro", "TEXTO", ADMIN, "SOCIO");
    expect(await D.desarchivarCampo(ADMIN, primero)).toEqual({ ok: false, error: "Ya hay 40 campos activos para asociados. Archivá alguno." });
    await D.archivarCampo(ADMIN, nuevo);
    expect(await D.desarchivarCampo(ADMIN, primero)).toEqual({ ok: true });
    expect(campo(primero)).toMatchObject({ archivedAt: null, order: 40 });
  });
});

describe("editar", () => {
  it("cambia nombre, obligatorio y listado sin tocar la clave", async () => {
    const id = await crear("Estilo");
    expect(await D.editarCampo(ADMIN, id, { nombre: "Estilo de fotos", obligatorio: true, enListado: true })).toEqual({ ok: true });
    expect(campo(id)).toMatchObject({ key: "estilo", name: "Estilo de fotos", required: true, showInList: true });
  });

  it("el tipo cambia sin valores y no con valores", async () => {
    const id = await crear("Dato");
    expect(await D.editarCampo(ADMIN, id, { tipo: "NUMERO" })).toEqual({ ok: true });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: id, entityType: "CLIENTE", entityId: "c1", valueNumber: "3" });
    expect(await D.editarCampo(ADMIN, id, { tipo: "TEXTO" })).toEqual({ ok: false, error: M.tipoConDatos });
    expect(campo(id).type).toBe("NUMERO");
  });

  it("el cambio de tipo se verifica dentro de la transacción: un valor que llega en el medio lo frena", async () => {
    const id = await crear("Dato");
    const original = B.tablas.fotofficeCustomValue.count;
    let llamadas = 0;
    B.tablas.fotofficeCustomValue.count = async (a) => {
      // La primera (fuera de la transacción) no ve nada; justo después alguien guarda un valor.
      if (++llamadas === 1) {
        B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: id, entityType: "CLIENTE", entityId: "c1", valueText: "x" });
        return 0;
      }
      return original(a);
    };
    try {
      expect(await D.editarCampo(ADMIN, id, { tipo: "NUMERO", nombre: "Otro" })).toEqual({ ok: false, error: M.tipoConDatos });
    } finally {
      B.tablas.fotofficeCustomValue.count = original;
    }
    expect(llamadas).toBe(2);
    expect(campo(id)).toMatchObject({ type: "TEXTO", name: "Dato" });
    expect(B.transacciones.length).toBeGreaterThan(0);
  });
});

describe("borrar o archivar", () => {
  it("sin valores se borra (con sus opciones); con valores pide archivar y queda todo", async () => {
    const sin = await crear("Sin datos", "LISTA", ADMIN, "CLIENTE", { opciones: ["a"] });
    expect(await D.borrarCampo(ADMIN, sin)).toEqual({ ok: true });
    expect(campos()).toHaveLength(0);
    expect(B.datos.fotofficeCustomFieldOption).toHaveLength(0);

    const con = await crear("Con datos");
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: con, entityType: "CLIENTE", entityId: "c1", valueText: "x" });
    expect(await D.borrarCampo(ADMIN, con)).toEqual({ ok: false, error: "Este campo tiene datos: archivalo." });
    expect(await D.archivarCampo(ADMIN, con)).toEqual({ ok: true });
    expect(campo(con).archivedAt).toBeInstanceOf(Date);
    expect(B.datos.fotofficeCustomValue).toHaveLength(1);
    expect(await D.listarCampos("ws-1", "CLIENTE")).toEqual([]);
    expect((await D.listarCampos("ws-1", "CLIENTE", { incluirArchivados: true })).map((c) => c.id)).toEqual([con]);
  });
});

describe("orden", () => {
  it("reordena los activos y rechaza listas desactualizadas o ajenas", async () => {
    const [a, b, c] = [await crear("A"), await crear("B"), await crear("C")];
    const ajeno = await crear("Z", "TEXTO", OTRO);
    expect(await D.reordenarCampos(ADMIN, "CLIENTE", [c, a, b])).toEqual({ ok: true });
    expect((await D.listarCampos("ws-1", "CLIENTE")).map((x) => x.id)).toEqual([c, a, b]);
    expect(await D.reordenarCampos(ADMIN, "CLIENTE", [c, a])).toEqual({ ok: false, error: M.ordenDesactualizado });
    expect(await D.reordenarCampos(ADMIN, "CLIENTE", [c, a, ajeno])).toEqual({ ok: false, error: M.ordenDesactualizado });
    expect(await D.reordenarCampos(ADMIN, "CLIENTE", [c, a, a])).toEqual({ ok: false, error: M.ordenDesactualizado });
    expect(campo(ajeno).order).toBe(0);
  });
});

describe("opciones", () => {
  it("agrega, renombra, archiva y reordena; la archivada sigue en las etiquetas", async () => {
    const id = await crear("Estilo", "LISTA", ADMIN, "CLIENTE", { opciones: ["Clásico"] });
    const r = await D.crearOpcion(ADMIN, id, "Moderno");
    if (!r.ok) throw new Error(r.error);
    expect(await D.crearOpcion(ADMIN, id, "moderno")).toEqual({ ok: false, error: M.opcionRepetida });
    expect(await D.renombrarOpcion(ADMIN, r.id, "Clasico")).toEqual({ ok: false, error: M.opcionRepetida });
    expect(await D.renombrarOpcion(ADMIN, r.id, "Contemporáneo")).toEqual({ ok: true });
    const clasico = B.datos.fotofficeCustomFieldOption.find((o) => o.label === "Clásico")!.id as string;
    expect(await D.reordenarOpciones(ADMIN, id, [r.id, clasico])).toEqual({ ok: true });
    expect((await D.listarCampos("ws-1", "CLIENTE"))[0]!.opciones.map((o) => o.label)).toEqual(["Contemporáneo", "Clásico"]);
    expect(await D.archivarOpcion(ADMIN, clasico)).toEqual({ ok: true });
    const [c] = await D.listarCampos("ws-1", "CLIENTE");
    expect(c!.opciones.map((o) => o.label)).toEqual(["Contemporáneo"]);
    expect(c!.etiquetas).toEqual({ [clasico]: "Clásico", [r.id]: "Contemporáneo" });
    // Archivada, su nombre se puede volver a usar.
    expect(await D.crearOpcion(ADMIN, id, "Clásico")).toMatchObject({ ok: true });
  });

  it("sólo las Listas tienen opciones", async () => {
    const id = await crear("Texto");
    expect(await D.crearOpcion(ADMIN, id, "a")).toEqual({ ok: false, error: M.noEsLista });
  });
});

describe("campo inicial de DNX", () => {
  it("crea Archivos del cliente una sola vez y sólo en DNX", async () => {
    await S.asegurarCamposIniciales("ws-1", "dnxestudio");
    await S.asegurarCamposIniciales("ws-1", "dnxestudio");
    await S.asegurarCamposIniciales("ws-2", "sfpr");
    expect(campos()).toHaveLength(1);
    expect(campos()[0]).toMatchObject({
      workspaceId: "ws-1", entityType: "CLIENTE", key: "archivos_del_cliente", name: "Archivos del cliente", type: "ENLACE",
    });
  });

  it("no vuelve si DNX ya tiene algún campo de clientes, aunque esté archivado", async () => {
    const id = await crear("Mío");
    await D.archivarCampo(ADMIN, id);
    await S.asegurarCamposIniciales("ws-1", "dnxestudio");
    expect(campos()).toHaveLength(1);
  });

  it("si otra pestaña lo creó en el mismo instante, no falla", async () => {
    const original = B.tablas.fotofficeCustomField.count;
    B.tablas.fotofficeCustomField.count = async () => {
      B.agregar("fotofficeCustomField", { workspaceId: "ws-1", entityType: "CLIENTE", key: "archivos_del_cliente", name: "x", type: "ENLACE" });
      return 0;
    };
    try {
      await expect(S.asegurarCamposIniciales("ws-1", "dnxestudio")).resolves.toBeUndefined();
    } finally {
      B.tablas.fotofficeCustomField.count = original;
    }
  });
});
