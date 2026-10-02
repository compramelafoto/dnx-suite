import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de "Más datos": quién es de servidor y qué nunca llega al navegador. */
const RAIZ = join(__dirname, "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const componente = (f: string) => leer("components", "campos", f);

describe("tarjeta Más datos", () => {
  it("la tarjeta es de servidor y lee sólo a través de la guarda", () => {
    const t = componente("mas-datos.tsx");
    expect(t).not.toMatch(/^["']use client["']/m);
    expect(t).toContain('import "server-only"');
    expect(t).toContain("await cargarMasDatos(entityType, entityId)");
    expect(t).not.toContain("@repo/db");
    expect(t).not.toMatch(/valoresDe|listarCampos|leerCampos/);
    // Enlaces: pestaña nueva sin acceso a la ficha, y sólo el href ya filtrado (http/https).
    expect(t).toContain('target="_blank" rel="noopener noreferrer"');
    expect(t).toContain("href={campo.href}");
    // Configuración sólo para quien configura.
    expect(t).toContain("if (!vista.puedeConfigurar) return null;");
  });

  it("el editor es de cliente y no importa la base ni módulos de servidor", () => {
    const e = componente("editor-mas-datos.tsx");
    expect(e.startsWith('"use client";')).toBe(true);
    expect(e).not.toContain("@repo/db");
    expect(e).not.toContain("prisma");
    expect(e).not.toContain("server-only");
    expect(e).not.toMatch(/from "@\/lib\/campos\/(valores|definiciones|ficha|acceso|semillas)"/);
    expect(e).toContain("guardarValoresAction(");
    // "Editar" sólo con permiso; errores por campo.
    expect(e).toContain("puedeEditar ? (");
    expect(e).toContain("errores[c.id]");
  });

  it("el editor manda sólo lo que cambió y, sin cambios, cierra sin llamar a la acción", () => {
    const e = componente("editor-mas-datos.tsx");
    const diff = e.indexOf("const datos = valoresCambiados(campos, valores);");
    expect(diff).toBeGreaterThan(0);
    const sinCambios = e.indexOf("if (Object.keys(datos).length === 0) {");
    expect(sinCambios).toBeGreaterThan(diff);
    expect(e.indexOf("guardarValoresAction(")).toBeGreaterThan(sinCambios);
    expect(e.slice(sinCambios, e.indexOf("guardarValoresAction("))).toMatch(/cancelar\(\);\s*return;/);
  });

  it("errores de campos que el formulario no tiene: avisa que la configuración cambió y recarga", () => {
    const e = componente("editor-mas-datos.tsx");
    expect(e).toContain('"La configuración de los campos cambió; recargá la página."');
    const aviso = e.indexOf("setError(CONFIGURACION_CAMBIO);");
    expect(aviso).toBeGreaterThan(0);
    expect(e.indexOf("router.refresh();", aviso)).toBeGreaterThan(aviso);
  });

  it("ningún componente de la carpeta importa la base", () => {
    for (const f of readdirSync(join(RAIZ, "components", "campos"))) {
      if (f.endsWith(".test.ts")) continue;
      expect(componente(f), f).not.toContain("@repo/db");
    }
  });

  it("la guarda de Más datos verifica el registro antes de leer valores", () => {
    const f = leer("lib", "campos", "ficha.ts");
    const guarda = f.indexOf("await contextoDeMasDatos(entityType, entityId)");
    expect(guarda).toBeGreaterThan(0);
    expect(f.indexOf("await listarCampos(")).toBeGreaterThan(guarda);
    expect(f.indexOf("await valoresDe(")).toBeGreaterThan(guarda);
    const ctx = f.indexOf("await contextoDelPedido()");
    expect(f.indexOf("registroDelWorkspace(ctx.workspaceId")).toBeGreaterThan(ctx);
  });

  it("está en las fichas de Cliente, Socio y Consulta", () => {
    expect(leer("app", "(shell)", "clientes", "[clientId]", "page.tsx")).toContain('<MasDatos entityType="CLIENTE" entityId={cliente.id} />');
    expect(leer("app", "(shell)", "members", "[id]", "page.tsx")).toContain('<MasDatos entityType="SOCIO" entityId={member.id} />');
    const consulta = leer("app", "(shell)", "captacion", "[id]", "page.tsx");
    expect(consulta).toContain('<MasDatos entityType="CONSULTA" entityId={id} />');
    // Los cambios de la consulta, recién después de verificarla en el workspace de la sesión.
    expect(consulta.indexOf("cambiosDeConsulta(workspace.id, id)")).toBeGreaterThan(consulta.indexOf("if (!ficha) notFound();"));
    expect(consulta).toContain("cambios={cambios}");
  });

  it("el historial de la consulta no importa la base", () => {
    const h = leer("components", "circuitos", "historial.tsx");
    expect(h).not.toContain("@repo/db");
    expect(h).not.toMatch(/from "@\/lib\/campos\/(valores|ficha)"/);
  });
});
