import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  fotofficeCircuit: { count: vi.fn(), create: vi.fn() },
  fotofficeLossReason: { count: vi.fn(), createMany: vi.fn() },
};
vi.mock("@repo/db", () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) },
}));

import { prisma } from "@repo/db";
import { asegurarCircuitos } from "./asegurar";
import { CIRCUITOS_DNX, MOTIVOS_INICIALES } from "./dnx";
import { CIRCUITO_MINIMO } from "./minimo";

const ETAPAS: Record<string, number> = {
  "Colaboradores": 2, "Embudo de Ventas DNX 2022": 6, "Plataforma 360": 1, "Workshops": 4,
  "Base 360°": 3, "Cobertura y edición de fotografía de evento": 7, "Cobertura y edición de Video de evento": 6,
  "Diseño de invitación web": 3, "Edición de placa gráfica o diseño": 6, "Edición de Videos para RRSS": 6,
  "Evento Social - Edición de Video Final de Fiesta": 5, "Evento Social - Fotografías como 2do fotógrafo": 3,
  "Fotolibro": 10, "Impresión de Fotografías": 4, "Impresión de Fotografías para Números de MESA": 5,
  "Impresiones a laboratorio": 5, "Pendrive": 3, "Publicar Video en RRSS": 4,
  "Servicio de Proyección en Vivo Selpix": 3, "Sesión Fotográfica": 8, "Stand de glitter": 1,
};

describe("CIRCUITOS_DNX", () => {
  it("tiene 4 de venta y 17 de trabajo", () => {
    expect(CIRCUITOS_DNX.filter((c) => c.kind === "VENTA")).toHaveLength(4);
    expect(CIRCUITOS_DNX.filter((c) => c.kind === "TRABAJO")).toHaveLength(17);
  });
  it("un solo predeterminado, de venta", () => {
    const d = CIRCUITOS_DNX.filter((c) => c.isDefault);
    expect(d).toHaveLength(1);
    expect(d[0]!.name).toBe("Embudo de Ventas DNX 2022");
    expect(d[0]!.kind).toBe("VENTA");
  });
  it("etapas por circuito como en el documento", () => {
    for (const c of CIRCUITOS_DNX) expect(c.stages.length, c.name).toBe(ETAPAS[c.name]);
    expect(CIRCUITOS_DNX.map((c) => c.name).sort()).toEqual(Object.keys(ETAPAS).sort());
  });
  it("nombres únicos y sin erratas", () => {
    const n = CIRCUITOS_DNX.map((c) => c.name);
    expect(new Set(n).size).toBe(n.length);
    const todo = JSON.stringify(CIRCUITOS_DNX);
    for (const x of ["oportunidnad", "Confecciónar", "Confecciónar ", "Eidción", "Instalr", "Impresion ", "Proyeccion"]) expect(todo).not.toContain(x);
  });
  it("días por etapa y total como en el documento", () => {
    const DIAS: Record<string, [number[], number]> = {
      "Colaboradores": [[1, 1], 2],
      "Embudo de Ventas DNX 2022": [[2, 1, 1, 1, 1, 1], 7],
      "Plataforma 360": [[1], 1],
      "Workshops": [[2, 1, 1, 1], 5],
      "Base 360°": [[3, 1, 1], 5],
      "Cobertura y edición de fotografía de evento": [[1, 1, 10, 1, 1, 1, 0], 15],
      "Cobertura y edición de Video de evento": [[1, 1, 15, 1, 1, 0], 19],
      "Diseño de invitación web": [[2, 2, 1], 5],
      "Edición de placa gráfica o diseño": [[1, 1, 1, 1, 1, 1], 6],
      "Edición de Videos para RRSS": [[1, 1, 1, 1, 1, 1], 6],
      "Evento Social - Edición de Video Final de Fiesta": [[0, 0, 0, 0, 0], 0],
      "Evento Social - Fotografías como 2do fotógrafo": [[1, 1, 0], 2],
      "Fotolibro": [[7, 2, 1, 1, 1, 1, 1, 7, 2, 0], 23],
      "Impresión de Fotografías": [[1, 1, 1, 0], 3],
      "Impresión de Fotografías para Números de MESA": [[1, 1, 1, 1, 0], 4],
      "Impresiones a laboratorio": [[1, 1, 1, 1, 1], 5],
      "Pendrive": [[1, 1, 0], 2],
      "Publicar Video en RRSS": [[1, 1, 1, 1], 4],
      "Servicio de Proyección en Vivo Selpix": [[0, 1, 3], 4],
      "Sesión Fotográfica": [[0, 1, 1, 1, 1, 1, 2, 0], 7],
      "Stand de glitter": [[20], 20],
    };
    expect(Object.keys(DIAS)).toHaveLength(21);
    for (const c of CIRCUITOS_DNX) {
      const [dias, total] = DIAS[c.name]!;
      const reales = c.stages.map((s) => s.days);
      expect(reales, c.name).toEqual(dias);
      expect(reales.reduce((a, b) => a + b, 0), c.name).toBe(total);
    }
  });
  it("cantidad de tareas por circuito", () => {
    const TAREAS: Record<string, number> = {
      "Diseño de invitación web": 5,
      "Edición de placa gráfica o diseño": 6,
      "Edición de Videos para RRSS": 4,
      "Evento Social - Edición de Video Final de Fiesta": 1,
      "Fotolibro": 4,
      "Impresión de Fotografías": 1,
      "Impresiones a laboratorio": 6,
      "Publicar Video en RRSS": 3,
      "Servicio de Proyección en Vivo Selpix": 9,
    };
    for (const c of CIRCUITOS_DNX) {
      const n = c.stages.reduce((a, s) => a + (s.tasks?.length ?? 0), 0);
      expect(n, c.name).toBe(TAREAS[c.name] ?? 0);
    }
  });
  it("Stand de glitter sin tareas", () => {
    const g = CIRCUITOS_DNX.find((c) => c.name === "Stand de glitter")!;
    expect(g.stages[0]).toMatchObject({ name: "Configurar plataforma", days: 20 });
    expect(g.stages.every((s) => !s.tasks?.length)).toBe(true);
  });
  it("estados de captación del embudo predeterminado", () => {
    const d = CIRCUITOS_DNX.find((c) => c.isDefault)!;
    expect(d.stages.map((s) => s.leadStatus)).toEqual(["NEW", "CONTACTED", "QUOTED", "INTERESTED", undefined, undefined]);
  });
});

