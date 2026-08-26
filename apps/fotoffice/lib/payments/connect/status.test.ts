import { describe, expect, it } from "vitest";
import { mapAccountToCollectionStatus } from "./status";

describe("mapAccountToCollectionStatus", () => {
  it("sin cuenta, no conectado", () => {
    expect(mapAccountToCollectionStatus(null)).toBe("NOT_CONNECTED");
  });

  it("cuenta activa con capacidad de split, conectada", () => {
    expect(
      mapAccountToCollectionStatus(
        { status: "ACTIVE", capabilities: ["SPLIT_RECEIVER"] },
        "SPLIT_1N",
      ),
    ).toBe("CONNECTED");
  });

  /**
   * En 1:N una cuenta activa SIN capacidad de split no sirve para cobrar cuotas: se vinculó,
   * pero no puede recibir su parte. Mostrarla como "conectada" haría que la institución
   * creyera que ya puede cobrar cuando todavía no.
   */
  it("en 1:N, cuenta activa sin capacidad de split queda pendiente", () => {
    expect(
      mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: [] }, "SPLIT_1N"),
    ).toBe("PENDING");
  });

  it("en 1:N, cuenta activa con otras capacidades pero sin split queda pendiente", () => {
    expect(
      mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: ["COLLECTOR"] }, "SPLIT_1N"),
    ).toBe("PENDING");
  });

  /**
   * En dos vías la institución cobra con sus propias credenciales: no hay reparto, así que
   * `SPLIT_RECEIVER` no interviene. Exigirla dejaría a una cuenta perfectamente vinculada en
   * "pendiente" para siempre — que es exactamente lo que le pasaba a la SFPR.
   */
  it("en dos vías, una cuenta activa sin capacidad de split está conectada", () => {
    expect(
      mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: [] }, "TWO_WAY"),
    ).toBe("CONNECTED");
  });

  it("dos vías es el modo por omisión", () => {
    expect(mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: [] })).toBe("CONNECTED");
  });

  /** Ni siquiera en dos vías una cuenta revocada puede cobrar. */
  it("en dos vías, el estado de la cuenta se sigue respetando", () => {
    expect(
      mapAccountToCollectionStatus({ status: "REVOKED", capabilities: [] }, "TWO_WAY"),
    ).toBe("REVOKED");
    expect(
      mapAccountToCollectionStatus({ status: "NEEDS_REAUTH", capabilities: [] }, "TWO_WAY"),
    ).toBe("NEEDS_REAUTH");
    expect(
      mapAccountToCollectionStatus({ status: "LO_QUE_SEA", capabilities: [] }, "TWO_WAY"),
    ).toBe("PENDING");
  });

  it.each([
    ["PENDING", "PENDING"],
    ["NEEDS_REAUTH", "NEEDS_REAUTH"],
    ["REVOKED", "REVOKED"],
    ["DISABLED", "REVOKED"],
  ])("cuenta en %s se muestra como %s", (accountStatus, expected) => {
    expect(
      mapAccountToCollectionStatus(
        { status: accountStatus, capabilities: ["SPLIT_RECEIVER"] },
        "SPLIT_1N",
      ),
    ).toBe(expected);
  });

  /** Ante un estado que no conocemos, nunca decir que se puede cobrar. */
  it("un estado desconocido no se muestra como conectada", () => {
    expect(
      mapAccountToCollectionStatus(
        { status: "LO_QUE_SEA", capabilities: ["SPLIT_RECEIVER"] },
        "SPLIT_1N",
      ),
    ).toBe("PENDING");
  });
});
