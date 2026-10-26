import { describe, expect, it } from "vitest";
import { enlaceDeBoton } from "./button-href";

describe("enlaceDeBoton", () => {
  it("a una ruta del sitio sin barra inicial se la agrega (el caso del botón Asociate de la SFPR)", () => {
    expect(enlaceDeBoton("w/sfpr/asociarse")).toBe("/w/sfpr/asociarse");
  });

  it("deja tal cual lo que ya está bien", () => {
    expect(enlaceDeBoton("/w/sfpr/asociarse")).toBe("/w/sfpr/asociarse");
    expect(enlaceDeBoton("#contacto")).toBe("#contacto");
    expect(enlaceDeBoton("https://instagram.com/sfpr")).toBe("https://instagram.com/sfpr");
    expect(enlaceDeBoton("mailto:hola@sfpr.org")).toBe("mailto:hola@sfpr.org");
    expect(enlaceDeBoton("tel:+543415550000")).toBe("tel:+543415550000");
  });

  it("a un dominio escrito a mano le completa https://", () => {
    expect(enlaceDeBoton("www.sfpr.org.ar")).toBe("https://www.sfpr.org.ar");
    expect(enlaceDeBoton("sfpr.org.ar/socios")).toBe("https://sfpr.org.ar/socios");
  });

  it("descarta lo que ejecutaría código en el navegador", () => {
    expect(enlaceDeBoton("javascript:alert(1)")).toBe(null);
    expect(enlaceDeBoton(" JavaScript:alert(1)")).toBe(null);
    expect(enlaceDeBoton("java script:alert(1)")).toBe(null);
    expect(enlaceDeBoton("data:text/html,<script>")).toBe(null);
    expect(enlaceDeBoton("vbscript:x")).toBe(null);
    expect(enlaceDeBoton("file:///etc/passwd")).toBe(null);
  });

  it("vacío, sin enlace", () => {
    expect(enlaceDeBoton("")).toBe(null);
    expect(enlaceDeBoton("   ")).toBe(null);
    expect(enlaceDeBoton(undefined)).toBe(null);
  });
});

describe("enlaceDeBoton con las páginas propias del sitio", () => {
  const paginas = { "quien-soy": "/w/dnx/quien-soy", "pedi-tu-presupuesto": "/w/dnx/pedi-tu-presupuesto" };

  it("una dirección de página propia apunta a esa página de este sitio", () => {
    expect(enlaceDeBoton("/pedi-tu-presupuesto", paginas)).toBe("/w/dnx/pedi-tu-presupuesto");
    expect(enlaceDeBoton("quien-soy", paginas)).toBe("/w/dnx/quien-soy");
    expect(enlaceDeBoton("/quien-soy#galeria", paginas)).toBe("/w/dnx/quien-soy#galeria");
    expect(enlaceDeBoton("/quien-soy?x=1", paginas)).toBe("/w/dnx/quien-soy?x=1");
  });

  it("no toca lo que no es una página propia", () => {
    expect(enlaceDeBoton("/w/dnx/presupuesto", paginas)).toBe("/w/dnx/presupuesto");
    expect(enlaceDeBoton("/login", paginas)).toBe("/login");
    expect(enlaceDeBoton("/", paginas)).toBe("/");
    expect(enlaceDeBoton("#contacto", paginas)).toBe("#contacto");
    expect(enlaceDeBoton("https://otro.com/quien-soy", paginas)).toBe("https://otro.com/quien-soy");
    expect(enlaceDeBoton("//quien-soy", paginas)).toBe("//quien-soy");
  });

  it("sin páginas (el constructor) queda como siempre", () => {
    expect(enlaceDeBoton("/quien-soy")).toBe("/quien-soy");
    expect(enlaceDeBoton("/constructor", {})).toBe("/constructor");
  });

  it("una clave heredada del prototipo no cuenta como página", () => {
    expect(enlaceDeBoton("/constructor", paginas)).toBe("/constructor");
  });
});
