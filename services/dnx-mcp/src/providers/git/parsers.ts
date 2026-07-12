import {
  type AheadBehind,
  type GitCommit,
  type GitDiffStat,
  type GitRemote,
  type GitStatus,
  gitCommitSchema,
  gitDiffStatSchema,
  gitRemoteSchema,
  gitStatusSchema,
} from "./types/index.js";

export function parsePorcelainStatus(stdout: string, branch: string): GitStatus {
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];

  for (const line of stdout.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const indexStatus = line[0] ?? " ";
    const workTreeStatus = line[1] ?? " ";
    const filePath = line.slice(3).trim();

    if (!filePath) {
      continue;
    }

    if (indexStatus === "?" && workTreeStatus === "?") {
      untracked.push(filePath);
      continue;
    }

    if (indexStatus !== " " && indexStatus !== "?") {
      staged.push(filePath);
    }

    if (workTreeStatus !== " " && workTreeStatus !== "?") {
      unstaged.push(filePath);
    }
  }

  const dirty = staged.length > 0 || unstaged.length > 0 || untracked.length > 0;

  return gitStatusSchema.parse({
    branch,
    dirty,
    staged,
    unstaged,
    untracked,
  });
}

export function parseCommitLine(line: string): GitCommit | null {
  const parts = line.split("\x1f");
  if (parts.length < 6) {
    return null;
  }

  const [hash, shortHash, author, email, date, ...subjectParts] = parts;
  if (!hash || !shortHash || !author || !date) {
    return null;
  }

  return gitCommitSchema.parse({
    hash,
    shortHash,
    author,
    email: email || undefined,
    date,
    subject: subjectParts.join("\x1f"),
  });
}

export function parseCommits(stdout: string): GitCommit[] {
  return stdout
    .split("\n")
    .map((line) => parseCommitLine(line.trim()))
    .filter((commit): commit is GitCommit => commit !== null);
}

export function parseRemotes(stdout: string): GitRemote[] {
  const remoteMap = new Map<string, { fetchUrl?: string; pushUrl?: string }>();

  for (const line of stdout.split("\n")) {
    const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line.trim());
    if (!match) {
      continue;
    }

    const [, name, url, kind] = match;
    if (!name || !url || !kind) {
      continue;
    }

    const current = remoteMap.get(name) ?? {};
    if (kind === "fetch") {
      current.fetchUrl = url;
    } else {
      current.pushUrl = url;
    }
    remoteMap.set(name, current);
  }

  return [...remoteMap.entries()]
    .filter(([, value]) => value.fetchUrl)
    .map(([name, value]) =>
      gitRemoteSchema.parse({
        name,
        fetchUrl: value.fetchUrl,
        pushUrl: value.pushUrl,
      }),
    );
}

export function parseDiffStat(stdout: string): GitDiffStat {
  const lines = stdout.trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    return gitDiffStatSchema.parse({
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      summary: "",
    });
  }

  const summaryLine = lines.at(-1) ?? "";
  const fileLines = lines.slice(0, -1);
  const summaryMatch =
    /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/.exec(
      summaryLine,
    );

  return gitDiffStatSchema.parse({
    filesChanged: summaryMatch ? Number(summaryMatch[1]) : fileLines.length,
    insertions: summaryMatch?.[2] ? Number(summaryMatch[2]) : 0,
    deletions: summaryMatch?.[3] ? Number(summaryMatch[3]) : 0,
    summary: summaryLine,
  });
}

export function parseAheadBehind(stdout: string, upstream: string | null): AheadBehind {
  const [behindRaw, aheadRaw] = stdout.trim().split(/\s+/);
  return {
    ahead: Number(aheadRaw ?? 0),
    behind: Number(behindRaw ?? 0),
    upstream,
  };
}

export function parseNameOnlyFiles(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
