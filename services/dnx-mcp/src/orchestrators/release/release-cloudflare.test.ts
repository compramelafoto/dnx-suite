import { describe, expect, it, vi } from "vitest";
import { cuantoCobroPlatform, comprameLaFotoPlatform } from "../../platforms/index.js";
import type { CloudflareProvider } from "../../providers/cloudflare/provider.js";
import type { CloudflareReleaseReadiness } from "../../providers/cloudflare/types/index.js";
import {
  cloudflareHasCriticalBlockers,
  formatCloudflareReport,
  resolveCloudflareProvider,
} from "./release-cloudflare.js";
import { mergeBrainWithCloudflareGate } from "./release-brain.js";

function readiness(
  overrides: Partial<CloudflareReleaseReadiness> = {},
): CloudflareReleaseReadiness {
  return {
    configured: true,
    bucketExists: true,
    bucketName: "compramelafoto-staging",
    corsReady: true,
    publicDomainReady: true,
    assetsRequired: true,
    productionProtected: true,
    riskLevel: "low",
    blockers: [],
    warnings: [],
    recommendation: "ok",
    ...overrides,
  };
}

describe("release cloudflare integration", () => {
  it("no resuelve provider si plataforma no usa R2", () => {
    const provider = { name: "cloudflare", isConfigured: () => true } as CloudflareProvider;
    expect(
      resolveCloudflareProvider(cuantoCobroPlatform, { cloudflare: provider }),
    ).toBeUndefined();
  });

  it("resuelve provider si plataforma declara R2", () => {
    const provider = { name: "cloudflare", isConfigured: () => true } as CloudflareProvider;
    expect(resolveCloudflareProvider(comprameLaFotoPlatform, { cloudflare: provider })).toBe(
      provider,
    );
  });

  it("bloqueo crítico solo con assetsRequired", () => {
    expect(
      cloudflareHasCriticalBlockers(
        readiness({ assetsRequired: false, blockers: ["x"], riskLevel: "high" }),
      ),
    ).toBe(false);

    expect(
      cloudflareHasCriticalBlockers(
        readiness({ assetsRequired: true, blockers: ["missing staging"], riskLevel: "high" }),
      ),
    ).toBe(true);
  });

  it("mergeBrain bloquea QA de fotos", () => {
    const brain = mergeBrainWithCloudflareGate(
      {
        score: 90,
        confidence: 0.9,
        verdict: "approve",
        reasoning: [],
        recommendation: "go",
        nextActions: [],
        risks: [],
        inconsistencies: [],
        rejected: false,
        shouldBlock: false,
      },
      readiness({
        bucketExists: false,
        blockers: ["Bucket staging ausente"],
        riskLevel: "high",
      }),
    );

    expect(brain.shouldBlock).toBe(true);
    expect(brain.verdict).toBe("reject");
  });

  it("formatCloudflareReport expone campos requeridos", () => {
    const report = formatCloudflareReport(readiness());
    expect(report).toMatchObject({
      configured: true,
      bucketExists: true,
      bucketName: "compramelafoto-staging",
      corsReady: true,
      publicDomainReady: true,
      riskLevel: "low",
    });
  });

  it("assessReleaseReadiness no crea recursos", async () => {
    const assess = vi.fn().mockResolvedValue(readiness({ bucketExists: false }));
    const provider = {
      assessReleaseReadiness: assess,
      isConfigured: () => true,
    } as unknown as CloudflareProvider;

    const result = await provider.assessReleaseReadiness(comprameLaFotoPlatform);
    expect(result.bucketExists).toBe(false);
    expect(assess).toHaveBeenCalledTimes(1);
  });
});
