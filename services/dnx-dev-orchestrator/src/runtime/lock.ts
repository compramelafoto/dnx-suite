import { mkdir, readFile, rename, unlink, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

export type ExecutionLock = {
  cursorRunId: string;
  taskId: string;
  pid: number;
  createdAt: string;
};

export class ExecutionLockManager {
  constructor(
    private readonly dataDir: string,
    private readonly staleMs: number,
  ) {}

  private lockPath(): string {
    return join(this.dataDir, "locks", "execution.lock.json");
  }

  async ensureReady(): Promise<void> {
    await mkdir(join(this.dataDir, "locks"), { recursive: true });
  }

  async readLock(): Promise<ExecutionLock | null> {
    try {
      const raw = await readFile(this.lockPath(), "utf8");
      return JSON.parse(raw) as ExecutionLock;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  private async pidAlive(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async acquire(lock: ExecutionLock): Promise<{ ok: true } | { ok: false; reason: string }> {
    await this.ensureReady();
    const existing = await this.readLock();
    if (existing) {
      const age = Date.now() - Date.parse(existing.createdAt);
      const alive = await this.pidAlive(existing.pid);
      const stale = !Number.isFinite(age) || age > this.staleMs || !alive;
      if (!stale) {
        return {
          ok: false,
          reason: `Execution lock held by cursorRunId=${existing.cursorRunId} pid=${existing.pid}`,
        };
      }
      // Stale lock: remove only if we can prove it's stale.
      await this.release(existing.cursorRunId, { forceStale: true });
    }

    const target = this.lockPath();
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
    try {
      await rename(temp, target);
      // If rename overwrote nothing and another process raced, re-read.
      const current = await this.readLock();
      if (!current || current.cursorRunId !== lock.cursorRunId) {
        return { ok: false, reason: "Failed to acquire execution lock (race)" };
      }
      return { ok: true };
    } catch (error) {
      try {
        await unlink(temp);
      } catch {
        // ignore
      }
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "Lock acquire failed",
      };
    }
  }

  async release(
    cursorRunId: string,
    options: { forceStale?: boolean } = {},
  ): Promise<void> {
    const existing = await this.readLock();
    if (!existing) return;
    if (!options.forceStale && existing.cursorRunId !== cursorRunId) {
      throw new Error("Refusing to release execution lock owned by another run");
    }
    try {
      await access(this.lockPath(), constants.F_OK);
      await unlink(this.lockPath());
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") throw error;
    }
  }
}
