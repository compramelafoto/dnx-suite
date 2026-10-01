import { describe, expect, it } from "vitest";
import { planSubmission } from "./submit-plan";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";

const settings = { ...DEFAULT_COVERAGE_SETTINGS, publicFormEnabled: true };

const parsed = {
  contactEmail: "contacto@manos.org",
  startsAt: new Date("2026-09-26T17:00:00Z"),
};

/**
 * Qué hay que decidir ANTES de escribir nada.
 *
 * Es función pura y no la transacción entera porque acá viven las decisiones que importan —si
 * el formulario está abierto, si esto es spam, si ya lo mandaron— y todas se pueden probar sin
 * base de datos. La transacción, después, solo ejecuta el plan.
 */
describe("planSubmission", () => {
  it("con el formulario cerrado no se recibe nada", () => {
    // Esconder el formulario no es un control: el POST puede llegar igual.
    const r = planSubmission({
      settings: { ...settings, publicFormEnabled: false },
      recientes: 0,
      duplicada: null,
      parsed,
    });
    expect(r.kind).toBe("RECHAZAR");
    if (r.kind === "RECHAZAR") expect(r.error.toLowerCase()).toContain("no están abiertas");
  });

  it("pasado el tope de envíos, se frena", () => {
    const r = planSubmission({ settings, recientes: 3, duplicada: null, parsed });
    expect(r.kind).toBe("RECHAZAR");
  });

  it("una solicitud igual ya en curso no se duplica: se la reconoce", () => {
    // Que alguien apriete dos veces no puede generar dos pedidos que la coordinación después
    // tiene que descartar a mano.
    const r = planSubmission({
      settings,
      recientes: 0,
      duplicada: { id: "req-1", publicCode: "SC-2026-0041" },
      parsed,
    });
    expect(r.kind).toBe("YA_EXISTE");
    if (r.kind === "YA_EXISTE") expect(r.publicCode).toBe("SC-2026-0041");
  });

  it("el freno se evalúa antes que el duplicado", () => {
    // Al revés, quien manda cien pedidos iguales recibiría cien respuestas amables en vez de
    // un freno.
    const r = planSubmission({
      settings,
      recientes: 99,
      duplicada: { id: "req-1", publicCode: "SC-2026-0041" },
      parsed,
    });
    expect(r.kind).toBe("RECHAZAR");
  });

  it("todo en orden: se guarda", () => {
    const r = planSubmission({ settings, recientes: 0, duplicada: null, parsed });
    expect(r.kind).toBe("GUARDAR");
  });
});
