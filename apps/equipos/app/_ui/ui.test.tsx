import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstadoPublicacion, FichaConfianza, GuiaCompraSegura, MedidorConfianza, PlacaSerie } from "./index";

describe("MedidorConfianza", () => {
  it("con nivel ALTO es un medidor accesible en 3 de 4 y dice «Alto»", () => {
    const html = renderToStaticMarkup(<MedidorConfianza level="ALTO" />);
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain('aria-valuemax="4"');
    expect(html).toContain("Alto");
  });

  it("marca un solo tramo como actual", () => {
    const html = renderToStaticMarkup(<MedidorConfianza level="BASICO" size="grande" />);
    expect(html.match(/data-actual="true"/g)).toHaveLength(1);
    expect(html).toContain("Básico");
  });
});

describe("FichaConfianza", () => {
  const html = renderToStaticMarkup(
    <FichaConfianza
      level="BUENO"
      verified={["Factura de compra presentada"]}
      declared={["Incluye cargador"]}
      shutterText="Cantidad de disparos: no verificada"
      serialMasked="•••• 4821"
    />,
  );

  it("separa lo comprobado de lo declarado, con sus títulos", () => {
    expect(html).toContain("Comprobado por el portal");
    expect(html).toContain("Declarado por el vendedor");
    const comprobado = html.slice(html.indexOf("Comprobado por el portal"), html.indexOf("Declarado por el vendedor"));
    const declarado = html.slice(html.indexOf("Declarado por el vendedor"));
    expect(comprobado).toContain("✔");
    expect(comprobado).toContain("Factura de compra presentada");
    expect(comprobado).not.toContain("Incluye cargador");
    expect(declarado).toContain("□");
    expect(declarado).toContain("Incluye cargador");
    expect(declarado).not.toContain("Factura de compra presentada");
    expect((html.match(/<ul/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("muestra el medidor, la placa de serie y los disparos", () => {
    expect(html).toContain('role="meter"');
    expect(html).toContain("•••• 4821");
    expect(html).toContain("Cantidad de disparos: no verificada");
  });

  it("sin disparos ni serie no muestra esas líneas", () => {
    const sin = renderToStaticMarkup(
      <FichaConfianza level="BASICO" verified={[]} declared={[]} shutterText={null} serialMasked={null} />,
    );
    expect(sin).not.toContain("disparos");
    expect(sin).not.toContain("Número de serie");
    expect(sin).toContain("Comprobado por el portal");
  });
});

describe("PlacaSerie", () => {
  it("sin serie no renderiza nada", () => {
    expect(renderToStaticMarkup(<PlacaSerie value={null} />)).toBe("");
  });

  it("con serie muestra el valor", () => {
    expect(renderToStaticMarkup(<PlacaSerie value="•••• 4821" />)).toContain("•••• 4821");
  });
});

describe("EstadoPublicacion", () => {
  it("IN_REVIEW dice «En revisión»", () => {
    expect(renderToStaticMarkup(<EstadoPublicacion status="IN_REVIEW" />)).toContain("En revisión");
  });

  it("cada estado tiene su texto", () => {
    const textos = {
      DRAFT: "Borrador",
      PUBLISHED: "Publicada",
      PAUSED: "Pausada",
      SOLD: "Vendida",
      CLOSED: "Cerrada",
    } as const;
    for (const [status, texto] of Object.entries(textos)) {
      expect(renderToStaticMarkup(<EstadoPublicacion status={status as keyof typeof textos} />)).toContain(
        texto,
      );
    }
  });
});

describe("GuiaCompraSegura", () => {
  it("pide comparar los últimos 4 caracteres de la serie y aclara qué significa «Identidad verificada»", () => {
    const html = renderToStaticMarkup(<GuiaCompraSegura contacto={null} />);
    expect(html).toContain("comprobá que los últimos 4");
    expect(html).toContain("caracteres del número de serie coincidan con los de la publicación");
    expect(html).toContain("no garantiza");
  });

  it("sin correo de contacto omite «escribinos»", () => {
    const html = renderToStaticMarkup(<GuiaCompraSegura contacto={null} />);
    expect(html).not.toContain("escribinos");
    expect(html).not.toContain("<a ");
  });

  it("con correo de contacto, «escribinos» es un mailto", () => {
    const html = renderToStaticMarkup(<GuiaCompraSegura contacto="mailto:hola@e.test?subject=x" />);
    expect(html).toContain('o <a href="mailto:hola@e.test?subject=x">escribinos</a>');
  });
});
