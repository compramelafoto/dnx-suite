import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@repo/db";

vi.mock("@/lib/course-classroom/grant", () => ({ avisarAccesoAlAula: vi.fn() }));
vi.mock("./email", () => ({ sendEnrollmentApprovedEmail: vi.fn() }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({ loadWorkspaceSignature: vi.fn() }));

import { recalcularReparto } from "./enrollment-workflow";

describe("reparto al aprobar un curso grabado con el 5% encima", () => {
  it("la comisión queda fija y el neto es lo cobrado menos esa comisión", () => {
    const r = recalcularReparto({
      montoCobrado: new Prisma.Decimal("105000"),
      feePercentCongelado: new Prisma.Decimal("5"),
      comisionFijaArs: new Prisma.Decimal("5000"),
    });
    expect(r.fee.toString()).toBe("5000");
    expect(r.net.toString()).toBe("100000");
  });

  it("sin comisión fija, sigue como antes", () => {
    const r = recalcularReparto({ montoCobrado: new Prisma.Decimal("100000"), feePercentCongelado: new Prisma.Decimal("5") });
    expect(r.fee.toString()).toBe("5000");
  });
});
