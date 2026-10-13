import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { botIncident: { findMany: (...a: unknown[]) => m.findMany(...a), updateMany: (...a: unknown[]) => m.updateMany(...a) } },
}));
import { GET, PATCH } from "./route";

const auth = (s = "secreto") => ({ authorization: `Bearer ${s}` });
const patch = (body: unknown, headers: Record<string, string> = auth()) =>
  new Request("http://x/api/internal/bot/incidentes", { method: "PATCH", headers, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLF_BOT_INCIDENTS_SECRET = "secreto";
  m.findMany.mockResolvedValue([{ id: "i1" }]);
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("/api/internal/bot/incidentes", () => {
  it("sin header o con secreto equivocado -> 401", async () => {
    expect((await GET(new Request("http://x"))).status).toBe(401);
    expect((await GET(new Request("http://x", { headers: auth("otro") }))).status).toBe(401);
    expect((await PATCH(patch({ id: "i1", status: "FIXED" }, auth("otro")))).status).toBe(401);
    expect(m.findMany).not.toHaveBeenCalled();
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("secreto vacío en el entorno -> siempre 401", async () => {
    process.env.CLF_BOT_INCIDENTS_SECRET = "";
    expect((await GET(new Request("http://x", { headers: { authorization: "Bearer " } }))).status).toBe(401);
    expect((await GET(new Request("http://x"))).status).toBe(401);
  });

  it("GET lista sólo CLF abiertos o en investigación", async () => {
    const res = await GET(new Request("http://x", { headers: auth() }));
    expect(res.status).toBe(200);
    expect(m.findMany.mock.calls[0]![0].where).toEqual({ platform: "CLF", status: { in: ["OPEN", "INVESTIGATING"] } });
  });

  it("PATCH con estado inválido -> 400", async () => {
    expect((await PATCH(patch({ id: "i1", status: "BORRADO" }))).status).toBe(400);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("PATCH con prUrl que no es de GitHub -> 400", async () => {
    expect((await PATCH(patch({ id: "i1", status: "FIXED", prUrl: "https://evil.com/x" }))).status).toBe(400);
  });

  it("PATCH válido actualiza dentro de CLF", async () => {
    const res = await PATCH(patch({ id: "i1", status: "FIXED", prUrl: "https://github.com/a/b/pull/1" }));
    expect(res.status).toBe(200);
    expect(m.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: "i1", platform: "CLF" },
      data: { status: "FIXED", prUrl: "https://github.com/a/b/pull/1" },
    });
  });
});
