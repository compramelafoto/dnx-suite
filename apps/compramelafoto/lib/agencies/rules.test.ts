import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENCY_TERMS,
  bpsToPercentLabel,
  effectiveCommissionBps,
  memberCanUpload,
  memberNeedsTerms,
  parseCommissionPercent,
  planJoin,
  planRequest,
  resolveAgencyTerms,
  sortByDistanceKm,
  validateAgencyInput,
} from "./rules";

describe("parseCommissionPercent", () => {
  it("acepta números y textos con coma", () => {
    expect(parseCommissionPercent(30)).toEqual({ ok: true, bps: 3000 });
    expect(parseCommissionPercent("27,5")).toEqual({ ok: true, bps: 2750 });
    expect(parseCommissionPercent("0")).toEqual({ ok: true, bps: 0 });
    expect(parseCommissionPercent("100")).toEqual({ ok: true, bps: 10000 });
  });
  it("rechaza fuera de rango, texto y símbolos", () => {
    for (const bad of ["-5", "150", "abc", "30%", null, undefined]) {
      const r = parseCommissionPercent(bad);
      expect(r.ok).toBe(false);
    }
    const r = parseCommissionPercent("150");
    expect(r.ok === false && r.error).toBe("El porcentaje tiene que estar entre 0 y 100.");
  });
  it("vacío sólo si se permite y devuelve null", () => {
    expect(parseCommissionPercent("", { allowEmpty: true })).toEqual({ ok: true, bps: null });
    expect(parseCommissionPercent(null, { allowEmpty: true })).toEqual({ ok: true, bps: null });
    expect(parseCommissionPercent("").ok).toBe(false);
  });
  it("redondea a un decimal", () => {
    expect(parseCommissionPercent("33.33")).toEqual({ ok: true, bps: 3330 });
  });
});

describe("bpsToPercentLabel", () => {
  it("formatea con coma decimal", () => {
    expect(bpsToPercentLabel(3000)).toBe("30 %");
    expect(bpsToPercentLabel(2750)).toBe("27,5 %");
  });
});

describe("effectiveCommissionBps", () => {
  it("usa el del miembro si tiene, si no el general", () => {
    expect(effectiveCommissionBps({ commissionBps: 3500 }, { defaultCommissionBps: 3000 })).toBe(3500);
    expect(effectiveCommissionBps({ commissionBps: 0 }, { defaultCommissionBps: 3000 })).toBe(0);
    expect(effectiveCommissionBps({ commissionBps: null }, { defaultCommissionBps: 3000 })).toBe(3000);
  });
});

describe("condiciones y permisos", () => {
  it("texto por defecto si la agencia no cargó uno", () => {
    expect(resolveAgencyTerms({ termsText: null })).toBe(DEFAULT_AGENCY_TERMS);
    expect(resolveAgencyTerms({ termsText: "   " })).toBe(DEFAULT_AGENCY_TERMS);
    expect(resolveAgencyTerms({ termsText: "Mis reglas" })).toBe("Mis reglas");
  });
  it("sólo sube el miembro ACTIVE con las condiciones vigentes", () => {
    const agency = { termsVersion: 2 };
    expect(memberCanUpload({ status: "ACTIVE", termsVersionAccepted: 2 }, agency)).toBe(true);
    expect(memberCanUpload({ status: "ACTIVE", termsVersionAccepted: 1 }, agency)).toBe(false);
    expect(memberCanUpload({ status: "ACTIVE", termsVersionAccepted: null }, agency)).toBe(false);
    for (const status of ["REQUESTED", "REJECTED", "REMOVED"]) {
      expect(memberCanUpload({ status, termsVersionAccepted: 2 }, agency)).toBe(false);
    }
    expect(memberCanUpload(null, agency)).toBe(false);
  });
  it("pide aceptar de nuevo cuando cambió la versión", () => {
    expect(memberNeedsTerms({ status: "ACTIVE", termsVersionAccepted: 1 }, { termsVersion: 2 })).toBe(true);
    expect(memberNeedsTerms({ status: "ACTIVE", termsVersionAccepted: 2 }, { termsVersion: 2 })).toBe(false);
    expect(memberNeedsTerms({ status: "REMOVED", termsVersionAccepted: 1 }, { termsVersion: 2 })).toBe(false);
  });
});

