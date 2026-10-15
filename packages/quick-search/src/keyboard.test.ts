import { describe, expect, it } from "vitest";
import { moveSelection, shouldIgnoreShortcut } from "./keyboard";

describe("moveSelection", () => {
  it("baja y sube de a uno", () => {
    expect(moveSelection(0, 5, 1)).toBe(1);
    expect(moveSelection(3, 5, -1)).toBe(2);
  });

  it("se frena en los extremos en vez de dar la vuelta", () => {
    expect(moveSelection(0, 5, -1)).toBe(0);
    expect(moveSelection(4, 5, 1)).toBe(4);
  });

  it("con la lista vacía se queda en cero", () => {
    expect(moveSelection(0, 0, 1)).toBe(0);
    expect(moveSelection(0, 0, -1)).toBe(0);
  });
});

describe("shouldIgnoreShortcut", () => {
  it("no dispara si estás escribiendo en un campo", () => {
    expect(shouldIgnoreShortcut("INPUT")).toBe(true);
    expect(shouldIgnoreShortcut("textarea")).toBe(true);
    expect(shouldIgnoreShortcut("SELECT")).toBe(true);
    expect(shouldIgnoreShortcut("DIV", true)).toBe(true);
  });

  it("dispara en cualquier otro lado", () => {
    expect(shouldIgnoreShortcut("DIV")).toBe(false);
    expect(shouldIgnoreShortcut("BODY")).toBe(false);
    expect(shouldIgnoreShortcut(undefined)).toBe(false);
  });
});
