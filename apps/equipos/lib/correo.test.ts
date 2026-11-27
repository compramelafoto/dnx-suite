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
  "publicacion_en_revision_admin",
  "serie_de_otro_usuario_admin",
  "publicacion_aprobada",
  "publicacion_rechazada",
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
      "publicacion_en_revision_admin",
      "serie_de_otro_usuario_admin",
    ] as const) {
      const r = renderPortalEmail(t, { nombre: "Ana Pérez", email: "ana@x.com", dni: "123" });
      expect(r.subject).not.toContain("Ana");
      expect(r.subject).not.toContain("ana@x.com");
    }
  });

  it("la publicación rechazada no lleva motivo interno", () => {
    const r = renderPortalEmail("publicacion_rechazada", { nombre: "Ana", motivo: "Denuncia activa #3" });
    expect(r.text).toContain("No pudimos publicar tu artículo. Si tenés dudas, respondé este correo.");
    expect(r.text).not.toContain("Denuncia");
  });

  it("asuntos fijos de publicaciones", () => {
    expect(renderPortalEmail("publicacion_en_revision_admin", {}).subject).toBe("Publicación en revisión");
    expect(renderPortalEmail("serie_de_otro_usuario_admin", {}).subject).toBe(
      "Serie publicada vista con otro usuario",
    );
  });

  it("escapa HTML en los datos", () => {
    const r = renderPortalEmail("verificacion_aprobada", { nombre: "<script>x</script>" });
    expect(r.html).not.toContain("<script>");
  });
});
