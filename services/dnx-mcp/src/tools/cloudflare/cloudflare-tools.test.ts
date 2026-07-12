import { describe, expect, it, vi } from "vitest";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { handleCloudflareStatus } from "./cloudflare-status.js";
import { handleR2BucketCreate } from "./r2-bucket-create.js";
import { handleR2PrepareStagingBucket } from "./r2-prepare-staging-bucket.js";
import { handleR2PrepareApplication } from "./r2-prepare-application.js";
import { ToolConfirmationRequiredError } from "../shared/guards.js";

function createMockProvider(overrides: Partial<CloudflareProvider> = {}): {
  provider: CloudflareProvider;
  verifyToken: ReturnType<typeof vi.fn>;
  createBucket: ReturnType<typeof vi.fn>;
  prepareStagingBucket: ReturnType<typeof vi.fn>;
} {
  const verifyToken = vi.fn().mockResolvedValue({ id: "t1", status: "active" });
  const createBucket = vi.fn().mockResolvedValue({
    dryRun: false,
    created: true,
    bucket: { name: "x-staging" },
    wouldCreate: false,
  });
  const prepareStagingBucket = vi.fn().mockResolvedValue({
    status: "ACTION_REQUIRED",
    platformId: "compramelafoto",
    bucketName: "compramelafoto-staging",
    dryRun: true,
    confirm: false,
    exists: false,
    created: false,
    wouldCreate: true,
    corsReady: null,
    publicDomainReady: null,
    blockers: [],
    warnings: ["dryRun=true — no se creará el bucket"],
    actions: ['Crear bucket "compramelafoto-staging"'],
    recommendation: "Acción requerida",
  });

  const provider = {
    name: "cloudflare",
    isConfigured: () => true,
    hasObjectCredentials: () => false,
    verifyToken,
    getAccount: vi.fn().mockResolvedValue({ id: "a1", name: "DNX" }),
    getAccountHealth: vi.fn().mockResolvedValue({
      configured: true,
      tokenActive: true,
      accountAccessible: true,
      accountId: "a1",
      accountName: "DNX",
      riskLevel: "low",
      blockers: [],
      warnings: [],
    }),
    listBuckets: vi.fn().mockResolvedValue([{ name: "compramelafoto-staging" }]),
    createBucket,
    prepareStagingBucket,
    ...overrides,
  } as unknown as CloudflareProvider;

  return { provider, verifyToken, createBucket, prepareStagingBucket };
}

describe("cloudflare MCP tools", () => {
  it("cloudflare_status dryRun no llama API", async () => {
    const { provider, verifyToken } = createMockProvider();
    const result = await handleCloudflareStatus(provider, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("r2_bucket_create dryRun no ejecuta", async () => {
    const { provider, createBucket } = createMockProvider();
    const result = await handleR2BucketCreate(provider, {
      bucket: "demo-staging",
      dryRun: true,
      confirm: false,
    });
    expect(result).toMatchObject({ dryRun: true, wouldCreate: true });
    expect(createBucket).not.toHaveBeenCalled();
  });

  it("r2_bucket_create sin confirm lanza error", async () => {
    const { provider } = createMockProvider();
    await expect(
      handleR2BucketCreate(provider, {
        bucket: "demo-staging",
        dryRun: false,
        confirm: false,
      }),
    ).rejects.toBeInstanceOf(ToolConfirmationRequiredError);
  });

  it("r2_prepare_staging_bucket dryRun no crea", async () => {
    const { provider } = createMockProvider();
    const result = await handleR2PrepareStagingBucket(provider, {
      platformId: "compramelafoto",
      bucketName: "compramelafoto-staging",
      dryRun: true,
      confirm: false,
    });
    expect(result.created).toBe(false);
    expect(result.dryRun).toBe(true);
  });

  it("r2_prepare_application dryRun delega al provider", async () => {
    const prepareApplication = vi.fn().mockResolvedValue({
      status: "ACTION_REQUIRED",
      platformId: "compramelafoto",
      bucketName: "compramelafoto-staging",
      dryRun: true,
      confirm: false,
      loadEnvToVercelPreview: false,
      bucketExists: true,
      endpoint: "https://acct.r2.cloudflarestorage.com",
      endpointValid: true,
      credentials: {
        source: "missing",
        accessKeyIdPresent: false,
        accessKeyIdFingerprint: null,
        secretFingerprint: null,
        created: false,
        createAttempted: false,
        createError: null,
      },
      envVars: null,
      envVarKeys: [],
      vercelPreview: {
        project: "compramelafoto-dnxsuite",
        configured: true,
        missingKeys: ["R2_BUCKET"],
        presentKeys: [],
        loadOffered: true,
        loadedKeys: [],
        loadSkippedReason: "load_not_requested",
      },
      smokeTest: {
        key: "smoke/x.txt",
        uploadOk: null,
        downloadOk: null,
        cleanedUp: false,
        error: null,
      },
      blockers: [],
      warnings: [],
      actions: [],
      recommendation: "Ejecutar con dryRun:false",
    });
    const { provider } = createMockProvider({ prepareApplication });
    const result = await handleR2PrepareApplication(provider, {
      platformId: "compramelafoto",
      dryRun: true,
      confirm: false,
      loadEnvToVercelPreview: false,
    });
    expect(result.status).toBe("ACTION_REQUIRED");
    expect(result.dryRun).toBe(true);
    expect(prepareApplication).toHaveBeenCalledWith({
      platformId: "compramelafoto",
      dryRun: true,
      confirm: false,
      loadEnvToVercelPreview: false,
    });
  });
});
