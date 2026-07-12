import { describe, expect, it } from "vitest";
import {
  parseAheadBehind,
  parseCommits,
  parseDiffStat,
  parsePorcelainStatus,
  parseRemotes,
} from "./parsers.js";

describe("git parsers", () => {
  it("parsea status porcelain", () => {
    const status = parsePorcelainStatus("M  src/app.ts\n M README.md\n?? new.txt\n", "main");

    expect(status.branch).toBe("main");
    expect(status.dirty).toBe(true);
    expect(status.staged).toEqual(["src/app.ts"]);
    expect(status.unstaged).toEqual(["README.md"]);
    expect(status.untracked).toEqual(["new.txt"]);
  });

  it("parsea commits con formato delimitado", () => {
    const commits = parseCommits(
      "abc123\x1fabc12\x1fDaniel\x1fdaniel@test.com\x1f2026-01-01T00:00:00Z\x1fInitial commit",
    );

    expect(commits).toHaveLength(1);
    expect(commits[0]?.subject).toBe("Initial commit");
    expect(commits[0]?.shortHash).toBe("abc12");
  });

  it("parsea remotes", () => {
    const remotes = parseRemotes(
      "origin\thttps://github.com/org/repo.git (fetch)\norigin\thttps://github.com/org/repo.git (push)\n",
    );

    expect(remotes).toHaveLength(1);
    expect(remotes[0]?.name).toBe("origin");
    expect(remotes[0]?.fetchUrl).toContain("github.com");
  });

  it("parsea diff stat", () => {
    const stat = parseDiffStat(" src/a.ts | 2 ++\n 1 file changed, 2 insertions(+)");
    expect(stat.filesChanged).toBe(1);
    expect(stat.insertions).toBe(2);
  });

  it("parsea ahead/behind", () => {
    const result = parseAheadBehind("2\t5", "origin/main");
    expect(result.behind).toBe(2);
    expect(result.ahead).toBe(5);
    expect(result.upstream).toBe("origin/main");
  });
});
