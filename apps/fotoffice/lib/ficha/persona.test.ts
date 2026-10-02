import { describe, expect, it } from "vitest";
import { duenoDe, wherePersona } from "./persona";

describe("duenoDe", () => {
  it("el cliente manda cuando existe", () => expect(duenoDe({ clientId: "c1", memberId: "m1" })).toEqual({ clientId: "c1" }));
  it("un socio sin cliente es dueño de lo suyo", () => expect(duenoDe({ clientId: null, memberId: "m1" })).toEqual({ memberId: "m1" }));
  it("sin ninguno es un error de programación", () => expect(() => duenoDe({ clientId: null, memberId: null })).toThrow());
});

describe("wherePersona", () => {
  it("lee los dos lados y siempre filtra por workspace", () =>
    expect(wherePersona("w1", { clientId: "c1", memberId: "m1" })).toEqual({ workspaceId: "w1", OR: [{ clientId: "c1" }, { memberId: "m1" }] }));
  it("un solo lado", () => expect(wherePersona("w1", { clientId: null, memberId: "m1" })).toEqual({ workspaceId: "w1", OR: [{ memberId: "m1" }] }));
});
