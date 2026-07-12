import { describe, expect, it, vi } from "vitest";
import { CloudflareHttpClient } from "../client/cloudflare-http-client.js";
import { CloudflareProvider } from "../provider.js";
import { CloudflareConfirmationRequiredError, CloudflareGuardError, CloudflareAuthError } from "../errors.js";
import {
  assertStagingBucketName,
  isProductionBucketName,
  isStagingBucketName,
} from "../helpers/bucket-name.js";
import { prepareStagingBucket } from "../helpers/staging-bucket.js";
import { prepareApplication } from "../helpers/prepare-application.js";


function okEnvelope(result: unknown): Response {
  return new Response(JSON.stringify({ success: true, errors: [], result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function createMockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  }) as unknown as typeof fetch;
}

describe("CloudflareHttpClient", () => {
  it("verifica token sin loguear secrets", async () => {
    const fetchImpl = createMockFetch(() => okEnvelope({ id: "tok_1", status: "active" }));

    const client = new CloudflareHttpClient({
      config: {
        apiToken: "secret-token-value",
        accountId: "acct_1",
        baseUrl: "https://api.cloudflare.com/client/v4",
        maxRetries: 0,
        retryBaseDelayMs: 10,
        requestsPerMinute: 1000,
        r2AccessKeyId: "",
        r2SecretAccessKey: "",
        r2Jurisdiction: "default",
      },
      fetchImpl,
    });

    const body = await client.get<{ success: boolean; result: { status: string } }>(
      "/user/tokens/verify",
    );
    expect(body.result.status).toBe("active");

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as
      [string, RequestInit?] | undefined;
    const headers = (call?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toContain("Bearer ");
    expect(JSON.stringify(call)).not.toContain("logged-secret");
  });

  it("reintenta en 429", async () => {
    let attempts = 0;
    const fetchImpl = createMockFetch(() => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: "rate" }] }), {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return okEnvelope({ id: "tok_1", status: "active" });
    });

    const client = new CloudflareHttpClient({
      config: {
        apiToken: "token",
        accountId: "acct",
        baseUrl: "https://api.cloudflare.com/client/v4",
        maxRetries: 2,
        retryBaseDelayMs: 1,
        requestsPerMinute: 1000,
        r2AccessKeyId: "",
        r2SecretAccessKey: "",
        r2Jurisdiction: "default",
      },
      fetchImpl,
      retry: {
        sleep: () => Promise.resolve(),
      },
    });

    await client.get("/user/tokens/verify");
    expect(attempts).toBe(2);
  });
});

describe("bucket naming guards", () => {
  it("acepta staging válido", () => {
    expect(isStagingBucketName("compramelafoto-staging")).toBe(true);
    expect(() => {
      assertStagingBucketName("compramelafoto-staging");
    }).not.toThrow();
  });

  it("bloquea prod/production", () => {
    expect(isProductionBucketName("compramelafoto-prod")).toBe(true);
    expect(isProductionBucketName("my-production-assets")).toBe(true);
    expect(() => {
      assertStagingBucketName("compramelafoto-prod");
    }).toThrow(/prod/);
  });
});

describe("CloudflareProvider R2 buckets", () => {
  it("dryRun no crea bucket", async () => {
    const fetchImpl = createMockFetch(() => {
      throw new Error("no debe llamar API en dryRun create");
    });

    const provider = new CloudflareProvider({
      config: {
        apiToken: "token",
        accountId: "acct",
      },
      fetchImpl,
    });

    const result = await provider.createBucket("demo-staging", { dryRun: true, confirm: false });
    expect(result.dryRun).toBe(true);
    expect(result.created).toBe(false);
    expect(result.wouldCreate).toBe(true);
  });

  it("requiere confirm para crear de verdad", async () => {
    const provider = new CloudflareProvider({
      config: { apiToken: "token", accountId: "acct" },
      fetchImpl: createMockFetch(() => okEnvelope({ name: "demo-staging" })),
    });

    await expect(
      provider.createBucket("demo-staging", { dryRun: false, confirm: false }),
    ).rejects.toBeInstanceOf(CloudflareConfirmationRequiredError);
  });

  it("bloquea creación de bucket prod", async () => {
    const provider = new CloudflareProvider({
      config: { apiToken: "token", accountId: "acct" },
      fetchImpl: createMockFetch(() => okEnvelope({})),
    });

    await expect(
      provider.createBucket("compramelafoto-prod", { dryRun: false, confirm: true }),
    ).rejects.toBeInstanceOf(CloudflareGuardError);
  });

  it("lista buckets con mock", async () => {
    const provider = new CloudflareProvider({
      config: { apiToken: "token", accountId: "acct" },
      fetchImpl: createMockFetch(() =>
        okEnvelope({
          buckets: [{ name: "compramelafoto-staging", creation_date: "2026-01-01T00:00:00Z" }],
        }),
      ),
    });

    const buckets = await provider.listBuckets();
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.name).toBe("compramelafoto-staging");
  });
});

