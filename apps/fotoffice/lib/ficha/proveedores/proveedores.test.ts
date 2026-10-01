import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  nota: vi.fn(),
  evento: vi.fn(),
  clientAudit: vi.fn(),
  memberAudit: vi.fn(),
  caja: vi.fn(),
  cargo: vi.fn(),
  pago: vi.fn(),
  carnet: vi.fn(),
  adjunto: vi.fn(),
  vocab: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: H.vocab }));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeNote: { findMany: H.nota },
    fotofficePersonEvent: { findMany: H.evento },
    clientAudit: { findMany: H.clientAudit },
    memberAudit: { findMany: H.memberAudit },
    cashMovement: { findMany: H.caja },
    membershipCharge: { findMany: H.cargo },
    membershipPayment: { findMany: H.pago },
    memberCardEvent: { findMany: H.carnet },
    fotofficeAttachment: { findMany: H.adjunto },
  },
}));

const { proveedorNotas } = await import("./notas");
const { proveedorEventosPersona } = await import("./eventos-persona");
const { proveedorHistorialCliente } = await import("./historial-cliente");
const { proveedorHistorialSocio } = await import("./historial-socio");
const { proveedorCaja } = await import("./caja");
const { proveedorCuotas } = await import("./cuotas");
const { proveedorCarnets } = await import("./carnets");
const { proveedorAdjuntos } = await import("./adjuntos");
const { PROVEEDORES_FICHA } = await import("./index");

const CTX = { workspaceId: "ws-1" };
const AMBOS = { clientId: "c1", memberId: "m1" };
const SOLO_CLIENTE = { clientId: "c1", memberId: null };
const SOLO_SOCIO = { clientId: null, memberId: "m1" };
const CORTE = new Date("2026-09-01T12:00:00.000Z");
const F = new Date("2026-08-01T10:00:00.000Z");

/** El `where` y el `take` de la única llamada. */
function llamada(fn: ReturnType<typeof vi.fn>) {
  expect(fn).toHaveBeenCalledTimes(1);
  return fn.mock.calls[0]![0] as { where: Record<string, unknown>; take: number; select: Record<string, unknown> };
}

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset().mockResolvedValue([]);
  H.vocab.mockResolvedValue({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" });
});

describe("todos los proveedores", () => {
  it("están registrados con claves únicas", () => {
    const claves = PROVEEDORES_FICHA.map((p) => p.clave);
    expect(claves).toEqual(["notas", "eventos-persona", "historial-cliente", "historial-socio", "campos", "caja", "cuotas", "carnets", "adjuntos"]);
  });
  it("sólo caja y cuotas piden verDinero", () => {
    expect(PROVEEDORES_FICHA.filter((p) => p.capacidad === "verDinero").map((p) => p.clave)).toEqual(["caja", "cuotas"]);
  });
});

describe("notas", () => {
  it("workspace + los dos ids, sin borradas ni fijadas, respeta antesDe y take", async () => {
    await proveedorNotas.traer(CTX, AMBOS, CORTE, 31, { idTope: "notas:n9" });
    const { where, take } = llamada(H.nota);
    expect(where).toMatchObject({
      workspaceId: "ws-1",
      OR: [{ clientId: "c1" }, { memberId: "m1" }],
      deletedAt: null,
      pinned: false,
    });
    expect(where.AND).toEqual([{ OR: [{ createdAt: { lt: CORTE } }, { createdAt: CORTE, id: { lt: "n9" } }] }]);
    expect(take).toBe(31);
  });
  it("arma el evento", async () => {
    H.nota.mockResolvedValue([
      { id: "n1", body: "Hola", createdAt: F, editedAt: null, authorLabel: "Ana", authorUserId: 7, categoryId: "k1", category: { name: "Correo" } },
    ]);
    const [e] = await proveedorNotas.traer(CTX, SOLO_CLIENTE, null, 31);
    expect(e).toEqual({
      id: "notas:n1", tipo: "notas", fecha: F, actor: "Ana", titulo: "Nota · Correo", detalle: "Hola",
      nota: { id: "n1", categoryId: "k1", categoria: "Correo", authorUserId: 7, editada: false },
    });
    expect(llamada(H.nota).where.AND).toEqual([{}]);
  });
});

