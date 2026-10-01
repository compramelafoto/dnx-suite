import { describe, expect, it } from "vitest";
import type { Prisma } from "@repo/db";
import { recordCashMovement } from "./record-movement";

describe("recordCashMovement", () => {
  describe("guarda de positividad", () => {
    const txFalso = {} as unknown as Prisma.TransactionClient;

    const inputBase = {
      workspaceId: "ws-test",
      accountId: "acc-test",
      kind: "INGRESO" as const,
      occurredAt: new Date(),
      description: "test",
      sourceModule: "membership" as const,
      sourceRef: "ref-test",
    };

    it("lanza si el importe es cero, sin tocar la base", async () => {
      await expect(
        recordCashMovement(txFalso, {
          ...inputBase,
          amountMinor: 0,
        }),
      ).rejects.toThrow(
        "recordCashMovement: el importe tiene que ser mayor que cero (recibido: 0).",
      );
    });

    it("lanza si el importe es negativo, sin tocar la base", async () => {
      await expect(
        recordCashMovement(txFalso, {
          ...inputBase,
          amountMinor: -100,
        }),
      ).rejects.toThrow(
        "recordCashMovement: el importe tiene que ser mayor que cero (recibido: -100).",
      );
    });

    it("el mensaje del error es claro y muestra el valor rechazado", async () => {
      try {
        await recordCashMovement(txFalso, {
          ...inputBase,
          amountMinor: -500,
        });
        expect.fail("Tenía que lanzar");
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/-500/);
        expect((e as Error).message).toMatch(/mayor que cero/);
      }
    });
  });
});
