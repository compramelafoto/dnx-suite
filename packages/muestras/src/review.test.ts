import { describe, expect, it } from "vitest";
import { canEdit, canPerform, nextStatus, type ActivityForReview } from "./review";

const owner = { userId: 7, isSuperAdmin: false };
const other = { userId: 8, isSuperAdmin: false };
const admin = { userId: 1, isSuperAdmin: true };
const base: ActivityForReview = { reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false };
const st = (s: ActivityForReview["reviewStatus"], extra: Partial<ActivityForReview> = {}) => ({ ...base, reviewStatus: s, ...extra });

describe("transiciones", () => {
  it("borrador → en revisión al enviar", () => expect(nextStatus("submit", "DRAFT")).toBe("IN_REVIEW"));
  it("rechazada → en revisión al reenviar", () => expect(nextStatus("submit", "REJECTED")).toBe("IN_REVIEW"));
  it("en revisión → aprobada", () => expect(nextStatus("approve", "IN_REVIEW")).toBe("APPROVED"));
  it("en revisión → rechazada", () => expect(nextStatus("reject", "IN_REVIEW")).toBe("REJECTED"));
  it("aprobada → despublicada", () => expect(nextStatus("unpublish", "APPROVED")).toBe("UNPUBLISHED"));
  it("despublicada → aprobada al republicar", () => expect(nextStatus("republish", "UNPUBLISHED")).toBe("APPROVED"));
  it("cancelar no cambia el estado de revisión", () => expect(nextStatus("cancel", "APPROVED")).toBe("APPROVED"));
  it("una transición inválida tira error", () => expect(() => nextStatus("approve", "DRAFT")).toThrow());
});

describe("permisos (etapa 1: sólo el super admin revisa)", () => {
  it("quien propuso puede enviar su borrador", () => expect(canPerform("submit", st("DRAFT"), owner).ok).toBe(true));
  it("otro usuario no puede enviar un borrador ajeno", () => expect(canPerform("submit", st("DRAFT"), other).ok).toBe(false));
  it("el super admin aprueba", () => expect(canPerform("approve", st("IN_REVIEW"), admin).ok).toBe(true));
  it("quien propuso no puede aprobarse a sí mismo", () => expect(canPerform("approve", st("IN_REVIEW"), owner).ok).toBe(false));
  it("no se aprueba algo que no está en revisión", () => {
    const r = canPerform("approve", st("DRAFT"), admin);
    expect(r.ok).toBe(false);
  });
  it("sólo quien revisa despublica", () => {
    expect(canPerform("unpublish", st("APPROVED"), owner).ok).toBe(false);
    expect(canPerform("unpublish", st("APPROVED"), admin).ok).toBe(true);
  });
  it("quien propuso puede cancelar una aprobada; no dos veces", () => {
    expect(canPerform("cancel", st("APPROVED"), owner).ok).toBe(true);
    expect(canPerform("cancel", st("APPROVED", { isCancelled: true }), owner).ok).toBe(false);
  });
  it("no se cancela algo que no está publicado", () => expect(canPerform("cancel", st("DRAFT"), owner).ok).toBe(false));
});

describe("edición", () => {
  it("quien propuso edita en borrador, rechazada y aprobada", () => {
    expect(canEdit(st("DRAFT"), owner)).toBe(true);
    expect(canEdit(st("REJECTED"), owner)).toBe(true);
    expect(canEdit(st("APPROVED"), owner)).toBe(true);
  });
  it("no se edita mientras está en revisión ni despublicada", () => {
    expect(canEdit(st("IN_REVIEW"), owner)).toBe(false);
    expect(canEdit(st("UNPUBLISHED"), owner)).toBe(false);
  });
  it("el super admin edita siempre; un tercero nunca", () => {
    expect(canEdit(st("IN_REVIEW"), admin)).toBe(true);
    expect(canEdit(st("DRAFT"), other)).toBe(false);
  });
});
