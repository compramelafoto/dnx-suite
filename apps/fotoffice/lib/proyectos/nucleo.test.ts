import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const R2 = vi.hoisted(() => ({
  urlDeSubida: vi.fn(), urlDeDescarga: vi.fn(), tamanoReal: vi.fn(), borrarObjeto: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/ficha/adjuntos-r2", () => R2);

const P = await import("./proyectos");
const Q = await import("./participantes");
const N = await import("./notas");
const A = await import("./adjuntos");
const S = await import("./semillas");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (projects: Nivel, extra: Record<string, unknown> = {}) => ({
  workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { projects } }, ...extra,
});
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const ADMIN = { ...ctx("MANAGE"), role: "WORKSPACE_ADMIN", acceso: { role: "WORKSPACE_ADMIN", levels: { projects: "MANAGE" as Nivel } } };
const SIN_PERMISO = { ok: false, error: "No tenés permiso para hacer esto." };
const proyecto = (id = "p1") => B.datos.fotofficeProyecto.find((p) => p.id === id)!;

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 8, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-2", userId: 99, role: "STAFF" });
  B.agregar("client", { id: "cl-1", workspaceId: "ws-1", firstName: "Laura" });
  B.agregar("client", { id: "cl-ajeno", workspaceId: "ws-2", firstName: "Ajena" });
  B.agregar("fotofficeProyecto", { id: "p1", workspaceId: "ws-1", number: "PRO-1", name: "Laura · Álbum", clientId: "cl-1", circuitId: "ct-1", baseDate: new Date("2026-11-01T00:00:00Z"), ownerUserId: 7 });
  B.agregar("fotofficeProyecto", { id: "p-ajeno", workspaceId: "ws-2", number: "PRO-1", name: "Ajeno", clientId: "cl-ajeno", circuitId: "ct-2", baseDate: new Date("2026-11-01T00:00:00Z") });
  B.agregar("fotofficeJourney", { id: "j1", workspaceId: "ws-1", circuitId: "ct-1", kind: "TRABAJO", subjectType: "PROYECTO", subjectId: "p1", stageId: "s1", ownerUserId: 7 });
  B.agregar("fotofficeTask", { id: "k1", workspaceId: "ws-1", journeyId: "j1", subjectType: "PROYECTO", subjectId: "p1", title: "A", assigneeUserId: 7 });
  B.agregar("fotofficeTask", { id: "k2", workspaceId: "ws-1", journeyId: "j1", subjectType: "PROYECTO", subjectId: "p1", title: "B", assigneeUserId: 7 });
  B.agregar("fotofficeTask", { id: "k-hecha", workspaceId: "ws-1", journeyId: "j1", subjectType: "PROYECTO", subjectId: "p1", title: "C", assigneeUserId: 7, doneAt: new Date() });
  B.agregar("fotofficeTask", { id: "k-ajena", workspaceId: "ws-2", journeyId: "jx", subjectType: "PROYECTO", subjectId: "p-ajeno", title: "X", assigneeUserId: 99 });
  B.agregar("fotofficeProyectoRol", { id: "r1", workspaceId: "ws-1", name: "DJ" });
  B.agregar("fotofficeProyectoRol", { id: "r-baja", workspaceId: "ws-1", name: "Viejo", isActive: false });
  B.agregar("fotofficeProyectoRol", { id: "r-ajeno", workspaceId: "ws-2", name: "DJ" });
});

