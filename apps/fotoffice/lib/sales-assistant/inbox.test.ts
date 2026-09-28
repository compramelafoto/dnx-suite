import { describe, expect, it } from "vitest";
import { clasificarTarjeta, enEmbudosIncluidos, esperaResultado } from "./inbox";
import type { OportunidadVenta } from "./opportunity";

const HOY = new Date("2026-09-28T15:00:00.000Z");

function op(over: Partial<OportunidadVenta> = {}): OportunidadVenta {
  return {
    fuente: "ALBOOM",
    idExterno: "1",
    titulo: "XV de Sol",
    tipoEvento: "XV",
    nombreCliente: "Sol",
    apellidoCliente: null,
    telefono: null,
    email: null,
    fechaEvento: new Date("2026-12-01T00:00:00.000Z"),
    lugar: null,
    ciudad: null,
    invitados: null,
    origen: null,
    descripcionCliente: null,
    embudo: "Ventas",
    etapa: "Presupuesto enviado",
    etapaOrden: 2,
    etapasTotal: 5,
    abierta: true,
    creadaEn: new Date("2026-09-01T00:00:00.000Z"),
    presupuestoEnviadoEn: new Date("2026-09-10T00:00:00.000Z"),
    modificadaEn: new Date("2026-09-20T00:00:00.000Z"),
    movimientos: [],
    ...over,
  };
}

describe("clasificarTarjeta", () => {
  it("manda a PARA_CERRAR cuando el evento ya pasó, aunque la sugerencia diga otra cosa", () => {
    const r = clasificarTarjeta({
      oportunidad: op({ fechaEvento: new Date("2026-01-01T00:00:00.000Z") }),
      staleDays: 120,
      hoy: HOY,
      sugerencia: { accion: "ESCRIBIR", prioridad: "ALTA", estado: "PENDIENTE", motivo: "Sin respuesta" },
    });
    expect(r.grupo).toBe("PARA_CERRAR");
    expect(r.accionHoy).toBe(false);
    expect(r.motivoCierre).toMatch(/ya pasó/);
  });

  it("manda a PARA_CERRAR cuando la sugerencia vigente es CERRAR_PERDIDA", () => {
    const r = clasificarTarjeta({
      oportunidad: op(),
      staleDays: 120,
      hoy: HOY,
      sugerencia: { accion: "CERRAR_PERDIDA", prioridad: "BAJA", estado: "PENDIENTE", motivo: "No contestó nunca" },
    });
    expect(r.grupo).toBe("PARA_CERRAR");
    expect(r.motivoCierre).toBe("No contestó nunca");
  });

  it("manda a HOY una sugerencia PENDIENTE con acción de mensaje", () => {
    const r = clasificarTarjeta({
      oportunidad: op(),
      staleDays: 120,
      hoy: HOY,
      sugerencia: { accion: "ESCRIBIR", prioridad: "ALTA", estado: "PENDIENTE", motivo: "Evento cerca" },
    });
    expect(r.grupo).toBe("HOY");
    expect(r.accionHoy).toBe(true);
    expect(r.prioridad).toBe("ALTA");
  });

  it("manda a HOY una sugerencia PENDIENTE de REVISAR_A_MANO", () => {
    const r = clasificarTarjeta({
      oportunidad: op(),
      staleDays: 120,
      hoy: HOY,
      sugerencia: { accion: "REVISAR_A_MANO", prioridad: "MEDIA", estado: "PENDIENTE", motivo: "Caso raro" },
    });
    expect(r.grupo).toBe("HOY");
    expect(r.accionHoy).toBe(true);
  });

  it("una sugerencia PENDIENTE de ESPERAR va a ESPERANDO, no a HOY", () => {
    const r = clasificarTarjeta({
      oportunidad: op(),
      staleDays: 120,
      hoy: HOY,
      sugerencia: { accion: "ESPERAR", prioridad: "MEDIA", estado: "PENDIENTE", motivo: "Recién se escribió" },
    });
    expect(r.grupo).toBe("ESPERANDO");
    expect(r.accionHoy).toBe(false);
  });

  it("una sugerencia ya ENVIADA no vuelve a marcar HOY", () => {
    const r = clasificarTarjeta({
      oportunidad: op(),
      staleDays: 120,
      hoy: HOY,
      sugerencia: { accion: "ESCRIBIR", prioridad: "ALTA", estado: "ENVIADA", motivo: "Ya se mandó" },
    });
    expect(r.grupo).toBe("ESPERANDO");
  });

  it("sin ninguna sugerencia todavía, va a ESPERANDO con prioridad null", () => {
    const r = clasificarTarjeta({ oportunidad: op(), staleDays: 120, hoy: HOY, sugerencia: null });
    expect(r.grupo).toBe("ESPERANDO");
    expect(r.prioridad).toBeNull();
  });
});

describe("esperaResultado", () => {
  const f = (tipo: "MENSAJE_ENVIADO" | "RESULTADO" | "NOTA", fecha: string, sugerenciaId: string | null = null) => ({
    tipo,
    fecha: new Date(fecha),
    sugerenciaId,
  });

  it("sin envíos no espera nada", () => {
    expect(esperaResultado([])).toEqual({ espera: false, sugerenciaId: null });
    expect(esperaResultado([f("RESULTADO", "2026-09-20T10:00:00Z")])).toEqual({ espera: false, sugerenciaId: null });
  });
  it("espera cuando el último envío no tiene un resultado posterior, y dice de qué sugerencia", () => {
    expect(
      esperaResultado([
        f("RESULTADO", "2026-09-20T10:00:00Z"),
        f("MENSAJE_ENVIADO", "2026-09-25T10:00:00Z", "s2"),
        f("NOTA", "2026-09-26T10:00:00Z"),
      ]),
    ).toEqual({ espera: true, sugerenciaId: "s2" });
  });
  it("deja de esperar cuando hay un resultado después del último envío", () => {
    expect(
      esperaResultado([
        f("RESULTADO", "2026-09-27T10:00:00Z"),
        f("MENSAJE_ENVIADO", "2026-09-25T10:00:00Z", "s2"),
      ]).espera,
    ).toBe(false);
  });
});

describe("enEmbudosIncluidos", () => {
  it("sólo entra un embudo marcado, comparando sin espacios de más", () => {
    expect(enEmbudosIncluidos("Casamientos", ["Casamientos"])).toBe(true);
    expect(enEmbudosIncluidos("  Casamientos ", [" Casamientos"])).toBe(true);
    expect(enEmbudosIncluidos("Workshops", ["Casamientos"])).toBe(false);
  });
  it("sin embudos marcados no entra ninguno", () => {
    expect(enEmbudosIncluidos("Casamientos", [])).toBe(false);
  });
});
