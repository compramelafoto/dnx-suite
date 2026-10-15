import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

vi.mock("server-only", () => ({}));

const { esClaveDeContrato } = await import("./almacen");
const { TIPOS_PLANTILLA, ETIQUETA_TIPO_PLANTILLA } = await import("@/lib/plantillas/constantes");
const { getModuleDefinition } = await import("@/lib/modules/registry");
const { RESERVED_SLUGS } = await import("@/lib/entrada/institution-shortcut");

/**
 * Reglas de fuente de las pantallas de Contratos (Etapa 5, tarea 2): el navegador no importa la base,
 * las acciones pasan por la guarda y cada pantalla conoce su permiso.
 */
const RAIZ = (() => {
  let dir = dirname(new URL(import.meta.url).pathname);
  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir);
  return dir;
})();
const leer = (ruta: string) => readFileSync(join(RAIZ, ...ruta.split("/")), "utf8");

describe("Contratos: registro y tipos", () => {
  it("el módulo está disponible, depende de Pedidos y su ruta está reservada", () => {
    const m = getModuleDefinition("contracts");
    expect(m).toMatchObject({ status: "AVAILABLE", route: "/contratos", dependsOn: ["orders"] });
    expect(RESERVED_SLUGS.has("contratos")).toBe(true);
  });

  it("CONTRATO es un tipo de plantilla con etiqueta", () => {
    expect(TIPOS_PLANTILLA).toContain("CONTRATO");
    expect(ETIQUETA_TIPO_PLANTILLA.CONTRATO).toBe("Contrato");
  });
});

describe("almacén privado de contratos", () => {
  it("sólo acepta claves bajo contratos/<workspace>/ y sin recorridos raros", () => {
    expect(esClaveDeContrato("contratos/ws-1/empresa/firma-abc.png")).toBe(true);
    expect(esClaveDeContrato("contratos/ws1/c1/f1.png")).toBe(true);
    for (const mala of ["adjuntos/ws/x", "contratos/ws-1/../otro/x.png", "contratos//x", "contratos/ws-1", "", null, 5]) {
      expect(esClaveDeContrato(mala), String(mala)).toBe(false);
    }
  });
});

describe("pantallas de Contratos: fuente", () => {
  it("los componentes del navegador no importan la base ni código de servidor", () => {
    for (const ruta of [
      "app/workspace/configuracion/contratos/ajustes-form.tsx",
      "app/workspace/configuracion/contratos/firma-empresa.tsx",
      "app/workspace/configuracion/contratos/plantillas/editor-plantilla.tsx",
      "components/contratos/contratantes-del-pedido.tsx",
    ]) {
      const f = leer(ruta);
      expect(f.startsWith('"use client"'), ruta).toBe(true);
      expect(f, ruta).not.toContain("@repo/db");
      expect(f, ruta).not.toContain("server-only");
      expect(f, ruta).not.toMatch(/from "@\/lib\/contratos\/(ajustes|plantillas|contratantes|contexto|pagina|almacen|semillas)"/);
    }
    // La vista previa corre en el navegador: sus cálculos son puros.
    for (const ruta of ["lib/contratos/muestra.ts", "lib/contratos/variables.ts", "lib/contratos/formato.ts", "lib/contratos/modelo.ts"]) {
      expect(leer(ruta), ruta).not.toContain("server-only");
      expect(leer(ruta), ruta).not.toContain("@repo/db");
    }
  });

  it("las acciones arman el contexto antes de escribir y las de configuración no se saltan `configurar`", () => {
    const a = leer("app/actions/contratos.ts");
    expect(a.startsWith('"use server"')).toBe(true);
    expect((a.match(/contextoDeContratos\(/g) ?? []).length).toBeGreaterThanOrEqual(9);
    expect(a).toContain('contextoDeContratos("operar")');
    for (const f of ["guardarAjustesContratos(ctx", "guardarFirmaEmpresa(ctx", "quitarFirmaEmpresa(ctx", "crearPlantilla(ctx", "editarPlantilla(ctx", "eliminarPlantilla(ctx", "fijarContratante(ctx", "quitarContratante2(ctx"]) {
      expect(a, f).toContain(f);
    }
  });

  it("las pantallas de configuración pasan por la guarda de `configurar`", () => {
    expect(leer("lib/contratos/pagina.ts").indexOf('puede(role, "configurar")')).toBeGreaterThan(0);
    for (const ruta of ["app/workspace/configuracion/contratos/page.tsx", "app/workspace/configuracion/contratos/plantillas/page.tsx"]) {
      expect(leer(ruta), ruta).toContain("prepararConfiguracionContratos()");
    }
  });

  it("la ficha del pedido muestra Contratantes sólo con el módulo encendido y Ver en Contratos", () => {
    const p = leer("app/(shell)/pedidos/[id]/page.tsx");
    expect(p).toContain("puedeVerContratos(ctx) && (await contratosEncendidos(workspace.id))");
    expect(p).toContain("<ContratantesDelPedido");
    expect(p).toContain("puedeGestionarContratos(ctx)");
  });

  it("aparece en el menú de Configuración y en la página de Configuración con el módulo encendido", () => {
    const nav = leer("components/shell/shell-nav.tsx");
    const i = nav.indexOf('"/workspace/configuracion/contratos"');
    expect(i).toBeGreaterThan(nav.indexOf("const institucion"));
    expect(nav.lastIndexOf("...(ve(CONTRACTS_MODULE_KEY)", i)).toBeGreaterThan(nav.indexOf("const institucion"));
    const cfg = leer("app/workspace/configuracion/page.tsx");
    expect(cfg).toContain('"/workspace/configuracion/contratos"');
    expect(cfg).toContain("contratosVisible ?");
  });

  it("nada habla de firma digital: es firma electrónica", () => {
    for (const ruta of ["lib/contratos/clausula.ts", "lib/contratos/modelo.ts", "app/workspace/configuracion/contratos/ajustes-form.tsx", "lib/landing/catalogo.ts"]) {
      const f = leer(ruta).toLowerCase();
      const aparece = f.split("firma digital").length - 1;
      expect(aparece, ruta).toBe(0);
    }
  });
});
