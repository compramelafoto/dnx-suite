import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@repo/db";
import { buildApproval, ApprovalError } from "./approve";

const d = (v: string) => new Prisma.Decimal(v);

const solicitud = {
  id: "app-1",
  workspaceId: "ws-sfpr",
  firstName: "Ana",
  lastName: "Fotógrafa",
  email: "ana@test.com",
  declaredFeeScale: "PLENA" as const,
  ownDuesAmount: null,
  originInstitution: null,
  avatarUrl: "https://cdn/foto.jpg",
  noticeAddress: "San Martín 1234",
  documentType: "DNI",
  documentNumber: "30111222",
  phone: null,
  taxId: null,
  city: null,
  province: null,
  postalCode: null,
  categoryId: "cat-activo",
  status: "PENDIENTE" as const,
};

const settings = {
  dueDay: 10,
  initialDuesCount: 3,
  countJoinMonthIfBeforeDueDay: true,
  collaboratorFloorMultiple: 1,
};

const base = {
  application: solicitud,
  settings,
  referenceAmount: d("10000"),
  feeValueId: "fv-1",
  existingNumbers: ["731", "732", "733"],
  now: new Date("2026-08-18T12:00:00Z"),
};

beforeEach(() => vi.clearAllMocks());

describe("buildApproval", () => {
  it("asigna el número siguiente del padrón", () => {
    const r = buildApproval(base);
    expect(r.member.memberNumber).toBe("734");
  });

  it("la foto de la solicitud pasa a ser el perfil del socio", () => {
    expect(buildApproval(base).member.avatarUrl).toBe("https://cdn/foto.jpg");
  });

  it("copia el domicilio de notificaciones y el documento", () => {
    const m = buildApproval(base).member;
    expect(m.address).toBe("San Martín 1234");
    expect(m.documentNumber).toBe("30111222");
  });

  /** Tu ejemplo: alta el 18 de agosto genera septiembre, octubre y noviembre. */
  it("genera tres cargos de ingreso con los períodos correctos", () => {
    const r = buildApproval(base);
    expect(r.charges).toHaveLength(3);
    expect(r.charges.map((c) => c.period)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(r.charges.every((c) => c.concept === "INGRESO")).toBe(true);
  });

  it("cada cargo nace impago, con saldo igual al monto", () => {
    for (const c of buildApproval(base).charges) {
      expect(c.balanceArs.toFixed(2)).toBe(c.amountArs.toFixed(2));
      expect(c.amountArs.toFixed(2)).toBe("10000.00");
    }
  });

  it("cada cargo guarda con qué valor de cuota se generó", () => {
    expect(buildApproval(base).charges.every((c) => c.feeValueId === "fv-1")).toBe(true);
  });

  it("el total a cobrar es la suma exacta de los cargos", () => {
    const r = buildApproval(base);
    const suma = r.charges.reduce((a, c) => a.plus(c.amountArs), new Prisma.Decimal(0));
    expect(r.totalArs.toFixed(2)).toBe(suma.toFixed(2));
    expect(r.totalArs.toFixed(2)).toBe("30000.00");
  });

  it("el estudiante paga la mitad en cada cargo", () => {
    const r = buildApproval({
      ...base,
      application: { ...solicitud, declaredFeeScale: "REDUCIDA", originInstitution: "Escuela X" },
    });
    expect(r.totalArs.toFixed(2)).toBe("15000.00");
    expect(r.charges[0]!.amountArs.toFixed(2)).toBe("5000.00");
  });

  it("el colaborador paga tres veces el monto que eligió", () => {
    const r = buildApproval({
      ...base,
      application: { ...solicitud, ownDuesAmount: d("20000") },
    });
    expect(r.totalArs.toFixed(2)).toBe("60000.00");
  });

  it("un monto propio por debajo del piso se sube al piso", () => {
    const r = buildApproval({
      ...base,
      application: { ...solicitud, ownDuesAmount: d("100") },
    });
    expect(r.charges[0]!.amountArs.toFixed(2)).toBe("10000.00");
  });

  it("la solicitud queda aprobada e impaga, con vencimiento a 30 días", () => {
    const r = buildApproval(base);
    expect(r.applicationUpdate.status).toBe("APROBADA_IMPAGA");
    const dias = Math.round(
      (r.applicationUpdate.expiresAt.getTime() - base.now.getTime()) / 86_400_000,
    );
    expect(dias).toBe(30);
  });

  /** Aprobar dos veces la misma solicitud crearía dos socios para la misma persona. */
  it.each(["APROBADA_IMPAGA", "RECHAZADA", "COMPLETADA", "VENCIDA"] as const)(
    "rechaza aprobar una solicitud en estado %s",
    (status) => {
      expect(() => buildApproval({ ...base, application: { ...solicitud, status } })).toThrow(
        ApprovalError,
      );
    },
  );

  it("sin valor de cuota configurado no se puede aprobar", () => {
    expect(() =>
      buildApproval({ ...base, referenceAmount: null as unknown as Prisma.Decimal }),
    ).toThrow(ApprovalError);
  });

  it("con cero cuotas iniciales el total es cero y no hay cargos", () => {
    const r = buildApproval({ ...base, settings: { ...settings, initialDuesCount: 0 } });
    expect(r.charges).toHaveLength(0);
    expect(r.totalArs.toFixed(2)).toBe("0.00");
  });
});

describe("presencia profesional", () => {
  const conRedes = {
    ...base,
    application: {
      ...solicitud,
      businessName: "Estudio Ana",
      bio: "Fotógrafa social desde 2010.",
      specialties: ["SOCIAL", "CASAMIENTOS"],
      website: "https://estudioana.com.ar/",
      instagram: "estudioana",
      tiktok: null,
      facebook: "https://facebook.com/estudioana",
      youtube: null,
      linkedin: null,
      directoryOptIn: true,
    },
  };

  it("lo declarado al asociarse queda en el socio, no solo en la solicitud", () => {
    const m = buildApproval(conRedes).member;
    expect(m.businessName).toBe("Estudio Ana");
    expect(m.bio).toBe("Fotógrafa social desde 2010.");
    expect(m.specialties).toEqual(["SOCIAL", "CASAMIENTOS"]);
    expect(m.website).toBe("https://estudioana.com.ar/");
    expect(m.instagram).toBe("estudioana");
    expect(m.facebook).toBe("https://facebook.com/estudioana");
    expect(m.directoryOptIn).toBe(true);
  });

  it("una solicitud sin redes no rompe la aprobación", () => {
    const m = buildApproval(base).member;
    expect(m.instagram).toBeNull();
    expect(m.specialties).toEqual([]);
    expect(m.directoryOptIn).toBe(false);
  });

  it("no publica en el directorio a quien no lo pidió", () => {
    const m = buildApproval({
      ...conRedes,
      application: { ...conRedes.application, directoryOptIn: false },
    }).member;
    expect(m.directoryOptIn).toBe(false);
    // Los datos igual se guardan: el consentimiento decide si se muestran, no si se piden.
    expect(m.instagram).toBe("estudioana");
  });

  it("las especialidades del socio no comparten el array con la solicitud", () => {
    const m = buildApproval(conRedes).member;
    m.specialties.push("OTRO");
    expect(conRedes.application.specialties).toEqual(["SOCIAL", "CASAMIENTOS"]);
  });
});
