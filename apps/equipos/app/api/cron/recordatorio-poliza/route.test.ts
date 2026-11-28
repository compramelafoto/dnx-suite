import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn(), email: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: { gearOwnerSettings: { findMany: m.findMany, update: m.update } },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-11T15:00:00.000Z"));
  process.env.CRON_SECRET = "s";
  m.email.mockResolvedValue({ success: true });
});
afterEach(() => vi.useRealTimers());

describe("cron recordatorio-poliza", () => {
  it("manda el próximo aniversario, no la fecha original cargada", async () => {
    m.findMany.mockResolvedValue([
      {
        id: 1,
        policyRenewalDate: new Date("2024-01-10T12:00:00.000Z"),
        lastRenewalReminderAt: null,
        user: { email: "a@t.com", name: "Ana" },
      },
    ]);
    const res = await GET(
      new Request("http://x/api", { headers: { authorization: "Bearer s" } }) as never,
    );
    expect((await res.json()).enviados).toBe(1);
    expect(m.email).toHaveBeenCalledWith(
      "a@t.com",
      "recordatorio_poliza",
      expect.objectContaining({ fecha: "10/1/27" }),
    );
    expect(m.update).toHaveBeenCalled();
  });
});
