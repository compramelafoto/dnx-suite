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
  "pedido_dueno",
  "pedido_publicado",
  "reporte_usuario_admin",
  "cuenta_bloqueada",
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

  it("pedido_dueno: modelo, precio, zona y enlace al aviso; nunca el comprador", () => {
    const r = renderPortalEmail("pedido_dueno", {
      nombre: "Pedro",
      equipo: "Sony FE 20mm F1.8 G",
      precio: "$ 900.000",
      zona: "Córdoba",
      estado: "Muy bueno",
      url: "https://e.test/busco/avisos/500",
      // Aunque llegara, el nombre del comprador no se usa.
      comprador: "Juan Gómez",
    });
    expect(r.subject).toBe("Un comprador busca un Sony FE 20mm F1.8 G como el tuyo");
    expect(r.text).toContain(
      "Un comprador con identidad verificada busca un Sony FE 20mm F1.8 G, como el que tenés en tu inventario.",
    );
    expect(r.text).toContain("Ofrece hasta $ 900.000.");
    expect(r.text).toContain("Lo busca en Córdoba.");
    expect(r.text).toContain("Estado mínimo que acepta: Muy bueno.");
    expect(r.text).toContain("https://e.test/busco/avisos/500");
    expect(r.html).toContain('<a href="https://e.test/busco/avisos/500">');
    for (const s of [r.subject, r.html, r.text]) expect(s).not.toContain("Juan");
    const sinDatos = renderPortalEmail("pedido_dueno", { equipo: "Canon R6", url: "u" });
    expect(sinDatos.text).not.toContain("Ofrece");
    expect(sinDatos.text).not.toContain("Lo busca en");
  });

  it("reporte_usuario_admin: asunto sin datos personales", () => {
    const r = renderPortalEmail("reporte_usuario_admin", {
      detalle: "Reporte #30 · Venta #5",
      url: "https://e.test/admin/usuarios",
    });
    expect(r.subject).toBe("Usuario reportado");
    expect(r.text).toContain("Reporte #30 · Venta #5");
    expect(r.text).toContain("https://e.test/admin/usuarios");
  });

  it("cuenta_bloqueada: el texto fijo, nunca el motivo interno", () => {
    const r = renderPortalEmail("cuenta_bloqueada", { nombre: "Juan", motivo: "vendió robado" });
    expect(r.subject).toBe("Tu cuenta de MercadoFotoRaw fue suspendida");
    expect(r.text).toContain("Hola Juan,");
    expect(r.text).toContain(
      "Tu cuenta de MercadoFotoRaw fue suspendida. Si creés que es un error, respondé este correo.",
    );
    expect(r.text + r.html + r.subject).not.toContain("robado");
  });

  it("pedido_publicado: enlace a la ficha", () => {
    const r = renderPortalEmail("pedido_publicado", {
      nombre: "Juan",
      equipo: "Sony <b>FE</b> 20mm",
      precio: "$ 850.000",
      url: "https://e.test/equipos/77",
    });
    expect(r.subject).toBe("Se publicó el equipo que buscabas");
    expect(r.text).toContain("Hola Juan,");
    expect(r.text).toContain("Sony <b>FE</b> 20mm");
    expect(r.text).toContain("$ 850.000");
    expect(r.html).not.toContain("<b>FE</b>");
    expect(r.html).toContain('<a href="https://e.test/equipos/77">');
  });

  it("escapa HTML en los datos", () => {
    const r = renderPortalEmail("verificacion_aprobada", { nombre: "<script>x</script>" });
    expect(r.html).not.toContain("<script>");
  });
});
