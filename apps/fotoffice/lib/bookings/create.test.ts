import { describe, expect, it } from "vitest";
import { isOverlapConstraintError } from "./create";

/**
 * La forma de este error NO está inventada: se capturó ejecutando dos reservas
 * superpuestas contra la base real. Prisma no expone el código de Postgres en `code` ni en
 * `meta` — lo entierra en el texto del mensaje, como `PrismaClientUnknownRequestError`.
 */
const errorReal = Object.assign(
  new Error(
    "\nInvalid `prisma.booking.create()` invocation:\n\n" +
      "Error occurred during query execution:\n" +
      'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { ' +
      'code: "23P01", message: "conflicting key value violates exclusion constraint ' +
      '\\"Booking_sin_solapamiento\\"", severity: "ERROR" }) })',
  ),
  { name: "PrismaClientUnknownRequestError" },
);

describe("el choque que informa la base", () => {
  it("reconoce el error tal como llega de verdad, sin code ni meta", () => {
    expect((errorReal as { code?: unknown }).code).toBeUndefined();
    expect(isOverlapConstraintError(errorReal)).toBe(true);
  });

  it("reconoce el nombre de la restricción en el texto", () => {
    expect(
      isOverlapConstraintError(new Error('violates constraint "Booking_sin_solapamiento"')),
    ).toBe(true);
  });

  it("reconoce el código de Postgres si algún día Prisma sí lo expone", () => {
    expect(isOverlapConstraintError(Object.assign(new Error("x"), { code: "23P01" }))).toBe(true);
    expect(
      isOverlapConstraintError(
        Object.assign(new Error("x"), { code: "P2010", meta: { code: "23P01" } }),
      ),
    ).toBe(true);
  });

  it("no confunde otros errores con un choque de horarios", () => {
    expect(isOverlapConstraintError(new Error("la base no responde"))).toBe(false);
    expect(isOverlapConstraintError(Object.assign(new Error("x"), { code: "P2002" }))).toBe(false);
    expect(isOverlapConstraintError(null)).toBe(false);
    expect(isOverlapConstraintError(undefined)).toBe(false);
    expect(isOverlapConstraintError("23P01")).toBe(false);
  });
});