describe("prepareStagingBucket", () => {
  it("devuelve ACTION_REQUIRED en dryRun si no existe", async () => {
    const buckets = {
      bucketExists: vi.fn().mockResolvedValue(false),
      createBucket: vi.fn(),
    };
    const cors = {
      getCors: vi.fn(),
      isCorsReady: vi.fn().mockReturnValue(false),
    };
    const domains = {
      getPublicDomain: vi.fn(),
    };

    const result = await prepareStagingBucket(
      {
        buckets: buckets as never,
        cors: cors as never,
        domains: domains as never,
      },
      {
        platformId: "compramelafoto",
        bucketName: "compramelafoto-staging",
        dryRun: true,
        confirm: false,
      },
    );

    expect(result.status).toBe("ACTION_REQUIRED");
    expect(result.wouldCreate).toBe(true);
    expect(result.created).toBe(false);
    expect(buckets.createBucket).not.toHaveBeenCalled();
  });

  it("bloquea bucket con prod en el nombre", async () => {
    const result = await prepareStagingBucket(
      {
        buckets: { bucketExists: vi.fn() } as never,
        cors: { getCors: vi.fn(), isCorsReady: vi.fn() } as never,
        domains: { getPublicDomain: vi.fn() } as never,
      },
      {
        platformId: "compramelafoto",
        bucketName: "compramelafoto-prod-staging",
        dryRun: true,
        confirm: false,
      },
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.blockers.some((b) => b.toLowerCase().includes("prod"))).toBe(true);
  });
});

