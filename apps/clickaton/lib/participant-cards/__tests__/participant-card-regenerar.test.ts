import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { persistParticipantCardMediaAsset } from "../participant-card-asset-store";

/**
 * Volver a generar una placa que ya existía.
 *
 * El archivo se guarda en una ubicación calculada con una huella de los datos que la componen:
 * los mismos datos dan siempre la misma ubicación. Eso está bien —evita duplicados— pero
 * significa que regenerar una placa sin cambios choca contra el archivo anterior.
 *
 * Pasó al regenerar las 111 placas de producción para que tomaran un arreglo de dibujo: el
 * render salía perfecto y moría al guardarlo, con "Unique constraint failed".
 */
type Fila = { id: string; storageBackend: string; storageKey: string };

function prismaFalso(existentes: Fila[]) {
  const filas = [...existentes];
  const llamadas = { create: 0, update: 0 };

  return {
    llamadas,
    filas,
    db: {
      dnxMediaAsset: {
        async findFirst({ where }: { where: { storageBackend: string; storageKey: string } }) {
          return (
            filas.find(
              (f) =>
                f.storageBackend === where.storageBackend && f.storageKey === where.storageKey,
            ) ?? null
          );
        },
        async create({ data }: { data: Record<string, unknown> }) {
          llamadas.create += 1;
          const fila = {
            id: `nuevo-${filas.length + 1}`,
            storageBackend: String(data.storageBackend),
            storageKey: String(data.storageKey),
          };
          const choca = filas.some(
            (f) => f.storageBackend === fila.storageBackend && f.storageKey === fila.storageKey,
          );
          if (choca) {
            throw new Error(
              "Unique constraint failed on the fields: (`storageBackend`,`storageKey`)",
            );
          }
          filas.push(fila);
          return fila;
        },
        async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
          llamadas.update += 1;
          const fila = filas.find((f) => f.id === where.id);
          if (!fila) throw new Error("no existe");
          void data;
          return fila;
        },
      },
    },
  };
}

const entrada = {
  cardRecordId: "card-1",
  registrationId: "reg-1",
  editionId: "ed-1",
  storageKey: "clickaton/participant-cards/edition-ed-1/welcome/v1/abc.png",
  publicUrl: null,
  png: Buffer.from("imagen"),
  width: 1080,
  height: 1920,
  storageBackend: "R2",
  templateKey: "TEMPLATE_V2_WELCOME",
  templateVersion: 1,
  cardType: "welcome",
  renderHashPrefix: "abc",
};

describe("guardar una placa regenerada", () => {
  it("reutiliza el registro cuando el archivo ya estaba en esa ubicación", async () => {
    const fake = prismaFalso([
      { id: "viejo-1", storageBackend: "R2", storageKey: entrada.storageKey },
    ]);

    const id = await persistParticipantCardMediaAsset({
      ...entrada,
      prisma: fake.db as never,
    });

    assert.equal(id, "viejo-1", "tiene que devolver el registro que ya existía");
    assert.equal(fake.llamadas.create, 0, "no puede intentar crear uno nuevo y chocar");
  });

  it("crea el registro cuando la placa es nueva", async () => {
    const fake = prismaFalso([]);

    const id = await persistParticipantCardMediaAsset({
      ...entrada,
      prisma: fake.db as never,
    });

    assert.equal(fake.llamadas.create, 1);
    assert.ok(id.startsWith("nuevo-"));
  });
});
