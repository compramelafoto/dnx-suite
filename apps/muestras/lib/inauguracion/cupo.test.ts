import { describe, expect, it, vi } from "vitest";
import { promoverEnTx } from "./cupo";

const tx = () => ({ culturalActivityRsvp: { findMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } });

describe("promoverEnTx", () => {
  it("lee confirmadas y espera en orden de llegada y pasa a quien entra", async () => {
    const t = tx();
    t.culturalActivityRsvp.findMany.mockResolvedValue([
      { id: "c1", status: "CONFIRMED", companions: 1, email: null, name: "A" },
      { id: "w1", status: "WAITLIST", companions: 2, email: "w1@x.com", name: "B" },
      { id: "w2", status: "WAITLIST", companions: 0, email: null, name: "C" },
    ]);
    const ahora = new Date("2026-11-01T12:00:00Z");
    expect(await promoverEnTx(t as never, "a1", 4, ahora)).toEqual([{ id: "w2", email: null, name: "C" }]);
    expect(t.culturalActivityRsvp.findMany.mock.calls[0]![0]).toMatchObject({ where: { activityId: "a1", status: { in: ["CONFIRMED", "WAITLIST"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(t.culturalActivityRsvp.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["w2"] }, status: "WAITLIST" }, data: { status: "CONFIRMED", promotedAt: ahora } });
  });
  it("sin cupo pasan todas; sin espera no escribe", async () => {
    const t = tx();
    t.culturalActivityRsvp.findMany.mockResolvedValue([{ id: "c1", status: "CONFIRMED", companions: 0, email: null, name: "A" }]);
    expect(await promoverEnTx(t as never, "a1", null, new Date())).toEqual([]);
    expect(t.culturalActivityRsvp.updateMany).not.toHaveBeenCalled();
  });
});
