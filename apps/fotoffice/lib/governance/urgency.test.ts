import { describe, expect, it } from "vitest";
import { isTaskOverdue, progressOf, progressPercent, sortByPriority, urgencyFor } from "./urgency";

const ahora = new Date("2026-10-05T15:00:00Z");
const enDias = (d: number) => new Date(ahora.getTime() + d * 24 * 60 * 60 * 1000);

describe("urgencia", () => {
  it("colorea por días hasta la fecha límite", () => {
    expect(urgencyFor(null, ahora)).toBe("gray");
    expect(urgencyFor(enDias(-3), ahora)).toBe("red");
    expect(urgencyFor(enDias(10), ahora)).toBe("red");
    expect(urgencyFor(enDias(15), ahora)).toBe("yellow");
    expect(urgencyFor(enDias(45), ahora)).toBe("yellow");
    expect(urgencyFor(enDias(46), ahora)).toBe("green");
  });

  it("ordena lo abierto primero, después por urgencia y por fecha", () => {
    const base = { createdAt: ahora };
    const lista = [
      { id: "verde", status: "PROPOSED" as const, deadlineAt: enDias(90), ...base },
      { id: "terminado", status: "DONE" as const, deadlineAt: enDias(1), ...base },
      { id: "sin-fecha", status: "APPROVED" as const, deadlineAt: null, ...base },
      { id: "rojo-2", status: "IN_PROGRESS" as const, deadlineAt: enDias(10), ...base },
      { id: "rojo-1", status: "PROPOSED" as const, deadlineAt: enDias(2), ...base },
      { id: "amarillo", status: "IN_REVIEW" as const, deadlineAt: enDias(30), ...base },
    ];
    expect(sortByPriority(lista, ahora).map((p) => p.id)).toEqual([
      "rojo-1",
      "rojo-2",
      "amarillo",
      "verde",
      "sin-fecha",
      "terminado",
    ]);
  });
});

describe("tareas", () => {
  it("vencida si la fecha pasó y sigue abierta", () => {
    expect(isTaskOverdue({ status: "PENDING", dueAt: enDias(-1) }, ahora)).toBe(true);
    expect(isTaskOverdue({ status: "IN_PROGRESS", dueAt: enDias(-1) }, ahora)).toBe(true);
    expect(isTaskOverdue({ status: "DONE", dueAt: enDias(-1) }, ahora)).toBe(false);
    expect(isTaskOverdue({ status: "PENDING", dueAt: enDias(1) }, ahora)).toBe(false);
    expect(isTaskOverdue({ status: "PENDING", dueAt: null }, ahora)).toBe(false);
  });

  it("el avance cuenta hechas y no hechas", () => {
    const p = progressOf([
      { status: "DONE" },
      { status: "NOT_DONE" },
      { status: "PENDING" },
      { status: "IN_PROGRESS" },
    ]);
    expect(p).toEqual({ closed: 2, total: 4 });
    expect(progressPercent(p)).toBe(50);
    expect(progressPercent({ closed: 0, total: 0 })).toBe(0);
  });
});
