import { describe, expect, it } from "vitest";
import { parseCoverageRequest } from "./request-form";

/** Un formulario válido mínimo, para no repetirlo en cada caso. */
function base(extra: Record<string, string> = {}): Record<string, string> {
  return {
    orgName: "Asociación Manos Abiertas",
    contactName: "María Pérez",
    contactEmail: "contacto@manosabiertas.org",
    contactPhone: "3415551234",
    eventTitle: "Jornada solidaria para familias",
    startsAt: "2026-09-26T14:00",
    endsAt: "2026-09-26T18:30",
    city: "Rosario",
    ...extra,
  };
}

/**
 * El formulario público.
 *
 * Lo completa alguien que no conoce el sistema, desde el teléfono, probablemente apurado. Se
 * pide lo mínimo indispensable y se valida en el servidor: el navegador puede mandar cualquier
 * cosa y el `required` del HTML no es una validación.
 */
describe("parseCoverageRequest", () => {
  it("un formulario completo pasa", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
  });

  it("sin nombre de organización no se puede tomar el pedido", () => {
    const r = parseCoverageRequest(base({ orgName: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("organización");
  });

  it("sin correo no hay forma de contestar", () => {
    const r = parseCoverageRequest(base({ contactEmail: "" }));
    expect(r.ok).toBe(false);
  });

  it("un correo mal escrito se rechaza", () => {
    expect(parseCoverageRequest(base({ contactEmail: "no-es-un-mail" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ contactEmail: "a@b" })).ok).toBe(false);
  });

  it("el correo se normaliza a minúsculas y sin espacios", () => {
    const r = parseCoverageRequest(base({ contactEmail: "  Contacto@Manos.ORG " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.contactEmail).toBe("contacto@manos.org");
  });

  it("sin fechas no se puede evaluar nada", () => {
    expect(parseCoverageRequest(base({ startsAt: "" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ endsAt: "" })).ok).toBe(false);
  });

  it("el final no puede ser anterior al inicio", () => {
    const r = parseCoverageRequest(
      base({ startsAt: "2026-09-26T18:00", endsAt: "2026-09-26T14:00" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("termina");
  });

  it("calcula la duración, que es lo que alimenta la regla del refuerzo", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.durationMinutes).toBe(270); // 14:00 a 18:30
  });

  it("una fecha inventada se rechaza en vez de guardarse como inválida", () => {
    expect(parseCoverageRequest(base({ startsAt: "cuando sea" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ startsAt: "2026-13-45T99:99" })).ok).toBe(false);
  });

  it("la cantidad de fotógrafos, si viene, tiene que ser un número sensato", () => {
    expect(parseCoverageRequest(base({ requestedPhotographers: "2" })).ok).toBe(true);
    expect(parseCoverageRequest(base({ requestedPhotographers: "0" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ requestedPhotographers: "-1" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ requestedPhotographers: "muchos" })).ok).toBe(false);
  });

  it("la cantidad de asistentes, si viene, tiene que ser un número sensato", () => {
    // Comparte la validación `entero()` con requestedPhotographers: mismos casos.
    expect(parseCoverageRequest(base({ expectedAttendees: "2" })).ok).toBe(true);
    expect(parseCoverageRequest(base({ expectedAttendees: "0" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ expectedAttendees: "-1" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ expectedAttendees: "muchos" })).ok).toBe(false);
  });

  it("los campos opcionales pueden faltar sin drama", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.eventDescription).toBe(null);
      expect(r.data.requestedPhotographers).toBe(null);
    }
  });

  it("los enlaces de documentación se separan y se limpian", () => {
    const r = parseCoverageRequest(
      base({ documentationLinks: "https://a.org\n\n  https://b.org  \n" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.documentationLinks).toEqual(["https://a.org", "https://b.org"]);
  });

  it("un enlace que no es http no entra", () => {
    // Un `javascript:` guardado y después mostrado como enlace en el panel sería un agujero.
    const r = parseCoverageRequest(
      base({ documentationLinks: "javascript:alert(1)\nhttps://ok.org" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.documentationLinks).toEqual(["https://ok.org"]);
  });
});
