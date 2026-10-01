import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente del botón "Mensaje" y de cómo se ven los mensajes registrados. */
const RAIZ = join(__dirname, "..", "..");
// (vive en lib/ porque vitest sólo incluye lib/** y app/**)
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const componente = (f: string) => leer("components", "mensajes", f);

/** Lo que el navegador nunca debe cargar: la base y los módulos de servidor de plantillas. */
const PROHIBIDOS = [
  "@repo/db",
  "prisma",
  "server-only",
  "@/lib/plantillas/definiciones",
  "@/lib/plantillas/semillas",
  "@/lib/plantillas/acceso",
  "@/lib/plantillas/contexto",
  "@/lib/plantillas/envio",
  "@/lib/plantillas/ficha",
  "@/lib/plantillas/registro",
];

/** Lo que importa cada archivo, con las comillas, para no confundir un comentario con un import. */
function importados(fuente: string): string[] {
  return [...fuente.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]!);
}

describe("botón «Mensaje»", () => {
  it("la tarjeta es de servidor y lee sólo a través de la guarda", () => {
    const t = componente("mensaje.tsx");
    expect(t).not.toMatch(/^["']use client["']/m);
    expect(t).toContain('import "server-only"');
    expect(t).toContain("await cargarPanelMensaje(entityType, entityId)");
    expect(t).toContain("if (!panel) return null;");
    expect(t).not.toContain("@repo/db");
  });

  it("los componentes de cliente no importan la base ni módulos de servidor", () => {
    const clientes = readdirSync(join(RAIZ, "components", "mensajes")).filter(
      (f) => f.endsWith(".tsx") && componente(f).startsWith('"use client";'),
    );
    expect(clientes.sort()).toEqual(["mensaje-registrado.tsx", "panel-mensaje.tsx"]);
    for (const f of clientes) {
      const imports = importados(componente(f));
      for (const p of PROHIBIDOS) {
        expect(imports.some((i) => i === p || i.startsWith(`${p}/`)), `${f} importa ${p}`).toBe(false);
      }
    }
    // Lo que sí usan del lado del navegador: módulos puros y las acciones de servidor.
    const panel = importados(componente("panel-mensaje.tsx"));
    expect(panel).toContain("@/app/actions/mensajes");
    expect(panel).toContain("@/lib/plantillas/motor");
  });

  it("la línea de tiempo y el historial tampoco importan módulos de servidor de plantillas", () => {
    for (const f of [leer("components", "ficha", "evento.tsx"), leer("components", "circuitos", "historial.tsx")]) {
      const imports = importados(f);
      for (const p of PROHIBIDOS) expect(imports.includes(p)).toBe(false);
    }
  });

  it("el panel prepara con la acción, avisa de variables vacías y de textos en MAYÚSCULAS", () => {
    const p = componente("panel-mensaje.tsx");
    expect(p).toContain("prepararMensajeAction({ canal, entityType, entityId, templateId: id })");
    expect(p).toContain("setVacias(r.vacias)");
    expect(p).toContain("vacias.length > 0 ? (");
    expect(p).toContain("tieneMarcadorSinCompletar(cuerpo)");
    expect(p).toContain('<option value="">Sin plantilla</option>');
  });

  it("correo: «Enviar» muestra el resultado o el error y refresca", () => {
    const p = componente("panel-mensaje.tsx");
    const envio = p.slice(p.indexOf("function enviarCorreo()"), p.indexOf("function abrirWhatsapp()"));
    expect(envio).toContain("enviarCorreoAction(");
    expect(envio).toContain("router.refresh()");
    expect(envio).toContain("setError(r.error)");
    expect(envio).toContain("if (r.registrado) router.refresh();");
  });

  it("WhatsApp: la pestaña se abre en el clic, antes de esperar la acción; si se bloquea, queda el enlace", () => {
    const p = componente("panel-mensaje.tsx");
    const wa = p.slice(p.indexOf("function abrirWhatsapp()"), p.indexOf("return (", p.indexOf("function abrirWhatsapp()")));
    const abre = wa.indexOf('window.open("", "_blank")');
    expect(abre).toBeGreaterThan(0);
    expect(wa.indexOf("await abrirWhatsappAction(")).toBeGreaterThan(abre);
    expect(wa).toContain("pestana.opener = null");
    expect(wa).toContain("pestana.location.href = r.url");
    expect(wa).toContain("setEnlace(r.url)");
    expect(p).toContain('<a href={enlace} target="_blank" rel="noopener noreferrer"');
  });

  it("los canales sin destino van deshabilitados con el motivo", () => {
    const p = componente("panel-mensaje.tsx");
    expect(p).toContain("const deshabilitado = datos.destino === null;");
    expect(p).toContain("disabled={deshabilitado}");
    expect(p).toContain("d.motivo ? (");
  });

  it("la guarda del panel corre antes de sembrar o leer", () => {
    const f = leer("lib", "plantillas", "ficha.ts");
    const guarda = f.indexOf("await contextoDelPanelMensaje(entityType, entityId)");
    expect(guarda).toBeGreaterThan(0);
    for (const lectura of ["asegurarPlantillasIniciales(", "destinoDe(", "listarPlantillas("]) {
      expect(f.indexOf(lectura, f.indexOf("export async function cargarPanelMensaje")), lectura).toBeGreaterThan(guarda);
    }
    const ctx = f.indexOf("await contextoDelPedido()");
    expect(f.indexOf('puede(ctx.role, "operar")')).toBeGreaterThan(ctx);
    expect(f.indexOf("moduloDeRegistroEncendido(ctx.workspaceId")).toBeGreaterThan(ctx);
    expect(f.indexOf("registroDelWorkspace(ctx.workspaceId")).toBeGreaterThan(ctx);
  });

  it("está en las fichas de Cliente, Socio y Consulta", () => {
    expect(leer("app", "(shell)", "clientes", "[clientId]", "page.tsx")).toContain('<Mensaje entityType="CLIENTE" entityId={cliente.id} />');
    expect(leer("app", "(shell)", "members", "[id]", "page.tsx")).toContain('<Mensaje entityType="SOCIO" entityId={member.id} />');
    const consulta = leer("app", "(shell)", "captacion", "[id]", "page.tsx");
    expect(consulta).toContain('<Mensaje entityType="CONSULTA" entityId={id} />');
    // Los mensajes de la consulta, recién después de verificarla en el workspace de la sesión.
    expect(consulta.indexOf("mensajesDeConsulta(workspace.id, id)")).toBeGreaterThan(consulta.indexOf("if (!ficha) notFound();"));
    expect(consulta).toContain("mensajes={mensajes}");
  });
});
