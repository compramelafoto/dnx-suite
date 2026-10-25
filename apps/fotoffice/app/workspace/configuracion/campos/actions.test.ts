import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acciones de Configuración → Campos contra el catálogo real y la base en memoria. */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ role: vi.fn(), workspaceId: vi.fn(), revalidate: vi.fn(), modulo: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: H.workspaceId(), name: "Estudio" },
    role: H.role(),
  })),
}));

const A = await import("./actions");
const D = await import("@/lib/campos/definiciones");

type Accion = (p: undefined, f: FormData) => Promise<{ error: string | null; ok?: string }>;

function fd(o: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const campos = () => B.datos.fotofficeCustomField;
const opciones = () => B.datos.fotofficeCustomFieldOption;

async function crear(nombre: string, tipo = "TEXTO", extra: Record<string, string | string[]> = {}) {
  const r = await A.crearCampoAction(undefined, fd({ entityType: "CLIENTE", nombre, tipo, ...extra }));
  expect(r.error).toBeNull();
  return campos().find((c) => c.name === nombre)!.id as string;
}

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  H.role.mockReturnValue("WORKSPACE_ADMIN");
  H.workspaceId.mockReturnValue("ws-1");
  H.modulo.mockResolvedValue(true);
});

describe("Configuración → Campos (acciones)", () => {
  it("sin `configurar` ninguna acción toca la base", async () => {
    const id = await crear("Algo", "LISTA", { opciones: "A\nB" });
    const antes = JSON.stringify(B.datos);
    H.role.mockReturnValue("STAFF");
    const acciones = Object.entries(A).filter(([, v]) => typeof v === "function") as [string, Accion][];
    expect(acciones).toHaveLength(10);
    const f = fd({ id, campoId: id, entityType: "CLIENTE", nombre: "X", tipo: "TEXTO", etiqueta: "C", orden: [id] });
    for (const [n, accion] of acciones) expect((await accion(undefined, f)).error, n).toMatch(/dueño o un administrador/);
    expect(JSON.stringify(B.datos)).toBe(antes);
  });

  it("crea con el workspace de la sesión, casillas y opciones de Lista por renglón", async () => {
    const id = await crear("Estilo", "LISTA", { obligatorio: "1", enListado: "1", opciones: "Clásico\n\n Moderno \r\n", workspaceId: "otro" });
    expect(campos().find((c) => c.id === id)).toMatchObject({ workspaceId: "ws-1", required: true, showInList: true, type: "LISTA" });
    expect(opciones().filter((o) => o.fieldId === id).map((o) => o.label)).toEqual(["Clásico", "Moderno"]);
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/campos");
  });

  it("Consultas con Captación apagada: no crea ni reordena", async () => {
    H.modulo.mockResolvedValue(false);
    const r = await A.crearCampoAction(undefined, fd({ entityType: "CONSULTA", nombre: "X", tipo: "TEXTO" }));
    expect(r.error).toBe("Ese módulo no está activo.");
    expect((await A.reordenarCamposAction(undefined, fd({ entityType: "CONSULTA", orden: [] }))).error).toBe("Ese módulo no está activo.");
    expect(campos()).toHaveLength(0);
  });

  it("Clientes y Socios con su módulo apagado: no crean ni reordenan; los demás tipos siguen", async () => {
    const { CLIENTS_MODULE_KEY } = await import("@/lib/clients/constants");
    const { MEMBERS_MODULE_KEY } = await import("@/lib/members/constants");
    const apagado = "Ese módulo no está activo.";
    for (const [tipo, modulo] of [["CLIENTE", CLIENTS_MODULE_KEY], ["SOCIO", MEMBERS_MODULE_KEY]] as const) {
      H.modulo.mockImplementation(async (_ws: string, clave: string) => clave !== modulo);
      expect((await A.crearCampoAction(undefined, fd({ entityType: tipo, nombre: "X", tipo: "TEXTO" }))).error).toBe(apagado);
      expect((await A.reordenarCamposAction(undefined, fd({ entityType: tipo, orden: [] }))).error).toBe(apagado);
    }
    expect(campos()).toHaveLength(0);
    // Con Socios apagado, un campo de clientes sí se crea y después no se archiva si se apaga Clientes.
    H.modulo.mockImplementation(async (_ws: string, clave: string) => clave !== MEMBERS_MODULE_KEY);
    const id = await crear("Del cliente");
    H.modulo.mockImplementation(async (_ws: string, clave: string) => clave !== CLIENTS_MODULE_KEY);
    expect((await A.archivarCampoAction(undefined, fd({ id }))).error).toBe(apagado);
  });

  it("un campo de Consultas con Captación apagada no se edita, archiva, borra ni toca sus opciones", async () => {
    const r = await A.crearCampoAction(undefined, fd({ entityType: "CONSULTA", nombre: "Origen", tipo: "LISTA", opciones: "Web\nRedes" }));
    expect(r.error).toBeNull();
    const id = campos()[0]!.id as string;
    const op = opciones()[0]!.id as string;
    const cliente = await crear("Del cliente");
    const { SERVICE_LEADS_MODULE_KEY } = await import("@/lib/service-leads/constants");
    H.modulo.mockImplementation(async (_ws: string, clave: string) => clave !== SERVICE_LEADS_MODULE_KEY);
    const antes = JSON.stringify(B.datos);
    const apagado = { error: "Ese módulo no está activo." };
    expect(await A.editarCampoAction(undefined, fd({ id, nombre: "X", tipo: "LISTA" }))).toEqual(apagado);
    expect(await A.archivarCampoAction(undefined, fd({ id }))).toEqual(apagado);
    expect(await A.desarchivarCampoAction(undefined, fd({ id }))).toEqual(apagado);
    expect(await A.borrarCampoAction(undefined, fd({ id }))).toEqual(apagado);
    expect(await A.crearOpcionAction(undefined, fd({ campoId: id, etiqueta: "Otra" }))).toEqual(apagado);
    expect(await A.reordenarOpcionesAction(undefined, fd({ campoId: id, orden: opciones().map((o) => o.id as string).reverse() }))).toEqual(apagado);
    expect(await A.renombrarOpcionAction(undefined, fd({ id: op, etiqueta: "Sitio" }))).toEqual(apagado);
    expect(await A.archivarOpcionAction(undefined, fd({ id: op }))).toEqual(apagado);
    expect(JSON.stringify(B.datos)).toBe(antes);
    // Los campos de clientes no dependen de Captación.
    expect((await A.archivarCampoAction(undefined, fd({ id: cliente }))).error).toBeNull();
  });

  it("editar: nombre y casillas; el tipo con datos no cambia y el error llega a la pantalla", async () => {
    const id = await crear("Notas");
    expect((await A.editarCampoAction(undefined, fd({ id, nombre: "Notas largas", tipo: "TEXTO", obligatorio: "1" }))).error).toBeNull();
    expect(campos()[0]).toMatchObject({ name: "Notas largas", required: true, showInList: false });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: id, entityType: "CLIENTE", entityId: "c1" });
    H.revalidate.mockClear();
    const r = await A.editarCampoAction(undefined, fd({ id, nombre: "Notas largas", tipo: "NUMERO" }));
    expect(r).toEqual({ error: D.MENSAJES_CAMPOS.tipoConDatos });
    expect(campos()[0]!.type).toBe("TEXTO");
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("reordenar con el orden completo; un orden viejo se rechaza", async () => {
    const a = await crear("A");
    const b = await crear("B");
    expect((await A.reordenarCamposAction(undefined, fd({ entityType: "CLIENTE", orden: [b, a] }))).error).toBeNull();
    expect(campos().find((c) => c.id === b)!.order).toBe(0);
    expect((await A.reordenarCamposAction(undefined, fd({ entityType: "CLIENTE", orden: [a] }))).error).toBe(D.MENSAJES_CAMPOS.ordenDesactualizado);
  });

  it("archivar, desarchivar y borrar: con datos no se borra", async () => {
    const id = await crear("Fecha", "FECHA");
    expect((await A.archivarCampoAction(undefined, fd({ id }))).ok).toBe("Campo archivado.");
    expect(campos()[0]!.archivedAt).not.toBeNull();
    expect((await A.desarchivarCampoAction(undefined, fd({ id }))).ok).toBe("Campo desarchivado.");
    expect(campos()[0]!.archivedAt).toBeNull();
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: id, entityType: "CLIENTE", entityId: "c1" });
    expect(await A.borrarCampoAction(undefined, fd({ id }))).toEqual({ error: D.MENSAJES_CAMPOS.tieneDatos });
    expect(campos()).toHaveLength(1);
    B.datos.fotofficeCustomValue = [];
    expect((await A.borrarCampoAction(undefined, fd({ id }))).ok).toBe("Campo borrado.");
    expect(campos()).toHaveLength(0);
  });

  it("opciones: agregar, renombrar, reordenar y archivar", async () => {
    const id = await crear("Estilo", "LISTA", { opciones: "A\nB" });
    expect((await A.crearOpcionAction(undefined, fd({ campoId: id, etiqueta: "C" }))).error).toBeNull();
    const [a, b, c] = opciones().map((o) => o.id as string);
    expect((await A.crearOpcionAction(undefined, fd({ campoId: id, etiqueta: "c" }))).error).toBe(D.MENSAJES_CAMPOS.opcionRepetida);
    expect((await A.renombrarOpcionAction(undefined, fd({ id: a!, etiqueta: "Primera" }))).error).toBeNull();
    expect((await A.reordenarOpcionesAction(undefined, fd({ campoId: id, orden: [c!, a!, b!] }))).error).toBeNull();
    expect((await A.archivarOpcionAction(undefined, fd({ id: b! }))).error).toBeNull();
    const lista = (await D.leerCampos("ws-1", "CLIENTE"))[0]!;
    expect(lista.opciones.map((o) => o.label)).toEqual(["C", "Primera"]);
  });

  it("un campo de otro workspace no se encuentra", async () => {
    const id = await crear("Ajeno");
    H.workspaceId.mockReturnValue("ws-2");
    for (const accion of [A.archivarCampoAction, A.borrarCampoAction, A.desarchivarCampoAction] as Accion[]) {
      expect((await accion(undefined, fd({ id }))).error).toBe(D.MENSAJES_CAMPOS.noEncontrado);
    }
    expect((await A.editarCampoAction(undefined, fd({ id, nombre: "Mío", tipo: "TEXTO" }))).error).toBe(D.MENSAJES_CAMPOS.noEncontrado);
    expect(campos()[0]).toMatchObject({ name: "Ajeno", archivedAt: null });
  });

  it("datos con forma inválida no llegan al catálogo", async () => {
    expect(await A.archivarCampoAction(undefined, fd({}))).toEqual({ error: "Los datos no son válidos." });
    expect(await A.reordenarCamposAction(undefined, fd({ entityType: "CLIENTE", orden: ["x".repeat(101)] }))).toEqual({
      error: "Los datos no son válidos.",
    });
  });
});

describe("contarValoresPorCampo", () => {
  it("cuenta sólo los valores del workspace", async () => {
    const id = await crear("Algo");
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: id, entityType: "CLIENTE", entityId: "c1" });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId: id, entityType: "CLIENTE", entityId: "c2" });
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-2", fieldId: id, entityType: "CLIENTE", entityId: "c3" });
    expect(await D.contarValoresPorCampo("ws-1", [id, "otro"])).toEqual({ [id]: 2 });
    expect(await D.contarValoresPorCampo("ws-1", [])).toEqual({});
  });
});
