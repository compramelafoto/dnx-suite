import { describe, expect, it } from "vitest";
import { renderPortalEmail } from "./correo";

const PLANTILLAS = [
  "verificacion_aprobada",
  "verificacion_rechazada",
  "verificacion_en_revision_admin",
  "denuncia_recibida",
  "coincidencia_inventario_admin",
  "conflicto_serie_admin",
  "recordatorio_poliza",
] as const;

describe("renderPortalEmail", () => {
  it.each(PLANTILLAS)("%s produce asunto y cuerpo en español sin undefined", (t) => {
    const r = renderPortalEmail(t, { nombre: "Ana", motivo: "x", url: "https://e.test/a" });
    expect(r.subject.length).toBeGreaterThan(5);
    for (const s of [r.subject, r.html, r.text]) {
      expect(s).not.toContain("undefined");
      expect(s).not.toContain("null");
    }
  });

  it("no rompe con datos vacíos", () => {
    for (const t of PLANTILLAS) {
      const r = renderPortalEmail(t, {});
      expect(r.html).not.toContain("undefined");
      expect(r.text).not.toContain("undefined");
    }
  });

  it("los correos al admin no llevan datos personales en el asunto", () => {
    for (const t of [
      "verificacion_en_revision_admin",
      "coincidencia_inventario_admin",
      "conflicto_serie_admin",
    ] as const) {
      const r = renderPortalEmail(t, { nombre: "Ana Pérez", email: "ana@x.com", dni: "123" });
      expect(r.subject).not.toContain("Ana");
      expect(r.subject).not.toContain("ana@x.com");
    }
  });

  it("escapa HTML en los datos", () => {
    const r = renderPortalEmail("verificacion_aprobada", { nombre: "<script>x</script>" });
    expect(r.html).not.toContain("<script>");
  });
});
