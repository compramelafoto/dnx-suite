import type { GitExecutor } from "../client/git-executor.js";
import { parseAheadBehind } from "../parsers.js";
import type { AheadBehind, ReleaseSummary } from "../types/index.js";
import { releaseSummarySchema } from "../types/index.js";
import type { GitCompareService } from "./compare.service.js";
import type { GitStatusService } from "./status.service.js";

export class GitSecurityService {
  constructor(
    private readonly executor: GitExecutor,
    private readonly status: GitStatusService,
    private readonly compare: GitCompareService,
  ) {}

  async hasUncommittedChanges(): Promise<boolean> {
    return this.status.isDirty();
  }

  async hasUnpushedCommits(): Promise<boolean> {
    const count = await this.getUnpushedCommitCount();
    return count > 0;
  }

  async getUnpushedCommitCount(): Promise<number> {
    try {
      const stdout = await this.executor.runText(["rev-list", "--count", "@{u}..HEAD"]);
      return Number(stdout);
    } catch {
      return 0;
    }
  }

  async isAheadBehindRemote(): Promise<AheadBehind | null> {
    try {
      const upstream = await this.executor.runText(["rev-parse", "--abbrev-ref", "@{u}"]);
      const stdout = await this.executor.runText([
        "rev-list",
        "--left-right",
        "--count",
        "@{u}...HEAD",
      ]);
      return parseAheadBehind(stdout, upstream);
    } catch {
      return null;
    }
  }

  async getReleaseSummary(defaultBranch?: string): Promise<ReleaseSummary> {
    const [
      branch,
      headCommit,
      latestTag,
      dirty,
      unpushedCommits,
      aheadBehind,
      changedFiles,
      resolvedDefaultBranch,
    ] = await Promise.all([
      this.status.getCurrentBranch(),
      this.status.getHeadCommit(),
      this.status.getLatestTag(),
      this.status.isDirty(),
      this.getUnpushedCommitCount(),
      this.isAheadBehindRemote(),
      this.compare.getWorkingTreeChangedFiles(),
      this.status.resolveDefaultBranch(defaultBranch),
    ]);

    return releaseSummarySchema.parse({
      branch,
      headCommit,
      latestTag,
      dirty,
      unpushedCommits,
      aheadBehind,
      changedFilesCount: changedFiles.length,
      defaultBranch: resolvedDefaultBranch,
      onDefaultBranch: resolvedDefaultBranch ? branch === resolvedDefaultBranch : false,
    });
  }
}
