import { describe, expect, it } from "vitest";
import { parseResendEvent, percent } from "./webhook-events";

const now = new Date("2026-10-05T20:00:00Z");

describe("avisos de Resend", () => {
  it("traduce cada tipo a su columna", () => {
    expect(parseResendEvent({ type: "email.opened", created_at: "2026-10-05T19:00:00Z", data: { email_id: "e1" } }, now)).toEqual({
      field: "openedAt",
      emailId: "e1",
      at: new Date("2026-10-05T19:00:00Z"),
      optOut: false,
    });
    expect(parseResendEvent({ type: "email.bounced", data: { email_id: "e2" } }, now)).toMatchObject({ field: "bouncedAt", optOut: true, at: now });
    expect(parseResendEvent({ type: "email.complained", data: { email_id: "e3" } }, now)?.optOut).toBe(true);
  });

  it("ignora lo que no nos importa o viene mal", () => {
    expect(parseResendEvent({ type: "email.sent", data: { email_id: "e1" } }, now)).toBeNull();
    expect(parseResendEvent({ type: "email.opened", data: {} }, now)).toBeNull();
    expect(parseResendEvent(null, now)).toBeNull();
    expect(parseResendEvent({ type: "email.opened", created_at: "basura", data: { email_id: "e" } }, now)?.at).toEqual(now);
  });

  it("porcentajes", () => {
    expect(percent(1, 3)).toBe("33%");
    expect(percent(0, 0)).toBe("—");
  });
});
