import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), lanzar: vi.fn(), evento: vi.fn(), aviso: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { supportTicket: { findMany: (...a: unknown[]) => m.find(...a), update: (...a: unknown[]) => m.update(...a) } } }));
vi.mock("@/lib/soporte/diagnostico/lanzar", () => ({ lanzarDiagnostico: (...a: unknown[]) => m.lanzar(...a), diagnosticoEncendido: () => process.env.CLF_SUPPORT_DIAG_ENABLED === "1" }));
vi.mock("@/lib/soporte/aplicar-evento", () => ({ aplicarEvento: (...a: unknown[]) => m.evento(...a) }));
vi.mock("@/lib/soporte/avisos", () => ({ avisarSoporte: (...a: unknown[]) => m.aviso(...a) }));
import { correrCronSoporte } from "@/lib/soporte/cron";
import { GET } from "./route";

const now = new Date("2026-10-26T12:00:00Z");
const hace = (h: number) => new Date(now.getTime() - h * 3_600_000);

type Where = { status?: unknown; esperandoDesde?: unknown; OR?: unknown };
function filas(where: Where) {
  const s = JSON.stringify(where.status);
  if (where.OR) return [{ id: 1 }, { id: 2 }];
  if (s.includes("WAITING_CUSTOMER") && where.esperandoDesde) return [{ id: 3 }];
  return [
    { id: 4, reason: "OTHER", createdAt: hace(30), slaDesde: null, vencimientoAvisadoAt: null },
    { id: 5, reason: "OTHER", createdAt: hace(30), slaDesde: null, vencimientoAvisadoAt: hace(2) },
    { id: 6, reason: "OTHER", createdAt: hace(2), slaDesde: null, vencimientoAvisadoAt: null },
    { id: 7, reason: "OTHER", createdAt: hace(50), slaDesde: hace(25), vencimientoAvisadoAt: hace(26) },
  ];
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.find.mockImplementation(async (a: { where: Where }) => filas(a.where));
  m.evento.mockResolvedValue({ status: "RESOLVED" });
  process.env.CLF_SUPPORT_DIAG_ENABLED = "1";
});

describe("correrCronSoporte", () => {
  it("diagnostica pendientes de a 5, resuelve los que esperan hace 3 días y avisa vencidos una sola vez", async () => {
    const r = await correrCronSoporte(now);
    expect(m.find.mock.calls.find((c) => c[0].where.OR)![0].take).toBe(5);
    expect(m.lanzar.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    expect(m.evento).toHaveBeenCalledWith(3, { tipo: "SIN_RESPUESTA_3_DIAS" }, now);
    // 4: vencido sin aviso → avisa. 5: ya avisado después de que arrancó el reloj → no. 6: en plazo → no.
    // 7: el reloj se reinició después del último aviso → avisa de nuevo.
    expect(m.aviso.mock.calls.map((c) => c[0])).toEqual([expect.stringContaining("#4"), expect.stringContaining("#7")]);
    expect(m.update.mock.calls.map((c) => c[0].where.id)).toEqual([4, 7]);
    expect(r).toEqual({ diagnosticados: 2, autoResueltos: 1, avisosVencidos: 2 });
  });

  it("con el diagnóstico apagado no diagnostica, pero el resto sigue", async () => {
    process.env.CLF_SUPPORT_DIAG_ENABLED = "";
    const r = await correrCronSoporte(now);
    expect(m.lanzar).not.toHaveBeenCalled();
    expect(r.autoResueltos).toBe(1);
  });
});

describe("GET /api/cron/soporte", () => {
  it("sin el secreto del cron → 401", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(new Request("http://x/api/cron/soporte") as never);
    expect(res.status).toBe(401);
  });
});
