import { realpath, lstat, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, sep, relative, isAbsolute } from "node:path";

export type PathContainmentResult =
  | { ok: true; realPath: string; rootRealPath: string }
  | { ok: false; reason: string; code: "FORBIDDEN_AUTOMATIC" };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve realpath when the path exists; otherwise resolve parent chain safely.
 */
export async function resolveRealPath(path: string): Promise<string> {
  const absolute = resolve(path);
  if (await exists(absolute)) {
    return realpath(absolute);
  }

  // Walk up until an existing ancestor can be realpath'd.
  let current = absolute;
  const parts: string[] = [];
  for (let i = 0; i < 64; i += 1) {
    const parent = resolve(current, "..");
    if (parent === current) break;
    parts.unshift(current.slice(parent.length).replace(/^[/\\]/, ""));
    if (await exists(parent)) {
      const parentReal = await realpath(parent);
      return resolve(parentReal, ...parts);
    }
    current = parent;
  }
  return absolute;
}

function isInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  const rel = relative(parent, child);
  return Boolean(rel) && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

export async function assertPathInsideRoot(
  candidatePath: string,
  rootPath: string,
): Promise<PathContainmentResult> {
  const rootReal = await resolveRealPath(rootPath);
  const candidateReal = await resolveRealPath(candidatePath);

  if (!isInside(candidateReal, rootReal)) {
    return {
      ok: false,
      code: "FORBIDDEN_AUTOMATIC",
      reason: `Path escapes allowed root. candidate=${candidateReal} root=${rootReal}`,
    };
  }

  // Reject if the candidate itself is a symlink that escapes after final resolve
  // (already covered by realpath) or if any immediate symlink target escapes.
  if (await exists(resolve(candidatePath))) {
    try {
      const st = await lstat(resolve(candidatePath));
      if (st.isSymbolicLink()) {
        const linkReal = await realpath(resolve(candidatePath));
        if (!isInside(linkReal, rootReal)) {
          return {
            ok: false,
            code: "FORBIDDEN_AUTOMATIC",
            reason: `Symlink escapes allowed root: ${linkReal}`,
          };
        }
      }
    } catch {
      // ignore lstat races; realpath check already applied
    }
  }

  return { ok: true, realPath: candidateReal, rootRealPath: rootReal };
}

export async function assertPathInsideWorktreeRoot(
  candidatePath: string,
  worktreeRoot: string,
): Promise<PathContainmentResult> {
  return assertPathInsideRoot(candidatePath, worktreeRoot);
}

export async function assertPathInsideTaskWorktree(
  candidatePath: string,
  taskWorktree: string,
): Promise<PathContainmentResult> {
  return assertPathInsideRoot(candidatePath, taskWorktree);
}

export async function assertNotControlPlaneWorkspace(
  workspace: string,
  controlPlaneRoot: string,
): Promise<PathContainmentResult> {
  const workspaceReal = await resolveRealPath(workspace);
  const controlReal = await resolveRealPath(controlPlaneRoot);
  if (workspaceReal === controlReal) {
    return {
      ok: false,
      code: "FORBIDDEN_AUTOMATIC",
      reason: "Execution on control-plane working tree is forbidden.",
    };
  }
  return { ok: true, realPath: workspaceReal, rootRealPath: controlReal };
}
