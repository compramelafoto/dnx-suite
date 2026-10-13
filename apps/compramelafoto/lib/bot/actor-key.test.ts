import { describe, expect, it } from "vitest";
import { claveInvitado, claveIp, claveUsuario, PREFIJO_INVITADO } from "./actor-key";

describe("actor-key", () => {
  it("arma las tres claves", () => {
    expect(claveUsuario(79)).toBe("u:79");
    expect(claveInvitado("ab12")).toBe("g:ab12");
    expect(claveIp("ff00")).toBe("ip:ff00");
    expect(claveInvitado("x").startsWith(PREFIJO_INVITADO)).toBe(true);
  });
});
