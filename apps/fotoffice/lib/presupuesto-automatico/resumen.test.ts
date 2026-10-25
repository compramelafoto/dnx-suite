import { describe, expect, it } from "vitest";
import { armarResumen, escaparHtml, type DatosResumen } from "./resumen";

const BASE: DatosResumen = {
  aprobacionId: "ckaprobacion0001",
  origen: "WEB",
  numeroConsulta: "C-0042",
  cliente: "Lucía <Gómez>",
  email: "lucia@example.com",
  telefono: "341 555-1234",
  categoria: "15 años",
  fechaEvento: "14/03/2027",
  lugar: "Salón Los Álamos, Rosario",
  invitados: 150,
  mensaje: "Queremos fotos y video & sesión previa",
  presupuesto: {
    items: [
      { nombre: "Cobertura fotográfica 6 h", cantidad: 1, neto: 850_000, opcional: false, horas: 14 },
      { nombre: "Fotolibro 30x30", cantidad: 1, neto: 250_000, opcional: false, horas: null },
      { nombre: "Drone", cantidad: 1, neto: 90_000, opcional: true, horas: null },
    ],
    total: 1_100_000,
    costo: 620_000,
    margen: 480_000,
    margenProporcion: 0.4364,
    horas: 14,
    itemsSinCosto: 0,
  },
  urlPresupuesto: "https://fotoffice.com/presupuestos/ckpres0001",
  urlConsulta: "https://fotoffice.com/consultas/cklead0001",
};

describe("armarResumen (aviso de Telegram)", () => {
  it("trae cliente, tipo y fecha, lo que incluye, el precio y cómo se calculó", () => {
    const { html } = armarResumen(BASE);
    expect(html).toContain("Consulta nueva desde la web · N° C-0042");
    expect(html).toContain("Lucía &lt;Gómez&gt;");
    expect(html).toContain("15 años · 📅 14/03/2027");
    expect(html).toContain("Salón Los Álamos, Rosario");
    expect(html).toContain("150 invitados");
    expect(html).toContain("Cobertura fotográfica 6 h");
    expect(html).toMatch(/Precio: \$\s?1\.100\.000/);
    expect(html).toMatch(/costo \$\s?620\.000 · 14 h · margen \$\s?480\.000 \(44 %\)/);
    expect(html).toContain("Opcionales: Drone");
    expect(html).toContain("y video &amp; sesión");
  });

  it("los botones son Aprobar y enviar (callback) y Corregir (abre el presupuesto)", () => {
    const { teclado } = armarResumen(BASE);
    expect(teclado?.inline_keyboard[0]).toEqual([
      { text: "✅ Aprobar y enviar", callback_data: "ap:ckaprobacion0001" },
      { text: "✏️ Corregir", url: "https://fotoffice.com/presupuestos/ckpres0001" },
    ]);
  });

  it("sin propuesta modelo lo dice y ofrece abrir la consulta", () => {
    const { html, teclado } = armarResumen({ ...BASE, presupuesto: null, motivoSinPresupuesto: "SIN_PROPUESTA" });
    expect(html).toContain("no tiene propuesta modelo");
    expect(html).not.toContain("Precio");
    expect(teclado).toEqual({ inline_keyboard: [[{ text: "Abrir la consulta", url: "https://fotoffice.com/consultas/cklead0001" }]] });
  });

  it("enviado: saca los botones y dice por dónde salió", () => {
    const { html, teclado } = armarResumen(BASE, { tipo: "ENVIADO", via: "TELEGRAM", canales: { correo: "ENVIADO", whatsapp: "SIN_CELULAR" } });
    expect(teclado).toBeNull();
    expect(html).toContain("Aprobado.");
    expect(html).toContain("Enviado por correo.");
    expect(html).toContain("no dejó celular");
  });

  it("sin costos cargados no inventa margen y avisa los renglones sin costo", () => {
    const { html } = armarResumen({
      ...BASE,
      presupuesto: { ...BASE.presupuesto!, costo: null, margen: null, margenProporcion: null, horas: null, itemsSinCosto: 2 },
    });
    expect(html).not.toContain("Cómo se calculó");
    expect(html).toContain("2 renglones no tienen costo cargado");
  });

  it("en local (sin dirección pública) no manda botones con enlaces que Telegram rechaza", () => {
    const { teclado } = armarResumen({ ...BASE, urlPresupuesto: "http://localhost:3000/presupuestos/x" });
    expect(teclado?.inline_keyboard[0]).toHaveLength(1);
  });

  it("escapa el HTML de Telegram", () => {
    expect(escaparHtml("<b>&</b>")).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
  });
});