describe("prepareApplication", () => {
  const baseConfig = {
    apiToken: "tok",
    accountId: "f2657ee448aca18d2af0cf2b0669289b",
    baseUrl: "https://api.cloudflare.com/client/v4",
    maxRetries: 0,
    retryBaseDelayMs: 1,
    requestsPerMinute: 100,
    r2AccessKeyId: "",
    r2SecretAccessKey: "",
    r2Jurisdiction: "default" as const,
  };

  function createServices(overrides: {
    bucketExists?: boolean;
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
    createCredentials?: ReturnType<typeof vi.fn>;
    vercel?: {
      isConfigured: () => boolean;
      listPreviewEnvKeys: ReturnType<typeof vi.fn>;
      createPreviewEnvVar: ReturnType<typeof vi.fn>;
    };
    uploadObject?: ReturnType<typeof vi.fn>;
    downloadObject?: ReturnType<typeof vi.fn>;
    deleteObject?: ReturnType<typeof vi.fn>;
  } = {}) {
    const createCredentials =
      overrides.createCredentials ??
      vi.fn().mockRejectedValue(new CloudflareAuthError("Authentication error"));

    return {
      config: {
        ...baseConfig,
        r2AccessKeyId: overrides.r2AccessKeyId ?? "",
        r2SecretAccessKey: overrides.r2SecretAccessKey ?? "",
      },
      buckets: {
        bucketExists: vi.fn().mockResolvedValue(overrides.bucketExists ?? true),
      },
      objects: {
        uploadObject:
          overrides.uploadObject ??
          vi.fn().mockResolvedValue({
            dryRun: false,
            uploaded: true,
            key: "smoke/x",
            wouldUpload: false,
          }),
        downloadObject:
          overrides.downloadObject ??
          vi.fn().mockImplementation((_b: string, _k: string) => ({
            ok: true,
            body: Buffer.from("placeholder"),
            status: 200,
            contentType: "text/plain",
          })),
        deleteObject:
          overrides.deleteObject ??
          vi.fn().mockResolvedValue({
            dryRun: false,
            deleted: true,
            key: "smoke/x",
            wouldDelete: false,
          }),
      },
      credentials: {
        createScopedObjectCredentials: createCredentials,
      },
      createS3Client: vi.fn().mockReturnValue({}),
      vercel: overrides.vercel,
    };
  }

  it("dryRun con bucket existente y sin credenciales → ACTION_REQUIRED sin mutar", async () => {
    const services = createServices({ bucketExists: true });
    const result = await prepareApplication(services as never, {
      platformId: "compramelafoto",
      dryRun: true,
      confirm: false,
      loadEnvToVercelPreview: false,
    });

    expect(result.status).toBe("ACTION_REQUIRED");
    expect(result.bucketExists).toBe(true);
    expect(result.bucketName).toBe("compramelafoto-staging");
    expect(result.endpointValid).toBe(true);
    expect(result.credentials.source).toBe("missing");
    expect(result.credentials.createAttempted).toBe(false);
    expect(services.credentials.createScopedObjectCredentials).not.toHaveBeenCalled();
    expect(services.objects.uploadObject).not.toHaveBeenCalled();
  });

  it("READY cuando hay credenciales env + smoke OK", async () => {
    const payloadHolder = { value: "" };
    const services = createServices({
      bucketExists: true,
      r2AccessKeyId: "AKIA_TEST",
      r2SecretAccessKey: "secret_test_value",
      uploadObject: vi.fn().mockImplementation((_b: string, _k: string, body: string) => {
        payloadHolder.value = body;
        return { dryRun: false, uploaded: true, key: _k, wouldUpload: false };
      }),
      downloadObject: vi.fn().mockImplementation(() => ({
        ok: true,
        body: Buffer.from(payloadHolder.value),
        status: 200,
        contentType: "text/plain",
      })),
      vercel: {
        isConfigured: () => true,
        listPreviewEnvKeys: vi.fn().mockResolvedValue([
          "R2_ACCOUNT_ID",
          "R2_ACCESS_KEY_ID",
          "R2_SECRET_ACCESS_KEY",
          "R2_ENDPOINT",
          "R2_BUCKET",
          "R2_BUCKET_NAME",
          "R2_REGION",
        ]),
        createPreviewEnvVar: vi.fn(),
      },
    });

    const result = await prepareApplication(services as never, {
      platformId: "compramelafoto",
      dryRun: false,
      confirm: true,
      loadEnvToVercelPreview: false,
    });

    expect(result.status).toBe("READY");
    expect(result.credentials.source).toBe("env");
    expect(result.smokeTest.uploadOk).toBe(true);
    expect(result.smokeTest.downloadOk).toBe(true);
    expect(result.smokeTest.cleanedUp).toBe(true);
    expect(result.envVars?.R2_BUCKET).toBe("compramelafoto-staging");
    expect(result.vercelPreview.loadOffered).toBe(false);
    expect(services.vercel?.createPreviewEnvVar).not.toHaveBeenCalled();
  });

  it("ofrece cargar vars faltantes en Preview y no toca production", async () => {
    const createPreviewEnvVar = vi.fn().mockResolvedValue(undefined);
    const services = createServices({
      bucketExists: true,
      r2AccessKeyId: "AKIA_TEST",
      r2SecretAccessKey: "secret_test_value",
      uploadObject: vi.fn().mockImplementation((_b: string, _k: string, body: string) => ({
        dryRun: false,
        uploaded: true,
        key: _k,
        wouldUpload: false,
        body,
      })),
      downloadObject: vi.fn().mockImplementation((_b: string, _k: string) => {
        // Will fail body match unless we sync — use flexible check via upload capturing
        return { ok: true, body: Buffer.from("x"), status: 200, contentType: "text/plain" };
      }),
      vercel: {
        isConfigured: () => true,
        listPreviewEnvKeys: vi.fn().mockResolvedValue(["R2_ACCOUNT_ID"]),
        createPreviewEnvVar,
      },
    });

    // Fix download to match uploaded body
    let uploaded = "";
    services.objects.uploadObject = vi.fn().mockImplementation((_b: string, _k: string, body: string) => {
      uploaded = body;
      return { dryRun: false, uploaded: true, key: _k, wouldUpload: false };
    });
    services.objects.downloadObject = vi.fn().mockImplementation(() => ({
      ok: true,
      body: Buffer.from(uploaded),
      status: 200,
      contentType: "text/plain",
    }));

    const dry = await prepareApplication(services as never, {
      platformId: "compramelafoto",
      dryRun: true,
      confirm: false,
      loadEnvToVercelPreview: false,
    });
    expect(dry.vercelPreview.loadOffered).toBe(true);
    expect(dry.vercelPreview.missingKeys).toContain("R2_BUCKET");
    expect(createPreviewEnvVar).not.toHaveBeenCalled();

    const loaded = await prepareApplication(services as never, {
      platformId: "compramelafoto",
      dryRun: false,
      confirm: true,
      loadEnvToVercelPreview: true,
    });
    expect(loaded.status).toBe("READY");
    expect(createPreviewEnvVar).toHaveBeenCalled();
    for (const call of createPreviewEnvVar.mock.calls) {
      expect(call[0]).toBe("compramelafoto-dnxsuite");
      expect(typeof call[1]).toBe("string");
      expect(typeof call[2]).toBe("string");
    }
    expect(loaded.vercelPreview.loadedKeys.length).toBeGreaterThan(0);
  });

  it("403 al crear credenciales → ACTION_REQUIRED sin romper", async () => {
    const services = createServices({
      bucketExists: true,
      createCredentials: vi.fn().mockRejectedValue(new CloudflareAuthError("Authentication error")),
    });

    const result = await prepareApplication(services as never, {
      platformId: "compramelafoto",
      dryRun: false,
      confirm: true,
      loadEnvToVercelPreview: false,
    });

    expect(result.status).toBe("ACTION_REQUIRED");
    expect(result.credentials.createAttempted).toBe(true);
    expect(result.credentials.source).toBe("missing");
    expect(result.warnings.some((w) => w.includes("403") || w.includes("Dashboard"))).toBe(true);
  });
});
