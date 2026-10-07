import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acciones de Configuración → Consultas contra los catálogos reales y la base en memoria. */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({
  role: vi.fn(),
  workspaceId: vi.fn(),
  revalidate: vi.fn(),
  modulo: vi.fn(),
  nivel: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: H.workspaceId(), name: "Estudio" },
    role: H.role(),
  })),
}));

const A = await import("./actions");
const S = await import("@/lib/consultas/semillas");
const K = await import("@/lib/consultas/constantes");

type Accion = (p: undefined, f: FormData) => Promise<{ error: string | null; ok?: string }>;

function fd(o: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const categorias = (ws = "ws-1") =>
  B.datos.fotofficeConsultaCategoria.filter((c) => c.workspaceId === ws).sort((a, b) => (a.order as number) - (b.order as number));
const cat = (nombre: string, ws = "ws-1") => categorias(ws).find((c) => c.name === nombre)!;

beforeEach(async () => {
  B.vaciar();
  vi.clearAllMocks();
  H.role.mockReturnValue("WORKSPACE_ADMIN");
  H.workspaceId.mockReturnValue("ws-1");
  H.modulo.mockResolvedValue(true);
  H.nivel.mockResolvedValue(true);
  await S.asegurarCatalogosIniciales("ws-1", "otra-org");
  await S.asegurarCatalogosIniciales("ws-2", "otra-org");
});

describe("Configuración → Consultas (acciones)", () => {
  it("sin `configurar` ninguna acción toca la base", async () => {
    const antes = JSON.stringify(B.datos);
    H.role.mockReturnValue("STAFF");
    const acciones = Object.entries(A).filter(([, v]) => typeof v === "function") as [string, Accion][];
    expect(acciones).toHaveLength(7);
    const id = categorias()[0]!.id as string;
    const f = fd({ catalogo: "categorias", id, nombre: "X", grupo: "BODA", orden: [id], responsable: "", correo: "1" });
    for (const [n, accion] of acciones) expect((await accion(undefined, f)).error, n).toMatch(/dueño o un administrador/);
    expect(JSON.stringify(B.datos)).toBe(antes);
  });

  it("con Consultas apagado tampoco", async () => {
    H.modulo.mockResolvedValue(false);
    const r = await A.crearItemAction(undefined, fd({ catalogo: "origenes", nombre: "Radio" }));
    expect(r.error).toBe("El módulo Consultas no está activo.");
    expect(B.datos.fotofficeOrigen.some((o) => o.name === "Radio")).toBe(false);
  });

  it("crea en el workspace de la sesión, con grupo en categorías", async () => {
    expect((await A.crearItemAction(undefined, fd({ catalogo: "categorias", nombre: "Book", grupo: "TRABAJO_CON_FECHA", workspaceId: "ws-2" }))).error).toBeNull();
    expect(cat("Book")).toMatchObject({ workspaceId: "ws-1", group: "TRABAJO_CON_FECHA", archivedAt: null });
    expect((await A.crearItemAction(undefined, fd({ catalogo: "roles", nombre: "Padrino" }))).ok).toBe("Agregado.");
    expect(B.datos.fotofficeRolParticipante.find((r) => r.name === "Padrino")).toMatchObject({ workspaceId: "ws-1" });
    expect((await A.crearItemAction(undefined, fd({ catalogo: "categorias", nombre: "Mal", grupo: "NADA" }))).error).toMatch(/grupo válido/);
    expect((await A.crearItemAction(undefined, fd({ catalogo: "inventado", nombre: "X" }))).error).toBe("Los datos no son válidos.");
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/consultas");
  });

  it("el grupo de una categoría usada no cambia; el nombre sí", async () => {
    const boda = cat("Boda");
    B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "l1", clientId: "c1", categoryId: boda.id });
    const r = await A.editarItemAction(undefined, fd({ catalogo: "categorias", id: boda.id as string, nombre: "Bodas", grupo: "EVENTO" }));
    expect(r.error).toMatch(/no se puede cambiar/);
    // Con el selector bloqueado (no se envía el grupo) se renombra igual.
    expect((await A.editarItemAction(undefined, fd({ catalogo: "categorias", id: boda.id as string, nombre: "Bodas" }))).error).toBeNull();
    expect(cat("Bodas").group).toBe("BODA");
  });

  it("ordena con subir/bajar, archiva, desarchiva y borra sólo lo que no se usó", async () => {
    const ids = categorias().filter((c) => c.archivedAt === null).map((c) => c.id as string);
    const nuevo = [ids[1]!, ids[0]!, ...ids.slice(2)];
    expect((await A.reordenarAction(undefined, fd({ catalogo: "categorias", orden: nuevo }))).error).toBeNull();
    expect(categorias().map((c) => c.id)).toEqual(nuevo);

    const otro = B.datos.fotofficeOrigen.find((o) => o.workspaceId === "ws-1")!;
    expect((await A.archivarItemAction(undefined, fd({ catalogo: "origenes", id: otro.id as string }))).error).toBeNull();
    expect(otro.archivedAt).toBeInstanceOf(Date);
    expect((await A.desarchivarItemAction(undefined, fd({ catalogo: "origenes", id: otro.id as string }))).error).toBeNull();
    expect(B.datos.fotofficeOrigen.find((o) => o.id === otro.id)!.archivedAt).toBeNull();

    const usada = cat("Boda");
    B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "l1", clientId: "c1", categoryId: usada.id });
    expect((await A.borrarItemAction(undefined, fd({ catalogo: "categorias", id: usada.id as string }))).error).toMatch(/archivala/);
    const libre = categorias().find((c) => c.name !== "Boda")!;
    expect((await A.borrarItemAction(undefined, fd({ catalogo: "categorias", id: libre.id as string }))).ok).toBe("Borrado.");
    expect(categorias().some((c) => c.id === libre.id)).toBe(false);
  });

  it("aislamiento: un id de otra organización no se encuentra", async () => {
    const ajena = cat("Boda", "ws-2");
    for (const accion of [A.archivarItemAction, A.borrarItemAction] as Accion[]) {
      expect((await accion(undefined, fd({ catalogo: "categorias", id: ajena.id as string }))).error).toMatch(/No encontramos/);
    }
    expect((await A.editarItemAction(undefined, fd({ catalogo: "categorias", id: ajena.id as string, nombre: "Hack" }))).error).toMatch(/No encontramos/);
    expect(cat("Boda", "ws-2")).toMatchObject({ archivedAt: null });
  });

  it("avisos: responsable del equipo con Gestionar (o vacío = dueño), correo y tarea", async () => {
    B.agregar("workspaceMembership", { userId: 9, workspaceId: "ws-1", role: "STAFF" });
    B.agregar("workspaceMembership", { userId: 10, workspaceId: "ws-2", role: "STAFF" });
    expect((await A.guardarAvisosAction(undefined, fd({ responsable: "9", correo: "1" }))).ok).toBe("Avisos guardados.");
    expect(B.datos.fotofficeConsultaAjustes[0]).toMatchObject({ workspaceId: "ws-1", defaultOwnerUserId: 9, notifyEmail: true, createTask: false });
    // Alguien de otra organización, o sin Gestionar, no puede ser responsable.
    expect((await A.guardarAvisosAction(undefined, fd({ responsable: "10", correo: "1", tarea: "1" }))).error).toMatch(/responsable/);
    H.nivel.mockResolvedValue(false);
    expect((await A.guardarAvisosAction(undefined, fd({ responsable: "9", tarea: "1" }))).error).toMatch(/responsable/);
    expect((await A.guardarAvisosAction(undefined, fd({ responsable: "", tarea: "1" }))).error).toBeNull();
    expect(B.datos.fotofficeConsultaAjustes[0]).toMatchObject({ defaultOwnerUserId: null, notifyEmail: false, createTask: true });
    expect((await A.guardarAvisosAction(undefined, fd({ responsable: "abc" }))).error).toBe("Los datos no son válidos.");
  });

  it("las semillas de otra organización usan los tipos viejos", () => {
    expect(categorias()).toHaveLength(K.CATEGORIAS_EQUIVALENTES.length);
  });
});
