import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { presupuestosSinRespuesta } = await import("./seguimientos");

const AHORA = new Date("2026-10-20T15:00:00.000Z");
const dia = (d: number) => new Date(AHORA.getTime() - d * 24 * 60 * 60 * 1000);
const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "D", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { quotes: "MANAGE" } } as never };

function enviado(id: string, opciones: { hace: number; estado?: string; vence?: Date; vistas?: Date[]; ws?: string; aceptado?: boolean }) {
  const ws = opciones.ws ?? "ws-1";
  B.agregar("serviceSalesLead", { id: `lead-${id}`, workspaceId: ws, name: `Ana ${id} López`, eventType: "BODA", email: "a@b.test", phone: "3415550000" });
  B.agregar("fotofficePresupuesto", {
    id, workspaceId: ws, consultaLeadId: `lead-${id}`, clientId: "c", status: opciones.estado ?? "ENVIADO",
    validUntil: opciones.vence ?? new Date("2026-12-31T00:00:00Z"), currentVersionId: `v-${id}`,
  });
  B.agregar("fotofficePresupuestoVersion", { id: `v-${id}`, workspaceId: ws, presupuestoId: id, number: 1, items: [], totals: {}, sentAt: dia(opciones.hace), acceptedAt: opciones.aceptado ? AHORA : null });
  for (const v of opciones.vistas ?? []) B.agregar("fotofficePresupuestoVista", { workspaceId: ws, versionId: `v-${id}`, viewedAt: v });
  B.agregar("fotofficeRecordNumber", { workspaceId: ws, entityType: "PRESUPUESTO", entityId: id, display: `000${id}`, sequenceKey: "PRESUPUESTO", value: Number(id) });
}

beforeEach(() => {
  B.vaciar();
});

describe("presupuestosSinRespuesta", () => {
  it("enviados o vistos hace al menos los días del seguimiento, sin aceptar ni vencer, del más viejo al más nuevo", async () => {
    enviado("7", { hace: 6, vistas: [dia(5), dia(2)] });
    enviado("9", { hace: 4, estado: "VISTO" });
    enviado("1", { hace: 1 });
    enviado("2", { hace: 10, vence: dia(1) });
    enviado("3", { hace: 10, estado: "ACEPTADO" });
    enviado("4", { hace: 10, ws: "ws-2" });
    const r = await presupuestosSinRespuesta(CTX, { ahora: AHORA });
    expect(r.dias).toBe(3);
    expect(r.presupuestos.map((p) => p.id)).toEqual(["7", "9"]);
    expect(r.presupuestos[0]).toMatchObject({ numero: "0007", nombreDePila: "Ana", estado: "ENVIADO", diasDesdeEnvio: 6, vistas: 2, ultimaVista: "18/10/2026", seguimientoAutomatico: "apagado" });
    expect(JSON.stringify(r)).not.toMatch(/López|a@b\.test|3415550000/);
  });

  it("con otros días pedidos", async () => {
    enviado("1", { hace: 1 });
    expect((await presupuestosSinRespuesta(CTX, { dias: 1, ahora: AHORA })).presupuestos.map((p) => p.id)).toEqual(["1"]);
  });

  it("seguimiento automático: pendiente o ya enviado desde el envío de la versión vigente", async () => {
    B.agregar("fotofficePresupuestoAjustes", { workspaceId: "ws-1", followUpDays: 3, followUpEnabled: true });
    B.agregar("fotofficeMessageTemplate", { id: "tpl", workspaceId: "ws-1", systemKey: "PRESUPUESTO_SEGUIMIENTO", channel: "EMAIL", entityType: "PRESUPUESTO", name: "Seg", enabled: true, subject: "s", body: "b" });
    enviado("7", { hace: 6 });
    enviado("9", { hace: 4 });
    B.agregar("fotofficeMessage", { workspaceId: "ws-1", channel: "EMAIL", templateId: "tpl", entityType: "PRESUPUESTO", entityId: "7", toAddress: "x", subject: "s", body: "b", createdAt: dia(3), status: "SENT", errorCode: null });
    const r = await presupuestosSinRespuesta(CTX, { ahora: AHORA });
    expect(r.seguimientoActivo).toBe(true);
    expect(Object.fromEntries(r.presupuestos.map((p) => [p.id, p.seguimientoAutomatico]))).toEqual({ "7": "enviado", "9": "pendiente" });
  });

  it("como mucho 20", async () => {
    for (let i = 10; i < 35; i++) enviado(String(i), { hace: 5 });
    expect((await presupuestosSinRespuesta(CTX, { ahora: AHORA })).presupuestos).toHaveLength(20);
  });
});
