import { describe, expect, it } from "vitest";
import {
  buildEventDescription,
  buildEventSummary,
  type CalendarEventData,
} from "./event-content";

const base: CalendarEventData = {
  spaceName: "Coworking",
  contactName: "Daniel Andrés Cuart",
  contactEmail: "daniel@ejemplo.com",
  contactPhone: null,
  memberPhone: null,
  memberNumber: null,
  extras: [],
};

const socio: CalendarEventData = { ...base, memberNumber: "556" };

describe("título del evento", () => {
  it("lleva el número de socio cuando lo hay", () => {
    expect(buildEventSummary(socio)).toBe("Coworking — Daniel Andrés Cuart · N° 556");
  });

  it("no inventa un número para quien no es socio", () => {
    expect(buildEventSummary(base)).toBe("Coworking — Daniel Andrés Cuart");
  });
});

describe("descripción del evento", () => {
  it("dice quién reservó y su condición", () => {
    expect(buildEventDescription(socio)).toContain("Socio N° 556 · Daniel Andrés Cuart");
    expect(buildEventDescription(base)).toContain("No socio · Daniel Andrés Cuart");
  });

  it("arma el enlace de WhatsApp cuando el número trae código de país", () => {
    const texto = buildEventDescription({ ...socio, contactPhone: "+54 9 341 681 1201" });
    expect(texto).toContain("WhatsApp: +54 9 341 681 1201");
    expect(texto).toContain("https://wa.me/5493416811201");
  });

  it("un número sin código de país se muestra, pero SIN enlace", () => {
    // Completar el país a ojo abriría el chat de un desconocido.
    const texto = buildEventDescription({ ...socio, contactPhone: "3416811201" });
    expect(texto).toContain("Teléfono: 3416811201");
    expect(texto).not.toContain("wa.me");
  });

  it("usa el teléfono del padrón cuando la reserva no dejó uno", () => {
    const texto = buildEventDescription({ ...socio, memberPhone: "+54 9 341 681 1201" });
    expect(texto).toContain("https://wa.me/5493416811201");
  });

  it("prefiere el de la reserva sobre el del padrón: es el más reciente", () => {
    const texto = buildEventDescription({
      ...socio,
      contactPhone: "+54 9 341 111 1111",
      memberPhone: "+54 9 341 222 2222",
    });
    expect(texto).toContain("+54 9 341 111 1111");
    expect(texto).not.toContain("222 2222");
  });

  it("sin ningún teléfono no escribe la línea en vez de decir que falta", () => {
    const texto = buildEventDescription(socio);
    expect(texto).not.toContain("WhatsApp");
    expect(texto).not.toContain("Teléfono");
  });

  it("detalla los extras con sus unidades y su importe", () => {
    const texto = buildEventDescription({
      ...socio,
      extras: [
        { name: "Pack de 2 flashes", units: 1, amountArs: "12000.00", status: "CONFIRMED" },
        { name: "Modelo", units: 2, amountArs: "30000.00", status: "PENDING_CONFIRMATION" },
      ],
    });
    expect(texto).toContain("· Pack de 2 flashes — $12.000");
    expect(texto).toContain("· Modelo ×2 — $30.000 (a confirmar)");
  });

  it("un extra quitado no figura: no se contrató", () => {
    const texto = buildEventDescription({
      ...socio,
      extras: [{ name: "Máquina de humo", units: 1, amountArs: "5000.00", status: "REMOVED" }],
    });
    expect(texto).not.toContain("Máquina de humo");
    expect(texto).not.toContain("Extras");
  });

  it("avisa que el evento no se edita desde Google", () => {
    expect(buildEventDescription(base)).toContain("se maneja desde FotoOffice");
  });
});
