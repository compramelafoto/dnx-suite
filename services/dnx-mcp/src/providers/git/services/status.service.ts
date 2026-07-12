import type { GitExecutor } from "../client/git-executor.js";
import { parseCommitLine, parseCommits, parsePorcelainStatus, parseRemotes } from "../parsers.js";
import type { GitCommit, GitRemote, GitStatus } from "../types/index.js";

const LOG_FORMAT = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s";

export class GitStatusService {
  constructor(private readonly executor: GitExecutor) {}

  async getStatus(): Promise<GitStatus> {
    const branch = await this.getCurrentBranch();
    const porcelain = await this.executor.runText(["status", "--porcelain"]);
    return parsePorcelainStatus(porcelain, branch);
  }

  async isDirty(): Promise<boolean> {
    const status = await this.getStatus();
    return status.dirty;
  }

  async getCurrentBranch(): Promise<string> {
    return this.executor.runText(["rev-parse", "--abbrev-ref", "HEAD"]);
  }

  async getRemote(name = "origin"): Promise<GitRemote | null> {
    const remotes = await this.getRemotes();
    return remotes.find((remote) => remote.name === name) ?? null;
  }

  async getRemotes(): Promise<GitRemote[]> {
    const stdout = await this.executor.runText(["remote", "-v"]);
    return parseRemotes(stdout);
  }

  async getHeadCommit(): Promise<GitCommit> {
    const line = await this.executor.runText(["log", "-1", `--format=${LOG_FORMAT}`]);
    const commit = parseCommitLine(line);
    if (!commit) {
      throw new Error("No se pudo parsear HEAD commit");
    }
    return commit;
  }

  async getLastCommits(limit: number): Promise<GitCommit[]> {
    if (limit < 1) {
      return [];
    }

    const stdout = await this.executor.runText([
      "log",
      `-n`,
      String(limit),
      `--format=${LOG_FORMAT}`,
    ]);
    return parseCommits(stdout);
  }

  async getTags(): Promise<string[]> {
    const stdout = await this.executor.runText(["tag", "-l"]);
    return stdout
      .split("\n")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .sort();
  }

  async getLatestTag(): Promise<string | null> {
    try {
      return await this.executor.runText(["describe", "--tags", "--abbrev=0"]);
    } catch {
      return null;
    }
  }

  async resolveDefaultBranch(configuredDefault?: string): Promise<string | null> {
    if (configuredDefault) {
      return configuredDefault;
    }

    try {
      const remote = await this.getRemote("origin");
      if (!remote) {
        return null;
      }

      const ref = await this.executor.runText([
        "symbolic-ref",
        "refs/remotes/origin/HEAD",
        "--short",
      ]);
      return ref.replace(/^origin\//, "");
    } catch {
      return null;
    }
  }
}
