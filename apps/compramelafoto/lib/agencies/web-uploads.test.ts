import { beforeEach, describe, expect, it, vi } from "vitest";

const agencyFindUnique = vi.fn();
const userFindUnique = vi.fn();
const placeFindFirst = vi.fn();
const jobUpdateMany = vi.fn();
const jobFindUnique = vi.fn();
const target = vi.fn();
const membership = vi.fn();
const ensureMp = vi.fn();
const enqueue = vi.fn();
const awaitsFilterMock = vi.fn();
const processJob = vi.fn();
const signPut = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agency: { findUnique: (...a: unknown[]) => agencyFindUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    agencyPlace: { findFirst: (...a: unknown[]) => placeFindFirst(...a) },
    cameraIngestJob: {
      updateMany: (...a: unknown[]) => jobUpdateMany(...a),
      findUnique: (...a: unknown[]) => jobFindUnique(...a),
    },
  },
}));
vi.mock("@/lib/r2-client", () => ({
  generateR2Key: (name: string, prefix: string) => `${prefix}/uuid-${name}`,
  getSignedPutUrl: (...a: unknown[]) => signPut(...a),
  deleteFromR2: vi.fn(),
}));
vi.mock("@/lib/agencies/upload-target", () => ({ checkAgencyUploadTarget: (...a: unknown[]) => target(...a) }));
vi.mock("@/lib/agencies/queries", () => ({ findMembership: (...a: unknown[]) => membership(...a) }));
vi.mock("@/app/api/dashboard/albums/[id]/photos/upload-helpers", () => ({ ensureMpConnected: (...a: unknown[]) => ensureMp(...a) }));
vi.mock("@/lib/albums/enqueue-album-photo-ingest", () => ({ enqueueAlbumPhotoIngest: (...a: unknown[]) => enqueue(...a) }));
vi.mock("@/lib/agencies/publish-mode", () => ({ agencyAwaitsFilter: (...a: unknown[]) => awaitsFilterMock(...a) }));
vi.mock("@/lib/camera-connection/process-camera-ingest-job", () => ({
  processClaimedCameraIngestJob: (...a: unknown[]) => processJob(...a),
}));

import {
  AUTHOR_NOT_IN_AGENCY,
  ONLY_OWNER_PICKS_AUTHOR,
  authorizeAgencyWebUpload,
  completeAgencyWebUpload,
  startAgencyWebUpload,
} from "./web-uploads";

const OWNER = { id: 10, role: "PHOTOGRAPHER" } as const;
const MEMBER = { id: 20, role: "PHOTOGRAPHER" } as const;
const OUTSIDER = { id: 99, role: "PHOTOGRAPHER" } as const;
const base = { agencyId: 3, albumId: 50 };
const KEY = "albums/50/raw/uuid-a.jpg";

function job(over: Record<string, unknown> = {}) {
  return {
    id: "job1", userId: 20, albumId: 50, rawKey: KEY, status: "PENDING", attempts: 0, uploadLogId: null,
    eventFolderId: null, folderId: null, originalFilename: "a.jpg", declaredLat: null, declaredLng: null, ...over,
  };
}

beforeEach(() => {
  for (const f of [agencyFindUnique, userFindUnique, placeFindFirst, jobUpdateMany, jobFindUnique, target, membership, ensureMp, enqueue, awaitsFilterMock, processJob, signPut]) f.mockReset();
  agencyFindUnique.mockResolvedValue({ ownerUserId: OWNER.id, termsVersion: 2 });
  // Por defecto: quien sube puede (dueño o miembro al día); los rechazos se prueban aparte.
  target.mockResolvedValue({ ok: true });
  membership.mockResolvedValue({ id: 1, status: "ACTIVE", termsVersionAccepted: 2, commissionBps: null });
  userFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({ id: where.id, role: "PHOTOGRAPHER", name: `Fot ${where.id}`, email: "x@y" }));
  ensureMp.mockResolvedValue({ ok: true, error: null });
  awaitsFilterMock.mockResolvedValue(false);
  enqueue.mockImplementation(async (input: { userId: number }) => ({ job: job({ userId: input.userId }), created: true }));
  jobUpdateMany.mockResolvedValue({ count: 1 });
  processJob.mockResolvedValue({ ok: true, photoId: 700 });
  jobFindUnique.mockResolvedValue({ status: "COMPLETED", photoId: 700, lastError: null });
  signPut.mockImplementation(async (key: string) => `https://r2/${key}?firma`);
});

