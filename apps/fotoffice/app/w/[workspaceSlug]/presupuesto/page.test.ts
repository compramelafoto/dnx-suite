import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  sitio: vi.fn(),
  datos: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/website/public-site", () => ({ loadPublicSite: H.sitio }));
vi.mock("@/lib/website/dynamic-data.server", () => ({ loadWebsiteDynamicData: H.datos }));

const { default: PresupuestoPage, generateMetadata } = await import("./page");

const SITIO = {
  workspaceId: "ws-1",
  workspaceSlug: "dnx-estudio",
  commercialName: "DNX Estudio",
  colors: {},
  designPresets: {},
  enabledModuleKeys: new Set(["service-leads"]),
};
const INQUIRY = { workspaceSlug: "dnx-estudio", categorias: [{ id: "c-boda", nombre: "Boda" }], origenes: [] };

type Elemento = { props: { children: { props: { blocks: Array<{ type: string; config: Record<string, unknown> }>; dynamicData: { inquiry?: Record<string, unknown> } } } } };
const pagina = async (categoria?: string | string[]) =>
  (await PresupuestoPage({
    params: Promise.resolve({ workspaceSlug: "dnx-estudio" }),
    searchParams: Promise.resolve(categoria === undefined ? {} : { categoria }),
  })) as unknown as Elemento;

beforeEach(() => {
  vi.clearAllMocks();
  H.sitio.mockResolvedValue(SITIO);
  H.datos.mockImplementation(async () => ({ inquiry: { ...INQUIRY } }));
});

describe("/w/<slug>/presupuesto", () => {
  it("dibuja un único formulario de presupuesto a página completa, con la config por omisión", async () => {
    const { blocks, dynamicData } = (await pagina()).props.children.props;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "INQUIRY_FORM", visible: true, config: { categoryIds: [], askOrigin: true, buttonLabel: "Pedir presupuesto" } });
    expect(blocks[0]!.config.title).toBe("Pedí tu presupuesto");
    expect(dynamicData.inquiry).toEqual(INQUIRY);
    expect(H.datos).toHaveBeenCalledWith(SITIO, blocks);
  });

  it("?categoria=<id> preelige la categoría", async () => {
    expect((await pagina("c-boda")).props.children.props.dynamicData.inquiry).toMatchObject({ categoriaPreelegida: "c-boda" });
    expect((await pagina(["c-boda", "otra"])).props.children.props.dynamicData.inquiry).toMatchObject({ categoriaPreelegida: "c-boda" });
    expect((await pagina("x".repeat(500))).props.children.props.dynamicData.inquiry).not.toHaveProperty("categoriaPreelegida");
  });

  it("404 con Consultas apagado o sin workspace", async () => {
    H.sitio.mockResolvedValue({ ...SITIO, enabledModuleKeys: new Set(["website"]) });
    await expect(pagina()).rejects.toThrow("NOT_FOUND");
    H.sitio.mockResolvedValue(null);
    await expect(pagina()).rejects.toThrow("NOT_FOUND");
    expect(H.datos).not.toHaveBeenCalled();
  });

  it("título de la pestaña con el nombre comercial", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ workspaceSlug: "dnx-estudio" }), searchParams: Promise.resolve({}) })).toEqual({
      title: "Pedí tu presupuesto · DNX Estudio",
    });
  });
});