describe("eventos-persona", () => {
  it("workspace + ids, kinds según el filtro, antesDe y take", async () => {
    await proveedorEventosPersona.traer(CTX, AMBOS, CORTE, 31, { idTope: "caja:x", tipo: "adjuntos" });
    const { where, take } = llamada(H.evento);
    expect(where).toMatchObject({ workspaceId: "ws-1", OR: [{ clientId: "c1" }, { memberId: "m1" }] });
    expect(where.kind).toEqual({ in: ["ADJUNTO_BORRADO", "ADJUNTO_RESTAURADO"] });
    // "eventos-persona:" ordena después de "caja:": el empate ya se mostró.
    expect(where.AND).toEqual([{ createdAt: { lt: CORTE } }]);
    expect(take).toBe(31);
  });
  it("la subida no se repite: ADJUNTO_SUBIDO queda afuera", async () => {
    await proveedorEventosPersona.traer(CTX, AMBOS, null, 31);
    expect((llamada(H.evento).where.kind as { in: string[] }).in).not.toContain("ADJUNTO_SUBIDO");
  });
  it("tipo por kind y título legible", async () => {
    H.evento.mockResolvedValue([
      { id: "e1", kind: "ETIQUETA_PUESTA", detail: { nombre: "VIP" }, actorLabel: "Ana", createdAt: F },
      { id: "e2", kind: "NOTA_BORRADA", detail: {}, actorLabel: "Ana", createdAt: F },
      { id: "e3", kind: "SOCIO_VINCULADO", detail: {}, actorLabel: "Ana", createdAt: F },
    ]);
    H.vocab.mockResolvedValue({ singular: "voluntario", plural: "voluntarios", Singular: "Voluntario", Plural: "Voluntarios" });
    const r = await proveedorEventosPersona.traer(CTX, AMBOS, null, 31);
    expect(r.map((e) => [e.id, e.tipo, e.titulo])).toEqual([
      ["eventos-persona:e1", "cambios", "Etiqueta puesta: VIP"],
      ["eventos-persona:e2", "notas", "Nota borrada"],
      ["eventos-persona:e3", "cambios", "Vinculado con su ficha de voluntario"],
    ]);
    expect(H.vocab).toHaveBeenCalledWith("ws-1");
  });
  it("filtro de un tipo que no produce: no consulta", async () => {
    expect(await proveedorEventosPersona.traer(CTX, AMBOS, null, 31, { tipo: "carnets" })).toEqual([]);
    expect(H.evento).not.toHaveBeenCalled();
  });
});

describe("historial-cliente", () => {
  it("workspace + clientId, antesDe y take; etiquetas de campo", async () => {
    H.clientAudit.mockResolvedValue([
      { id: "a1", action: "UPDATED", actorLabel: "Ana", createdAt: F, changesJson: { email: { before: null, after: "a@b.c" }, ivaCondition: { before: "EXENTO", after: "MONOTRIBUTO" } } },
    ]);
    const [e] = await proveedorHistorialCliente.traer(CTX, AMBOS, CORTE, 31);
    const { where, take } = llamada(H.clientAudit);
    expect(where).toMatchObject({ workspaceId: "ws-1", clientId: "c1" });
    expect(where.AND).toEqual([{ createdAt: { lte: CORTE } }]);
    expect(take).toBe(31);
    expect(e!.cambios).toEqual([
      { campo: "Correo", antes: "vacío", despues: "a@b.c" },
      { campo: "Condición frente al IVA", antes: "Exento", despues: "Monotributo" },
    ]);
  });
  it("sin cliente no consulta", async () => {
    expect(await proveedorHistorialCliente.traer(CTX, SOLO_SOCIO, null, 31)).toEqual([]);
    expect(H.clientAudit).not.toHaveBeenCalled();
  });
});

