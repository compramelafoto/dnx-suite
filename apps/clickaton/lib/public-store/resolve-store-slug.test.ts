import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickStoreSlugWinner,
  type StoreSlugCandidate,
} from "@/lib/public-store/resolve-store-slug";

function candidate(input: {
  id: string;
  updatedAt?: Date;
  isPublished?: boolean;
  registrationEnabled?: boolean;
  status?: string;
}): StoreSlugCandidate {
  return {
    id: input.id,
    storeSlug: "remera-clickaton",
    updatedAt: input.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    edition: {
      isPublished: input.isPublished ?? false,
      registrationEnabled: input.registrationEnabled ?? false,
      status: input.status ?? "DRAFT",
    },
  };
}

describe("resolve-store-slug", () => {
  it("prioriza edición publicada", () => {
    const winner = pickStoreSlugWinner([
      candidate({
        id: "a",
        registrationEnabled: true,
        status: "REGISTRATION_OPEN",
      }),
      candidate({
        id: "b",
        isPublished: true,
        status: "DRAFT",
      }),
    ]);
    assert.equal(winner?.id, "b");
  });

  it("prioriza updatedAt más reciente a igualdad de vigencia", () => {
    const winner = pickStoreSlugWinner([
      candidate({
        id: "older",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        isPublished: true,
        registrationEnabled: true,
        status: "REGISTRATION_OPEN",
      }),
      candidate({
        id: "newer",
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        isPublished: true,
        registrationEnabled: true,
        status: "REGISTRATION_OPEN",
      }),
    ]);
    assert.equal(winner?.id, "newer");
  });

  it("usa id estable como desempate final", () => {
    const when = new Date("2026-06-01T00:00:00.000Z");
    const winner = pickStoreSlugWinner([
      candidate({
        id: "zzz",
        updatedAt: when,
        isPublished: true,
        registrationEnabled: true,
        status: "REGISTRATION_OPEN",
      }),
      candidate({
        id: "aaa",
        updatedAt: when,
        isPublished: true,
        registrationEnabled: true,
        status: "REGISTRATION_OPEN",
      }),
    ]);
    assert.equal(winner?.id, "aaa");
  });
});
