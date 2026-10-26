import { describe, expect, it } from "vitest";
import { estadoReloj, transicion, type EstadoTicket } from "./estados";

const now = new Date("2026-10-26T12:00:00.000Z");
const hace = (min: number) => new Date(now.getTime() - min * 60_000);
const t = (status: EstadoTicket) => ({ id: 60, status });

describe("estadoReloj", () => {
  it("verde hasta que faltan 6 h, amarillo después y rojo al vencer las 24 h corridas", () => {
    expect(estadoReloj({ status: "OPEN", slaDesde: null, createdAt: hace(17 * 60 + 59) }, now)?.color).toBe("verde");
    expect(estadoReloj({ status: "OPEN", slaDesde: null, createdAt: hace(18 * 60 + 1) }, now)?.color).toBe("amarillo");
    expect(estadoReloj({ status: "IN_PROGRESS", slaDesde: null, createdAt: hace(24 * 60 + 1) }, now)?.color).toBe("rojo");
  });

  it("cuenta desde slaDesde cuando existe y devuelve cuándo vence", () => {
    const r = estadoReloj({ status: "IN_PROGRESS", slaDesde: hace(60), createdAt: hace(5000) }, now);
    expect(r?.color).toBe("verde");
    expect(r?.venceEn.toISOString()).toBe(new Date(hace(60).getTime() + 86_400_000).toISOString());
  });

  it("no corre mientras se espera al cliente ni en casos cerrados", () => {
    for (const status of ["WAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const) {
      expect(estadoReloj({ status, slaDesde: null, createdAt: hace(5000) }, now)).toBeNull();
    }
  });
});

describe("transicion", () => {
  it("la respuesta del admin pasa a Esperando al cliente", () => {
    expect(transicion(t("OPEN"), { tipo: "ADMIN_RESPONDIO" }, now)).toEqual({ status: "WAITING_CUSTOMER", esperandoDesde: now });
  });

  it("el cliente que escribe desde el panel reabre y reinicia el reloj, con aviso", () => {
    for (const desde of ["WAITING_CUSTOMER", "RESOLVED"] as const) {
      const c = transicion(t(desde), { tipo: "CLIENTE_ESCRIBIO_PANEL" }, now);
      expect(c).toMatchObject({ status: "IN_PROGRESS", slaDesde: now, clienteRespondioAt: now, esperandoDesde: null, resolvedAt: null });
      expect("aviso" in c && c.aviso).toContain("#60");
    }
  });

  it("un caso cerrado no acepta mensajes del cliente", () => {
    expect(transicion(t("CLOSED"), { tipo: "CLIENTE_ESCRIBIO_PANEL" }, now)).toHaveProperty("rechazado");
    expect(transicion(t("CLOSED"), { tipo: "CLIENTE_ESCRIBIO_BOT" }, now)).toHaveProperty("rechazado");
  });

  it("si charla con el bot mientras se lo espera, sólo se marca que escribió", () => {
    expect(transicion(t("WAITING_CUSTOMER"), { tipo: "CLIENTE_ESCRIBIO_BOT" }, now)).toEqual({ clienteEscribioAt: now });
  });

  it("si escribe al bot en un caso resuelto, se reabre", () => {
    expect(transicion(t("RESOLVED"), { tipo: "CLIENTE_ESCRIBIO_BOT" }, now)).toMatchObject({ status: "IN_PROGRESS", slaDesde: now, resolvedAt: null, clienteEscribioAt: now });
  });

  it("el bot pasa el caso al equipo: En curso, reloj de nuevo y aviso", () => {
    const c = transicion(t("WAITING_CUSTOMER"), { tipo: "BOT_PASO_AL_EQUIPO", motivo: "sigue sin poder pagar" }, now);
    expect(c).toMatchObject({ status: "IN_PROGRESS", slaDesde: now, clienteRespondioAt: now });
    expect("aviso" in c && c.aviso).toContain("sigue sin poder pagar");
  });

  it("el cliente confirma que se resolvió", () => {
    expect(transicion(t("WAITING_CUSTOMER"), { tipo: "CLIENTE_CONFIRMO_RESUELTO" }, now)).toEqual({ status: "RESOLVED", resolvedAt: now, cerradoPor: "CLIENTE_BOT", esperandoDesde: null });
  });

  it("a los 3 días sin respuesta pasa sola a Resuelto, sólo desde Esperando", () => {
    expect(transicion(t("WAITING_CUSTOMER"), { tipo: "SIN_RESPUESTA_3_DIAS" }, now)).toEqual({ status: "RESOLVED", resolvedAt: now, cerradoPor: "AUTOMATICO", esperandoDesde: null });
    expect(transicion(t("IN_PROGRESS"), { tipo: "SIN_RESPUESTA_3_DIAS" }, now)).toHaveProperty("rechazado");
  });

  it("los movimientos del admin dejan los campos coherentes", () => {
    expect(transicion(t("OPEN"), { tipo: "ADMIN_MOVIO", a: "WAITING_CUSTOMER" }, now)).toEqual({ status: "WAITING_CUSTOMER", esperandoDesde: now });
    expect(transicion(t("IN_PROGRESS"), { tipo: "ADMIN_MOVIO", a: "RESOLVED" }, now)).toEqual({ status: "RESOLVED", resolvedAt: now, cerradoPor: "ADMIN", esperandoDesde: null });
    expect(transicion(t("RESOLVED"), { tipo: "ADMIN_MOVIO", a: "IN_PROGRESS" }, now)).toEqual({ status: "IN_PROGRESS", resolvedAt: null, cerradoPor: null, esperandoDesde: null });
  });
});
