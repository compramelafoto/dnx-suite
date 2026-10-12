import { describe, expect, it } from "vitest";
import { argentinaDay, argentinaMonthPrefix } from "./dia-argentino";

describe("día argentino", () => {
  it("02:00 UTC del 12/10 todavía es 11/10 en Argentina", () => {
    expect(argentinaDay(new Date("2026-10-12T02:00:00Z"))).toBe("2026-10-11");
  });
  it("mes", () => {
    expect(argentinaMonthPrefix(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
  });
});
