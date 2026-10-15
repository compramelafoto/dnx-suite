// lib/payments/split-1n-cursos.test.ts
import { describe, expect, it } from "vitest";
import { testActivePartnerConsent } from "@repo/payments/mercado-pago";
import { calcularReparto } from "@/lib/course-marketplace/reparto";
import {
  armarOrdenSinLlave,
  consentimientoDeCuenta,
  evidenciaDeConsentimiento,
  prepararOrdenDeCursoConReparto,
  type EntradaOrdenDeCurso,
  type ReceptorDeSplit,
} from "./split-1n-cursos";

const UUID = {
  sfpr: "11111111-1111-4111-8111-111111111111",
  prod: "22222222-2222-4222-8222-222222222222",
  doc: "33333333-3333-4333-8333-333333333333",
  club: "44444444-4444-4444-8444-444444444444",
  plataforma: "55555555-5555-4555-8555-555555555555",
};

const benef = [
  { id: "ws-sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "ws-prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "ws-doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];

function partes(descuentoBps = 0) {
  const r = calcularReparto({
    listaCentavos: 10_000_000,
    comisionPlataformaBps: 500,
    beneficiarios: benef,
    reventa: { id: "ws-club", nombre: "Fotoclub", bps: 2500 },
    descuentoBps,
  });
  if (!r.ok) throw new Error(r.errores.join());
  return r.partes;
}

const receptor = (id: string): ReceptorDeSplit => ({ receiverId: id, consentimiento: testActivePartnerConsent(id) });

function entrada(cambios: Partial<EntradaOrdenDeCurso> = {}): EntradaOrdenDeCurso {
  return {
    enrollmentId: "insc123",
    tituloCurso: "Retrato",
    payerEmail: "alumna@example.com",
    partes: partes(),
    receptores: new Map([
      ["ws-sfpr", receptor(UUID.sfpr)],
      ["ws-prod", receptor(UUID.prod)],
      ["ws-doc", receptor(UUID.doc)],
      ["ws-club", receptor(UUID.club)],
    ]),
    plataforma: receptor(UUID.plataforma),
    pago: { token: "tok_prueba", metodo: "visa", cuotas: 1, deviceSessionId: "sesion-de-prueba-123" },
    permitirFixturesDePrueba: true,
    ...cambios,
  };
}

describe("orden de Mercado Pago con reparto para un curso (spec, sección 5.2)", () => {
  it("quien absorbe la comisión es el dueño de la orden; el resto, socios; montos fijos del motor", () => {
    const r = armarOrdenSinLlave(entrada());
    if (!r.ok) throw new Error(r.detalle);
    expect(r.ownerReceiverId).toBe(UUID.doc);
    expect(r.body.total_amount).toBe("105000.00");
    expect(r.body.config.split_rules.amount_type).toBe("fixed");
    expect(r.body.splits[0]).toMatchObject({ receiver_id: UUID.doc, receiver_type: "owner", amount: "37500.00" });
    const socio = (id: string) => r.body.splits.find((s) => s.receiver_id === id);
    expect(socio(UUID.club)).toMatchObject({ receiver_type: "partner", amount: "25000.00" });
    expect(socio(UUID.sfpr)).toMatchObject({ receiver_type: "partner", amount: "22500.00" });
    expect(socio(UUID.prod)).toMatchObject({ receiver_type: "partner", amount: "15000.00" });
    expect(socio(UUID.plataforma)).toMatchObject({ receiver_type: "partner", amount: "5000.00" });
    expect(r.headers["x-meli-session-id"]).toBe("sesion-de-prueba-123");
  });

  it("una parte en cero no viaja (el socio con todo el descuento del revendedor)", () => {
    const r = armarOrdenSinLlave(entrada({ partes: partes(2500) }));
    if (!r.ok) throw new Error(r.detalle);
    expect(r.body.total_amount).toBe("80000.00");
    expect(r.body.splits.some((s) => s.receiver_id === UUID.club)).toBe(false);
  });

  it("sin consentimiento ACTIVE de algún receptor, no se arma", () => {
    const receptores = entrada().receptores;
    receptores.set("ws-prod", { receiverId: UUID.prod, consentimiento: { ...testActivePartnerConsent(UUID.prod), status: "PENDING" } });
    expect(armarOrdenSinLlave(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_CONSENTIMIENTO" });
    receptores.set("ws-prod", { receiverId: UUID.prod, consentimiento: null });
    expect(armarOrdenSinLlave(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_CONSENTIMIENTO" });
  });

  it("el dueño de la orden también necesita su consentimiento", () => {
    const receptores = entrada().receptores;
    receptores.set("ws-doc", { receiverId: UUID.doc, consentimiento: null });
    expect(armarOrdenSinLlave(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_CONSENTIMIENTO" });
  });

  it("sin cuenta de un beneficiario o de la plataforma, no se arma", () => {
    const receptores = entrada().receptores;
    receptores.delete("ws-sfpr");
    expect(armarOrdenSinLlave(entrada({ receptores }))).toMatchObject({ ok: false, codigo: "SIN_RECEPTOR" });
    expect(armarOrdenSinLlave(entrada({ plataforma: null }))).toMatchObject({ ok: false, codigo: "SIN_PLATAFORMA" });
  });

  it("un consentimiento de prueba no pasa sin el permiso explícito de los tests", () => {
    expect(armarOrdenSinLlave(entrada({ permitirFixturesDePrueba: false }))).toMatchObject({ ok: false, codigo: "INVALIDA" });
  });

  it("el armado exportado tampoco funciona con la llave apagada", () => {
    expect(prepararOrdenDeCursoConReparto(entrada(), {} as unknown as NodeJS.ProcessEnv)).toMatchObject({ ok: false, codigo: "SPLIT_APAGADO" });
  });

  it("un negocio que es revendedor y beneficiario va en un solo receptor con la suma", () => {
    const base = partes();
    const club = base.find((p) => p.id === "ws-club")!;
    const prod = base.find((p) => p.id === "ws-prod")!;
    const dup = base.map((p) => (p === club ? { ...club, id: "ws-prod" } : p));
    const r = armarOrdenSinLlave(entrada({ partes: dup }));
    if (!r.ok) throw new Error(r.detalle);
    const delProd = r.body.splits.filter((s) => s.receiver_id === UUID.prod);
    expect(delProd).toHaveLength(1);
    expect(delProd[0]!.amount).toBe(((prod.centavos + club.centavos) / 100).toFixed(2));
  });

  it("si quien absorbe la comisión tiene $0, no se arma", () => {
    const p = partes().map((x) => (x.id === "ws-doc" ? { ...x, centavos: 0 } : x));
    expect(armarOrdenSinLlave(entrada({ partes: p }))).toMatchObject({ ok: false, codigo: "INVALIDA" });
  });

  it("con la llave apagada no se arma nada, aunque el guard general esté encendido", () => {
    const env = { DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "true" } as unknown as NodeJS.ProcessEnv;
    expect(prepararOrdenDeCursoConReparto(entrada(), env)).toMatchObject({ ok: false, codigo: "SPLIT_APAGADO" });
  });
});

describe("consentimiento guardado → receptor", () => {
  it("sin fila o sin receptor, nada", () => {
    expect(evidenciaDeConsentimiento(null)).toBeNull();
    expect(evidenciaDeConsentimiento({ providerReceiverId: null, status: "ACTIVE" })).toBeNull();
  });

  it("normaliza el estado y nunca inventa ACTIVE", () => {
    expect(evidenciaDeConsentimiento({ providerReceiverId: UUID.sfpr, status: "active" })).toEqual({
      receiverId: UUID.sfpr,
      consentimiento: { receiverId: UUID.sfpr, status: "ACTIVE", provider: "mercadopago" },
    });
    expect(evidenciaDeConsentimiento({ providerReceiverId: UUID.sfpr, status: "LO_QUE_SEA" })?.consentimiento?.status).toBe("PENDING");
  });
});

describe("consentimiento guardado de una cuenta (dos filas reales)", () => {
  // Como quedan en la base: la invitación (fila UUID, estado de ese momento) y el refresh
  // (fila con el user_id numérico, upsert por providerReceiverId). Más nueva primero.
  const numerico = "1234567890";
  const invitacion = { providerReceiverId: UUID.sfpr, status: "PENDING" };

  it("invitación UUID PENDING + aceptación numérica ACTIVE: activo, con el UUID", () => {
    const r = consentimientoDeCuenta([{ providerReceiverId: numerico, status: "ACTIVE" }, invitacion]);
    expect(r?.receiverId).toBe(UUID.sfpr);
    expect(r?.consentimiento).toEqual({ receiverId: UUID.sfpr, status: "ACTIVE", provider: "mercadopago" });
  });

  it("ACTIVE y después dado de baja: no está activo", () => {
    for (const baja of ["CANCELED", "EXPIRED", "REJECTED", "REVOKED"]) {
      // El refresh pisa la misma fila numérica que antes decía ACTIVE.
      const r = consentimientoDeCuenta([{ providerReceiverId: numerico, status: baja }, invitacion]);
      expect(r?.receiverId).toBe(UUID.sfpr);
      expect(r?.consentimiento?.status).not.toBe("ACTIVE");
    }
    // Un estado posterior en la fila UUID (por ejemplo, una nueva invitación) también gana.
    const r = consentimientoDeCuenta([{ providerReceiverId: UUID.sfpr, status: "CANCELED" }, { providerReceiverId: numerico, status: "ACTIVE" }]);
    expect(r?.consentimiento?.status).toBe("CANCELED");
  });

  it("sólo la invitación: pendiente; sin fila UUID o sin filas: no hay receptor", () => {
    expect(consentimientoDeCuenta([invitacion])?.consentimiento?.status).toBe("PENDING");
    expect(consentimientoDeCuenta([{ providerReceiverId: numerico, status: "ACTIVE" }])).toBeNull();
    expect(consentimientoDeCuenta([])).toBeNull();
  });

  it("con las filas reales de cada negocio la orden se arma sin fixtures; sin fila UUID, SIN_RECEPTOR", () => {
    const deCuenta = (uuid: string, n: string) =>
      consentimientoDeCuenta([{ providerReceiverId: n, status: "ACTIVE" }, { providerReceiverId: uuid, status: "PENDING" }])!;
    const receptores = new Map([
      ["ws-sfpr", deCuenta(UUID.sfpr, "101")],
      ["ws-prod", deCuenta(UUID.prod, "102")],
      ["ws-doc", deCuenta(UUID.doc, "103")],
      ["ws-club", deCuenta(UUID.club, "104")],
    ]);
    const plataforma = evidenciaDeConsentimiento({ providerReceiverId: UUID.plataforma, status: "ACTIVE" });
    const r = armarOrdenSinLlave(entrada({ receptores, plataforma, permitirFixturesDePrueba: false }));
    if (!r.ok) throw new Error(r.detalle);
    expect(r.ownerReceiverId).toBe(UUID.doc);

    const sinUuid = consentimientoDeCuenta([{ providerReceiverId: "102", status: "ACTIVE" }]);
    expect(sinUuid).toBeNull();
    receptores.delete("ws-prod");
    expect(armarOrdenSinLlave(entrada({ receptores, plataforma, permitirFixturesDePrueba: false }))).toMatchObject({ ok: false, codigo: "SIN_RECEPTOR" });
  });
});
