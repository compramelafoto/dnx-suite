import { describe, expect, it, vi } from "vitest";
import type { GitExecutor } from "./client/git-executor.js";
import { GitProvider } from "./provider.js";

const LOG_FORMAT = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s";

function createMockExecutor(responses: Record<string, string>): GitExecutor {
  return {
    runText: vi.fn((args: readonly string[]) => {
      const key = args.join(" ");
      if (key in responses) {
        return Promise.resolve(responses[key]);
      }
      return Promise.reject(new Error(`Unexpected git command: ${key}`));
    }),
    run: vi.fn(),
  } as unknown as GitExecutor;
}

const baseResponses: Record<string, string> = {
  "rev-parse --git-dir": ".git",
  "rev-parse --abbrev-ref HEAD": "main",
  "status --porcelain": "",
  "remote -v":
    "origin\thttps://github.com/org/repo.git (fetch)\norigin\thttps://github.com/org/repo.git (push)",
  [`log -1 --format=${LOG_FORMAT}`]:
    "abc123def456\x1fabc123d\x1fDaniel\x1fdaniel@test.com\x1f2026-01-01T00:00:00Z\x1ffeat: release",
  [`log -n 3 --format=${LOG_FORMAT}`]:
    "abc123def456\x1fabc123d\x1fDaniel\x1fdaniel@test.com\x1f2026-01-01T00:00:00Z\x1ffeat: release",
  "tag -l": "v1.0.0\nv1.1.0",
  "describe --tags --abbrev=0": "v1.1.0",
  "diff --stat HEAD": "",
  "diff --name-only HEAD": "",
  "diff --name-only": "",
  "ls-files --others --exclude-standard": "",
  "rev-list --count @{u}..HEAD": "0",
  "rev-parse --abbrev-ref @{u}": "origin/main",
  "rev-list --left-right --count @{u}...HEAD": "0\t0",
  "symbolic-ref refs/remotes/origin/HEAD --short": "origin/main",
};

describe("GitProvider", () => {
  it("reporta configurado cuando el path del repo existe", () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd() },
      executor: createMockExecutor(baseResponses),
    });
    expect(provider.isConfigured()).toBe(true);
  });

  it("obtiene estado limpio del repo", async () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd(), defaultBranch: "main" },
      executor: createMockExecutor(baseResponses),
    });

    const status = await provider.getStatus();
    expect(status.branch).toBe("main");
    expect(status.dirty).toBe(false);
  });

  it("detecta cambios sin commitear", async () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd() },
      executor: createMockExecutor({
        ...baseResponses,
        "status --porcelain": " M dirty.ts\n",
      }),
    });

    expect(await provider.hasUncommittedChanges()).toBe(true);
    expect(await provider.isDirty()).toBe(true);
  });

  it("detecta commits sin push", async () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd() },
      executor: createMockExecutor({
        ...baseResponses,
        "rev-list --count @{u}..HEAD": "2",
        "rev-list --left-right --count @{u}...HEAD": "0\t2",
      }),
    });

    expect(await provider.hasUnpushedCommits()).toBe(true);
    const aheadBehind = await provider.isAheadBehindRemote();
    expect(aheadBehind?.ahead).toBe(2);
  });

  it("compara ramas", async () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd() },
      executor: createMockExecutor({
        ...baseResponses,
        [`log main..release --format=${LOG_FORMAT}`]:
          "abc123def456\x1fabc123d\x1fDaniel\x1fdaniel@test.com\x1f2026-01-01T00:00:00Z\x1frelease commit",
        "diff --stat main...release": " src/a.ts | 1 +\n 1 file changed, 1 insertion(+)",
        "diff --name-only main...release": "src/a.ts",
      }),
    });

    const compare = await provider.compareBranches("main", "release");
    expect(compare.commits).toHaveLength(1);
    expect(compare.changedFiles).toEqual(["src/a.ts"]);
  });

  it("assessReleaseReadiness bloquea con working tree sucio", async () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd(), defaultBranch: "main" },
      executor: createMockExecutor({
        ...baseResponses,
        "status --porcelain": "?? temp.txt\n",
        "diff --name-only": "",
        "ls-files --others --exclude-standard": "temp.txt",
      }),
    });

    const readiness = await provider.assessReleaseReadiness();
    expect(readiness.dirtyTree).toBe(true);
    expect(readiness.riskLevel).toBe("high");
    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.recommendation).toContain("No liberar");
  });

  it("assessReleaseReadiness aprueba repo limpio", async () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd(), defaultBranch: "main" },
      executor: createMockExecutor(baseResponses),
    });

    const readiness = await provider.assessReleaseReadiness();
    expect(readiness.riskLevel).toBe("low");
    expect(readiness.blockers).toHaveLength(0);
    expect(readiness.latestTag).toBe("v1.1.0");
  });

  it("getReleaseSummary consolida métricas", async () => {
    const provider = new GitProvider({
      config: { repoPath: process.cwd(), defaultBranch: "main" },
      executor: createMockExecutor(baseResponses),
    });

    const summary = await provider.getReleaseSummary();
    expect(summary.branch).toBe("main");
    expect(summary.onDefaultBranch).toBe(true);
    expect(summary.headCommit.subject).toBe("feat: release");
  });
});