describe("asegurarCircuitos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.fotofficeCircuit.count.mockResolvedValue(0);
    tx.fotofficeLossReason.count.mockResolvedValue(0);
  });
  it("no escribe si ya hay circuitos", async () => {
    tx.fotofficeCircuit.count.mockResolvedValue(1);
    await asegurarCircuitos("w1", "dnxestudio");
    expect(tx.fotofficeCircuit.create).not.toHaveBeenCalled();
    expect(tx.fotofficeLossReason.createMany).not.toHaveBeenCalled();
  });
  it("DNX: 21 circuitos y 6 motivos", async () => {
    await asegurarCircuitos("w1", "dnxestudio");
    expect(vi.mocked(prisma.$transaction).mock.calls[0]![1]).toEqual({ timeout: 30_000, maxWait: 10_000 });
    expect(tx.fotofficeCircuit.create).toHaveBeenCalledTimes(21);
    expect(tx.fotofficeLossReason.createMany.mock.calls[0]![0].data).toHaveLength(MOTIVOS_INICIALES.length);
  });
  it("DNX con la dirección histórica dnx-estudio también recibe sus 21 circuitos", async () => {
    await asegurarCircuitos("w1", "dnx-estudio");
    expect(tx.fotofficeCircuit.create).toHaveBeenCalledTimes(21);
  });
  it("otro workspace: 1 circuito y 6 motivos", async () => {
    await asegurarCircuitos("w2", "otra");
    expect(tx.fotofficeCircuit.create).toHaveBeenCalledTimes(1);
    expect(tx.fotofficeCircuit.create.mock.calls[0]![0].data.name).toBe(CIRCUITO_MINIMO.name);
    expect(tx.fotofficeLossReason.createMany.mock.calls[0]![0].data).toHaveLength(6);
  });
  it("tolera la carrera (P2002)", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(asegurarCircuitos("w1", "x")).resolves.toBeUndefined();
  });
  it("otros errores se propagan", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("boom"));
    await expect(asegurarCircuitos("w1", "x")).rejects.toThrow("boom");
  });
});
