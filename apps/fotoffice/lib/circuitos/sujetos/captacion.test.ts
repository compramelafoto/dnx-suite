import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { adaptadorCaptacion } = await import("./captacion");
const { adaptadorDe } = await import("./index");

type Tx = Parameters<typeof adaptadorCaptacion.existe>[0];
const tx = B.prisma as unknown as Tx;
const status = (id: string) => B.datos.serviceSalesLead.find((l) => l.id === id)?.status;

beforeEach(() => {
  B.vaciar();
  B.agregar("serviceSalesLead", {
    id: "l1", workspaceId: "ws-1", name: "Laura Pérez", eventType: "BODA", eventDate: new Date("2026-12-20T15:00:00Z"), status: "NEW",
  });
  B.agregar("serviceSalesLead", { id: "l2", workspaceId: "ws-1", name: "Martín", eventType: "RARO", status: "QUOTED" });
  B.agregar("serviceSalesLead", { id: "l3", workspaceId: "ws-2", name: "Ajena", eventType: "XV", status: "NEW" });
});

describe("adaptadorDe", () => {
  it("sólo Captación está conectada", () => {
    expect(adaptadorDe("CAPTACION")).toBe(adaptadorCaptacion);
    expect(adaptadorCaptacion.moduleKey).toBe("service-leads");
    expect(adaptadorCaptacion.rutaTablero).toBe("/consultas");
    expect(adaptadorCaptacion.rutaFicha("a/b")).toBe("/consultas/a%2Fb");
    for (const t of ["CONSULTA", "PROYECTO", "COBERTURA", "toString", ""]) expect(adaptadorDe(t)).toBeNull();
  });
});

describe("adaptadorCaptacion", () => {
  it("existe sólo dentro del workspace", async () => {
    expect(await adaptadorCaptacion.existe(tx, "ws-1", "l1")).toBe(true);
    expect(await adaptadorCaptacion.existe(tx, "ws-1", "l3")).toBe(false);
    expect(await adaptadorCaptacion.existe(tx, "ws-2", "l1")).toBe(false);
  });

  it("nombre: título, tipo y fecha del evento, enlace a la ficha; ignora ids ajenos", async () => {
    const m = await adaptadorCaptacion.nombre("ws-1", ["l1", "l2", "l3", "l1"]);
    expect([...m.keys()].sort()).toEqual(["l1", "l2"]);
    expect(m.get("l1")).toEqual({ titulo: "Laura Pérez", subtitulo: "Boda · 20/12/2026", href: "/consultas/l1" });
    expect(m.get("l2")).toEqual({ titulo: "Martín", subtitulo: "RARO", href: "/consultas/l2" });
    expect((await adaptadorCaptacion.nombre("ws-1", [])).size).toBe(0);
  });

  it("alCambiarEtapa: salida manda, etapa con estado lo pone, etapa sin estado no toca", async () => {
    const cambiar = adaptadorCaptacion.alCambiarEtapa!;
    await cambiar(tx, "ws-1", "l1", { leadStatus: "CONTACTED" }, null);
    expect(status("l1")).toBe("CONTACTED");
    await cambiar(tx, "ws-1", "l1", { leadStatus: null }, null);
    expect(status("l1")).toBe("CONTACTED");
    await cambiar(tx, "ws-1", "l1", { leadStatus: "WON" }, null); // una etapa no puede ganar
    expect(status("l1")).toBe("CONTACTED");
    await cambiar(tx, "ws-1", "l1", null, "GANADA");
    expect(status("l1")).toBe("WON");
    await cambiar(tx, "ws-1", "l2", null, "PERDIDA");
    expect(status("l2")).toBe("LOST");
    await cambiar(tx, "ws-1", "l2", null, "TERMINADO");
    expect(status("l2")).toBe("LOST");
  });

  it("alCambiarEtapa no toca consultas de otro workspace", async () => {
    await adaptadorCaptacion.alCambiarEtapa!(tx, "ws-1", "l3", null, "GANADA");
    expect(status("l3")).toBe("NEW");
  });
});
