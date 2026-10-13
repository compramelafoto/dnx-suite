import { describe, expect, it } from "vitest";
import { encodeSse, parseSseBuffer } from "./sse";

describe("sse", () => {
  it("ida y vuelta", () => {
    const raw = encodeSse("text", { delta: "hola\nchau" }) + encodeSse("done", {});
    const { events, rest } = parseSseBuffer(raw);
    expect(events).toEqual([{ event: "text", data: { delta: "hola\nchau" } }, { event: "done", data: {} }]);
    expect(rest).toBe("");
  });
  it("guarda el fragmento incompleto", () => {
    const full = encodeSse("text", { delta: "a" });
    const { events, rest } = parseSseBuffer(full.slice(0, 10));
    expect(events).toEqual([]);
    expect(rest).toBe(full.slice(0, 10));
  });
});
