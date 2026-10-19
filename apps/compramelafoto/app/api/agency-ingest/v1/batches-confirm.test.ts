import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const target = vi.fn();
const ensureMp = vi.fn();
const requestUploads = vi.fn();
const resolvePoint = vi.fn();
const confirm = vi.fn();
vi.mock("@/lib/agencies/flux-keys", () => ({ authenticateAgencyDevice: (...a: unknown[]) => authenticate(...a) }));
vi.mock("@/lib/agencies/upload-target", () => ({ checkAgencyUploadTarget: (...a: unknown[]) => target(...a) }));
vi.mock("@/app/api/dashboard/albums/[id]/photos/upload-helpers", () => ({ ensureMpConnected: (...a: unknown[]) => ensureMp(...a) }));
vi.mock("@/lib/agencies/flux-uploads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agencies/flux-uploads")>()),
  requestFluxUploads: (...a: unknown[]) => requestUploads(...a),
  resolveFluxPoint: (...a: unknown[]) => resolvePoint(...a),
  confirmFluxUpload: (...a: unknown[]) => confirm(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-client", () => ({}));

import { POST as BATCHES } from "./batches/route";

let keyN = 0;
const AUTH = () => ({ authorization: `Bearer clf_dev_${++keyN}` });
const batchReq = (body: unknown, headers: Record<string, string> = AUTH()) =>
  new Request("https://x/api/agency-ingest/v1/batches", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const okBody = { agencyId: 3, albumId: 50, placeId: 1, files: [{ name: "DSC_1.JPG", size: 100, contentType: "image/jpeg" }] };

beforeEach(() => {
  for (const f of [authenticate, target, ensureMp, requestUploads, resolvePoint, confirm]) f.mockReset();
  authenticate.mockImplementation(async () => ({ deviceKeyId: ++keyN + 1000, userId: 20, role: "PHOTOGRAPHER" }));
  target.mockResolvedValue({ ok: true });
  ensureMp.mockResolvedValue({ ok: true, error: null });
  resolvePoint.mockResolvedValue({ ok: true, point: { lat: -38, lng: -57.5 } });
  requestUploads.mockResolvedValue([{ alreadyThere: true }]);
});

describe("POST batches", () => {
  it("sin llave: 401", async () => {
    authenticate.mockResolvedValue(null);
    expect((await BATCHES(batchReq(okBody, {}))).status).toBe(401);
  });
  it("datos mal (agencia, álbum o archivos): 400 sin tocar nada", async () => {
    expect((await BATCHES(batchReq({ ...okBody, albumId: "x" }))).status).toBe(400);
    expect((await BATCHES(batchReq({ ...okBody, files: [{ name: "a.png", size: 1, contentType: "image/png" }] }))).status).toBe(400);
    expect(requestUploads).not.toHaveBeenCalled();
  });
  it("lo dieron de baja o el álbum no es de esa agencia: 403 con el motivo", async () => {
    target.mockResolvedValue({ ok: false, message: "Ya no podés subir a ese álbum de la agencia." });
    const res = await BATCHES(batchReq(okBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Ya no podés subir a ese álbum de la agencia.");
    expect(target).toHaveBeenCalledWith(3, 50, 20);
    expect(requestUploads).not.toHaveBeenCalled();
  });
  it("sin Mercado Pago conectado: 403", async () => {
    ensureMp.mockResolvedValue({ ok: false, error: "Debés conectar Mercado Pago para subir fotos." });
    expect((await BATCHES(batchReq(okBody))).status).toBe(403);
    expect(requestUploads).not.toHaveBeenCalled();
  });
  it("punto inválido: 400", async () => {
    resolvePoint.mockResolvedValue({ ok: false, error: "Ese lugar no es de la agencia." });
    expect((await BATCHES(batchReq(okBody))).status).toBe(400);
  });
  it("válido: 200 con un ítem por archivo", async () => {
    const res = await BATCHES(batchReq(okBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ files: [{ alreadyThere: true }] });
    expect(requestUploads.mock.calls[0][1]).toEqual({ agencyId: 3, albumId: 50 });
    expect(requestUploads.mock.calls[0][3]).toEqual({ lat: -38, lng: -57.5 });
  });
});
