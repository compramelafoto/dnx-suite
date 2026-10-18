import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/token-hash";
import { buildInviteUrl, createInviteToken } from "./invite-token";

describe("invite-token", () => {
  it("genera un token largo y su hash", () => {
    const { token, tokenHash } = createInviteToken();
    expect(token).toMatch(/^[a-f0-9]{48}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(createInviteToken().token).not.toBe(token);
  });
  it("arma la URL", () => {
    expect(buildInviteUrl("https://www.compramelafoto.com", "abc")).toBe("https://www.compramelafoto.com/agencias/unirse?token=abc");
    expect(buildInviteUrl("https://www.compramelafoto.com/", "abc")).toBe("https://www.compramelafoto.com/agencias/unirse?token=abc");
  });
});
