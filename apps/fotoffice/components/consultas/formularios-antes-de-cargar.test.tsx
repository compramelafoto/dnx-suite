import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/actions/service-lead", () => ({ createServiceLead: vi.fn() }));

const { PublicServiceLeadForm } = await import("@/app/w/[workspaceSlug]/xv/public-service-lead-form");
const { PublicDynamicServiceLeadForm } = await import("@/app/w/[workspaceSlug]/public-dynamic-service-lead-form");

/**
 * Antes de que la página termine de cargar, el formulario es HTML común: si se enviaba así, el
 * navegador lo mandaba por GET y dejaba nombre, correo y lugar en la dirección de la página.
 */
describe("formularios de consulta antes de que cargue la página", () => {
  it("el de XV y boda va por POST y el botón espera a que cargue", () => {
    const html = renderToStaticMarkup(<PublicServiceLeadForm workspaceSlug="dnx-estudio" eventType="BODA" insertado />);
    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it("el general va por POST y el botón espera a que cargue", () => {
    const html = renderToStaticMarkup(
      <PublicDynamicServiceLeadForm workspaceSlug="dnx-estudio" form={{ id: "f1", slug: "general", configJson: {} }} insertado />,
    );
    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});