describe("editarDatos", () => {
  it("cambia nombre, responsable, delegado, fecha final y descripción; el responsable también va al recorrido", async () => {
    expect(await P.editarDatos(GESTIONA, "p1", { name: "  Nuevo   nombre ", ownerUserId: 8, delegateUserId: 7, finalDueDate: "2026-12-24", description: " Detalle " })).toEqual({ ok: true });
    expect(proyecto()).toMatchObject({ name: "Nuevo nombre", ownerUserId: 8, delegateUserId: 7, description: "Detalle" });
    expect(proyecto().finalDueDate).toEqual(new Date("2026-12-24T00:00:00.000Z"));
    expect(B.datos.fotofficeJourney[0]!.ownerUserId).toBe(8);
  });

  it("null o vacío borra; lo que no viene no se toca", async () => {
    await P.editarDatos(GESTIONA, "p1", { delegateUserId: 8, description: "x", finalDueDate: "2026-12-24" });
    expect(await P.editarDatos(GESTIONA, "p1", { delegateUserId: null, description: "  ", finalDueDate: null, ownerUserId: null })).toEqual({ ok: true });
    expect(proyecto()).toMatchObject({ delegateUserId: null, description: null, finalDueDate: null, ownerUserId: null, name: "Laura · Álbum" });
  });

  it("valida nombre, fecha, descripción y que el equipo sea del workspace", async () => {
    const mal = [
      { name: "" }, { name: "x".repeat(201) }, { name: 3 }, { finalDueDate: "2026-02-30" }, { finalDueDate: 5 },
      { description: "x".repeat(5001) }, { ownerUserId: "7" }, { ownerUserId: 99 }, { delegateUserId: 99 }, {},
    ];
    for (const d of mal) expect((await P.editarDatos(GESTIONA, "p1", d)).ok, JSON.stringify(d)).toBe(false);
    expect(proyecto()).toMatchObject({ name: "Laura · Álbum", ownerUserId: 7 });
  });

  it("sin Gestionar, de otro workspace o inexistente no cambia nada", async () => {
    expect(await P.editarDatos(SOLO_VER, "p1", { name: "x" })).toEqual(SIN_PERMISO);
    expect(await P.editarDatos(GESTIONA, "p-ajeno", { name: "x" })).toEqual({ ok: false, error: "No encontramos ese proyecto." });
    expect(await P.editarDatos(GESTIONA, "nada", { name: "x" })).toMatchObject({ ok: false });
    expect(B.datos.fotofficeProyecto.find((p) => p.id === "p-ajeno")!.name).toBe("Ajeno");
  });
});

describe("suspender y reanudar", () => {
  it("suspende con motivo y reanuda", async () => {
    const ahora = new Date("2026-10-20T15:00:00Z");
    expect(await P.suspender(GESTIONA, "p1", "  El cliente pidió esperar ", ahora)).toEqual({ ok: true });
    expect(proyecto()).toMatchObject({ suspendedAt: ahora, suspendReason: "El cliente pidió esperar" });
    expect(await P.suspender(GESTIONA, "p1", "otra vez")).toEqual({ ok: false, error: "El proyecto ya está suspendido." });
    expect(await P.reanudar(GESTIONA, "p1")).toEqual({ ok: true });
    expect(proyecto()).toMatchObject({ suspendedAt: null, suspendReason: null });
    expect(await P.reanudar(GESTIONA, "p1")).toEqual({ ok: false, error: "El proyecto no está suspendido." });
  });

  it("el motivo es obligatorio y los permisos se respetan", async () => {
    for (const m of ["", "   ", 5, "x".repeat(1001)]) expect((await P.suspender(GESTIONA, "p1", m)).ok).toBe(false);
    expect(await P.suspender(SOLO_VER, "p1", "x")).toEqual(SIN_PERMISO);
    expect(await P.reanudar(SOLO_VER, "p1")).toEqual(SIN_PERMISO);
    expect((await P.suspender(GESTIONA, "p-ajeno", "x")).ok).toBe(false);
    expect(proyecto()).toMatchObject({ suspendedAt: null });
  });

  it("suspendidosEntre devuelve sólo los suspendidos del workspace", async () => {
    await P.suspender(GESTIONA, "p1", "x");
    B.datos.fotofficeProyecto.find((p) => p.id === "p-ajeno")!.suspendedAt = new Date();
    expect([...(await P.suspendidosEntre("ws-1", ["p1", "p-ajeno"]))]).toEqual(["p1"]);
    expect((await P.suspendidosEntre("ws-1", [])).size).toBe(0);
  });
});

