import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const K = await import("./citas");
const PA = await import("./participantes");
const { MENSAJES_AGENDA: M } = await import("./acceso");

const ctx = (nivel: string | null, extra: Record<string, unknown> = {}, workspaceId = "ws-1") => ({
  workspaceId, userId: 1, userLabel: "Ana", role: "STAFF",
  acceso: { role: "STAFF", levels: nivel ? { agenda: nivel } : {} } as never, ...extra,
});
const GESTIONA = ctx("MANAGE");
const LECTOR = ctx("VIEW");

const INICIO = "2026-11-20T21:00:00.000Z";
const FIN = "2026-11-20T22:30:00.000Z";
const base = (extra: Record<string, unknown> = {}) => ({ title: "Reunión con Laura", startAt: INICIO, endAt: FIN, ...extra });
const citas = () => B.datos.fotofficeCita;

beforeEach(() => {
  B.vaciar();
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 1, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-2", userId: 9, role: "STAFF" });
  B.agregar("fotofficeCitaTipo", { id: "t1", workspaceId: "ws-1", name: "Reunión" });
  B.agregar("fotofficeCitaTipo", { id: "t-baja", workspaceId: "ws-1", name: "Viejo", isActive: false });
  B.agregar("fotofficeCitaTipo", { id: "t-ajeno", workspaceId: "ws-2", name: "Ajeno" });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez" });
  B.agregar("client", { id: "cli-ajeno", workspaceId: "ws-2", kind: "PERSONA", firstName: "X", lastName: "Y" });
  B.agregar("fotofficeProyectoRol", { id: "rol-1", workspaceId: "ws-1", name: "Fotógrafo" });
  B.agregar("fotofficeProyectoRol", { id: "rol-baja", workspaceId: "ws-1", name: "Viejo", isActive: false });
  B.agregar("fotofficeProyectoRol", { id: "rol-ajeno", workspaceId: "ws-2", name: "Ajeno" });
  B.agregar("fotofficeProyecto", { id: "pro-1", workspaceId: "ws-1" });
  B.agregar("fotofficeProyecto", { id: "pro-ajeno", workspaceId: "ws-2" });
  B.agregar("fotofficePedido", { id: "ped-1", workspaceId: "ws-1" });
  B.agregar("fotofficePedido", { id: "ped-ajeno", workspaceId: "ws-2" });
  B.agregar("serviceSalesLead", { id: "lead-1", workspaceId: "ws-1" });
  B.agregar("serviceSalesLead", { id: "lead-ajeno", workspaceId: "ws-2" });
});

