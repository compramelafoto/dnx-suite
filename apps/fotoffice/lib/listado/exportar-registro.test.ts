import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ registrar: vi.fn(), traerIds: vi.fn(), traerPorIds: vi.fn(), aviso: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/listado/actividad", () => ({ registrarActividad: H.registrar }));
vi.mock("@/lib/listado/acceso", () => ({
  contextoDeListado: async () => ({ workspaceId: "w", workspaceName: "W", userId: 1, userLabel: "x", role: "WORKSPACE_OWNER" }),
  exigirCapacidad: () => true,
}));
vi.mock("@/lib/listado/ejecutar", () => ({ resolverConsulta: async (_d: unknown, _c: unknown, consulta: unknown) => ({ resuelta: consulta, descartados: [] }) }));
vi.mock("@/lib/listado/registro", () => ({
  definicionDe: async () => ({
    clave: "socios",
    filtros: [{ tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [{ valor: "A", etiqueta: "A" }] }],
    ordenes: ["n"],
    ordenPorDefecto: { campo: "n", desc: false },
    traerIds: H.traerIds,
    traerPorIds: H.traerPorIds,
    aviso: H.aviso,
    idDe: (f: { id: string }) => f.id,
    exportar: { columnas: [{ titulo: "Id", tipo: "texto", valor: (f: { id: string }) => f.id }] },
  }),
}));

const { GET } = await import("@/app/api/listados/[clave]/exportar/route");
const params = Promise.resolve({ clave: "socios" });

beforeEach(() => {
  H.registrar.mockReset().mockResolvedValue(undefined);
  H.traerIds.mockReset().mockResolvedValue(["a", "b"]);
  H.aviso.mockReset().mockResolvedValue(null);
  // Sólo vuelven las filas del workspace: "ajeno" desaparece.
  H.traerPorIds.mockReset().mockImplementation(async (_c: unknown, ids: string[]) => ids.filter((i) => i !== "ajeno").map((id) => ({ id })));
});

describe("registro de una exportación", () => {
  it("por filtros guarda la consulta saneada, no la dirección cruda", async () => {
    const r = await GET(new NextRequest("http://x/api/listados/socios/exportar?estado=A&hack=%3DHYPERLINK&pagina=3&ver=zz"), { params });
    expect(r.status).toBe(200);
    const registro = H.registrar.mock.calls[0][1];
    expect(registro).toMatchObject({ kind: "EXPORT", rowCount: 2, query: "estado=A" });
    expect(registro.detail).toBeUndefined();
  });

  it("por selección guarda los ids que de verdad salieron", async () => {
    const r = await GET(new NextRequest("http://x/api/listados/socios/exportar?ids=a,ajeno,a,b&estado=A"), { params });
    expect(r.status).toBe(200);
    expect(H.registrar.mock.calls[0][1]).toMatchObject({ rowCount: 2, query: "", detail: { ids: ["a", "b"] } });
  });
});

describe("exportación vacía con aviso", () => {
  it("si la lista quedó vacía por un tope (hay aviso), responde 422 con el aviso y no registra", async () => {
    H.traerIds.mockResolvedValue([]);
    H.aviso.mockResolvedValue("Hay más de 20.000 coincidencias en los campos personalizados de socios: acotá la búsqueda o sumá otro filtro.");
    const r = await GET(new NextRequest("http://x/api/listados/socios/exportar?estado=A"), { params });
    expect(r.status).toBe(422);
    expect(await r.text()).toContain("campos personalizados");
    expect(H.traerPorIds).not.toHaveBeenCalled();
    expect(H.registrar).not.toHaveBeenCalled();
  });

  it("vacía sin aviso sigue saliendo como archivo (sólo encabezados)", async () => {
    H.traerIds.mockResolvedValue([]);
    const r = await GET(new NextRequest("http://x/api/listados/socios/exportar?estado=A"), { params });
    expect(r.status).toBe(200);
  });

  it("con filas no consulta el aviso", async () => {
    await GET(new NextRequest("http://x/api/listados/socios/exportar?estado=A"), { params });
    expect(H.aviso).not.toHaveBeenCalled();
  });
});