describe("reasignarTareas", () => {
  const dueno = (id: string) => B.datos.fotofficeTask.find((t) => t.id === id)!.assigneeUserId;

  it("reasigna todas las pendientes y no toca las hechas ni las de otro proyecto", async () => {
    expect(await P.reasignarTareas(GESTIONA, "p1", { haciaUserId: 8 })).toEqual({ ok: true, reasignadas: 2 });
    expect([dueno("k1"), dueno("k2"), dueno("k-hecha"), dueno("k-ajena")]).toEqual([8, 8, 7, 99]);
  });

  it("reasigna sólo las elegidas, o las de una persona, o deja sin responsable", async () => {
    expect(await P.reasignarTareas(GESTIONA, "p1", { haciaUserId: 8, taskIds: ["k1"] })).toEqual({ ok: true, reasignadas: 1 });
    expect([dueno("k1"), dueno("k2")]).toEqual([8, 7]);
    expect(await P.reasignarTareas(GESTIONA, "p1", { haciaUserId: null, desdeUserId: 7 })).toEqual({ ok: true, reasignadas: 1 });
    expect([dueno("k1"), dueno("k2")]).toEqual([8, null]);
  });

  it("una tarea ajena, hecha o repetida corta todo; el destino tiene que ser del equipo", async () => {
    for (const taskIds of [["k1", "k-ajena"], ["k1", "k-hecha"], [], "k1"]) {
      expect((await P.reasignarTareas(GESTIONA, "p1", { haciaUserId: 8, taskIds })).ok).toBe(false);
    }
    expect((await P.reasignarTareas(GESTIONA, "p1", { haciaUserId: 99 })).ok).toBe(false);
    expect((await P.reasignarTareas(GESTIONA, "p1", { haciaUserId: "8" })).ok).toBe(false);
    expect([dueno("k1"), dueno("k2")]).toEqual([7, 7]);
    expect(await P.reasignarTareas(GESTIONA, "p1", { haciaUserId: 8, desdeUserId: 55 })).toEqual({ ok: false, error: "No hay tareas pendientes para reasignar." });
    expect(await P.reasignarTareas(SOLO_VER, "p1", { haciaUserId: 8 })).toEqual(SIN_PERMISO);
    expect((await P.reasignarTareas(GESTIONA, "p-ajeno", { haciaUserId: 8 })).ok).toBe(false);
  });
});

