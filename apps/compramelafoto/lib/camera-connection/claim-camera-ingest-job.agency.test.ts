import { describe, expect, it, vi } from "vitest";
import { claimNextCameraIngestJob } from "./claim-camera-ingest-job";

describe("claimNextCameraIngestJob", () => {
  it("sólo toma trabajos PENDING (un AWAITING_FILTER nunca se procesa sin la señal)", async () => {
    const queryRaw = vi.fn(async () => []);
    await claimNextCameraIngestJob({ $queryRaw: queryRaw } as any);
    const sql = (queryRaw.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?");
    expect(sql).toContain("WHERE status = 'PENDING'");
    expect(sql).not.toContain("AWAITING_FILTER");
  });
});
