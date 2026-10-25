import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apply = vi.fn();
vi.mock("@/lib/agencies/filter-signal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agencies/filter-signal")>()),
  applyFilterDecisions: (...a: unknown[]) => apply(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-client", () => ({}));

import { POST } from "./route";
import { signFilterBody } from "@/lib/agencies/filter-signal";

const body = JSON.stringify({ decisions: [{ jobId: "cj1", decision: "APPROVED" }] });
const req = (headers: Record<string, string>, b = body) =>
  new Request("https://x/api/internal/agency-filter/decisions", { method: "POST", headers, body: b });

beforeEach(() => {
  apply.mockReset();
  apply.mockResolvedValue([{ jobId: "cj1", result: "approved" }]);
  process.env.AGENCY_FILTER_SIGNAL_SECRET = "s3";
});
afterEach(() => {
  delete process.env.AGENCY_FILTER_SIGNAL_SECRET;
});

describe("POST decisiones del filtro", () => {
  it("sin firma o con firma mala: 401 sin tocar nada", async () => {
    expect((await POST(req({}))).status).toBe(401);
    expect((await POST(req({ "x-dnx-firma": "t=1,v1=00" }))).status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });
  it("sin secreto configurado: 401 aunque firmen", async () => {
    delete process.env.AGENCY_FILTER_SIGNAL_SECRET;
    const t = Math.floor(Date.now() / 1000);
    expect((await POST(req({ "x-dnx-firma": signFilterBody("s3", t, body) }))).status).toBe(401);
  });
  it("firmado: aplica y devuelve los resultados", async () => {
    const t = Math.floor(Date.now() / 1000);
    const res = await POST(req({ "x-dnx-firma": signFilterBody("s3", t, body) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ jobId: "cj1", result: "approved" }] });
  });
  it("firmado pero con decisiones inválidas: 400", async () => {
    const bad = JSON.stringify({ decisions: [{ jobId: "cj1", decision: "TAL_VEZ" }] });
    const t = Math.floor(Date.now() / 1000);
    expect((await POST(req({ "x-dnx-firma": signFilterBody("s3", t, bad) }, bad))).status).toBe(400);
  });
});