describe("historial-socio", () => {
  it("workspace + memberId, antesDe y take; invitaciones como portal", async () => {
    H.memberAudit.mockResolvedValue([
      { id: "a1", action: "INVITE_SENT", source: "MANUAL", actorLabel: "Ana", changesJson: null, reason: null, sourceRow: null, createdAt: F },
      { id: "a2", action: "STATUS_CHANGED", source: "MANUAL", actorLabel: "Ana", changesJson: { status: { before: "ACTIVE", after: "SUSPENDED" } }, reason: "Deuda", sourceRow: null, createdAt: F },
    ]);
    const r = await proveedorHistorialSocio.traer(CTX, AMBOS, CORTE, 31);
    const { where, take } = llamada(H.memberAudit);
    expect(where).toMatchObject({ workspaceId: "ws-1", memberId: "m1" });
    expect(where.AND).toEqual([{ createdAt: { lte: CORTE } }]);
    expect(take).toBe(31);
    expect(r[0]).toMatchObject({ id: "historial-socio:a1", tipo: "portal", titulo: "Invitación al portal enviada" });
    expect(r[1]).toMatchObject({
      tipo: "cambios",
      titulo: "Cambio de estado",
      detalle: "Motivo: Deuda",
      cambios: [{ campo: "Estado", antes: "Activo", despues: "Suspendido" }],
    });
  });
  it("filtro portal: sólo acciones de portal", async () => {
    await proveedorHistorialSocio.traer(CTX, AMBOS, null, 31, { tipo: "portal" });
    const acciones = (llamada(H.memberAudit).where.action as { in: string[] }).in;
    expect(acciones).toContain("INVITE_ACCEPTED");
    expect(acciones).toContain("USER_LINKED");
    expect(acciones).not.toContain("UPDATED");
  });
  it("sin socio no consulta", async () => {
    expect(await proveedorHistorialSocio.traer(CTX, SOLO_CLIENTE, null, 31)).toEqual([]);
    expect(H.memberAudit).not.toHaveBeenCalled();
  });
});

describe("caja", () => {
  it("workspace + clientId, occurredAt antes del corte, take; importe como en Caja y enlace", async () => {
    H.caja.mockResolvedValue([
      { id: "k1", kind: "INGRESO", amountArs: { toString: () => "3000.50" }, occurredAt: F, paymentMethod: "EFECTIVO", description: "Copias", reversesMovementId: null, account: { name: "Caja diaria" } },
    ]);
    const [e] = await proveedorCaja.traer(CTX, AMBOS, CORTE, 31, { idTope: "caja:k9" });
    const { where, take } = llamada(H.caja);
    expect(where).toMatchObject({ workspaceId: "ws-1", clientId: "c1" });
    expect(where.AND).toEqual([{ OR: [{ occurredAt: { lt: CORTE } }, { occurredAt: CORTE, id: { lt: "k9" } }] }]);
    expect(take).toBe(31);
    expect(e).toMatchObject({
      id: "caja:k1",
      tipo: "plata",
      titulo: "Ingreso en caja: $ 3.000,50",
      detalle: "Copias · Efectivo · Caja diaria",
      enlace: "/caja/movimientos?ver=k1",
    });
  });
  it("sin cliente no consulta", async () => {
    expect(await proveedorCaja.traer(CTX, SOLO_SOCIO, null, 31)).toEqual([]);
    expect(H.caja).not.toHaveBeenCalled();
  });
});