describe("crear una cita", () => {
  it("guarda la cita con todos sus vínculos, estado AGENDADA y quién la creó", async () => {
    const r = await K.crearCita(GESTIONA, base({
      typeId: "t1", allDay: false, location: " Estudio ", notes: "Traer el contrato", ownerUserId: 7, clientId: "cli-1",
      proyectoId: "pro-1", pedidoId: "ped-1", consultaLeadId: "lead-1",
    }));
    if (!r.ok) throw new Error(r.error);
    expect(citas()).toHaveLength(1);
    expect(citas()[0]).toMatchObject({
      id: r.id, workspaceId: "ws-1", title: "Reunión con Laura", typeId: "t1", status: "AGENDADA", allDay: false, location: "Estudio",
      notes: "Traer el contrato", ownerUserId: 7, clientId: "cli-1", proyectoId: "pro-1", pedidoId: "ped-1", consultaLeadId: "lead-1", createdByUserId: 1,
    });
    expect(citas()[0]!.startAt).toEqual(new Date(INICIO));
    expect(citas()[0]!.endAt).toEqual(new Date(FIN));
  });

  it("pide Gestionar: Ver o nada no alcanza", async () => {
    expect(await K.crearCita(LECTOR, base())).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.crearCita(ctx(null), base())).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.crearCita(ctx("MANAGE", { userId: null }), base())).toEqual({ ok: false, error: M.sinPermiso });
    expect(citas()).toHaveLength(0);
  });

  it("título obligatorio, fechas válidas y fin posterior al inicio", async () => {
    expect(await K.crearCita(GESTIONA, base({ title: "  " }))).toEqual({ ok: false, error: M.titulo });
    expect(await K.crearCita(GESTIONA, base({ title: "x".repeat(201) }))).toEqual({ ok: false, error: M.titulo });
    expect(await K.crearCita(GESTIONA, base({ startAt: "mañana" }))).toEqual({ ok: false, error: M.fechas });
    expect(await K.crearCita(GESTIONA, base({ endAt: undefined }))).toEqual({ ok: false, error: M.fechas });
    expect(await K.crearCita(GESTIONA, base({ endAt: INICIO }))).toEqual({ ok: false, error: M.finAnterior });
    expect(await K.crearCita(GESTIONA, base({ endAt: "2026-11-20T20:00:00.000Z" }))).toEqual({ ok: false, error: M.finAnterior });
    expect(await K.crearCita(GESTIONA, base({ status: "LISTA" }))).toEqual({ ok: false, error: M.estado });
    expect(citas()).toHaveLength(0);
  });

  it("todo id tiene que ser del workspace de la sesión (el tipo, además, activo)", async () => {
    expect(await K.crearCita(GESTIONA, base({ typeId: "t-ajeno" }))).toEqual({ ok: false, error: M.tipo });
    expect(await K.crearCita(GESTIONA, base({ typeId: "t-baja" }))).toEqual({ ok: false, error: M.tipo });
    expect(await K.crearCita(GESTIONA, base({ ownerUserId: 9 }))).toEqual({ ok: false, error: M.responsable });
    expect(await K.crearCita(GESTIONA, base({ clientId: "cli-ajeno" }))).toEqual({ ok: false, error: M.contacto });
    expect(await K.crearCita(GESTIONA, base({ proyectoId: "pro-ajeno" }))).toEqual({ ok: false, error: M.proyecto });
    expect(await K.crearCita(GESTIONA, base({ pedidoId: "ped-ajeno" }))).toEqual({ ok: false, error: M.pedido });
    expect(await K.crearCita(GESTIONA, base({ consultaLeadId: "lead-ajeno" }))).toEqual({ ok: false, error: M.consulta });
    expect(await K.crearCita(ctx("MANAGE", {}, "ws-2"), base({ typeId: "t1" }))).toEqual({ ok: false, error: M.tipo });
    expect(citas()).toHaveLength(0);
  });

  it("los participantes (equipo o contacto, con rol) se guardan junto con la cita; uno inválido frena todo", async () => {
    const r = await K.crearCita(GESTIONA, base({
      participantes: [{ userId: 7, roleId: "rol-1" }, { clientId: "cli-1", note: "  Novia  " }],
    }));
    if (!r.ok) throw new Error(r.error);
    expect(B.datos.fotofficeCitaParticipante.map((p) => [p.citaId, p.userId, p.clientId, p.roleId, p.note])).toEqual([
      [r.id, 7, null, "rol-1", null],
      [r.id, null, "cli-1", null, "Novia"],
    ]);
    for (const malo of [
      [{ userId: 7, clientId: "cli-1" }], [{}], [{ userId: 9 }], [{ clientId: "cli-ajeno" }],
      [{ userId: 7, roleId: "rol-baja" }], [{ userId: 7, roleId: "rol-ajeno" }], [{ userId: 7 }, { userId: 7 }],
    ]) {
      const antes = citas().length;
      expect((await K.crearCita(GESTIONA, base({ participantes: malo }))).ok).toBe(false);
      expect(citas()).toHaveLength(antes);
    }
  });
});

