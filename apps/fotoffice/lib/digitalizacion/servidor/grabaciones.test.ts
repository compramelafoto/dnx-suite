import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findFirst: vi.fn() },
  digitalizacionGrabacion: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  digitalizacionParte: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  digitalizacionEquipo: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
}));
vi.mock("@repo/db", () => ({ prisma: db }));
const almacen = vi.hoisted(() => ({ urlDeSubidaParte: vi.fn(async () => "https://r2/firmada"), tamanoDeParte: vi.fn(), urlDeLecturaParte: vi.fn(), borrarPrefijo: vi.fn() }));
vi.mock("./almacen", () => almacen);

import type { NuevaGrabacion } from "../validar";
import { confirmarParte, crearGrabacion, pedirParte } from "./grabaciones";

const ctx = { workspaceId: "ws1", userId: 7 };
const vhs: NuevaGrabacion = { tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "MEDIA", mimeType: "video/webm;codecs=vp9,opus", corregirProporcion: false, equipoId: null, dvdArchivos: null };

beforeEach(() => vi.clearAllMocks());

describe("crearGrabacion", () => {
  it("rechaza un trabajo de otro negocio", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue(null);
    expect(await crearGrabacion(ctx, vhs)).toMatchObject({ ok: false });
    expect(db.fotofficeProyecto.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", workspaceId: "ws1" } }));
    expect(db.digitalizacionGrabacion.create).not.toHaveBeenCalled();
  });
  it("crea la grabación del negocio", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p1" });
    db.digitalizacionGrabacion.create.mockResolvedValue({ id: "g1" });
    expect(await crearGrabacion(ctx, vhs)).toEqual({ ok: true, id: "g1", tramo: 1 });
  });
});

describe("pedirParte", () => {
  it("no firma partes de una grabación ajena", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
  });
  it("una parte ya LISTA no se vuelve a subir", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ estado: "LISTA" });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 3, bytes: 10 })).toEqual({ ok: true, yaEstaba: true });
    expect(almacen.urlDeSubidaParte).not.toHaveBeenCalled();
  });
  it("firma la clave armada por el servidor", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 3, bytes: 10 })).toEqual({ ok: true, yaEstaba: false, url: "https://r2/firmada", tipoContenido: "video/webm" });
    expect(almacen.urlDeSubidaParte).toHaveBeenCalledWith("digitalizacion/ws1/g1/t1/000003.webm", "video/webm", 10);
  });
  it("no acepta un tramo que todavía no existe", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 2, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
  });
});

describe("confirmarParte", () => {
  it("cuenta los bytes una sola vez aunque se confirme dos veces", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ id: "pa1", key: "digitalizacion/ws1/g1/t1/000000.webm", bytes: BigInt(10), estado: "PENDIENTE" });
    almacen.tamanoDeParte.mockResolvedValue(10);
    db.digitalizacionParte.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 });
    await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 });
    expect(db.digitalizacionGrabacion.update).toHaveBeenCalledTimes(1);
  });
  it("si el tamaño en R2 no coincide, no la confirma", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ id: "pa1", key: "k", bytes: BigInt(10), estado: "PENDIENTE" });
    almacen.tamanoDeParte.mockResolvedValue(4);
    expect(await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 })).toMatchObject({ ok: false });
  });
});