describe("planJoin y planRequest", () => {
  it("link de invitación", () => {
    expect(planJoin(null)).toEqual({ action: "create" });
    expect(planJoin({ status: "ACTIVE" })).toEqual({ action: "already_active" });
    expect(planJoin({ status: "REMOVED" })).toEqual({ action: "request_again" });
    for (const status of ["REQUESTED", "REJECTED"]) {
      expect(planJoin({ status })).toEqual({ action: "reactivate" });
    }
  });
  it("solicitud desde el directorio", () => {
    expect(planRequest(null)).toEqual({ action: "create" });
    expect(planRequest({ status: "ACTIVE" })).toEqual({ action: "already_active" });
    expect(planRequest({ status: "REQUESTED" })).toEqual({ action: "already_requested" });
    expect(planRequest({ status: "REJECTED" })).toEqual({ action: "reopen" });
    expect(planRequest({ status: "REMOVED" })).toEqual({ action: "reopen" });
  });
});

describe("validateAgencyInput", () => {
  it("normaliza lo mínimo", () => {
    const r = validateAgencyInput({ name: "  Fotoshow  ", defaultCommissionPercent: "30" });
    expect(r).toEqual({
      ok: true,
      data: {
        name: "Fotoshow",
        description: null,
        defaultCommissionBps: 3000,
        directoryListed: false,
        directoryLat: null,
        directoryLng: null,
        directoryRadiusKm: 50,
        directoryCity: null,
        notFoundSearchEnabled: false,
        termsText: null,
      },
    });
  });
  it("sin porcentaje usa 30 %", () => {
    const r = validateAgencyInput({ name: "X" });
    expect(r.ok && r.data.defaultCommissionBps).toBe(3000);
  });
  it("exige nombre", () => {
    expect(validateAgencyInput({ name: "  " })).toEqual({ ok: false, error: "Poné el nombre de la agencia." });
  });
  it("para aparecer en el directorio exige el punto en el mapa", () => {
    const r = validateAgencyInput({ name: "X", directoryListed: true });
    expect(r).toEqual({ ok: false, error: "Para aparecer en el directorio marcá tu zona en el mapa." });
    const ok = validateAgencyInput({ name: "X", directoryListed: true, directoryLat: -38.0, directoryLng: -57.55, directoryRadiusKm: 30 });
    expect(ok.ok && ok.data.directoryRadiusKm).toBe(30);
  });
  it("radio entre 1 y 500 km", () => {
    const r = validateAgencyInput({ name: "X", directoryRadiusKm: 0 });
    expect(r).toEqual({ ok: false, error: "El radio tiene que estar entre 1 y 500 km." });
  });
  it("rechaza coordenadas inválidas", () => {
    const r = validateAgencyInput({ name: "X", directoryLat: 200, directoryLng: 0 });
    expect(r).toEqual({ ok: false, error: "La ubicación del mapa no es válida." });
  });
});

describe("sortByDistanceKm", () => {
  it("ordena de más cerca a más lejos y agrega la distancia", () => {
    const mdq = { lat: -38.0055, lng: -57.5426 };
    const out = sortByDistanceKm(
      [
        { id: "bsas", lat: -34.6037, lng: -58.3816 },
        { id: "mdq", lat: -38.0, lng: -57.55 },
      ],
      mdq
    );
    expect(out.map((o) => o.id)).toEqual(["mdq", "bsas"]);
    expect(out[0].distanceKm).toBeLessThan(2);
    expect(out[1].distanceKm).toBeGreaterThan(350);
  });
});