describe("authorizeAgencyWebUpload: miembro desde su usuario", () => {
  it("el miembro activo sube y queda como autor", async () => {
    const r = await authorizeAgencyWebUpload(MEMBER, { ...base });
    expect(r).toEqual({ ok: true, agencyId: 3, albumId: 50, authorUserId: 20, byOwner: false });
    expect(target).toHaveBeenCalledWith(3, 50, 20);
  });

  it("el miembro puede mandarse a sí mismo como autor", async () => {
    const r = await authorizeAgencyWebUpload(MEMBER, { ...base, authorUserId: 20 });
    expect(r).toMatchObject({ ok: true, authorUserId: 20 });
  });

  it("el miembro no puede atribuir fotos a otro", async () => {
    const r = await authorizeAgencyWebUpload(MEMBER, { ...base, authorUserId: 21 });
    expect(r).toEqual({ ok: false, status: 403, error: ONLY_OWNER_PICKS_AUTHOR });
    expect(target).not.toHaveBeenCalled();
  });

  it("rechaza a quien no es miembro", async () => {
    target.mockResolvedValue({ ok: false, message: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
    const r = await authorizeAgencyWebUpload(OUTSIDER, { ...base });
    expect(r).toMatchObject({ ok: false, status: 403, error: expect.stringMatching(/sólo su equipo/) });
  });

  it("rechaza a un miembro dado de baja", async () => {
    target.mockResolvedValue({ ok: false, message: "Ya no podés subir a ese álbum de la agencia." });
    const r = await authorizeAgencyWebUpload(MEMBER, { ...base });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("sin Mercado Pago conectado no sube", async () => {
    ensureMp.mockResolvedValue({ ok: false, error: "Debés conectar Mercado Pago para subir fotos." });
    const r = await authorizeAgencyWebUpload(MEMBER, { ...base });
    expect(r).toMatchObject({ ok: false, status: 403, error: expect.stringMatching(/Mercado Pago/) });
  });

  it("pide agencia y álbum válidos; agencia inexistente es 404", async () => {
    expect(await authorizeAgencyWebUpload(MEMBER, { agencyId: "x", albumId: 50 })).toMatchObject({ ok: false, status: 400 });
    agencyFindUnique.mockResolvedValue(null);
    expect(await authorizeAgencyWebUpload(MEMBER, { ...base })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("authorizeAgencyWebUpload: dueño indicando el autor", () => {
  it("sin elegir autor, las fotos quedan del dueño (100 % agencia)", async () => {
    const r = await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: "" });
    expect(r).toEqual({ ok: true, agencyId: 3, albumId: 50, authorUserId: 10, byOwner: true });
    expect(membership).not.toHaveBeenCalled();
  });

  it("atribuye a un miembro activo de su agencia", async () => {
    const r = await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: "20" });
    expect(r).toMatchObject({ ok: true, authorUserId: 20, byOwner: true });
    expect(membership).toHaveBeenCalledWith(3, 20);
    expect(ensureMp).toHaveBeenCalledWith({ id: 20, role: "PHOTOGRAPHER" });
  });

  it("no puede atribuir a alguien de fuera de la agencia", async () => {
    membership.mockResolvedValue(null);
    const r = await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: 99 });
    expect(r).toEqual({ ok: false, status: 403, error: AUTHOR_NOT_IN_AGENCY });
  });

  it("no puede atribuir a un miembro dado de baja ni a una solicitud pendiente", async () => {
    membership.mockResolvedValue({ id: 1, status: "REMOVED", termsVersionAccepted: 2, commissionBps: null });
    expect(await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: 20 })).toEqual({ ok: false, status: 403, error: AUTHOR_NOT_IN_AGENCY });
    membership.mockResolvedValue({ id: 1, status: "REQUESTED", termsVersionAccepted: null, commissionBps: null });
    expect(await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: 20 })).toEqual({ ok: false, status: 403, error: AUTHOR_NOT_IN_AGENCY });
  });

  it("no puede atribuir a un miembro con condiciones sin aceptar ni sin Mercado Pago", async () => {
    membership.mockResolvedValue({ id: 1, status: "ACTIVE", termsVersionAccepted: 1, commissionBps: null });
    expect(await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: 20 })).toMatchObject({ ok: false, error: expect.stringMatching(/condiciones/) });
    membership.mockResolvedValue({ id: 1, status: "ACTIVE", termsVersionAccepted: 2, commissionBps: null });
    ensureMp.mockImplementation(async (u: { id: number }) => (u.id === 20 ? { ok: false, error: "x" } : { ok: true, error: null }));
    expect(await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: 20 })).toMatchObject({ ok: false, error: expect.stringMatching(/Mercado Pago/) });
  });

  it("el álbum tiene que ser de esa agencia", async () => {
    target.mockResolvedValue({ ok: false, message: "Ya no podés subir a ese álbum de la agencia." });
    const r = await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: 20 });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(membership).not.toHaveBeenCalled();
  });

  it("autor inválido es 400", async () => {
    expect(await authorizeAgencyWebUpload(OWNER, { ...base, authorUserId: "abc" })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("startAgencyWebUpload", () => {
  it("firma un PUT directo a R2 bajo el álbum, sólo JPG", async () => {
    const r = await startAgencyWebUpload(MEMBER, { ...base, name: "a.jpg", contentType: "image/jpeg", size: 1000 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ key: KEY, uploadUrl: `https://r2/${KEY}?firma` });
    expect(signPut).toHaveBeenCalledWith(KEY, "image/jpeg", 900, 1000);
    const png = await startAgencyWebUpload(MEMBER, { ...base, name: "a.png", contentType: "image/png", size: 1000 });
    expect(png.status).toBe(400);
  });

  it("no firma nada si no está autorizado", async () => {
    target.mockResolvedValue({ ok: false, message: "no" });
    const r = await startAgencyWebUpload(OUTSIDER, { ...base, name: "a.jpg", contentType: "image/jpeg", size: 1000 });
    expect(r.status).toBe(403);
    expect(signPut).not.toHaveBeenCalled();
  });
});

describe("completeAgencyWebUpload", () => {
  it("miembro: encola en la fila común con su autoría y la publica al instante", async () => {
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: KEY, originalName: "a.jpg", lat: -38, lng: -57.5 });
    expect(enqueue).toHaveBeenCalledWith({
      userId: 20, albumId: 50, rawKey: KEY, originalFilename: "a.jpg", source: "WEB_UPLOAD",
      declaredPoint: { lat: -38, lng: -57.5 }, awaitFilter: false,
    });
    expect(jobUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job1", status: "PENDING" } }));
    expect(processJob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "job1", userId: 20, attempts: 1 }));
    expect(r).toEqual({ status: 200, body: { ok: true, state: "PUBLISHED", jobId: "job1", photoId: 700, authorUserId: 20 } });
  });

  it("dueño con autor elegido: la foto queda del miembro", async () => {
    const r = await completeAgencyWebUpload(OWNER, { ...base, key: KEY, authorUserId: 20 });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ userId: 20 }));
    expect(r.body).toMatchObject({ authorUserId: 20, state: "PUBLISHED" });
  });

  it("dueño sin autor: la foto queda del dueño", async () => {
    const r = await completeAgencyWebUpload(OWNER, { ...base, key: KEY });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ userId: 10 }));
    expect(r.body).toMatchObject({ authorUserId: 10 });
  });

  it("dueño no puede completar atribuyendo a alguien de fuera", async () => {
    membership.mockResolvedValue(null);
    const r = await completeAgencyWebUpload(OWNER, { ...base, key: KEY, authorUserId: 99 });
    expect(r.status).toBe(403);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("con publishMode AWAIT_FILTER queda esperando al filtro y no se procesa", async () => {
    awaitsFilterMock.mockResolvedValue(true);
    enqueue.mockResolvedValue({ job: job({ status: "AWAITING_FILTER" }), created: true });
    jobFindUnique.mockResolvedValue({ status: "AWAITING_FILTER", photoId: null, lastError: null });
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: KEY });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ awaitFilter: true }));
    expect(processJob).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ state: "AWAITING_FILTER" });
  });

  it("usa el punto de un lugar de la agencia", async () => {
    placeFindFirst.mockResolvedValue({ lat: -38.1, lng: -57.6 });
    await completeAgencyWebUpload(MEMBER, { ...base, key: KEY, placeId: 7 });
    expect(placeFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, agencyId: 3 } }));
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ declaredPoint: { lat: -38.1, lng: -57.6 } }));
  });

  it("repetida: se informa como tal", async () => {
    jobFindUnique.mockResolvedValue({ status: "COMPLETED", photoId: null, lastError: "Repetida" });
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: KEY });
    expect(r.body).toMatchObject({ state: "DUPLICATE" });
  });

  it("si otro ya tomó el trabajo, no lo procesa dos veces y queda en cola", async () => {
    jobUpdateMany.mockResolvedValue({ count: 0 });
    jobFindUnique.mockResolvedValue({ status: "PROCESSING", photoId: null, lastError: null });
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: KEY });
    expect(processJob).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ state: "QUEUED" });
  });

  it("falla definitiva: devuelve el error", async () => {
    jobFindUnique.mockResolvedValue({ status: "FAILED", photoId: null, lastError: "Archivo dañado" });
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: KEY });
    expect(r).toEqual({ status: 422, body: { error: "Archivo dañado" } });
  });

  it("rechaza una clave de otro álbum", async () => {
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: "albums/51/raw/uuid-a.jpg" });
    expect(r.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("no cambia el autor de un trabajo que ya existía con otro", async () => {
    enqueue.mockResolvedValue({ job: job({ userId: 21 }), created: false });
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: KEY });
    expect(r.status).toBe(409);
    expect(processJob).not.toHaveBeenCalled();
  });

  it("foto que todavía no llegó a R2", async () => {
    enqueue.mockRejectedValue(new Error("El archivo aún no está disponible en almacenamiento."));
    const r = await completeAgencyWebUpload(MEMBER, { ...base, key: KEY });
    expect(r.status).toBe(409);
  });
});
