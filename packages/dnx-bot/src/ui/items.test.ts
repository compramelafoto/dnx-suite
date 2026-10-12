import { describe, expect, it } from "vitest";
import { applyDecision, applySseEvent, dropEmptyBot, type Item } from "./items";

describe("items de la burbuja", () => {
  it("acumula deltas en el último mensaje del bot", () => {
    let items: Item[] = [{ kind: "user", text: "hola" }, { kind: "bot", text: "" }];
    items = applySseEvent(items, "text", { delta: "Ho" });
    items = applySseEvent(items, "text", { delta: "la" });
    expect(items[1]).toEqual({ kind: "bot", text: "Hola" });
  });
  it("una propuesta queda pendiente y abre un bot vacío que luego se descarta", () => {
    const items = applySseEvent([], "proposal", { actionId: "a1", summary: "Precio $6.000" });
    expect(items[0]).toMatchObject({ kind: "proposal", state: "pending" });
    expect(dropEmptyBot(items)).toHaveLength(1);
  });
  it("el error ofrece ticket", () => {
    const items = applySseEvent([], "error", { message: "Falló", offerTicket: true });
    expect(items[0]).toEqual({ kind: "notice", text: "Falló", offerTicket: true });
  });
  it("confirmar con deshacer disponible; rechazar no", () => {
    const base = applySseEvent([], "proposal", { actionId: "a1", summary: "x" });
    expect(applyDecision(base, "a1", "confirmar", { ok: true, message: "Listo", canUndo: true })[0]).toMatchObject({ state: "done", canUndo: true });
    expect(applyDecision(base, "a1", "rechazar", { ok: true, message: "Ok", canUndo: true })[0]).toMatchObject({ state: "rejected", canUndo: false });
    expect(applyDecision(base, "a1", "confirmar", { ok: false, message: "No" })[0]).toMatchObject({ state: "failed" });
  });
  it("un 409 tardío después de confirmar no pisa done ni canUndo", () => {
    const base = applySseEvent([], "proposal", { actionId: "a1", summary: "x" });
    const done = applyDecision(base, "a1", "confirmar", { ok: true, message: "Listo", canUndo: true });
    const late = applyDecision(done, "a1", "confirmar", { ok: false, message: "Ya ejecutada" });
    expect(late).toEqual(done);
    expect(applyDecision(done, "a1", "rechazar", { ok: true, message: "x" })).toEqual(done);
  });
  it("deshacer solo aplica sobre done", () => {
    const base = applySseEvent([], "proposal", { actionId: "a1", summary: "x" });
    expect(applyDecision(base, "a1", "deshacer", { ok: true, message: "x" })).toEqual(base);
    const done = applyDecision(base, "a1", "confirmar", { ok: true, message: "Listo", canUndo: true });
    expect(applyDecision(done, "a1", "deshacer", { ok: true, message: "Deshecho" })[0]).toMatchObject({ state: "done", result: "Deshecho", canUndo: false });
  });
  it("deshacer rechazado (409) queda done, muestra el motivo y oculta Deshacer", () => {
    const base = applySseEvent([], "proposal", { actionId: "a1", summary: "x" });
    const done = applyDecision(base, "a1", "confirmar", { ok: true, message: "Listo", canUndo: true });
    const r = applyDecision(done, "a1", "deshacer", { ok: false, message: "Ya no se puede deshacer." })[0];
    expect(r).toMatchObject({ state: "done", result: "Ya no se puede deshacer.", canUndo: false });
  });
  it("deshacer que falló pero se puede reintentar mantiene el botón", () => {
    const base = applySseEvent([], "proposal", { actionId: "a1", summary: "x" });
    const done = applyDecision(base, "a1", "confirmar", { ok: true, message: "Listo", canUndo: true });
    const r = applyDecision(done, "a1", "deshacer", { ok: false, message: "No pude deshacerlo.", canUndo: true })[0];
    expect(r).toMatchObject({ state: "done", result: "No pude deshacerlo.", canUndo: true });
  });
});
