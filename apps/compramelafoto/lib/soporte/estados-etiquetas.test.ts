import { describe, expect, it } from "vitest";
import { getStatusLabel } from "@/lib/admin/helpers";
import { getSupportStatusLabel } from "@/lib/support-url";
import { isTicketClosedForUserReply } from "@/lib/support/sanitize";

describe("estado Esperando al cliente", () => {
  it("tiene etiqueta en el admin y en el panel del usuario", () => {
    expect(getStatusLabel("WAITING_CUSTOMER")).toBe("Esperando al cliente");
    expect(getSupportStatusLabel("WAITING_CUSTOMER")).toBe("Esperando tu respuesta");
  });

  it("un caso resuelto se puede reabrir; uno cerrado no", () => {
    expect(isTicketClosedForUserReply("RESOLVED")).toBe(false);
    expect(isTicketClosedForUserReply("CLOSED")).toBe(true);
  });
});