describe("editar, mover, cambiar de estado y anular", () => {
  async function crear(extra: Record<string, unknown> = {}) {
    const r = await K.crearCita(GESTIONA, base(extra));
    if (!r.ok) throw new Error(r.error);
    return r.id;
  }

  it("edita sólo lo que se manda y valida los ids nuevos", async () => {
    const id = await crear({ typeId: "t1", location: "Estudio" });
    expect(await K.editarCita(GESTIONA, id, { title: "Nuevo título", ownerUserId: 7, location: null })).toEqual({ ok: true, id });
    expect(citas()[0]).toMatchObject({ title: "Nuevo título", ownerUserId: 7, location: null, typeId: "t1" });
    expect(await K.editarCita(GESTIONA, id, { ownerUserId: 9 })).toEqual({ ok: false, error: M.responsable });
    expect(await K.editarCita(GESTIONA, id, { typeId: "t-ajeno" })).toEqual({ ok: false, error: M.tipo });
    expect(await K.editarCita(GESTIONA, id, { typeId: null })).toEqual({ ok: true, id });
    expect(citas()[0]!.typeId).toBeNull();
    expect(await K.editarCita(GESTIONA, id, {})).toEqual({ ok: false, error: M.datosInvalidos });
  });

  it("una cita cuyo tipo se dio de baja conserva el tipo al editarla, pero no se puede elegir de nuevo", async () => {
    const id = await crear();
    B.datos.fotofficeCita[0]!.typeId = "t-baja";
    expect(await K.editarCita(GESTIONA, id, { typeId: "t-baja", title: "Sigue" })).toEqual({ ok: true, id });
    expect(await K.editarCita(GESTIONA, id, { typeId: "t1" })).toEqual({ ok: true, id });
    expect(await K.editarCita(GESTIONA, id, { typeId: "t-baja" })).toEqual({ ok: false, error: M.tipo });
  });

  it("no toca citas de otro workspace ni inexistentes", async () => {
    B.agregar("fotofficeCita", { id: "c-ajena", workspaceId: "ws-2", title: "Ajena", startAt: new Date(INICIO), endAt: new Date(FIN) });
    expect(await K.editarCita(GESTIONA, "c-ajena", { title: "Hackeada" })).toEqual({ ok: false, error: M.noExiste });
    expect(await K.anularCita(GESTIONA, "c-ajena")).toEqual({ ok: false, error: M.noExiste });
    expect(await K.editarCita(GESTIONA, "nada", { title: "x" })).toEqual({ ok: false, error: M.noExiste });
    expect(citas()[0]!.title).toBe("Ajena");
  });

  it("mover cambia inicio, fin y todo el día; el fin siempre contra el inicio vigente", async () => {
    const id = await crear();
    expect(await K.moverCita(GESTIONA, id, { startAt: "2026-11-21T12:00:00.000Z", endAt: "2026-11-21T13:00:00.000Z" })).toEqual({ ok: true, id });
    expect(citas()[0]!.startAt).toEqual(new Date("2026-11-21T12:00:00.000Z"));
    expect(await K.moverCita(GESTIONA, id, { startAt: "2026-11-21T12:00:00.000Z", endAt: "2026-11-21T12:00:00.000Z" })).toEqual({ ok: false, error: M.finAnterior });
    expect(await K.moverCita(GESTIONA, id, { startAt: "2026-11-22T03:00:00.000Z", endAt: "2026-11-23T03:00:00.000Z", allDay: true })).toEqual({ ok: true, id });
    expect(citas()[0]).toMatchObject({ allDay: true });
    expect(await K.moverCita(GESTIONA, id, { startAt: INICIO })).toEqual({ ok: false, error: M.fechas });
    // Editar sólo el fin, anterior al inicio vigente, también se rechaza.
    expect(await K.editarCita(GESTIONA, id, { endAt: "2026-11-01T00:00:00.000Z" })).toEqual({ ok: false, error: M.finAnterior });
  });

  it("estados: cualquiera de los cuatro; anular deja la cita en la base como ANULADA", async () => {
    const id = await crear();
    for (const e of ["CONFIRMADA", "REALIZADA", "AGENDADA"]) {
      expect(await K.cambiarEstadoCita(GESTIONA, id, e)).toEqual({ ok: true, id });
      expect(citas()[0]!.status).toBe(e);
    }
    expect(await K.cambiarEstadoCita(GESTIONA, id, "BORRADA")).toEqual({ ok: false, error: M.estado });
    expect(await K.anularCita(GESTIONA, id)).toEqual({ ok: true, id });
    expect(citas()).toHaveLength(1);
    expect(citas()[0]!.status).toBe("ANULADA");
  });

  it("editar, mover y anular piden Gestionar", async () => {
    const id = await crear();
    expect(await K.editarCita(LECTOR, id, { title: "x" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.moverCita(LECTOR, id, { startAt: INICIO, endAt: FIN })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.anularCita(LECTOR, id)).toEqual({ ok: false, error: M.sinPermiso });
    expect(citas()[0]!.status).toBe("AGENDADA");
  });
});

describe("participantes de una cita existente", () => {
  async function crear() {
    const r = await K.crearCita(GESTIONA, base());
    if (!r.ok) throw new Error(r.error);
    return r.id;
  }

  it("suma, edita y quita; uno solo entre equipo y contacto; sin repetir persona y rol", async () => {
    const id = await crear();
    const a = await PA.agregarParticipante(GESTIONA, id, { userId: 7, roleId: "rol-1" });
    const b = await PA.agregarParticipante(GESTIONA, id, { clientId: "cli-1" });
    if (!a.ok || !b.ok) throw new Error("no sumó");
    expect(await PA.agregarParticipante(GESTIONA, id, { userId: 7, roleId: "rol-1" })).toEqual({ ok: false, error: M.participanteRepetido });
    expect(await PA.agregarParticipante(GESTIONA, id, { userId: 7, clientId: "cli-1" })).toEqual({ ok: false, error: M.participante });
    expect(await PA.agregarParticipante(GESTIONA, id, { userId: 9 })).toEqual({ ok: false, error: M.integrante });
    expect(await PA.agregarParticipante(GESTIONA, id, { clientId: "cli-ajeno" })).toEqual({ ok: false, error: M.contacto });
    expect(await PA.agregarParticipante(GESTIONA, id, { userId: 1, roleId: "rol-ajeno" })).toEqual({ ok: false, error: M.rol });
    expect(await PA.editarParticipante(GESTIONA, b.id, { roleId: "rol-1", note: "Cliente" })).toEqual({ ok: true });
    expect(await PA.editarParticipante(GESTIONA, b.id, { roleId: "rol-baja" })).toEqual({ ok: false, error: M.rol });
    expect(await PA.listarParticipantes(GESTIONA, id)).toEqual([
      expect.objectContaining({ id: a.id, userId: 7, roleName: "Fotógrafo" }),
      expect.objectContaining({ id: b.id, clientId: "cli-1", roleName: "Fotógrafo", note: "Cliente" }),
    ]);
    expect(await PA.quitarParticipante(GESTIONA, a.id)).toEqual({ ok: true });
    expect(B.datos.fotofficeCitaParticipante).toHaveLength(1);
  });

  it("no se opera sobre citas ni participantes de otro workspace, ni sin Gestionar", async () => {
    const id = await crear();
    const otro = ctx("MANAGE", {}, "ws-2");
    expect(await PA.agregarParticipante(otro, id, { userId: 9 })).toEqual({ ok: false, error: M.noExiste });
    const a = await PA.agregarParticipante(GESTIONA, id, { userId: 7 });
    if (!a.ok) throw new Error(a.error);
    expect(await PA.editarParticipante(otro, a.id, { note: "x" })).toEqual({ ok: false, error: M.participanteNoExiste });
    expect(await PA.quitarParticipante(otro, a.id)).toEqual({ ok: false, error: M.participanteNoExiste });
    expect(await PA.listarParticipantes(otro, id)).toEqual([]);
    expect(await PA.agregarParticipante(LECTOR, id, { userId: 1 })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await PA.quitarParticipante(LECTOR, a.id)).toEqual({ ok: false, error: M.sinPermiso });
    expect(B.datos.fotofficeCitaParticipante).toHaveLength(1);
  });
});
