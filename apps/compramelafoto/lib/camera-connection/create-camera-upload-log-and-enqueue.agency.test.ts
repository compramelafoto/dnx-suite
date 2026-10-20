import { beforeEach, describe, expect, it, vi } from "vitest";

const jobCreate = vi.fn();
vi.mock("@/lib/prisma", () => {
  const tx = {
    cameraIngestJob: { findUnique: async () => null, create: (...a: unknown[]) => jobCreate(...a) },
    cameraUploadLog: { create: async () => ({ id: 1 }) },
  };
  return {
    prisma: {
      cameraIngestJob: { findUnique: async () => null },
      cameraUploadLog: { create: async () => ({ id: 1 }) },
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    },
  };
});

import { createCameraUploadLogAndEnqueue } from "./create-camera-upload-log-and-enqueue";

const input = { userId: 20, albumId: 50, rawKey: "albums/50/raw/k.jpg", filename: "DSC_1.JPG", filesizeBytes: 100 };

beforeEach(() => {
  jobCreate.mockReset();
  jobCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "j", ...data }));
});

describe("createCameraUploadLogAndEnqueue y la espera del filtro", () => {
  it("sin awaitFilter (FTP de siempre): PENDING", async () => {
    await createCameraUploadLogAndEnqueue(input);
    expect(jobCreate.mock.calls[0][0].data.status).toBe("PENDING");
  });
  it("agencia que espera al filtro: AWAITING_FILTER", async () => {
    await createCameraUploadLogAndEnqueue({ ...input, awaitFilter: true });
    expect(jobCreate.mock.calls[0][0].data.status).toBe("AWAITING_FILTER");
  });
});
