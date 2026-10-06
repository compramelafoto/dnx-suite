import { describe, expect, it } from "vitest";
import { canWithdrawComment, commentCountLabel, MAX_COMMENT, parseCommentBody } from "./comments";

describe("parseCommentBody", () => {
  it("recorta y acepta", () => {
    expect(parseCommentBody("  A favor si baja el costo  ")).toEqual({ ok: true, body: "A favor si baja el costo" });
  });
  it("rechaza vacío y demasiado largo", () => {
    expect(parseCommentBody("   ").ok).toBe(false);
    expect(parseCommentBody(null).ok).toBe(false);
    expect(parseCommentBody("x".repeat(MAX_COMMENT + 1)).ok).toBe(false);
  });
});

describe("canWithdrawComment", () => {
  it("sólo quien la escribió, y una sola vez", () => {
    expect(canWithdrawComment({ authorUserId: 4, withdrawnAt: null }, 4)).toBe(true);
    expect(canWithdrawComment({ authorUserId: 4, withdrawnAt: null }, 5)).toBe(false);
    expect(canWithdrawComment({ authorUserId: 4, withdrawnAt: new Date() }, 4)).toBe(false);
  });
});

describe("commentCountLabel", () => {
  it("singular y plural", () => {
    expect(commentCountLabel(0)).toBe("Sin opiniones");
    expect(commentCountLabel(1)).toBe("1 opinión");
    expect(commentCountLabel(3)).toBe("3 opiniones");
  });
});
