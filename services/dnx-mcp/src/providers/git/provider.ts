import { ProviderNotConfiguredError } from "../../utils/errors.js";
import type { Provider } from "../../types/provider.js";
import { GitExecutor } from "./client/git-executor.js";
import {
  gitConfigSchema,
  isRepoPathAccessible,
  resolveGitConfig,
  type GitConfig,
} from "./config.js";
import { GitNotRepositoryError } from "./errors.js";
import { GitReleaseHelpers } from "./helpers/index.js";
import { GitCompareService, GitSecurityService, GitStatusService } from "./services/index.js";
import type {
  AheadBehind,
  GitBranchCompare,
  GitCommit,
  GitDiffStat,
  GitRemote,
  GitStatus,
  ReleaseReadiness,
  ReleaseSummary,
} from "./types/index.js";

export interface GitProviderOptions {
  config?: Partial<GitConfig>;
  executor?: GitExecutor;
}

/**
 * Provider de Git de solo lectura.
 * Inspecciona el estado del repositorio sin ejecutar operaciones destructivas.
 */
export class GitProvider implements Provider {
  readonly name = "git" as const;

  readonly status: GitStatusService;
  readonly compare: GitCompareService;
  readonly security: GitSecurityService;
  readonly helpers: GitReleaseHelpers;

  private readonly config: GitConfig;
  private readonly executor: GitExecutor;
  private repositoryVerified = false;

  constructor(options: GitProviderOptions = {}) {
    this.config = resolveGitConfig(options.config);
    this.executor =
      options.executor ??
      new GitExecutor({
        binary: this.config.binary,
        cwd: this.config.repoPath,
      });

    this.status = new GitStatusService(this.executor);
    this.compare = new GitCompareService(this.executor);
    this.security = new GitSecurityService(this.executor, this.status, this.compare);
    this.helpers = new GitReleaseHelpers(
      this.status,
      this.compare,
      this.security,
      this.config.defaultBranch,
    );
  }

  isConfigured(): boolean {
    return isRepoPathAccessible(this.config.repoPath);
  }

  getConfig(): Readonly<GitConfig> {
    return this.config;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }
  }

  private async assertRepository(): Promise<void> {
    this.assertConfigured();

    if (this.repositoryVerified) {
      return;
    }

    try {
      await this.executor.runText(["rev-parse", "--git-dir"]);
      this.repositoryVerified = true;
    } catch {
      throw new GitNotRepositoryError(this.config.repoPath);
    }
  }

  // --- Estado del repo ---

  async getStatus(): Promise<GitStatus> {
    await this.assertRepository();
    return this.status.getStatus();
  }

  async isDirty(): Promise<boolean> {
    await this.assertRepository();
    return this.status.isDirty();
  }

  async getCurrentBranch(): Promise<string> {
    await this.assertRepository();
    return this.status.getCurrentBranch();
  }

  async getRemote(name = "origin"): Promise<GitRemote | null> {
    await this.assertRepository();
    return this.status.getRemote(name);
  }

  async getHeadCommit(): Promise<GitCommit> {
    await this.assertRepository();
    return this.status.getHeadCommit();
  }

  async getLastCommits(limit: number): Promise<GitCommit[]> {
    await this.assertRepository();
    return this.status.getLastCommits(limit);
  }

  async getTags(): Promise<string[]> {
    await this.assertRepository();
    return this.status.getTags();
  }

  async getLatestTag(): Promise<string | null> {
    await this.assertRepository();
    return this.status.getLatestTag();
  }

  // --- Comparación ---

  async getDiffStat(ref = "HEAD"): Promise<GitDiffStat> {
    await this.assertRepository();
    return this.compare.getDiffStat(ref);
  }

  async getChangedFiles(ref = "HEAD"): Promise<string[]> {
    await this.assertRepository();
    return this.compare.getChangedFiles(ref);
  }

  async compareBranches(base: string, head: string): Promise<GitBranchCompare> {
    await this.assertRepository();
    return this.compare.compareBranches(base, head);
  }

  async getCommitsBetween(base: string, head: string): Promise<GitCommit[]> {
    await this.assertRepository();
    return this.compare.getCommitsBetween(base, head);
  }

  // --- Seguridad release ---

  async hasUncommittedChanges(): Promise<boolean> {
    await this.assertRepository();
    return this.security.hasUncommittedChanges();
  }

  async hasUnpushedCommits(): Promise<boolean> {
    await this.assertRepository();
    return this.security.hasUnpushedCommits();
  }

  async isAheadBehindRemote(): Promise<AheadBehind | null> {
    await this.assertRepository();
    return this.security.isAheadBehindRemote();
  }

  async getReleaseSummary(): Promise<ReleaseSummary> {
    await this.assertRepository();
    return this.security.getReleaseSummary(this.config.defaultBranch);
  }

  // --- Helpers de alto nivel ---

  async assessReleaseReadiness(): Promise<ReleaseReadiness> {
    await this.assertRepository();
    return this.helpers.assessReleaseReadiness();
  }
}

export function createGitProvider(options: GitProviderOptions = {}): GitProvider {
  return new GitProvider(options);
}

export const gitProvider = createGitProvider();

export { gitConfigSchema, resolveGitConfig, type GitConfig };
