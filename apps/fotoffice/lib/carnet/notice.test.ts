import { describe, expect, it } from "vitest";
import { buildCardNotice } from "./notice";
import { FULFILLMENT_STATES, shouldNotifyMember } from "./fulfillment";

const base = {
  firstName: "Daniel",
  institutionName: "Sociedad de Fotógrafos",
  cardNumber: "C-2026-0412",
};

describe("buildCardNotice", () => {
  it("avisa que puede pasar a retirarlo, nombrando a la institución", () => {
    const n = buildCardNotice({ ...base, state: "LISTO_PARA_RETIRAR" });
    expect(n).not.toBeNull();
    expect(n?.text).toContain("Daniel");
    expect(n?.text).toContain("Sociedad de Fotógrafos");
    expect(n?.text).toContain("C-2026-0412");
  });

  it("en el envío incluye el detalle, que es el seguimiento", () => {
    const n = buildCardNotice({ ...base, state: "ENVIADO", note: "Correo Argentino, CA123456789AR" });
    expect(n?.text).toContain("CA123456789AR");
  });

  it("no avisa de los pasos internos", () => {
    expect(buildCardNotice({ ...base, state: "EN_COLA" })).toBeNull();
    expect(buildCardNotice({ ...base, state: "IMPRESO" })).toBeNull();
    expect(buildCardNotice({ ...base, state: "ANULADO" })).toBeNull();
  });

  it("hay aviso exactamente para los estados que lo piden", () => {
    // Que las dos reglas no se separen: si mañana se agrega un estado avisable y falta el
    // texto, el socio recibiría un correo vacío.
    for (const estado of FULFILLMENT_STATES) {
      const tiene = buildCardNotice({ ...base, state: estado }) !== null;
      expect(tiene).toBe(shouldNotifyMember(estado));
    }
  });

  it("escapa lo que rompería el HTML", () => {
    const n = buildCardNotice({
      ...base,
      firstName: 'Ana & "Pipo" <script>',
      state: "LISTO_PARA_RETIRAR",
    });
    expect(n?.html).toContain("&amp;");
    expect(n?.html).toContain("&lt;script&gt;");
    expect(n?.html).not.toContain("<script>");
  });
});
