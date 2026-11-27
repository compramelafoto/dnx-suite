import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ reportarUsuario: vi.fn() }));

import { ReportarPersona } from "./ReportarPersona";

describe("ReportarPersona", () => {
  it("manda sólo el origen, el número y (desde interesados) la persona", () => {
    const html = renderToStaticMarkup(<ReportarPersona origen="interesado" refId={12} persona={2} />);
    expect(html).toContain("Reportar a esta persona");
    expect(html).toContain('name="origen" value="interesado"');
    expect(html).toContain('name="ref" value="12"');
    expect(html).toContain('name="persona" value="2"');
    expect(html).toContain('minLength="10"');
    expect(html).toContain('maxLength="500"');
  });

  it("con nombre lo usa en el desplegable y sin persona no la manda", () => {
    const html = renderToStaticMarkup(<ReportarPersona origen="venta" refId={5} nombre="Juan" />);
    expect(html).toContain("Reportar a Juan");
    expect(html).not.toContain('name="persona"');
  });
});
