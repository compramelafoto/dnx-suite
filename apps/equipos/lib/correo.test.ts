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
  "consulta_serie_coincide_admin",
  "cambio_serie_admin",
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
      "consulta_serie_coincide_admin",
      "cambio_serie_admin",
    ] as const) {
      const r = renderPortalEmail(t, { nombre: "Ana Pérez", email: "ana@x.com", dni: "123" });
      expect(r.subject).not.toContain("Ana");
      expect(r.subject).not.toContain("ana@x.com");
    }
  });

  it("la publicación rechazada no lleva motivo interno", () => {
    const r = renderPortalEmail("publicacion_rechazada", { nombre: "Ana", motivo: "Denuncia activa #3" });
    expect(r.text).toContain("No pudimos publicar tu artículo.");
    expect(r.text).not.toContain("Denuncia");
  });

  it("rechazo sin correo de contacto: omite la invitación a escribirnos", () => {
    const r = renderPortalEmail("publicacion_rechazada", { nombre: "Ana" });
    expect(r.text).not.toContain("escribinos");
    expect(r.text).not.toContain("respondé este correo");
    expect(r.html).not.toContain("mailto:");
  });

  it("rechazo con correo de contacto: «escribinos» con mailto en HTML y el correo en texto", () => {
    const r = renderPortalEmail("publicacion_rechazada", {
      nombre: "Ana",
      contacto: "hola@mercadofotoraw.com",
      contactoUrl: "mailto:hola@mercadofotoraw.com?subject=Publicaci%C3%B3n",
    });
    expect(r.html).toContain(
      '<p>Si tenés dudas, <a href="mailto:hola@mercadofotoraw.com?subject=Publicaci%C3%B3n">escribinos</a>.</p>',
    );
    expect(r.text).toContain("Si tenés dudas, escribinos a hola@mercadofotoraw.com.");
  });

  it("asuntos fijos de publicaciones", () => {
    expect(renderPortalEmail("publicacion_en_revision_admin", {}).subject).toBe("Publicación en revisión");
    expect(renderPortalEmail("serie_de_otro_usuario_admin", {}).subject).toBe(
      "Serie publicada vista con otro usuario",
    );
  });

  it("la consulta de serie lleva usuario, serie y denuncia en el cuerpo y un asunto fijo", () => {
    const r = renderPortalEmail("consulta_serie_coincide_admin", {
      usuario: "7",
      serie: "ABC1234",
      denuncia: "9",
      url: "https://clf.test/admin/equipos-robados",
    });
    expect(r.subject).toBe("Consulta de serie con denuncia activa");
    expect(r.text).toContain("Usuario: 7");
    expect(r.text).toContain("Serie: ABC1234");
    expect(r.text).toContain("Denuncia: #9");
    expect(r.text).toContain("https://clf.test/admin/equipos-robados");
  });

  it("escapa HTML en los datos", () => {
    const r = renderPortalEmail("verificacion_aprobada", { nombre: "<script>x</script>" });
    expect(r.html).not.toContain("<script>");
  });
});
