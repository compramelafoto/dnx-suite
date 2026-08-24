import { describe, expect, it } from "vitest";
import { mapAccountToCollectionStatus } from "./status";

describe("mapAccountToCollectionStatus", () => {
  it("sin cuenta, no conectado", () => {
    expect(mapAccountToCollectionStatus(null)).toBe("NOT_CONNECTED");
  });

  it("cuenta activa con capacidad de split, conectada", () => {
    expect(
      mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: ["SPLIT_RECEIVER"] }),
    ).toBe("CONNECTED");
  });

  /**
   * Una cuenta activa SIN capacidad de split no sirve para cobrar cuotas: se vinculó, pero
   * no puede recibir su parte. Mostrarla como "conectada" haría que la institución creyera
   * que ya puede cobrar cuando todavía no.
   */
  it("cuenta activa sin capacidad de split queda pendiente, no conectada", () => {
    expect(mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: [] })).toBe("PENDING");
  });

  it("cuenta activa con otras capacidades pero sin split queda pendiente", () => {
    expect(
      mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: ["COLLECTOR"] }),
    ).toBe("PENDING");
  });

  it.each([
    ["PENDING", "PENDING"],
    ["NEEDS_REAUTH", "NEEDS_REAUTH"],
    ["REVOKED", "REVOKED"],
    ["DISABLED", "REVOKED"],
  ])("cuenta en %s se muestra como %s", (accountStatus, expected) => {
    expect(
      mapAccountToCollectionStatus({ status: accountStatus, capabilities: ["SPLIT_RECEIVER"] }),
    ).toBe(expected);
  });

  /** Ante un estado que no conocemos, nunca decir que se puede cobrar. */
  it("un estado desconocido no se muestra como conectada", () => {
    expect(
      mapAccountToCollectionStatus({ status: "LO_QUE_SEA", capabilities: ["SPLIT_RECEIVER"] }),
    ).toBe("PENDING");
  });
});
