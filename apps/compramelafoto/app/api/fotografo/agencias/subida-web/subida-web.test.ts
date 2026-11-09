import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const start = vi.fn();
const complete = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({ Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" } }));
vi.mock("@/lib/agencies/web-uploads", () => ({
  startAgencyWebUpload: (...a: unknown[]) => start(...a),
  completeAgencyWebUpload: (...a: unknown[]) => complete(...a),
}));

import { POST as initPost } from "./init/route";
import { POST as completePost } from "./complete/route";

const req = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never;

beforeEach(() => {
  for (const f of [requireAuth, start, complete]) f.mockReset();
});

describe("subida web a la agencia (rutas)", () => {
  it("sin sesión es 401 y no hace nada", async () => {
    requireAuth.mockResolvedValue({ error: "No autenticado", user: null });
    expect((await initPost(req({}))).status).toBe(401);
    expect((await completePost(req({}))).status).toBe(401);
    expect(start).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("pasa la sesión (nunca un usuario del cuerpo) y devuelve lo que decide la lógica", async () => {
    requireAuth.mockResolvedValue({ error: null, user: { id: 20, role: "PHOTOGRAPHER" } });
    complete.mockResolvedValue({ status: 403, body: { error: "no" } });
    const res = await completePost(req({ agencyId: 3, albumId: 50, userId: 999 }));
    expect(complete).toHaveBeenCalledWith({ id: 20, role: "PHOTOGRAPHER" }, { agencyId: 3, albumId: 50, userId: 999 });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "no" });
  });
});
