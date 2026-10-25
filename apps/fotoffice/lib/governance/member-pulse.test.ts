import { describe, expect, it } from "vitest";
import { isMemberPollOpen, memberPulse, memberPulseLabel, memberPulseTone, rankByMemberSupport } from "./member-pulse";

describe("isMemberPollOpen", () => {
  it("sólo en proyectos visibles y vivos", () => {
    expect(isMemberPollOpen({ status: "PROPOSED", visibleToMembers: true })).toBe(true);
    expect(isMemberPollOpen({ status: "IN_PROGRESS", visibleToMembers: true })).toBe(true);
    expect(isMemberPollOpen({ status: "PROPOSED", visibleToMembers: false })).toBe(false);
    for (const cerrado of ["DONE", "CANCELLED", "REJECTED", "ARCHIVED", "MEMBER_PROPOSAL"]) {
      expect(isMemberPollOpen({ status: cerrado, visibleToMembers: true })).toBe(false);
    }
  });
});

describe("memberPulse", () => {
  it("calcula el porcentaje sobre los que votaron", () => {
    expect(memberPulse({ for: 18, against: 4 })).toEqual({ for: 18, against: 4, total: 22, percentFor: 82 });
    expect(memberPulse({ for: 0, against: 0 }).percentFor).toBe(0);
  });
  it("se lee bien", () => {
    expect(memberPulseLabel(memberPulse({ for: 0, against: 0 }))).toBe("Ningún socio votó todavía");
    expect(memberPulseLabel(memberPulse({ for: 1, against: 0 }))).toBe("1 de 1 socio lo apoya (100 %)");
    expect(memberPulseLabel(memberPulse({ for: 18, against: 4 }))).toBe("18 de 22 socios lo apoyan (82 %)");
  });
  it("color según el apoyo", () => {
    expect(memberPulseTone(memberPulse({ for: 0, against: 0 }))).toBe("neutral");
    expect(memberPulseTone(memberPulse({ for: 8, against: 2 }))).toBe("success");
    expect(memberPulseTone(memberPulse({ for: 5, against: 5 }))).toBe("warning");
    expect(memberPulseTone(memberPulse({ for: 1, against: 9 }))).toBe("danger");
  });
});

describe("rankByMemberSupport", () => {
  it("ordena por apoyos y deja afuera los que nadie votó", () => {
    const r = rankByMemberSupport([
      { id: "a", pulse: memberPulse({ for: 2, against: 0 }) },
      { id: "b", pulse: memberPulse({ for: 32, against: 8 }) },
      { id: "c", pulse: memberPulse({ for: 0, against: 0 }) },
      { id: "d", pulse: memberPulse({ for: 2, against: 3 }) },
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "a", "d"]);
  });
});
