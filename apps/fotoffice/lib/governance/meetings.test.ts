import { describe, expect, it } from "vitest";
import { canApplyOutcome, isMinutesLocked, moveInOrder, parseMeetingForm, targetStatusFor } from "./meetings";

const form = (c: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(c)) fd.set(k, v);
  return fd;
};

describe("reuniones", () => {
  it("lo resuelto mueve el proyecto", () => {
    expect(targetStatusFor("APPROVED", "IN_REVIEW")).toBe("APPROVED");
    expect(targetStatusFor("CONTINUES", "PROPOSED")).toBe("IN_REVIEW");
    expect(targetStatusFor("CONTINUES", "IN_REVIEW")).toBeNull();
    expect(targetStatusFor("POSTPONED", "POSTPONED")).toBeNull();
  });

  it("no aplica resultados imposibles", () => {
    expect(canApplyOutcome("APPROVED", "PROPOSED")).toBe(true);
    expect(canApplyOutcome("APPROVED", "DONE")).toBe(false);
    expect(canApplyOutcome("CONTINUES", "APPROVED")).toBe(false);
    expect(canApplyOutcome("CONTINUES", "POSTPONED")).toBe(true);
  });

  it("el acta aprobada queda fija", () => {
    expect(isMinutesLocked("MINUTES_APPROVED")).toBe(true);
    expect(isMinutesLocked("HELD")).toBe(false);
  });

  it("lee la fecha en hora argentina y pone un título por defecto", () => {
    const r = parseMeetingForm(form({ scheduledAt: "2026-10-15T19:30", location: "Sede" }));
    expect(r.ok && r.values.scheduledAt.toISOString()).toBe("2026-10-15T22:30:00.000Z");
    expect(r.ok && r.values.title).toBe("Reunión de comisión");
    expect(parseMeetingForm(form({})).ok).toBe(false);
  });

  it("reordena con el vecino", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "c", "down")).toBeNull();
  });
});