describe("participantes", () => {
  it("suma un integrante del equipo o un contacto, con rol y nota", async () => {
    expect((await Q.agregarParticipante(GESTIONA, "p1", { userId: 8, roleId: "r1", note: " Llega a las 18 " })).ok).toBe(true);
    expect((await Q.agregarParticipante(GESTIONA, "p1", { clientId: "cl-1" })).ok).toBe(true);
    expect(B.datos.fotofficeProyectoParticipante.map((f) => [f.userId, f.clientId, f.roleId, f.note])).toEqual([[8, null, "r1", "Llega a las 18"], [null, "cl-1", null, null]]);
    expect(await Q.listarParticipantes(GESTIONA, "p1")).toEqual([
      expect.objectContaining({ userId: 8, roleName: "DJ", note: "Llega a las 18" }),
      expect.objectContaining({ clientId: "cl-1", roleName: null }),
    ]);
  });

  it("exige uno solo, del workspace, con rol activo del workspace, sin repetir", async () => {
    const mal = [
      {}, { userId: 8, clientId: "cl-1" }, { userId: 99 }, { clientId: "cl-ajeno" }, { userId: "8" },
      { userId: 8, roleId: "r-ajeno" }, { userId: 8, roleId: "r-baja" }, { userId: 8, roleId: "nada" }, { userId: 8, note: "x".repeat(501) },
    ];
    for (const d of mal) expect((await Q.agregarParticipante(GESTIONA, "p1", d)).ok, JSON.stringify(d)).toBe(false);
    await Q.agregarParticipante(GESTIONA, "p1", { userId: 8, roleId: "r1" });
    expect(await Q.agregarParticipante(GESTIONA, "p1", { userId: 8, roleId: "r1" })).toEqual({ ok: false, error: "Esa persona ya participa con ese rol." });
    expect((await Q.agregarParticipante(GESTIONA, "p1", { userId: 8 })).ok).toBe(true); // mismo usuario, otro rol (ninguno)
    expect((await Q.agregarParticipante(GESTIONA, "p-ajeno", { userId: 8 })).ok).toBe(false);
    expect(await Q.agregarParticipante(SOLO_VER, "p1", { userId: 8 })).toEqual(SIN_PERMISO);
  });

  it("edita rol y nota, y quita; todo acotado al workspace", async () => {
    const { id } = (await Q.agregarParticipante(GESTIONA, "p1", { userId: 8, roleId: "r1" })) as { id: string };
    B.agregar("fotofficeProyectoParticipante", { id: "pa-ajeno", workspaceId: "ws-2", proyectoId: "p-ajeno", userId: 99 });
    expect(await Q.editarParticipante(GESTIONA, id, { roleId: null, note: "Nota" })).toEqual({ ok: true });
    expect(B.datos.fotofficeProyectoParticipante[0]).toMatchObject({ roleId: null, note: "Nota" });
    expect((await Q.editarParticipante(GESTIONA, id, { roleId: "r-baja" })).ok).toBe(false);
    expect((await Q.editarParticipante(GESTIONA, "pa-ajeno", { note: "x" })).ok).toBe(false);
    expect((await Q.editarParticipante(GESTIONA, id, {})).ok).toBe(false);
    expect((await Q.quitarParticipante(GESTIONA, "pa-ajeno")).ok).toBe(false);
    expect(await Q.quitarParticipante(GESTIONA, id)).toEqual({ ok: true });
    expect(B.datos.fotofficeProyectoParticipante.map((f) => f.id)).toEqual(["pa-ajeno"]);
  });

  it("los roles: listar sin bajas del workspace, y crear sólo con configurar, sin repetir", async () => {
    expect((await Q.listarRoles(SOLO_VER)).map((r) => r.name)).toEqual(["DJ"]);
    expect((await Q.listarRoles(SOLO_VER, { conBajas: true })).map((r) => r.name).sort()).toEqual(["DJ", "Viejo"]);
    expect(await Q.listarRoles(ctx("NONE"))).toEqual([]);
    expect(await Q.crearRol(GESTIONA, "Catering")).toEqual(SIN_PERMISO);
    expect((await Q.crearRol(ADMIN, " Catering ")).ok).toBe(true);
    expect(await Q.crearRol(ADMIN, "catering")).toEqual({ ok: false, error: "Ya hay un rol con ese nombre." });
    expect((await Q.crearRol(ADMIN, "")).ok).toBe(false);
  });
});

describe("notas", () => {
  it("agrega, lista (la más nueva primero), edita y borra", async () => {
    const a = (await N.agregarNota(GESTIONA, "p1", "  Primera ")) as { id: string };
    B.datos.fotofficeProyectoNota[0]!.createdAt = new Date("2026-10-01T00:00:00Z");
    await N.agregarNota(GESTIONA, "p1", "Segunda");
    B.datos.fotofficeProyectoNota[1]!.createdAt = new Date("2026-10-02T00:00:00Z");
    expect((await N.listarNotas(SOLO_VER, "p1")).map((n) => n.body)).toEqual(["Segunda", "Primera"]);
    expect(await N.editarNota(GESTIONA, a.id, "Editada")).toEqual({ ok: true });
    expect(B.datos.fotofficeProyectoNota[0]).toMatchObject({ body: "Editada", authorUserId: 7 });
    expect(await N.borrarNota(GESTIONA, a.id)).toEqual({ ok: true });
    expect(B.datos.fotofficeProyectoNota).toHaveLength(1);
  });

  it("valida el texto y el proyecto; ajena sólo la toca el admin", async () => {
    for (const t of ["", "   ", 4, "x".repeat(5001)]) expect((await N.agregarNota(GESTIONA, "p1", t)).ok).toBe(false);
    expect((await N.agregarNota(GESTIONA, "p-ajeno", "x")).ok).toBe(false);
    expect(await N.agregarNota(SOLO_VER, "p1", "x")).toEqual(SIN_PERMISO);
    B.agregar("fotofficeProyectoNota", { id: "n-otro", workspaceId: "ws-1", proyectoId: "p1", body: "De Beto", authorUserId: 8 });
    B.agregar("fotofficeProyectoNota", { id: "n-ws2", workspaceId: "ws-2", proyectoId: "p-ajeno", body: "x", authorUserId: 7 });
    expect(await N.editarNota(GESTIONA, "n-otro", "y")).toEqual({ ok: false, error: "Sólo puede cambiar la nota quien la escribió o un administrador." });
    expect(await N.borrarNota(GESTIONA, "n-otro")).toMatchObject({ ok: false });
    expect(await N.borrarNota(GESTIONA, "n-ws2")).toEqual({ ok: false, error: "No encontramos esa nota." });
    expect(await N.editarNota(ADMIN, "n-otro", "y")).toEqual({ ok: true });
    expect(await N.listarNotas(ctx("NONE"), "p1")).toEqual([]);
  });
});

