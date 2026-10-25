import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const redeem = vi.fn();
const userFindUnique = vi.fn();
const memberFindMany = vi.fn();
const ensureMp = vi.fn();
vi.mock("@/lib/agencies/flux-keys", () => ({
  authenticateAgencyDevice: (...a: unknown[]) => authenticate(...a),
  redeemLinkCode: (...a: unknown[]) => redeem(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    agencyMember: { findMany: (...a: unknown[]) => memberFindMany(...a) },
  },
}));
vi.mock("@/app/api/dashboard/albums/[id]/photos/upload-helpers", () => ({ ensureMpConnected: (...a: unknown[]) => ensureMp(...a) }));

import { POST as LINK } from "./link/route";
import { GET as ME } from "./me/route";

let ipCounter = 0;
const linkReq = (body: unknown, ip = `10.0.0.${++ipCounter}`) =>
  new Request("https://x/api/agency-ingest/v1/link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const meReq = (auth?: string) => new Request("https://x/api/agency-ingest/v1/me", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  for (const f of [authenticate, redeem, userFindUnique, memberFindMany, ensureMp]) f.mockReset();
  ensureMp.mockResolvedValue({ ok: true, error: null });
});

describe("POST link", () => {
  it("cuerpo que no es JSON: 400", async () => {
    expect((await LINK(linkReq("no-json"))).status).toBe(400);
  });
  it("canje válido: 201 con la llave y sin caché", async () => {
    redeem.mockResolvedValue({ ok: true, key: "clf_dev_x", deviceKeyId: 3, userId: 20 });
    const res = await LINK(linkReq({ code: "K7QM-4PXT", deviceName: "Notebook" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ deviceKey: "clf_dev_x" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(redeem).toHaveBeenCalledWith("K7QM-4PXT", "Notebook");
  });
  it("código inválido o tope de computadoras: pasa el estado y el mensaje", async () => {
    redeem.mockResolvedValue({ ok: false, status: 409, error: "Ya tenés 10 computadoras" });
    const res = await LINK(linkReq({ code: "K7QM-4PXT" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Ya tenés 10 computadoras");
  });
  it("el pedido 11 del mismo minuto desde la misma IP: 429", async () => {
    redeem.mockResolvedValue({ ok: false, status: 400, error: "x" });
    for (let i = 0; i < 10; i += 1) expect((await LINK(linkReq({ code: "AAAAAAAA" }, "10.9.9.9"))).status).toBe(400);
    const res = await LINK(linkReq({ code: "AAAAAAAA" }, "10.9.9.9"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

describe("GET me", () => {
  it("sin llave o llave inválida: 401 con WWW-Authenticate", async () => {
    authenticate.mockResolvedValue(null);
    const res = await ME(meReq());
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
  });
  it("devuelve sólo agencias activas con álbumes y lugares, sin datos de clientes", async () => {
    authenticate.mockResolvedValue({ deviceKeyId: 3, userId: 20, role: "PHOTOGRAPHER" });
    userFindUnique.mockResolvedValue({ name: "Juan" });
    memberFindMany.mockResolvedValue([
      {
        status: "ACTIVE",
        termsVersionAccepted: 1,
        agency: {
          id: 3, name: "Fotoshow", logoUrl: null, termsVersion: 1,
          albums: [{ albumId: 50, album: { title: "Temporada 2027" } }],
          places: [{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }],
        },
      },
      {
        status: "ACTIVE",
        termsVersionAccepted: 1,
        agency: { id: 4, name: "Otra", logoUrl: null, termsVersion: 2, albums: [], places: [] },
      },
    ]);
    const res = await ME(meReq("Bearer clf_dev_x"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { name: "Juan" },
      mpConnected: true,
      agencies: [
        {
          agencyId: 3, name: "Fotoshow", logoUrl: null, canUpload: true, needsTerms: false,
          albums: [{ albumId: 50, title: "Temporada 2027" }],
          places: [{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }],
        },
        { agencyId: 4, name: "Otra", logoUrl: null, canUpload: false, needsTerms: true, albums: [], places: [] },
      ],
    });
    expect(memberFindMany.mock.calls[0][0].where).toEqual({ userId: 20, status: "ACTIVE" });
    expect(ensureMp).toHaveBeenCalledWith({ id: 20, role: "PHOTOGRAPHER" });
  });
});
