import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const L = await import("./lista-precios");
const { clavesPermitidas, resolverVariables } = await import("@/lib/plantillas/variables");

/** Sin el espacio duro del formato de moneda, para comparar fácil. */
const plano = (t: string | null) => t?.replace(/ /g, " ") ?? null;

function producto(id: string, nombre: string, precio: string, datos: Record<string, unknown> = {}, enLista = true) {
  B.agregar("product", { id, workspaceId: "ws-1", name: nombre, priceArs: precio, ...datos });
  B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-1", productId: id, inPriceList: enLista });
}

beforeEach(() => {
  B.vaciar();
});

describe("textoListaPrecios (puro)", () => {
  it("sin productos, null", () => {
    expect(L.textoListaPrecios([])).toBeNull();
  });

  it("una sola categoría: sin títulos; precio es-AR", () => {
    expect(plano(L.textoListaPrecios([{ nombre: "Cobertura", precio: 600000, categoria: "Bodas", ordenCategoria: 0 }]))).toBe("- Cobertura: $ 600.000");
    expect(plano(L.textoListaPrecios([{ nombre: "Álbum", precio: 150000.5, categoria: null, ordenCategoria: 0 }]))).toBe("- Álbum: $ 150.000,5");
  });

  it("hasta 50 productos y una línea con los que faltan", () => {
    const muchos = Array.from({ length: 53 }, (_, i) => ({ nombre: `P${i}`, precio: 1, categoria: null, ordenCategoria: 0 }));
    const t = L.textoListaPrecios(muchos)!;
    expect(t.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(L.MAX_LINEAS_LISTA);
    expect(t.endsWith("Y 3 productos más.")).toBe(true);
  });
});

describe("listaDePrecios", () => {
  it("sólo los activos «en lista de precios» del workspace, agrupados por categoría en su orden; sin categoría al final", async () => {
    B.agregar("productCategory", { id: "c-alb", workspaceId: "ws-1", name: "Álbumes", order: 2 });
    B.agregar("productCategory", { id: "c-cob", workspaceId: "ws-1", name: "Coberturas", order: 1 });
    producto("p1", "Cobertura completa", "600000.00", { categoryId: "c-cob" });
    producto("p2", "Álbum 30x30", "150000.00", { categoryId: "c-alb" });
    producto("p3", "Drone", "80000.00");
    producto("p4", "Fuera de lista", "1.00", {}, false);
    producto("p5", "Archivado", "1.00", { isActive: false });
    B.agregar("product", { id: "ajeno", workspaceId: "ws-2", name: "Ajeno", priceArs: "1.00" });
    B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-2", productId: "ajeno", inPriceList: true });
    expect(plano(await L.listaDePrecios("ws-1"))).toBe(
      "Coberturas\n- Cobertura completa: $ 600.000\n\nÁlbumes\n- Álbum 30x30: $ 150.000\n\nOtros\n- Drone: $ 80.000",
    );
    expect(await L.listaDePrecios("ws-2")).not.toContain("Cobertura");
    expect(await L.listaDePrecios("ws-3")).toBeNull();
  });
});

describe("variable [lista_precios]", () => {
  it("vale en CONSULTA y PRESUPUESTO, no en las otras fichas", () => {
    expect(clavesPermitidas("CONSULTA", []).has("lista_precios")).toBe(true);
    expect(clavesPermitidas("PRESUPUESTO", []).has("lista_precios")).toBe(true);
    for (const t of ["GENERAL", "CLIENTE", "SOCIO"] as const) expect(clavesPermitidas(t, []).has("lista_precios")).toBe(false);
  });

  it("toma el texto del contexto (vacío = null, para [si:lista_precios])", () => {
    const base = {
      persona: { nombreCompleto: null, email: null, telefono: null },
      organizacion: { nombre: null, email: null, telefono: null, whatsapp: null, web: null, instagram: null, ciudad: null },
      usuario: { nombre: null, email: null },
      hoy: new Date(),
      campos: {},
    };
    expect(resolverVariables({ ...base, listaPrecios: "- A: $ 1" })("lista_precios")).toBe("- A: $ 1");
    expect(resolverVariables({ ...base, listaPrecios: null })("lista_precios")).toBeNull();
    expect(resolverVariables(base)("lista_precios")).toBeNull();
  });
});