describe("adjuntos", () => {
  const archivo = { nombre: "contrato.pdf", tipo: "application/pdf", tamano: 1000 };
  const filas = () => B.datos.fotofficeProyectoAdjunto;

  beforeEach(() => {
    R2.urlDeSubida.mockResolvedValue("https://r2.test/put");
    R2.urlDeDescarga.mockResolvedValue("https://r2.test/get");
    R2.tamanoReal.mockResolvedValue(1000);
    R2.borrarObjeto.mockResolvedValue(undefined);
  });

  async function subir() {
    const p = (await A.pedirSubida(GESTIONA, "p1", archivo)) as { id: string; url: string };
    expect(await A.confirmarSubida(GESTIONA, "p1", p.id)).toEqual({ ok: true });
    return p.id;
  }

  it("pide subida (PENDIENTE, clave en adjuntos/<ws>/<uuid>, sin exponerla) y confirma", async () => {
    const r = await A.pedirSubida(GESTIONA, "p1", archivo);
    expect(r).toMatchObject({ ok: true, url: "https://r2.test/put" });
    expect(JSON.stringify(r)).not.toContain("adjuntos/");
    expect(filas()[0]).toMatchObject({ workspaceId: "ws-1", proyectoId: "p1", status: "PENDIENTE", fileName: "contrato.pdf", uploadedByLabel: "Ana" });
    expect(String(filas()[0]!.storageKey)).toMatch(/^adjuntos\/ws-1\/[0-9a-f-]{36}$/);
    expect(await A.confirmarSubida(GESTIONA, "p1", (r as { id: string }).id)).toEqual({ ok: true });
    expect(filas()[0]!.status).toBe("LISTO");
    const visibles = await A.listarAdjuntos(SOLO_VER, "p1");
    expect(visibles).toHaveLength(1);
    expect(JSON.stringify(visibles)).not.toContain("storageKey");
  });

  it("usa las mismas reglas de tipo y tamaño que la ficha", async () => {
    expect((await A.pedirSubida(GESTIONA, "p1", { ...archivo, tipo: "application/zip" })).ok).toBe(false);
    expect((await A.pedirSubida(GESTIONA, "p1", { ...archivo, tamano: 10_485_761 })).ok).toBe(false);
    expect((await A.pedirSubida(GESTIONA, "p1", { ...archivo, tamano: 0 })).ok).toBe(false);
    expect((await A.pedirSubida(GESTIONA, "p-ajeno", archivo)).ok).toBe(false);
    expect(await A.pedirSubida(SOLO_VER, "p1", archivo)).toEqual(SIN_PERMISO);
    expect(filas()).toHaveLength(0);
  });

  it("si el bucket no tiene lo anunciado, la subida se descarta; si no se pudo firmar, no deja fila", async () => {
    const p = (await A.pedirSubida(GESTIONA, "p1", archivo)) as { id: string };
    R2.tamanoReal.mockResolvedValue(5);
    expect(await A.confirmarSubida(GESTIONA, "p1", p.id)).toEqual({ ok: false, error: "La subida no se completó. Probá de nuevo." });
    expect(R2.borrarObjeto).toHaveBeenCalledTimes(1);
    expect(filas()).toHaveLength(0);
    R2.urlDeSubida.mockRejectedValue(new Error("r2"));
    expect((await A.pedirSubida(GESTIONA, "p1", archivo)).ok).toBe(false);
    expect(filas()).toHaveLength(0);
  });

  it("la descarga es un enlace firmado, sólo de LISTO del mismo proyecto y workspace", async () => {
    const id = await subir();
    expect(await A.enlaceDeDescarga(SOLO_VER, "p1", id)).toEqual({ ok: true, url: "https://r2.test/get" });
    expect((await A.enlaceDeDescarga(SOLO_VER, "p-ajeno", id)).ok).toBe(false);
    expect((await A.enlaceDeDescarga({ ...SOLO_VER, workspaceId: "ws-2" }, "p1", id)).ok).toBe(false);
    expect((await A.enlaceDeDescarga(ctx("NONE"), "p1", id)).ok).toBe(false);
  });

  it("borra con plazo de 30 días, restaura sólo un administrador y a tiempo", async () => {
    const id = await subir();
    const ahora = new Date("2026-10-10T12:00:00Z");
    expect(await A.borrarAdjunto(GESTIONA, "p1", id, ahora)).toEqual({ ok: true });
    expect(filas()[0]).toMatchObject({ status: "BORRADO", deletedAt: ahora, purgeAfter: new Date("2026-11-09T12:00:00Z") });
    expect(await A.listarAdjuntos(SOLO_VER, "p1")).toHaveLength(0);
    expect(await A.listarAdjuntos(SOLO_VER, "p1", { conBorrados: true, ahora })).toHaveLength(1);
    expect(await A.restaurarAdjunto(GESTIONA, "p1", id, ahora)).toEqual(SIN_PERMISO);
    expect(await A.restaurarAdjunto(ADMIN, "p1", id, new Date("2026-11-10T00:00:00Z"))).toMatchObject({ ok: false });
    expect(await A.restaurarAdjunto(ADMIN, "p1", id, ahora)).toEqual({ ok: true });
    expect(filas()[0]).toMatchObject({ status: "LISTO", deletedAt: null, purgeAfter: null });
  });

  it("la purga diaria borra del bucket y de la base los vencidos y las subidas sin confirmar", async () => {
    const id = await subir();
    await A.borrarAdjunto(GESTIONA, "p1", id, new Date("2026-09-01T00:00:00Z"));
    await A.pedirSubida(GESTIONA, "p1", archivo);
    filas()[1]!.createdAt = new Date("2026-10-01T00:00:00Z");
    R2.borrarObjeto.mockClear();
    expect(await A.purgarAdjuntos(new Date("2026-10-10T00:00:00Z"))).toEqual({ purgados: 1, pendientesLimpios: 1, fallidos: 0 });
    expect(filas()).toHaveLength(0);
    expect(R2.borrarObjeto).toHaveBeenCalledTimes(2);
  });
});

