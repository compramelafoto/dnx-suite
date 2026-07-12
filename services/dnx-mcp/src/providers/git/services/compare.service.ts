import type { GitExecutor } from "../client/git-executor.js";
import { parseCommits, parseDiffStat, parseNameOnlyFiles } from "../parsers.js";
import {
  compareBranchesInputSchema,
  type GitBranchCompare,
  type GitCommit,
  type GitDiffStat,
  gitBranchCompareSchema,
} from "../types/index.js";

const LOG_FORMAT = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s";

export class GitCompareService {
  constructor(private readonly executor: GitExecutor) {}

  async getDiffStat(ref = "HEAD"): Promise<GitDiffStat> {
    const stdout = await this.executor.runText(["diff", "--stat", ref]);
    return parseDiffStat(stdout);
  }

  async getChangedFiles(ref = "HEAD"): Promise<string[]> {
    const stdout = await this.executor.runText(["diff", "--name-only", ref]);
    return parseNameOnlyFiles(stdout);
  }

  async getWorkingTreeChangedFiles(): Promise<string[]> {
    const stdout = await this.executor.runText(["diff", "--name-only"]);
    const untracked = await this.executor.runText(["ls-files", "--others", "--exclude-standard"]);
    return [...new Set([...parseNameOnlyFiles(stdout), ...parseNameOnlyFiles(untracked)])];
  }

  async compareBranches(base: string, head: string): Promise<GitBranchCompare> {
    const input = compareBranchesInputSchema.parse({ base, head });

    const [commitsStdout, diffStdout, filesStdout] = await Promise.all([
      this.executor.runText(["log", `${input.base}..${input.head}`, `--format=${LOG_FORMAT}`]),
      this.executor.runText(["diff", "--stat", `${input.base}...${input.head}`]),
      this.executor.runText(["diff", "--name-only", `${input.base}...${input.head}`]),
    ]);

    return gitBranchCompareSchema.parse({
      base: input.base,
      head: input.head,
      commits: parseCommits(commitsStdout),
      diffStat: parseDiffStat(diffStdout),
      changedFiles: parseNameOnlyFiles(filesStdout),
    });
  }

  async getCommitsBetween(base: string, head: string): Promise<GitCommit[]> {
    const input = compareBranchesInputSchema.parse({ base, head });
    const stdout = await this.executor.runText([
      "log",
      `${input.base}..${input.head}`,
      `--format=${LOG_FORMAT}`,
    ]);
    return parseCommits(stdout);
  }
}
