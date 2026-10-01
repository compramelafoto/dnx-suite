import { describe, expect, it } from "vitest";
import { MARCADOR_FIRMA } from "./constantes";
import { cuerpoCorreoHtml, cuerpoCorreoTexto, textoWhatsapp } from "./render";

const FIRMA_HTML = '<table class="firma"><tr><td>DNX</td></tr></table>';
const FIRMA_TXT = "DNX Estudio\nRosario";

describe("cuerpoCorreoHtml", () => {
  it("un párrafo por línea en blanco y <br> por salto simple", () => {
    const html = cuerpoCorreoHtml("Hola Ana,\nGracias.\n\n\nSaludos", "", true);
    expect(html).toBe("<p>Hola Ana,<br>Gracias.</p>\n<p>Saludos</p>");
  });

  it("normaliza \\r\\n y no deja párrafos vacíos", () => {
    expect(cuerpoCorreoHtml("\r\n\r\nA\r\n \r\nB\r\n\r\n", "", true)).toBe("<p>A</p>\n<p>B</p>");
  });

  it("escapa todo el HTML (XSS)", () => {
    const html = cuerpoCorreoHtml(`<script>alert("x")</script> & <img src=x onerror='y'>`, "", true);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;img src=x onerror=&#39;y&#39;&gt;");
  });

  it("sólo los enlaces http(s) se vuelven clicables", () => {
    const html = cuerpoCorreoHtml("Mirá https://dnx.com/agenda?a=1&b=2. Y javascript:alert(1) o data:text/html,x", "", true);
    expect(html).toContain('<a href="https://dnx.com/agenda?a=1&amp;b=2" rel="noopener noreferrer">https://dnx.com/agenda?a=1&amp;b=2</a>.');
    expect(html).not.toMatch(/href="javascript/i);
    expect(html).not.toMatch(/href="data/i);
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("enlaces: http y mayúsculas, sin arrastrar paréntesis ni comillas", () => {
    const html = cuerpoCorreoHtml('(ver HTTP://a.com/x) "https://b.com/y"', "", true);
    expect(html).toContain('<a href="HTTP://a.com/x" rel="noopener noreferrer">HTTP://a.com/x</a>)');
    expect(html).toContain('&quot;<a href="https://b.com/y" rel="noopener noreferrer">https://b.com/y</a>&quot;');
  });

  it("un enlace con intento de cortar el atributo queda escapado", () => {
    const html = cuerpoCorreoHtml("https://x.com/'onmouseover='alert(1)", "", true);
    expect(html).not.toContain("'onmouseover");
    expect(html).toContain("&#39;");
  });

  it("agrega la firma al final si el texto no tenía [firma]", () => {
    const html = cuerpoCorreoHtml("Hola", FIRMA_HTML, false);
    expect(html).toBe(`<p>Hola</p>\n${FIRMA_HTML}`);
  });

  it("si tenía [firma], la pone donde estaba y una sola vez (sin escaparla)", () => {
    const html = cuerpoCorreoHtml(`Hola\n\n${MARCADOR_FIRMA}\n\nPD: gracias`, FIRMA_HTML, true);
    expect(html).toBe(`<p>Hola</p>\n${FIRMA_HTML}\n<p>PD: gracias</p>`);
    expect(html.split(FIRMA_HTML)).toHaveLength(2);
  });

  it("la firma pegada a un párrafo lo corta en vez de quedar dentro de <p>", () => {
    expect(cuerpoCorreoHtml(`Saludos,\n${MARCADOR_FIRMA}`, FIRMA_HTML, true)).toBe(`<p>Saludos,</p>\n${FIRMA_HTML}`);
  });

  it("sin bandera, detecta el marcador por sí sola", () => {
    expect(cuerpoCorreoHtml(`A\n\n${MARCADOR_FIRMA}`, FIRMA_HTML).split(FIRMA_HTML)).toHaveLength(2);
    expect(cuerpoCorreoHtml("A", FIRMA_HTML)).toBe(`<p>A</p>\n${FIRMA_HTML}`);
  });

  it("sin firma configurada, el marcador desaparece", () => {
    expect(cuerpoCorreoHtml(`A\n\n${MARCADOR_FIRMA}`, "", true)).toBe("<p>A</p>");
  });
});

describe("cuerpoCorreoTexto", () => {
  it("agrega la firma en texto si faltaba, y la reemplaza si estaba", () => {
    expect(cuerpoCorreoTexto("Hola\r\n", FIRMA_TXT, false)).toBe(`Hola\n\n${FIRMA_TXT}`);
    expect(cuerpoCorreoTexto(`Hola\n\n${MARCADOR_FIRMA}\n\nPD`, FIRMA_TXT, true)).toBe(`Hola\n\n${FIRMA_TXT}\n\nPD`);
    expect(cuerpoCorreoTexto("Hola", "", false)).toBe("Hola");
  });
  it("no toca el HTML: es texto plano", () => {
    expect(cuerpoCorreoTexto("<b>x</b>", "", false)).toBe("<b>x</b>");
  });
});

describe("textoWhatsapp", () => {
  it("nunca agrega la firma sola", () => {
    expect(textoWhatsapp("Hola Ana")).toBe("Hola Ana");
    expect(textoWhatsapp("Hola Ana", FIRMA_TXT)).toBe("Hola Ana");
  });
  it("si la plantilla pide [firma], pone la firma en texto", () => {
    expect(textoWhatsapp(`Hola\n${MARCADOR_FIRMA}`, FIRMA_TXT)).toBe(`Hola\n${FIRMA_TXT}`);
    expect(textoWhatsapp(`Hola\n${MARCADOR_FIRMA}`)).toBe("Hola");
  });
  it("compacta las líneas en blanco que dejan los bloques quitados", () => {
    expect(textoWhatsapp("A\n\n\n\nB  \n")).toBe("A\n\nB");
  });
});
