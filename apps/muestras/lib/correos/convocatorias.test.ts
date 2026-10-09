import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const findUnique = vi.fn();
const userFindMany = vi.fn();
const enviarEnLote = vi.fn();
vi.mock("@repo/db", () => ({
  prisma: { culturalCall: { updateMany: (a: unknown) => updateMany(a), findUnique: (a: unknown) => findUnique(a) }, user: { findMany: (a: unknown) => userFindMany(a) } },
}));
vi.mock("./enviar", () => ({ APP_URL: "https://x.test", enviar: vi.fn(), enviarEnLote: (m: unknown) => enviarEnLote(m) }));

import { avisarConvocatoriaCerrada, avisarResultados } from "./convocatorias";

const sub = (userId: number, decisions: string[]) => ({ userId, authorName: "Ana P", works: decisions.map((d, i) => ({ title: `T${i}`, decision: d })) });

beforeEach(() => {
  for (const f of [updateMany, findUnique, userFindMany, enviarEnLote]) f.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  userFindMany.mockResolvedValue([{ id: 1, email: "a@x.com", name: null }, { id: 2, email: "b@x.com", name: null }]);
});

describe("avisos masivos", () => {
  it("cierre con compuerta cerrada: devuelve la marca a null", async () => {
    findUnique.mockResolvedValue({ title: "C", submissions: [sub(1, [])] });
    enviarEnLote.mockResolvedValue({ compuerta: false, total: 1, aceptados: 0 });
    await avisarConvocatoriaCerrada("c1");
    const marca = updateMany.mock.calls[0]![0].data.closedNoticeSentAt;
    expect(updateMany.mock.calls[1]![0]).toEqual({ where: { id: "c1", closedNoticeSentAt: marca }, data: { closedNoticeSentAt: null } });
  });
  it("cierre que salió: la marca queda", async () => {
    findUnique.mockResolvedValue({ title: "C", submissions: [sub(1, [])] });
    enviarEnLote.mockResolvedValue({ compuerta: true, total: 1, aceptados: 1 });
    await avisarConvocatoriaCerrada("c1");
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
  it("resultados con la curaduría abierta: no marca ni manda", async () => {
    findUnique.mockResolvedValue({ status: "CURATING", curationClosedAt: null });
    await avisarResultados("c1");
    expect(updateMany).not.toHaveBeenCalled();
    expect(enviarEnLote).not.toHaveBeenCalled();
  });
  it("resultados: saltea a quien tiene obras pendientes", async () => {
    findUnique
      .mockResolvedValueOnce({ status: "DONE", curationClosedAt: new Date() })
      .mockResolvedValueOnce({ title: "C", submissions: [sub(1, ["SELECTED"]), sub(2, ["NOT_SELECTED", "PENDING"])] });
    enviarEnLote.mockResolvedValue({ compuerta: true, total: 1, aceptados: 1 });
    await avisarResultados("c1");
    const m = enviarEnLote.mock.calls[0]![0] as { to: string }[];
    expect(m.map((x) => x.to)).toEqual(["a@x.com"]);
  });
  it("resultados con lote caído: devuelve la marca", async () => {
    findUnique
      .mockResolvedValueOnce({ status: "DONE", curationClosedAt: null })
      .mockResolvedValueOnce({ title: "C", submissions: [sub(1, ["SELECTED"])] });
    enviarEnLote.mockResolvedValue({ compuerta: true, total: 1, aceptados: 0 });
    await avisarResultados("c1");
    expect(updateMany.mock.calls[1]![0].data).toEqual({ resultsNoticeSentAt: null });
  });
});
