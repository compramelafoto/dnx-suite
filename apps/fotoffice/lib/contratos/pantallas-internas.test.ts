import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { whereContratos, ordenarContratos, listadoContratos, OPCIONES_ESTADO_CONTRATO } = await import("./listado");
const { LISTAS, listaPermitida } = await import("@/lib/listado/registro");
const { ETIQUETA_ESTADO_CONTRATO, ESTADOS_CONTRATO, ETIQUETA_EVENTO, TIPOS_EVENTO } = await import("./constantes");

/**
 * Pantallas internas de Contratos (Etapa 5, tarea 5): lista del motor de listas, reglas de la guarda y
 * reglas de fuente (el navegador no importa la base, los textos no hablan de "firma digital").
 */
const RAIZ = (() => {
  let dir = dirname(new URL(import.meta.url).pathname);
  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir);
  return dir;
})();
const leer = (ruta: string) => readFileSync(join(RAIZ, ...ruta.split("/")), "utf8");

const consulta = (extra: Record<string, unknown> = {}) =>
  ({ q: "", filtros: {}, orden: { campo: "alta", desc: true }, pagina: 1, filas: 25, ver: null, periodos: {}, etiquetasRelacion: {}, ...extra }) as never;

describe("lista de Contratos", () => {
  it("está registrada con su módulo y su ruta, sin condición extra de dinero", () => {
    expect(LISTAS.contratos).toMatchObject({ moduleKey: "contracts", ruta: "/contratos" });
    expect(LISTAS.contratos!.permitido).toBeUndefined();
    expect(listaPermitida("contratos", { workspaceId: "w", workspaceName: "W", userId: 1, userLabel: "x", role: "STAFF" })).toBe(true);
  });

  it("columnas: número, contacto, pedido, estado, enviado y firmado", () => {
    expect(listadoContratos.columnas.map((c) => c.titulo)).toEqual(["N°", "Contacto", "Pedido", "Estado", "Enviado", "Firmado"]);
    expect(listadoContratos.acciones).toEqual([]);
    expect(listadoContratos.hrefFicha("abc")).toBe("/contratos/abc");
    expect(listadoContratos.filtros).toHaveLength(1);
    expect(OPCIONES_ESTADO_CONTRATO.map((o) => o.valor)).toEqual([...ESTADOS_CONTRATO]);
  });

  it("todas las columnas ordenables figuran en los órdenes y el de fábrica también", () => {
    for (const c of listadoContratos.columnas) if (c.orden) expect(listadoContratos.ordenes).toContain(c.orden);
    expect(listadoContratos.ordenes).toContain(listadoContratos.ordenPorDefecto.campo);
  });

  it("el where siempre lleva el workspace y filtra por estado sólo con valores válidos", () => {
    expect(whereContratos("ws-1", consulta())).toEqual({ workspaceId: "ws-1" });
    expect(whereContratos("ws-1", consulta({ filtros: { estado: "FIRMADO" } }))).toEqual({ workspaceId: "ws-1", AND: [{ status: "FIRMADO" }] });
    expect(whereContratos("ws-1", consulta({ filtros: { estado: "inventado" } }))).toEqual({ workspaceId: "ws-1" });
    expect(whereContratos("ws-1", consulta({ filtros: { estado: "constructor" } }))).toEqual({ workspaceId: "ws-1" });
  });

  it("la búsqueda mira número, nombre, pedido y contacto, sin distinguir mayúsculas", () => {
    const w = whereContratos("ws-9", consulta({ q: "  gómez " })) as { workspaceId: string; AND: { OR: Record<string, unknown>[] }[] };
    expect(w.workspaceId).toBe("ws-9");
    const campos = w.AND[0]!.OR.map((o) => Object.keys(o)[0]);
    expect(campos).toEqual(["number", "name", "pedido", "client", "client", "client"]);
    expect(JSON.stringify(w)).toContain('"mode":"insensitive"');
    expect(JSON.stringify(w)).toContain('"contains":"gómez"');
  });

  it("los órdenes por fecha dejan los vacíos al final y siempre desempatan por id", () => {
    expect(ordenarContratos(consulta({ orden: { campo: "enviado", desc: true } }))).toEqual([{ sentAt: { sort: "desc", nulls: "last" } }, { id: "desc" }]);
    expect(ordenarContratos(consulta({ orden: { campo: "firmado", desc: false } }))).toEqual([{ signedAt: { sort: "asc", nulls: "last" } }, { id: "asc" }]);
    expect(ordenarContratos(consulta())).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("la exportación no lleva el texto del contrato", () => {
    const titulos = listadoContratos.exportar.columnas.map((c) => c.titulo);
    expect(titulos).toEqual(["N°", "Contrato", "Contacto", "Pedido", "Estado", "Enviado", "Firmado", "Alta"]);
  });
});

describe("textos en español", () => {
  it("cada estado y cada tipo de evento tiene etiqueta", () => {
    for (const e of ESTADOS_CONTRATO) expect(ETIQUETA_ESTADO_CONTRATO[e], e).toBeTruthy();
    for (const t of TIPOS_EVENTO) expect(ETIQUETA_EVENTO[t], t).toBeTruthy();
  });
});

describe("pantallas internas de Contratos: fuente", () => {
  const CLIENTE = [
    "components/contratos/borrador-contrato.tsx",
    "components/contratos/acciones-contrato.tsx",
    "components/contratos/firmantes-contrato.tsx",
    "components/contratos/contratos-del-pedido.tsx",
  ];

  it("los componentes del navegador no importan la base ni código de servidor", () => {
    for (const ruta of CLIENTE) {
      const f = leer(ruta);
      expect(f.startsWith('"use client"'), ruta).toBe(true);
      expect(f, ruta).not.toContain("@repo/db");
      expect(f, ruta).not.toContain("server-only");
      expect(f, ruta).not.toMatch(/from "@\/lib\/contratos\/(ficha|listado|tarjetas|requerir|contexto|contratos|envio|copiar-enlace|enlace|eventos|ajustes|plantillas|contratantes)"/);
    }
    // Lo que importa el navegador de lib/contratos es puro.
    for (const ruta of ["lib/contratos/ficha-etiquetas.ts", "lib/contratos/tarjeta-tipos.ts", "lib/contratos/estado-vista.ts", "lib/contratos/constantes.ts", "lib/contratos/formato.ts"]) {
      expect(leer(ruta), ruta).not.toContain("server-only");
      expect(leer(ruta), ruta).not.toContain("@repo/db");
    }
  });

  it("los componentes de tarjeta y de lista no usan hooks ni base (sirven en servidor y en navegador)", () => {
    for (const ruta of ["components/contratos/lista-contratos.tsx", "components/contratos/tarjeta-contratos.tsx"]) {
      const f = leer(ruta);
      expect(f, ruta).not.toContain("@repo/db");
      expect(f, ruta).not.toMatch(/useState|useEffect|useTransition/);
    }
  });

  it("la lista, la ficha y la sección piden la guarda con 'Ver'; los permisos de escritura los decide el servidor", () => {
    expect(leer("app/(shell)/contratos/layout.tsx")).toContain('requireContratos("ver")');
    expect(leer("app/(shell)/contratos/page.tsx")).toContain('requireContratos("ver")');
    const ficha = leer("app/(shell)/contratos/[id]/page.tsx");
    expect(ficha).toContain('requireContratos("ver")');
    expect(ficha).toContain("notFound()");
    expect(ficha).toContain("cargarFichaContrato(ctx, id)");
    expect(ficha).toContain("puedeGestionarContratos(ctx)");
    const guarda = leer("lib/contratos/requerir.ts");
    expect(guarda).toContain("CONTRACTS_MODULE_KEY");
    expect(guarda.indexOf("isModuleEnabledForWorkspace")).toBeLessThan(guarda.indexOf("puede(acceso, nivel"));
    expect(guarda).toContain("redirect(");
  });

  it("la ficha usa la lista del motor, con la clave del módulo", () => {
    const lista = leer("app/(shell)/contratos/page.tsx");
    expect(lista).toContain("listadoContratos");
    expect(lista).toContain("CONTRACTS_MODULE_KEY");
    expect(lista).toContain('ruta="/contratos"');
  });

  it("'Descargar PDF' no aparece hasta que el contrato tiene PDF", () => {
    const ficha = leer("app/(shell)/contratos/[id]/page.tsx");
    expect(ficha).toMatch(/\{ficha\.tienePdf \? \(\s*<a href=\{`\/contratos\/\$\{encodeURIComponent\(ficha\.id\)\}\/pdf`\}[^>]*>\s*Descargar PDF/);
    // Y la lectura nunca entrega la clave del PDF al navegador.
    expect(leer("lib/contratos/ficha.ts")).not.toMatch(/pdfKey:\s*c\.pdfKey/);
  });

  it("el pedido y el contacto muestran la tarjeta sólo con 'Ver' en Contratos y el módulo encendido", () => {
    const tarjetas = leer("lib/contratos/tarjetas.ts");
    expect(tarjetas).toContain("puedeVerContratos(ctx)");
    expect(tarjetas).toContain("contratosEncendidos(");
    expect(tarjetas.indexOf("puedeVerContratos(ctx)")).toBeLessThan(tarjetas.indexOf("prisma.fotofficeContrato.findMany"));
    expect(tarjetas).toContain("workspaceId: ctx.workspaceId");

    const pedido = leer("app/(shell)/pedidos/[id]/page.tsx");
    expect(pedido).toContain("contratosParaTarjeta(ctx, { pedidoId: detalle.id })");
    expect(pedido).toContain("<ContratosDelPedido");
    expect(pedido).toMatch(/gestionaContratos = verContratos && puedeGestionarContratos\(ctx\) && !cancelado/);
    expect(pedido).toContain("puedeGenerar={gestionaContratos}");
    expect(pedido).toContain("p.isActive");

    const contacto = leer("app/(shell)/clientes/[clientId]/page.tsx");
    expect(contacto).toContain("contratosParaTarjeta(");
    expect(contacto).toContain("clientId: cliente.id");
    expect(contacto).toContain("<TarjetaContratos");
  });

  it("el menú muestra 'Contratos' sólo con el módulo encendido y tiene palabras de búsqueda", () => {
    const nav = leer("components/shell/shell-nav.tsx");
    expect(nav).toMatch(/ve\(CONTRACTS_MODULE_KEY\)\s*\?\s*\[\s*\{\s*href: "\/contratos"/);
    expect(nav).toContain('isActive: under("/contratos")');
    expect(leer("lib/shell/nav-keywords.ts")).toContain('"/contratos": [');
  });

  it("las acciones nuevas piden Gestionar y validan el id", () => {
    const a = leer("app/actions/contratos.ts");
    const i = a.indexOf("export async function enlaceDeFirmanteContratoAction(");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = a.slice(i);
    expect(cuerpo).toContain('contextoDeContratos("operar")');
    expect(cuerpo).toContain("esId(firmanteId)");
    expect(cuerpo).toContain("enlaceDeFirmante(ctx, firmanteId)");
  });

  it("'Marcar firmado en papel' sube el archivo a la ficha del contacto y recién después marca el contrato", () => {
    const f = leer("components/contratos/acciones-contrato.tsx");
    expect(f).toContain('subirAdjuntoConId({ tipo: "CLIENTE", id: clientId }');
    expect(f.indexOf("subirAdjuntoConId(")).toBeLessThan(f.indexOf("marcarFirmadoEnPapelAction(contratoId"));
  });

  it("las pantallas nunca presentan esto como 'firma digital'", () => {
    const carpetas = ["components/contratos", "app/(shell)/contratos"];
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of readdirSync(join(RAIZ, ...dir.split("/")), { withFileTypes: true })) {
        const ruta = `${dir}/${e.name}`;
        if (e.isDirectory()) recorrer(ruta);
        else if (/\.tsx?$/.test(e.name)) archivos.push(ruta);
      }
    };
    carpetas.forEach(recorrer);
    expect(archivos.length).toBeGreaterThanOrEqual(10);
    for (const ruta of archivos) expect(leer(ruta).toLowerCase(), ruta).not.toContain("firma digital");
  });
});
