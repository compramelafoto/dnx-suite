import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const S = await import("./semaforo");
const { calcularSemaforo, semaforosPorDia } = await import("./semaforo-puro");

const DIA = new Date("2026-12-12T00:00:00.000Z");
const OTRO_DIA = new Date("2026-12-19T00:00:00.000Z");

beforeEach(() => B.vaciar());

describe("colores (puro)", () => {
  it("rojo al llegar al tope, amarillo con algo ese día, verde si no hay nada", () => {
    expect(calcularSemaforo(2, 0, 2)).toMatchObject({ color: "ROJO" });
    expect(calcularSemaforo(3, 1, 2).texto).toMatch(/Fecha ocupada: ya hay 3 eventos contratados ese día \(podés cubrir 2\)\. Además hay 1 consulta más/);
    expect(calcularSemaforo(1, 0, 2)).toMatchObject({ color: "AMARILLO", texto: "Queda lugar: hay 1 evento contratado ese día (podés cubrir 2)." });
    expect(calcularSemaforo(0, 2, 2)).toMatchObject({ color: "AMARILLO", texto: "Fecha libre, pero hay 2 consultas más para ese día." });
    expect(calcularSemaforo(0, 0, 2)).toMatchObject({ color: "VERDE" });
    expect(calcularSemaforo(1, 0, 1).color).toBe("ROJO");
  });

  it("el tope fuera de rango se acota", () => {
    expect(calcularSemaforo(1, 0, 0).capacidad).toBe(1);
    expect(calcularSemaforo(1, 0, 99).capacidad).toBe(20);
  });

  it("nunca se cuenta a sí misma", () => {
    const m = semaforosPorDia([{ leadId: "a", dia: "2026-12-12" }], new Map([["2026-12-12", new Set(["a"])]]), new Map([["2026-12-12", new Set(["a", "b"])]]), 2);
    expect(m.get("a")).toMatchObject({ contratados: 0, consultas: 1, color: "AMARILLO" });
  });
});

describe("semáforo desde la base", () => {
  const lead = (id: string, status: string, eventDate: Date | null, workspaceId = "w1") => B.agregar("serviceSalesLead", { id, workspaceId, name: id, status, eventDate, eventType: "XV" });
  const pedido = (id: string, consultaLeadId: string | null, status = "CONFIRMADO", eventDate: Date = DIA, workspaceId = "w1") =>
    B.agregar("fotofficePedido", { id, workspaceId, consultaLeadId, status, eventDate, number: id });

  it("con tope 2 (DNX): un pedido deja amarillo, dos lo ponen rojo; los cancelados y otros días no cuentan", async () => {
    B.agregar("fotofficeConsultaAjustes", { workspaceId: "w1", eventsPerDay: 2 });
    lead("mia", "NEW", DIA);
    lead("ganada-1", "WON", DIA);
    pedido("p1", "ganada-1");
    pedido("p-cancelado", "x1", "CANCELADO");
    pedido("p-otro-dia", "x2", "CONFIRMADO", OTRO_DIA);
    expect((await S.semaforosDeConsultas("w1", [{ leadId: "mia", fecha: DIA }])).get("mia")).toMatchObject({ color: "AMARILLO", contratados: 1, consultas: 0 });
    pedido("p2", "x3");
    expect((await S.semaforosDeConsultas("w1", [{ leadId: "mia", fecha: DIA }])).get("mia")).toMatchObject({ color: "ROJO", contratados: 2 });
  });

  it("una ganada sin pedido también toma la fecha; las abiertas del mismo día dan amarillo; otro workspace no cuenta", async () => {
    lead("mia", "CONTACTED", DIA);
    lead("otra-abierta", "QUOTED", DIA);
    lead("perdida", "LOST", DIA);
    lead("ajena", "WON", DIA, "w2");
    pedido("p-ajeno", null, "CONFIRMADO", DIA, "w2");
    expect((await S.semaforosDeConsultas("w1", [{ leadId: "mia", fecha: DIA }])).get("mia")).toMatchObject({ color: "AMARILLO", contratados: 0, consultas: 1, capacidad: 1 });
    lead("ganada-sin-pedido", "WON", DIA);
    expect((await S.semaforosDeConsultas("w1", [{ leadId: "mia", fecha: DIA }])).get("mia")).toMatchObject({ color: "ROJO", contratados: 1 });
  });

  it("sin fecha no hay semáforo; sin nada ese día, verde", async () => {
    lead("mia", "NEW", OTRO_DIA);
    const m = await S.semaforosDeConsultas("w1", [{ leadId: "mia", fecha: OTRO_DIA }, { leadId: "sin", fecha: null }]);
    expect(m.get("mia")?.color).toBe("VERDE");
    expect(m.has("sin")).toBe(false);
    expect((await S.semaforosDeConsultas("w1", [])).size).toBe(0);
  });
});
