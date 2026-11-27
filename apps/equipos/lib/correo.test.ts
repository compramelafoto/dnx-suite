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
  "confirmar_compra",
  "venta_confirmada",
  "venta_no_confirmada",
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

  it("confirmar_compra lleva vendedor, equipo, precio, vencimiento y enlace", () => {
    const r = renderPortalEmail("confirmar_compra", {
      nombre: "Beto",
      vendedor: "Ana",
      equipo: "Canon R5",
      precio: "$ 1.500.000",
      vence: "10/12/26",
      url: "https://e.test/compras/5",
    });
    expect(r.subject).toBe("Ana marcó que te vendió su Canon R5");
    expect(r.text).toContain("$ 1.500.000");
    expect(r.text).toContain("10/12/26");
    expect(r.text).toContain("https://e.test/compras/5");
    expect(r.text).not.toMatch(/plata/i);
  });

  it("venta_no_confirmada distingue rechazo de vencimiento", () => {
    const vencio = renderPortalEmail("venta_no_confirmada", { comprador: "Beto", equipo: "Canon R5", motivo: "vencio" });
    const rechazo = renderPortalEmail("venta_no_confirmada", { comprador: "Beto", equipo: "Canon R5", motivo: "rechazo" });
    expect(vencio.text).toContain("el plazo venció");
    expect(rechazo.text).toContain("rechazó la compra");
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

  it("alerta_busqueda lista cada equipo con precio, zona y enlace, y escapa el título", () => {
    const r = renderPortalEmail("alerta_busqueda", {
      nombre: "Juan",
      cantidad: "2",
      url: "https://e.test/alertas",
      item1_titulo: "Sony <b>A7</b>",
      item1_precio: "$ 800.000",
      item1_zona: "Rosario, Santa Fe",
      item1_url: "https://e.test/equipos/10",
      item2_titulo: "Canon R6",
      item2_precio: "$ 1.850.000",
      item2_zona: "Córdoba, Córdoba",
      item2_url: "https://e.test/equipos/11",
    });
    expect(r.subject).toBe("Se publicaron 2 equipos que estás buscando");
    expect(r.text).toContain("Sony <b>A7</b> — $ 800.000, Rosario, Santa Fe: https://e.test/equipos/10");
    expect(r.text).toContain("Canon R6 — $ 1.850.000, Córdoba, Córdoba: https://e.test/equipos/11");
    expect(r.html).toContain('<a href="https://e.test/equipos/11">Canon R6</a>');
    expect(r.html).not.toContain("<b>A7</b>");
    expect(r.text).toContain("https://e.test/alertas");
    expect(renderPortalEmail("alerta_busqueda", { item1_titulo: "X", item1_url: "u" }).subject).toBe(
      "Se publicó un equipo que estás buscando",
    );
  });

  it("escapa HTML en los datos", () => {
    const r = renderPortalEmail("verificacion_aprobada", { nombre: "<script>x</script>" });
    expect(r.html).not.toContain("<script>");
  });
});
