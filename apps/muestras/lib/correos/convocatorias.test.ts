import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const findUnique = vi.fn();
const userFindMany = vi.fn();
const enviarEnLote = vi.fn();
const enviar = vi.fn();
vi.mock("@repo/db", () => ({
  prisma: { culturalCall: { updateMany: (a: unknown) => updateMany(a), findUnique: (a: unknown) => findUnique(a) }, user: { findMany: (a: unknown) => userFindMany(a) } },
}));
vi.mock("./enviar", () => ({ APP_URL: "https://x.test", enviar: (...a: unknown[]) => enviar(...a), enviarEnLote: (m: unknown) => enviarEnLote(m) }));

import { avisarConvocatoriaCerrada, avisarInvitacionCurador, avisarResultados } from "./convocatorias";

const sub = (userId: number, decisions: string[]) => ({ userId, authorName: "Ana P", works: decisions.map((d, i) => ({ title: `T${i}`, decision: d })) });

beforeEach(() => {
  for (const f of [updateMany, findUnique, userFindMany, enviarEnLote, enviar]) f.mockReset();
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
  it("resultados: sin decidir cuenta como no elegida (D20) y también recibe aviso", async () => {
    findUnique
      .mockResolvedValueOnce({ status: "DONE", curationClosedAt: new Date() })
      .mockResolvedValueOnce({ title: "C", submissions: [sub(1, ["SELECTED", "PENDING"]), sub(2, ["NOT_SELECTED", "PENDING"])] });
    enviarEnLote.mockResolvedValue({ compuerta: true, total: 2, aceptados: 2 });
    await avisarResultados("c1");
    const m = enviarEnLote.mock.calls[0]![0] as { to: string; parrafos: string[] }[];
    expect(m.map((x) => x.to)).toEqual(["a@x.com", "b@x.com"]);
    const textoA = m[0]!.parrafos.join(" ");
    expect(textoA).toContain("T0");
    expect(textoA).not.toContain("T1");
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

describe("avisarInvitacionCurador", () => {
  const p = { email: "c@x.com", token: "tok", convocatoria: "C", organizador: "Ana", invitedAt: new Date("2026-10-01T12:00:00Z") };
  it("dice si salió y devuelve el mismo enlace que va en el correo", async () => {
    enviar.mockResolvedValue(true);
    expect(await avisarInvitacionCurador(p)).toEqual({ enviado: true, url: "https://x.test/panel/curaduria/invitacion/tok" });
    expect(enviar.mock.calls[0]![3]).toMatchObject({ url: "https://x.test/panel/curaduria/invitacion/tok" });
  });
  it("si no salió, lo dice", async () => {
    enviar.mockResolvedValue(false);
    expect((await avisarInvitacionCurador(p)).enviado).toBe(false);
  });
});
