import { describe, expect, it } from "vitest";
import {
  allowedTaskStatuses,
  canCloseTasks,
  canEditStructure,
  canTransition,
  isClosed,
  isCommissionDecision,
  nextStatuses,
  requiresReason,
} from "./lifecycle";
import { PROJECT_STATUSES } from "./constants";

describe("ciclo de vida del proyecto", () => {
  it("sigue el recorrido normal", () => {
    expect(canTransition("PROPOSED", "IN_REVIEW")).toBe(true);
    expect(canTransition("IN_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "DONE")).toBe(true);
  });

  it("una propuesta de socio se acepta o se archiva, nada más", () => {
    expect(nextStatuses("MEMBER_PROPOSAL")).toEqual(["PROPOSED", "ARCHIVED"]);
    expect(canTransition("MEMBER_PROPOSAL", "APPROVED")).toBe(false);
  });

  it("lo postergado vuelve a tratamiento", () => {
    expect(canTransition("POSTPONED", "IN_REVIEW")).toBe(true);
  });

  it("no se sale de un estado cerrado", () => {
    for (const cerrado of ["ARCHIVED", "REJECTED", "DONE", "CANCELLED"] as const) {
      expect(isClosed(cerrado)).toBe(true);
      expect(nextStatuses(cerrado)).toEqual([]);
    }
  });

  it("no se vuelve atrás de aprobado a tratamiento", () => {
    expect(canTransition("APPROVED", "IN_REVIEW")).toBe(false);
    expect(canTransition("IN_PROGRESS", "APPROVED")).toBe(false);
  });

  it("todo estado activo se puede cancelar", () => {
    for (const st of PROJECT_STATUSES) {
      if (isClosed(st) || st === "MEMBER_PROPOSAL") continue;
      expect(canTransition(st, "CANCELLED")).toBe(true);
    }
  });

  it("aprobar, rechazar y postergar son decisiones de comisión", () => {
    expect(isCommissionDecision("APPROVED")).toBe(true);
    expect(isCommissionDecision("REJECTED")).toBe(true);
    expect(isCommissionDecision("POSTPONED")).toBe(true);
    expect(isCommissionDecision("IN_PROGRESS")).toBe(false);
  });

  it("archivar, rechazar y cancelar piden motivo", () => {
    expect(requiresReason("ARCHIVED")).toBe(true);
    expect(requiresReason("REJECTED")).toBe(true);
    expect(requiresReason("CANCELLED")).toBe(true);
    expect(requiresReason("APPROVED")).toBe(false);
  });

  it("las etapas se arman desde propuesto; las tareas se cierran desde aprobado", () => {
    expect(canEditStructure("MEMBER_PROPOSAL")).toBe(false);
    expect(canEditStructure("PROPOSED")).toBe(true);
    expect(canEditStructure("DONE")).toBe(false);
    expect(canCloseTasks("PROPOSED")).toBe(false);
    expect(canCloseTasks("APPROVED")).toBe(true);
    expect(allowedTaskStatuses("IN_REVIEW")).toEqual(["PENDING", "IN_PROGRESS"]);
    expect(allowedTaskStatuses("IN_PROGRESS")).toContain("DONE");
    expect(allowedTaskStatuses("CANCELLED")).toEqual([]);
  });
});
