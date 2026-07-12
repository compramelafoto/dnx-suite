import { describe, expect, it } from "vitest";
import { extractBuildInfo } from "../types/build.js";
import type { VercelDeployment } from "../types/deployment.js";

describe("extractBuildInfo", () => {
  it("extrae metadata de build desde un deployment", () => {
    const deployment: VercelDeployment = {
      id: "dpl_123",
      url: "my-app.vercel.app",
      state: "READY",
      readyState: "READY",
      createdAt: 1_000,
      buildingAt: 1_000,
      ready: 4_000,
      meta: {
        githubCommitSha: "abc123",
        githubCommitMessage: "feat: init",
        githubCommitAuthorName: "Daniel",
        githubCommitRef: "main",
      },
    };

    const info = extractBuildInfo(deployment);

    expect(info).toEqual({
      deploymentId: "dpl_123",
      state: "READY",
      durationMs: 3_000,
      commitSha: "abc123",
      commitMessage: "feat: init",
      author: "Daniel",
      branch: "main",
      url: "my-app.vercel.app",
      createdAt: 1_000,
      readyAt: 4_000,
    });
  });
});
