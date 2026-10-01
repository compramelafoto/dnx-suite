import { describe, expect, it } from "vitest";
import { armarVistaPrevia, documentoDeCorreo } from "./vista-previa";

const HOY = new Date("2026-10-01T15:00:00Z");
const CAMPOS = [{ clave: "estilo", nombre: "Estilo de fotos" }];

describe("vista previa con datos de ejemplo", () => {
  it("correo: completa el asunto, escapa el cuerpo y agrega la firma al final si falta", () => {
    const v = armarVistaPrevia("EMAIL", "CLIENTE", CAMPOS, "Hola [nombre]", "Hola [nombre_completo] <b>\n\nVer https://x.com", HOY);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.asunto).toBe("Hola Ana");
    expect(v.html).toContain("<p>Hola Ana Pérez &lt;b&gt;</p>");
    expect(v.html).toContain('<a href="https://x.com"');
    expect(v.html).toContain("Estudio de ejemplo</p>");
    expect(v.texto).toBeNull();
  });

  it("WhatsApp: texto plano, sin firma salvo que se pida", () => {
    const sin = armarVistaPrevia("WHATSAPP", "GENERAL", [], "", "Hola [nombre], hoy es [hoy]", HOY);
    expect(sin).toMatchObject({ ok: true, texto: "Hola Ana, hoy es 01/10/2026", html: null });
    const con = armarVistaPrevia("WHATSAPP", "GENERAL", [], "", "Hola\n[firma]", HOY);
    expect(con.ok && con.texto).toContain("Estudio de ejemplo");
  });

  it("los campos personalizados muestran su nombre entre corchetes; GENERAL no los acepta", () => {
    const v = armarVistaPrevia("WHATSAPP", "CLIENTE", CAMPOS, "", "Estilo: [campo:estilo]", HOY);
    expect(v).toMatchObject({ ok: true, texto: "Estilo: [Estilo de fotos]" });
    const g = armarVistaPrevia("WHATSAPP", "GENERAL", CAMPOS, "", "Estilo: [campo:estilo]", HOY);
    expect(g.ok).toBe(false);
  });

  it("variables de otra ficha: error con la posición y el texto donde está", () => {
    const v = armarVistaPrevia("EMAIL", "SOCIO", [], "Consulta [consulta_numero]", "Hola [nombre]", HOY);
    expect(v).toEqual({
      ok: false,
      errores: [expect.objectContaining({ campo: "asunto", posicion: 9, variable: "consulta_numero" })],
    });
  });

  it("consulta: fecha de calendario y número de ejemplo", () => {
    const v = armarVistaPrevia("WHATSAPP", "CONSULTA", [], "", "[consulta_numero] [consulta_fecha]", HOY);
    expect(v).toMatchObject({ ok: true, texto: "C-2026-0042 12/12/2026" });
  });

  it("el documento del iframe envuelve el HTML", () => {
    expect(documentoDeCorreo("<p>x</p>")).toMatch(/^<!doctype html>.*<body><p>x<\/p><\/body><\/html>$/);
  });
});
