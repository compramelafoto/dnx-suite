import { describe, expect, it } from "vitest";
import {
  BOOKING_EXTERNAL_REFERENCE_PREFIX,
  bookingExternalReference,
  parseBookingExternalReference,
} from "./checkout";

describe("cómo se reconoce un pago de reserva", () => {
  it("la referencia lleva el prefijo y el identificador", () => {
    expect(bookingExternalReference("abc123")).toBe(`${BOOKING_EXTERNAL_REFERENCE_PREFIX}abc123`);
  });

  it("lo que se escribe se vuelve a leer", () => {
    expect(parseBookingExternalReference(bookingExternalReference("abc123"))).toBe("abc123");
  });

  it("una referencia de cuotas NO se confunde con una de reservas", () => {
    // Las cuotas mandan el id pelado del MembershipPayment. Sin el prefijo, el webhook de
    // reservas acreditaría un pago de cuota contra una reserva inexistente.
    expect(parseBookingExternalReference("cmf9x0000abcd")).toBeNull();
  });

  it("basura o vacío no devuelve un identificador inventado", () => {
    expect(parseBookingExternalReference(null)).toBeNull();
    expect(parseBookingExternalReference(undefined)).toBeNull();
    expect(parseBookingExternalReference("")).toBeNull();
    expect(parseBookingExternalReference("booking:")).toBeNull();
    expect(parseBookingExternalReference("bookings:abc")).toBeNull();
    expect(parseBookingExternalReference(123 as unknown as string)).toBeNull();
  });
});
