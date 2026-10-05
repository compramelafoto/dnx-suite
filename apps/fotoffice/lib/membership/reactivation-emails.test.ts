import { describe, expect, it } from "vitest";
import { buildReactivationContactEmail, buildSelfReactivatedEmail } from "./reactivation-emails";

const base = {
  institution: "SFPR",
  personName: "Gabriel Villagómez",
  memberNumber: "714",
  memberUrl: "https://fotoffice.com/members/m-1",
  signature: null,
};

describe("avisos de reactivación", () => {
  it("el pedido de contacto dice quién, con qué correo y cuánto debe", () => {
    const e = buildReactivationContactEmail({ ...base, email: "g@x.com", debtLabel: "$ 32.000,00" });
    expect(e.subject).toBe("SFPR: Gabriel Villagómez quiere reactivar su ficha");
    expect(e.text).toContain("socio 714");
    expect(e.text).toContain("$ 32.000,00");
    expect(e.text).toContain("g@x.com");
    expect(e.html).toContain("https://fotoffice.com/members/m-1");
  });

  it("sin deuda no inventa un importe", () => {
    const e = buildReactivationContactEmail({ ...base, email: "g@x.com", debtLabel: null });
    expect(e.text).toContain("No figura con deuda pendiente");
    expect(e.text).not.toContain("$");
  });

  it("la reactivación sola avisa que no hace falta hacer nada", () => {
    const e = buildSelfReactivatedEmail(base);
    expect(e.subject).toBe("SFPR: Gabriel Villagómez se reactivó pagando su deuda");
    expect(e.text).toContain("No hace falta que hagas nada");
  });
});
