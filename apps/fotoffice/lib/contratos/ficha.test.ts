import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const P = vi.hoisted(() => ({
  contrato: vi.fn(),
  versiones: vi.fn(),
  firmantes: vi.fn(),
  eventos: vi.fn(),
  adjunto: vi.fn(),
  usuarios: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeContrato: { findFirst: P.contrato },
    fotofficeContratoVersion: { findMany: P.versiones },
    fotofficeContratoFirmante: { findMany: P.firmantes },
    fotofficeContratoEvento: { findMany: P.eventos },
    fotofficeAttachment: { findFirst: P.adjunto },
    user: { findMany: P.usuarios },
  },
}));

const { cargarFichaContrato, estadoDeFirmante, ETIQUETA_ESTADO_FIRMANTE } = await import("./ficha");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (contracts: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { contracts } } as never });
const AHORA = new Date("2026-10-09T15:00:00.000Z");
const D = (s: string) => new Date(s);

const CONTRATO = {
  id: "ct1", number: "C-1", name: "Contrato de boda", status: "ENVIADO", bodyText: "texto borrador", currentVersionId: "v2",
  createdAt: D("2026-10-01T12:00:00Z"), sentAt: D("2026-10-02T12:00:00Z"), signedAt: null, rejectedAt: null, voidedAt: null, voidReason: null,
  pdfKey: null, pdfHash: null, manualSignedAt: null, manualAttachmentId: null, clientId: "cli1", pedidoId: "ped1",
  client: { firstName: "Ana", lastName: "Gómez", businessName: null }, pedido: { number: "P-9" }, template: { name: "Modelo" },
};

beforeEach(() => {
  for (const f of Object.values(P)) f.mockReset();
  P.contrato.mockResolvedValue(CONTRATO);
  P.versiones.mockResolvedValue([
    { id: "v1", number: 1, bodyText: "viejo", contentHash: "h1", sentAt: D("2026-10-02T12:00:00Z"), revokedAt: D("2026-10-03T12:00:00Z") },
    { id: "v2", number: 2, bodyText: "nuevo", contentHash: "h2", sentAt: D("2026-10-03T12:00:00Z"), revokedAt: null },
  ]);
  P.firmantes.mockResolvedValue([
    { id: "f-viejo", versionId: "v1", orden: 1, name: "Ana", email: "a@x.com", docNumber: null, viewedAt: null, verifiedAt: null, signedAt: D("2026-10-02T13:00:00Z"), rejectedAt: null, rejectReason: null, tokenExpiresAt: D("2026-11-01T00:00:00Z") },
    { id: "f1", versionId: "v2", orden: 1, name: "Ana Gómez", email: "ana@x.com", docNumber: "30.111", viewedAt: D("2026-10-04T10:00:00Z"), verifiedAt: null, signedAt: null, rejectedAt: null, rejectReason: null, tokenExpiresAt: D("2026-11-02T00:00:00Z") },
    { id: "f2", versionId: "v2", orden: 2, name: "Luis", email: "l@x.com", docNumber: null, viewedAt: null, verifiedAt: null, signedAt: null, rejectedAt: D("2026-10-05T10:00:00Z"), rejectReason: "No estoy de acuerdo", tokenExpiresAt: D("2026-10-05T00:00:00Z") },
  ]);
  P.eventos.mockResolvedValue([
    { id: "e1", type: "ENVIADO", firmanteId: null, actorUserId: 7, data: { version: 2, firmantes: 2, correccion: true }, createdAt: D("2026-10-03T12:00:00Z") },
    { id: "e2", type: "FIRMADO", firmanteId: "f-viejo", actorUserId: null, data: null, createdAt: D("2026-10-02T13:00:00Z") },
  ]);
  P.usuarios.mockResolvedValue([{ id: 7, name: "Ana Dueña", email: "d@x.com" }]);
});

describe("estado de un firmante", () => {
  it("el paso más avanzado manda", () => {
    const base = { viewedAt: null, verifiedAt: null, signedAt: null, rejectedAt: null };
    expect(estadoDeFirmante(base)).toBe("PENDIENTE");
    expect(estadoDeFirmante({ ...base, viewedAt: AHORA })).toBe("VISTO");
    expect(estadoDeFirmante({ ...base, viewedAt: AHORA, verifiedAt: AHORA })).toBe("VERIFICADO");
    expect(estadoDeFirmante({ ...base, verifiedAt: AHORA, signedAt: AHORA })).toBe("FIRMADO");
    expect(estadoDeFirmante({ ...base, viewedAt: AHORA, rejectedAt: AHORA })).toBe("RECHAZADO");
    expect(Object.keys(ETIQUETA_ESTADO_FIRMANTE)).toHaveLength(5);
  });
});

