import { describe, expect, it, vi } from "vitest";
import { preflightBucket } from "./preflight";

describe("preflightBucket", () => {
  it("true si hay acceso", async () => {
    const err = vi.fn();
    expect(await preflightBucket({ verificarAcceso: async () => {} }, "b", err)).toBe(true);
    expect(err).not.toHaveBeenCalled();
  });
  it("false y mensaje claro si no hay acceso", async () => {
    const err = vi.fn();
    const r = await preflightBucket({ verificarAcceso: async () => { throw new Error("AccessDenied"); } }, "mi-bucket", err);
    expect(r).toBe(false);
    expect(err.mock.calls[0][0]).toContain("R2 sin acceso al bucket mi-bucket: AccessDenied");
  });
});