describe("cuotas", () => {
  it("cargos y pagos acreditados del socio en el workspace, con corte y take", async () => {
    H.cargo.mockResolvedValue([
      { id: "g1", concept: "MENSUAL", period: "2026-09", amountArs: { toString: () => "15000.00" }, dueDate: new Date("2026-09-10T00:00:00Z"), createdAt: F },
    ]);
    H.pago.mockResolvedValue([
      { id: "p1", amountArs: { toString: () => "15000" }, method: "EFECTIVO", providerPaymentRef: null, paidAt: F, allocations: [{ charge: { period: "2026-09" } }] },
    ]);
    const r = await proveedorCuotas.traer(CTX, AMBOS, CORTE, 31);
    const cargo = llamada(H.cargo);
    const pago = llamada(H.pago);
    expect(cargo.where).toMatchObject({ workspaceId: "ws-1", memberId: "m1" });
    expect(cargo.where.AND).toEqual([{ createdAt: { lte: CORTE } }]);
    expect(pago.where).toMatchObject({ workspaceId: "ws-1", memberId: "m1", status: "ACREDITADO" });
    expect(pago.where.AND).toEqual([{ paidAt: { lte: CORTE } }]);
    expect(cargo.take).toBe(31);
    expect(pago.take).toBe(31);
    expect(r.map((e) => [e.id, e.tipo, e.titulo])).toEqual([
      ["cuotas:cargo:g1", "plata", "Cuota generada: septiembre de 2026"],
      ["cuotas:pago:p1", "plata", "Pago acreditado: $ 15.000,00"],
    ]);
    expect(r[1]!.detalle).toBe("Efectivo · Cubre: septiembre de 2026");
  });
  it("sin socio no consulta", async () => {
    expect(await proveedorCuotas.traer(CTX, SOLO_CLIENTE, null, 31)).toEqual([]);
    expect(H.cargo).not.toHaveBeenCalled();
    expect(H.pago).not.toHaveBeenCalled();
  });
});

describe("carnets", () => {
  it("acota por la tarjeta del socio en el workspace (el evento no tiene workspaceId)", async () => {
    H.carnet.mockResolvedValue([{ id: "v1", toState: "IMPRESO", actorLabel: "Imprenta", note: null, createdAt: F, card: { cardNumber: "C-2026-0412" } }]);
    const [e] = await proveedorCarnets.traer(CTX, AMBOS, CORTE, 31);
    const { where, take } = llamada(H.carnet);
    expect(where.card).toEqual({ workspaceId: "ws-1", memberId: "m1" });
    expect(where.AND).toEqual([{ createdAt: { lte: CORTE } }]);
    expect(take).toBe(31);
    expect(e).toMatchObject({ id: "carnets:v1", tipo: "carnets", titulo: "Carnet C-2026-0412: Impreso", actor: "Imprenta" });
  });
  it("sin socio no consulta", async () => {
    expect(await proveedorCarnets.traer(CTX, SOLO_CLIENTE, null, 31)).toEqual([]);
    expect(H.carnet).not.toHaveBeenCalled();
  });
});

describe("adjuntos", () => {
  it("workspace + ids, sólo LISTO, sin storageKey, con corte y take", async () => {
    H.adjunto.mockResolvedValue([{ id: "d1", fileName: "contrato.pdf", sizeBytes: 1_572_864, uploadedByLabel: "Ana", createdAt: F }]);
    const [e] = await proveedorAdjuntos.traer(CTX, AMBOS, CORTE, 31);
    const { where, take, select } = llamada(H.adjunto);
    expect(where).toMatchObject({ workspaceId: "ws-1", OR: [{ clientId: "c1" }, { memberId: "m1" }], status: "LISTO" });
    expect(where.AND).toEqual([{ createdAt: { lte: CORTE } }]);
    expect(take).toBe(31);
    expect(select).not.toHaveProperty("storageKey");
    expect(e).toEqual({ id: "adjuntos:d1", tipo: "adjuntos", fecha: F, actor: "Ana", titulo: "Adjunto: contrato.pdf", detalle: "1,5 MB" });
    expect(JSON.stringify(e)).not.toContain("adjuntos/ws-1");
  });
});
