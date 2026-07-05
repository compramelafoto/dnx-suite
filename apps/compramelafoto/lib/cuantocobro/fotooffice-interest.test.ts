import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fotoOfficeInterest: prismaMocks,
  },
}));

import {
  buildFotoOfficeInterestMetadata,
  buildFotoOfficeInterestWhere,
  FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
  FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
  registerFotoOfficeInterest,
  sanitizeInterestString,
} from "./fotooffice-interest";

describe("fotooffice-interest", () => {
  beforeEach(() => {
    prismaMocks.findFirst.mockReset();
    prismaMocks.create.mockReset();
    prismaMocks.update.mockReset();
  });

  it("sanitiza strings vacíos", () => {
    expect(sanitizeInterestString("  hola  ")).toBe("hola");
    expect(sanitizeInterestString("   ")).toBeNull();
    expect(sanitizeInterestString(null)).toBeNull();
  });

  it("arma metadata solo con campos válidos", () => {
    expect(
      buildFotoOfficeInterestMetadata({
        minimumSustainablePrice: 100_000.4,
        recommendedBusinessPrice: 125_000,
        commercialPositioningId: "stable",
        commercialPositioningLabel: "Tengo un negocio estable",
        jobType: "Boda",
        currency: "ARS",
      }),
    ).toEqual({
      minimumSustainablePrice: 100_000,
      recommendedBusinessPrice: 125_000,
      commercialPositioningId: "stable",
      commercialPositioningLabel: "Tengo un negocio estable",
      jobType: "Boda",
      currency: "ARS",
    });
  });

  it("deduplica por userId + source + interestType", async () => {
    prismaMocks.findFirst.mockResolvedValue({
      id: "existing-id",
      email: "foto@example.com",
    });
    prismaMocks.update.mockResolvedValue({ id: "existing-id" });

    const result = await registerFotoOfficeInterest({
      userId: 42,
      email: "foto@example.com",
      name: "Ana",
      source: FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
      interestType: FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
      metadata: { minimumSustainablePrice: 50_000 },
    });

    expect(result).toEqual({ ok: true, created: false, id: "existing-id" });
    expect(buildFotoOfficeInterestWhere({
      userId: 42,
      source: FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
      interestType: FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
    })).toEqual({
      userId: 42,
      source: FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
      interestType: FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
    });
    expect(prismaMocks.findFirst).toHaveBeenCalledOnce();
    expect(prismaMocks.create).not.toHaveBeenCalled();
    expect(prismaMocks.update).toHaveBeenCalledOnce();
  });

  it("deduplica por email cuando no hay userId", async () => {
    prismaMocks.findFirst.mockResolvedValue(null);
    prismaMocks.create.mockResolvedValue({ id: "new-id" });

    const result = await registerFotoOfficeInterest({
      email: "Foto@Example.com",
      source: FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
      interestType: FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
    });

    expect(result).toEqual({ ok: true, created: true, id: "new-id" });
    expect(buildFotoOfficeInterestWhere({
      email: "foto@example.com",
      source: FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
      interestType: FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
    })).toEqual({
      userId: null,
      email: "foto@example.com",
      source: FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
      interestType: FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
    });
    expect(prismaMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          email: "foto@example.com",
        }),
      }),
    );
  });

  it("requiere userId o email", async () => {
    await expect(registerFotoOfficeInterest({})).rejects.toThrow("EMAIL_REQUIRED");
  });
});
