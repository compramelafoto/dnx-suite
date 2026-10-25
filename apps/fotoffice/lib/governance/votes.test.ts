import { describe, expect, it } from "vitest";
import { isVotingOpen, tally, tallyLabel, votingRoll, voterRoster } from "./votes";

describe("votación", () => {
  it("abierta sólo mientras espera una decisión", () => {
    expect(isVotingOpen("PROPOSED")).toBe(true);
    expect(isVotingOpen("IN_REVIEW")).toBe(true);
    expect(isVotingOpen("POSTPONED")).toBe(true);
    expect(isVotingOpen("APPROVED")).toBe(false);
    expect(isVotingOpen("MEMBER_PROPOSAL")).toBe(false);
  });

  it("padrón: vota cada persona una vez; los cargos sin voto no cuentan", () => {
    const roll = votingRoll([
      { votes: true, userId: 1, memberId: "a", termId: "t1" },
      { votes: true, userId: 1, memberId: "a", termId: "t2" },
      { votes: true, userId: null, memberId: "b", termId: "t3" },
      { votes: false, userId: 3, memberId: "c", termId: "t4" },
    ]);
    expect([...roll.userIds]).toEqual([1]);
    expect(roll.total).toBe(2);
  });

  it("el porcentaje es sobre los habilitados y los ex integrantes no cuentan", () => {
    const t = tally(
      [
        { voterUserId: 1, value: "FOR" },
        { voterUserId: 2, value: "AGAINST" },
        { voterUserId: 99, value: "FOR" },
      ],
      new Set([1, 2, 3]),
      4,
    );
    expect(t).toEqual({ for: 1, against: 1, notVoted: 2, eligible: 4, percentFor: 25 });
    expect(tallyLabel(t)).toBe("1 de 4 a favor");
    expect(tallyLabel({ for: 0, eligible: 0 })).toBe("Sin votación");
  });
});

describe("voterRoster", () => {
  const h = (userId: number | null, name: string, votes = true, memberId: string | null = null) => ({
    votes,
    userId,
    memberId,
    termId: `t-${name}`,
    displayName: name,
    officeName: "Vocal",
  });
  it("una persona una vez, ordenados: a favor, en contra, faltan", () => {
    const r = voterRoster(
      [h(1, "Ana"), h(1, "Ana"), h(2, "Beto"), h(3, "Caro"), h(null, "Dani", true, "m4"), h(5, "Eli", false)],
      [
        { voterUserId: 2, value: "AGAINST" },
        { voterUserId: 3, value: "FOR" },
      ],
    );
    expect(r.map((x) => [x.name, x.value, x.hasAccount])).toEqual([
      ["Caro", "FOR", true],
      ["Beto", "AGAINST", true],
      ["Ana", null, true],
      ["Dani", null, false],
    ]);
  });
});