describe("semilla de roles de DNX", () => {
  it("son 16 nombres, sin repetir, tal cual la configuración real", () => {
    expect(S.ROLES_PROYECTO_DNX).toHaveLength(16);
    expect(new Set(S.ROLES_PROYECTO_DNX).size).toBe(16);
    expect(S.ROLES_PROYECTO_DNX).toContain("Asistente de Fotógrafo");
    expect(S.ROLES_PROYECTO_DNX).toContain("Shows para fiesta");
  });

  it("crea los que faltan sólo en DNX, es idempotente y no reactiva ni duplica", async () => {
    B.vaciar();
    expect(await S.asegurarRolesProyectoDnx("ws-1", "otra-institucion")).toBe(0);
    expect(await S.asegurarRolesProyectoDnx("ws-1", null)).toBe(0);
    B.agregar("fotofficeProyectoRol", { workspaceId: "ws-1", name: "  dj ", isActive: false, order: 4 });
    expect(await S.asegurarRolesProyectoDnx("ws-1", "dnxestudio")).toBe(15);
    expect(await S.asegurarRolesProyectoDnx("ws-1", "dnxestudio")).toBe(0);
    const roles = B.datos.fotofficeProyectoRol;
    expect(roles).toHaveLength(16);
    expect(roles.find((r) => r.name === "  dj ")!.isActive).toBe(false);
    expect(roles.filter((r) => r.workspaceId === "ws-1").every((r) => r.workspaceId === "ws-1")).toBe(true);
  });
});
