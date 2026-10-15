import { describe, expect, it } from "vitest";
import { hiddenReasonMessage } from "./visibility-labels";
import type { PortfolioHiddenReason } from "./visibility";

const TODOS: PortfolioHiddenReason[] = [
  "MODULE_DISABLED",
  "HIDDEN_BY_ADMIN",
  "MEMBER_NOT_ACTIVE",
  "NO_CONSENT",
  "NO_PHOTOS",
  "NOT_PUBLISHED_BY_MEMBER",
  "OVERDUE_DUES",
];

describe("hiddenReasonMessage", () => {
  it("todos los motivos tienen texto: ninguno deja al socio sin explicación", () => {
    for (const reason of TODOS) {
      const m = hiddenReasonMessage(reason);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.detail.length).toBeGreaterThan(0);
    }
  });

  it("la deuda ofrece ir a la cuenta: es lo único que el socio puede hacer al respecto", () => {
    expect(hiddenReasonMessage("OVERDUE_DUES").action).toEqual({
      label: "Ver mis cuotas",
      href: "/portal/cuotas",
    });
  });

  it("falta de consentimiento manda al perfil, que es donde se da", () => {
    expect(hiddenReasonMessage("NO_CONSENT").action).toEqual({
      label: "Ir a mi perfil",
      href: "/portal/perfil",
    });
  });

  it("lo que decidió la institución no ofrece ninguna acción al socio", () => {
    expect(hiddenReasonMessage("HIDDEN_BY_ADMIN").action).toBeNull();
    expect(hiddenReasonMessage("MEMBER_NOT_ACTIVE").action).toBeNull();
    expect(hiddenReasonMessage("MODULE_DISABLED").action).toBeNull();
  });

  it("la deuda se explica sin acusar: puede ser un error de la migración", () => {
    const detalle = hiddenReasonMessage("OVERDUE_DUES").detail;
    expect(detalle).toContain("Figurás");
    expect(detalle).toContain("Secretaría");
  });

  it("ningún texto dice la palabra 'socio': la elige cada institución", () => {
    for (const reason of TODOS) {
      const m = hiddenReasonMessage(reason);
      expect(`${m.title} ${m.detail}`.toLowerCase()).not.toContain("socio");
    }
  });

  it("cuando la única traba es el interruptor, el texto lo dice y no alarma", () => {
    const m = hiddenReasonMessage("NOT_PUBLISHED_BY_MEMBER");
    expect(m.detail).toContain("interruptor");
    expect(m.action).toBeNull();
  });
});
