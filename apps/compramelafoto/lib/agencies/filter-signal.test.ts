import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const jobUpdateMany = vi.fn();
const jobFindFirst = vi.fn();
const logUpdate = vi.fn();
const deleteR2 = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cameraIngestJob: { updateMany: (...a: unknown[]) => jobUpdateMany(...a), findFirst: (...a: unknown[]) => jobFindFirst(...a) },
    cameraUploadLog: { update: (...a: unknown[]) => logUpdate(...a) },
  },
}));
vi.mock("@/lib/r2-client", () => ({ deleteFromR2: (...a: unknown[]) => deleteR2(...a) }));

import { applyFilterDecisions, parseFilterDecisions, signFilterBody, verifyFilterSignature } from "./filter-signal";

const SECRET = "secreto-de-prueba";
const BODY = '{"decisions":[]}';
const T = 1_800_000_000;

beforeEach(() => {
  for (const f of [jobUpdateMany, jobFindFirst, logUpdate, deleteR2]) f.mockReset();
  jobUpdateMany.mockResolvedValue({ count: 1 });
  logUpdate.mockResolvedValue({});
  deleteR2.mockResolvedValue(undefined);
});

describe("firma", () => {
  it("formato t=…,v1=HMAC-SHA256(secreto, 't.cuerpo')", () => {
    const v1 = createHmac("sha256", SECRET).update(`${T}.${BODY}`).digest("hex");
    expect(signFilterBody(SECRET, T, BODY)).toBe(`t=${T},v1=${v1}`);
  });
  it("válida dentro de 5 minutos; vieja, adulterada, sin secreto o sin encabezado: no", () => {
    const h = signFilterBody(SECRET, T, BODY);
    expect(verifyFilterSignature(SECRET, h, BODY, (T + 299) * 1000)).toBe(true);
    expect(verifyFilterSignature(SECRET, h, BODY, (T + 301) * 1000)).toBe(false);
    expect(verifyFilterSignature(SECRET, h, '{"decisions":[1]}', T * 1000)).toBe(false);
    expect(verifyFilterSignature(undefined, h, BODY, T * 1000)).toBe(false);
    expect(verifyFilterSignature("", h, BODY, T * 1000)).toBe(false);
    expect(verifyFilterSignature(SECRET, null, BODY, T * 1000)).toBe(false);
    expect(verifyFilterSignature(SECRET, "t=abc,v1=zz", BODY, T * 1000)).toBe(false);
  });
});

describe("parseFilterDecisions", () => {
  it("acepta hasta 100 decisiones válidas", () => {
    expect(parseFilterDecisions([{ jobId: "cj1", decision: "APPROVED" }])).toEqual({ ok: true, decisions: [{ jobId: "cj1", decision: "APPROVED" }] });
    expect(parseFilterDecisions([])).toMatchObject({ ok: false });
    expect(parseFilterDecisions([{ jobId: "cj1", decision: "MAYBE" }])).toMatchObject({ ok: false });
    expect(parseFilterDecisions([{ jobId: "", decision: "APPROVED" }])).toMatchObject({ ok: false });
    expect(parseFilterDecisions(Array.from({ length: 101 }, () => ({ jobId: "a", decision: "APPROVED" })))).toMatchObject({ ok: false });
  });
});

describe("applyFilterDecisions", () => {
  it("aprobada: sólo si estaba esperando, vuelve a PENDING para que el cron la procese", async () => {
    expect(await applyFilterDecisions([{ jobId: "cj1", decision: "APPROVED" }])).toEqual([{ jobId: "cj1", result: "approved" }]);
    expect(jobUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "cj1", status: "AWAITING_FILTER" },
      data: { status: "PENDING", runAfter: null, lastError: null },
    });
  });
  it("rechazada: cierra el job con la nota, borra el raw y marca el log de FTP", async () => {
    jobFindFirst.mockResolvedValue({ id: "cj2", rawKey: "albums/50/raw/k", uploadLogId: 7 });
    expect(await applyFilterDecisions([{ jobId: "cj2", decision: "REJECTED" }])).toEqual([{ jobId: "cj2", result: "rejected" }]);
    expect(jobUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "cj2", status: "AWAITING_FILTER" },
      data: { status: "COMPLETED", completedAt: expect.any(Date), lastError: "Descartada por el filtro", lockedAt: null, runAfter: null },
    });
    expect(deleteR2).toHaveBeenCalledWith("albums/50/raw/k");
    expect(logUpdate).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: "REJECTED", errorMessage: "Descartada por el filtro" } });
  });
  it("una decisión sobre un job que no está esperando (repetida o tardía): not_waiting y no se borra nada", async () => {
    jobUpdateMany.mockResolvedValue({ count: 0 });
    jobFindFirst.mockResolvedValue(null);
    expect(await applyFilterDecisions([{ jobId: "cj3", decision: "APPROVED" }, { jobId: "cj4", decision: "REJECTED" }])).toEqual([
      { jobId: "cj3", result: "not_waiting" },
      { jobId: "cj4", result: "not_waiting" },
    ]);
    expect(deleteR2).not.toHaveBeenCalled();
  });
});
