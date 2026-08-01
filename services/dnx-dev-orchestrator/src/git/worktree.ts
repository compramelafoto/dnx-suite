import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { defaultWorktreeRoot } from "../config/defaults.js";
import { gitExec, gitOk } from "./exec.js";
import { buildTaskBranchName, validateBranchName } from "./branch.js";
import { assertPathInsideWorktreeRoot, resolveRealPath } from "./paths.js";

export type WorktreePrepareResult = {
  branch: string;
  worktree: string;
  baseRef: string;
  baseCommit: string;
};

export type WorktreeInspect = {
  exists: boolean;
  worktree: string | null;
  branch: string | null;
  head: string | null;
  statusPorcelain: string;
  clean: boolean;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export class WorktreeManager {
  constructor(
    private readonly controlPlaneRoot: string,
    private readonly worktreeRoot: string,
  ) {}

  static resolveWorktreeRoot(controlPlaneRoot: string, envOverride?: string): string {
    return envOverride?.trim() || defaultWorktreeRoot(controlPlaneRoot);
  }

  async getRepositoryRoot(): Promise<string> {
    const root = await gitOk(["rev-parse", "--show-toplevel"], { cwd: this.controlPlaneRoot });
    return resolveRealPath(root);
  }

  async getCurrentBranch(): Promise<string> {
    return gitOk(["branch", "--show-current"], { cwd: this.controlPlaneRoot });
  }

  async resolveBaseCommit(baseRef: string): Promise<{ baseRef: string; baseCommit: string }> {
    const commit = await gitOk(["rev-parse", "--verify", `${baseRef}^{commit}`], {
      cwd: this.controlPlaneRoot,
    });
    return { baseRef, baseCommit: commit };
  }

  async ensureWorktreeRoot(): Promise<string> {
    await mkdir(this.worktreeRoot, { recursive: true });
    const containment = await assertPathInsideWorktreeRoot(this.worktreeRoot, this.worktreeRoot);
    if (!containment.ok) throw new Error(containment.reason);
    return containment.realPath;
  }

  taskWorktreePath(taskId: string): string {
    return join(this.worktreeRoot, taskId);
  }

  async createTaskWorktree(input: {
    taskId: string;
    project: string;
    objective: string;
    baseRef?: string;
  }): Promise<WorktreePrepareResult> {
    await this.ensureWorktreeRoot();

    const baseRef =
      input.baseRef?.trim() || (await this.getCurrentBranch()) || "HEAD";
    const { baseCommit } = await this.resolveBaseCommit(baseRef);

    const branch = buildTaskBranchName(input.taskId, input.project, input.objective);
    const branchOk = validateBranchName(branch);
    if (!branchOk.ok) throw new Error(branchOk.reason);

    const worktree = this.taskWorktreePath(input.taskId);
    const containment = await assertPathInsideWorktreeRoot(worktree, this.worktreeRoot);
    if (!containment.ok) throw new Error(containment.reason);

    if (await pathExists(worktree)) {
      throw new Error(`Worktree path already exists: ${worktree}`);
    }

    // Ensure branch does not already exist unintentionally.
    const branchCheck = await gitExec(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: this.controlPlaneRoot,
    });
    if (branchCheck.code === 0) {
      throw new Error(`Branch already exists: ${branch}`);
    }

    // Create branch at concrete commit, then attach worktree.
    // This does NOT copy dirty uncommitted control-plane changes.
    const branchCreate = await gitExec(["branch", branch, baseCommit], {
      cwd: this.controlPlaneRoot,
    });
    if (branchCreate.code !== 0) {
      throw new Error(`Failed to create branch: ${branchCreate.stderr}`);
    }

    const wtAdd = await gitExec(["worktree", "add", worktree, branch], {
      cwd: this.controlPlaneRoot,
    });
    if (wtAdd.code !== 0) {
      // Best-effort cleanup of the orphan branch if worktree add failed.
      await gitExec(["branch", "-D", branch], { cwd: this.controlPlaneRoot });
      throw new Error(`Failed to create worktree: ${wtAdd.stderr}`);
    }

    return {
      branch,
      worktree: containment.realPath,
      baseRef,
      baseCommit,
    };
  }

  async getTaskWorktree(taskId: string): Promise<string> {
    return resolveRealPath(this.taskWorktreePath(taskId));
  }

  async inspectTaskWorktree(worktreePath: string | null | undefined): Promise<WorktreeInspect> {
    if (!worktreePath) {
      return {
        exists: false,
        worktree: null,
        branch: null,
        head: null,
        statusPorcelain: "",
        clean: true,
      };
    }
    if (!(await pathExists(worktreePath))) {
      return {
        exists: false,
        worktree: worktreePath,
        branch: null,
        head: null,
        statusPorcelain: "",
        clean: true,
      };
    }

    const branch = await gitOk(["branch", "--show-current"], { cwd: worktreePath });
    const head = await gitOk(["rev-parse", "HEAD"], { cwd: worktreePath });
    const statusPorcelain = await gitOk(["status", "--porcelain"], { cwd: worktreePath });
    return {
      exists: true,
      worktree: await resolveRealPath(worktreePath),
      branch,
      head,
      statusPorcelain,
      clean: statusPorcelain.length === 0,
    };
  }

  async captureGitSnapshot(cwd: string): Promise<{
    statusPorcelain: string;
    head: string;
    branch: string;
    diffStat: string;
    nameOnly: string[];
  }> {
    const statusPorcelain = await gitOk(["status", "--porcelain"], { cwd });
    const head = await gitOk(["rev-parse", "HEAD"], { cwd });
    const branch = await gitOk(["branch", "--show-current"], { cwd });
    const diffStatResult = await gitExec(["diff", "--stat"], { cwd });
    const nameOnlyResult = await gitExec(["diff", "--name-only"], { cwd });
    const untracked = statusPorcelain
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("??"))
      .map((l) => l.slice(2).trim());
    const nameOnly = [
      ...nameOnlyResult.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      ...untracked,
    ];
    return {
      statusPorcelain,
      head,
      branch,
      diffStat: diffStatResult.stdout.trim(),
      nameOnly: [...new Set(nameOnly)],
    };
  }

  /**
   * Removal is HUMAN_APPROVAL_REQUIRED — never auto-called in ETAPA 03.
   */
  async removeTaskWorktree(input: {
    worktree: string;
    branch: string;
    confirm: boolean;
  }): Promise<void> {
    if (!input.confirm) {
      throw new Error("HUMAN_APPROVAL_REQUIRED: pass explicit confirm to remove worktree");
    }
    const containment = await assertPathInsideWorktreeRoot(input.worktree, this.worktreeRoot);
    if (!containment.ok) throw new Error(containment.reason);

    const remove = await gitExec(["worktree", "remove", "--force", input.worktree], {
      cwd: this.controlPlaneRoot,
    });
    if (remove.code !== 0) {
      throw new Error(`Failed to remove worktree: ${remove.stderr}`);
    }
    // Do not auto-delete branch; leave for human review.
  }
}