describe("ficha del contrato", () => {
  it("sin Ver en Contratos no se lee nada", async () => {
    expect(await cargarFichaContrato(ctx("NONE"), "ct1", AHORA)).toBeNull();
    expect(P.contrato).not.toHaveBeenCalled();
  });

  it("las ids raras no llegan a la base", async () => {
    for (const malo of ["", "a b", "x".repeat(65), "../x"]) expect(await cargarFichaContrato(ctx("VIEW"), malo, AHORA)).toBeNull();
    expect(P.contrato).not.toHaveBeenCalled();
  });

  it("todas las lecturas van acotadas al workspace de la sesión; de otro workspace no hay ficha", async () => {
    P.contrato.mockResolvedValue(null);
    expect(await cargarFichaContrato(ctx("VIEW", "ws-2"), "ct1", AHORA)).toBeNull();
    expect(P.contrato.mock.calls[0]![0].where).toEqual({ id: "ct1", workspaceId: "ws-2" });
    expect(P.versiones).not.toHaveBeenCalled();

    P.contrato.mockResolvedValue(CONTRATO);
    await cargarFichaContrato(ctx("VIEW"), "ct1", AHORA);
    expect(P.versiones.mock.calls[0]![0].where.workspaceId).toBe("ws-1");
    expect(P.firmantes.mock.calls[0]![0].where.workspaceId).toBe("ws-1");
    expect(P.eventos.mock.calls[0]![0].where).toEqual({ workspaceId: "ws-1", contratoId: "ct1" });
  });

  it("muestra los firmantes de la versión vigente (las firmas de la versión vieja no se mezclan) con su estado", async () => {
    const f = (await cargarFichaContrato(ctx("VIEW"), "ct1", AHORA))!;
    expect(f.version).toMatchObject({ numero: 2, texto: "nuevo", huella: "h2", revocada: false });
    expect(f.versiones).toBe(2);
    expect(f.firmantes.map((x) => [x.id, x.estado])).toEqual([["f1", "VISTO"], ["f2", "RECHAZADO"]]);
    expect(f.firmantes[1]).toMatchObject({ motivoRechazo: "No estoy de acuerdo" });
    // f1 puede recibir enlace (pendiente, contrato abierto); f2 rechazó: no.
    expect(f.firmantes.map((x) => x.puedeEnlace)).toEqual([true, false]);
  });

  it("marca el enlace vencido de quien no firmó y no hay enlace en un contrato ya firmado", async () => {
    const f = (await cargarFichaContrato(ctx("VIEW"), "ct1", new Date("2026-11-05T00:00:00Z")))!;
    expect(f.firmantes[0]!.vencido).toBe(true);
    P.contrato.mockResolvedValue({ ...CONTRATO, status: "FIRMADO" });
    const g = (await cargarFichaContrato(ctx("VIEW"), "ct1", AHORA))!;
    expect(g.firmantes.every((x) => !x.puedeEnlace)).toBe(true);
  });

  it("el historial trae etiqueta en español, quién lo hizo y el detalle, sin datos sensibles", async () => {
    const f = (await cargarFichaContrato(ctx("VIEW"), "ct1", AHORA))!;
    expect(f.eventos[0]).toMatchObject({ etiqueta: "Enviado a firmar", actor: "Ana Dueña", detalle: "versión 2 · 2 firmantes · corrección" });
    expect(f.eventos[1]).toMatchObject({ etiqueta: "Firmado", firmante: "Ana", actor: null });
  });

  it("la ficha serializada no lleva el token, su hash, el código, la IP ni el equipo del firmante", async () => {
    const texto = JSON.stringify(await cargarFichaContrato(ctx("VIEW"), "ct1", AHORA));
    for (const prohibido of ["tokenHash", "codeHash", "ipHash", "userAgent", "signatureKey", "pdfKey"]) expect(texto, prohibido).not.toContain(prohibido);
    const select = P.firmantes.mock.calls[0]![0].select as Record<string, boolean>;
    for (const campo of ["tokenHash", "codeHash", "ipHash", "userAgent", "signatureKey"]) expect(select[campo], campo).toBeUndefined();
  });

  it("el PDF sólo figura cuando existe", async () => {
    expect((await cargarFichaContrato(ctx("VIEW"), "ct1", AHORA))!.tienePdf).toBe(false);
    P.contrato.mockResolvedValue({ ...CONTRATO, status: "FIRMADO", pdfKey: "contratos/ws-1/ct1/final.pdf", pdfHash: "abc" });
    const f = (await cargarFichaContrato(ctx("VIEW"), "ct1", AHORA))!;
    expect(f).toMatchObject({ tienePdf: true, huellaPdf: "abc" });
  });
});
