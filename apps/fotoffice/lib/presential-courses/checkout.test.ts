import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { splitByPlatformFee } from "@/lib/platform-fee/fee";
import { courseExternalReference, parseCourseExternalReference } from "./checkout";

describe("referencia externa de la inscripción", () => {
  it("va y vuelve", () => {
    expect(parseCourseExternalReference(courseExternalReference("insc-1"))).toBe("insc-1");
  });

  it("ignora una referencia de otro módulo", () => {
    expect(parseCourseExternalReference("fotoffice-reserva:r-1")).toBeNull();
    expect(parseCourseExternalReference("cualquier-cosa")).toBeNull();
  });

  it("una referencia sin identificador no es válida", () => {
    expect(parseCourseExternalReference("fotoffice-curso:")).toBeNull();
    expect(parseCourseExternalReference("fotoffice-curso:   ")).toBeNull();
  });
});

describe("cuánto retiene la plataforma", () => {
  it("con 5% sobre $100.000 retiene $5.000 y le quedan $95.000 a la institución", () => {
    const { fee, net } = splitByPlatformFee(new Prisma.Decimal("100000"), 500);
    expect(fee.toString()).toBe("5000");
    expect(net.toString()).toBe("95000");
  });

  it("el neto se obtiene restando, así la suma cierra contra el total", () => {
    const total = new Prisma.Decimal("99999.99");
    const { fee, net } = splitByPlatformFee(total, 725);
    expect(fee.plus(net).toString()).toBe(total.toString());
  });
});
