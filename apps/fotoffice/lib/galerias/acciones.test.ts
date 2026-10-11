import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fuente = readFileSync(new URL("../../app/actions/galerias.ts", import.meta.url), "utf8");
const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), "utf8");

function cuerpoDe(nombre: string): string {
  const i = fuente.indexOf(`export async function ${nombre}(`);
  expect(i, nombre).toBeGreaterThan(-1);
  const j = fuente.indexOf("\nexport async function ", i + 10);
  return fuente.slice(i, j === -1 ? undefined : j);
}

const NOMBRES = [...fuente.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]!);

describe("acciones de galerías (fuente)", () => {
  it("es un archivo 'use server' que sólo exporta funciones async", () => {
    expect(fuente.startsWith('"use server";')).toBe(true);
    expect(fuente).not.toMatch(/^export (const|let|var|type|interface|class)\b/m);
    expect(NOMBRES.length).toBeGreaterThan(15);
  });

  it("toda acción arma su contexto antes de tocar nada (ninguna escribe sin guarda)", () => {
    for (const n of NOMBRES) expect(cuerpoDe(n), n).toMatch(/contextoDeGalerias\("(ver|operar|configurar)"\)/);
  });

  it.each([
    "crearGaleriaAction", "editarGaleriaAction", "publicarGaleriaAction", "archivarGaleriaAction", "reactivarGaleriaAction",
    "buscarProyectosGaleriaAction", "pedirSubidaFotoAction", "borrarFotoAction", "reordenarFotosAction", "establecerModoOrdenAction",
    "establecerPortadaAction", "buscarContactosGaleriaAction", "agregarClienteGaleriaAction", "enlaceDeClienteGaleriaAction",
    "whatsappDeClienteGaleriaAction", "enviarEnlaceGaleriaPorCorreoAction", "regenerarEnlaceGaleriaAction", "anularEnlaceGaleriaAction",
  ])("%s exige Gestionar y valida la forma de lo que llega", (nombre) => {
    const c = cuerpoDe(nombre);
    expect(c).toContain('contextoDeGalerias("operar")');
    expect(c).toMatch(/esId\(|esObjeto\(|typeof texto/);
  });

  it.each(["responderComentarioGaleriaAction", "finalizarSeleccionGaleriaAction", "reactivarSeleccionGaleriaAction"])(
    "%s exige Gestionar, valida la forma y delega en lib/galerias/revision",
    (nombre) => {
      const c = cuerpoDe(nombre);
      expect(c).toContain('contextoDeGalerias("operar")');
      expect(c).toMatch(/esId\(/);
      expect(c).toMatch(/responderComentario\(ctx|finalizarSeleccion\(ctx|reactivarSeleccion\(ctx/);
    },
  );

  it("leer fotos sólo pide Ver; los ajustes piden `configurar` (lo mismo que la pantalla), sin exigir Ver en Galería", () => {
    expect(cuerpoDe("fotosPorIdsAction")).toContain('contextoDeGalerias("ver")');
    const c = cuerpoDe("guardarAjustesGaleriaAction");
    expect(c).toContain('contextoDeGalerias("configurar")');
    expect(c).not.toContain('contextoDeGalerias("ver")');
  });

  it("elegir un contacto del padrón exige además Ver en Clientes (regla R10); el alta rápida no", () => {
    expect(cuerpoDe("buscarContactosGaleriaAction")).toContain("CLIENTS_MODULE_KEY");
    expect(cuerpoDe("agregarClienteGaleriaAction")).toContain("CLIENTS_MODULE_KEY");
  });

  it("el correo del enlace sale con after() y nunca antes de validar el pedido", () => {
    const c = cuerpoDe("enviarEnlaceGaleriaPorCorreoAction");
    expect(c).toContain("after(");
    expect(c.indexOf("pedirEnvioPorCorreo(")).toBeLessThan(c.indexOf("after("));
    expect(c.indexOf("if (r.ok)")).toBeLessThan(c.indexOf("after("));
    expect(fuente).toContain('import { after } from "next/server"');
  });

  it("las acciones no devuelven nunca la clave del original ni el token en claro salvo copiar/WhatsApp", () => {
    expect(fuente).not.toMatch(/originalKey|tokenHash|tokenIssuedAt/);
  });
});

describe("pantallas de galerías (fuente)", () => {
  it("el layout y cada pantalla piden el módulo encendido y 'Ver'", () => {
    expect(leer("../../app/(shell)/galerias/layout.tsx")).toContain('requireGalerias("ver")');
    expect(leer("../../app/(shell)/galerias/page.tsx")).toContain('requireGalerias("ver")');
    expect(leer("../../app/(shell)/galerias/[id]/page.tsx")).toContain('requireGalerias("ver")');
  });

  it("la ficha valida el id, cae en notFound() si no existe en el workspace y sólo lee lo de la pestaña abierta", () => {
    const p = leer("../../app/(shell)/galerias/[id]/page.tsx");
    expect(p).toContain("ID_VALIDO.test(id)");
    expect(p).toContain("cargarFichaGaleria(ctx, id)");
    expect(p).toMatch(/if \(!ficha\) notFound\(\)/);
    expect(p).toContain('pestana === "fotos" ? await listarFotos(ctx, id) : []');
    expect(p).toContain('pestana === "historial" ? await cargarHistorial(ctx, id, pagina) : { items: []');
    // Los componentes de cliente reciben fechas como texto, no objetos.
    expect(p).toContain(".toISOString()");
  });

  it("la tarjeta del proyecto sólo aparece con el módulo encendido y Ver en Galería", () => {
    const p = leer("../../app/(shell)/proyectos/[id]/page.tsx");
    expect(p).toContain("galeriasEncendidas(workspace.id)");
    expect(p).toContain("galeriasDeProyecto(ctx, ficha.id)");
    expect(p).toContain("{galerias ? <TarjetaGaleriasProyecto");
  });

  it("Configuración → Galería pide `configurar` antes de leer nada", () => {
    expect(leer("../../app/workspace/configuracion/galeria/page.tsx")).toContain("prepararConfiguracionGalerias()");
    expect(leer("./pagina.ts")).toMatch(/puede\(role, "configurar"\)[\s\S]*isModuleEnabledForWorkspace/);
  });

  it("el menú y el ⌘K conocen la sección", () => {
    expect(leer("../../components/shell/shell-nav.tsx")).toContain('href: "/galerias"');
    expect(leer("../shell/nav-keywords.ts")).toContain('"/galerias"');
  });
});

describe("subida de fotos (fuente del uploader)", () => {
  const u = leer("../../components/galerias/uploader-fotos.tsx");
  it("sube directo con PUT firmado, 4 en paralelo, reintenta por foto y no crea vistas previas con object URLs", () => {
    expect(u).toContain("SUBIDAS_EN_PARALELO");
    expect(u).toContain("crearCola<Entrada>(SUBIDAS_EN_PARALELO");
    expect(u).toContain('xhr.open("PUT", url)');
    expect(u).not.toContain("createObjectURL");
    expect(u).toContain("/fotos/confirmar");
    expect(u).toContain("Reintentar");
    expect(u).toContain("clasificarArchivos");
  });
  it("la grilla no dibuja todo de golpe y trae las miniaturas por lotes", () => {
    const g = leer("../../components/galerias/pestana-fotos.tsx");
    expect(g).toContain("const TANDA = 120");
    expect(g).toContain('loading="lazy"');
    expect(g).toContain("slice(0, 100)");
  });
});

describe("revisión de la selección (fuente)", () => {
  it("la pantalla pide Ver antes de leer y cae en notFound con ids ajenos o mal formados", () => {
    const p = leer("../../app/(shell)/galerias/[id]/clientes/[clienteId]/page.tsx");
    expect(p.indexOf('requireGalerias("ver")')).toBeGreaterThan(-1);
    expect(p.indexOf('requireGalerias("ver")')).toBeLessThan(p.indexOf("cargarRevisionCliente("));
    expect(p).toContain("ID_VALIDO.test(id)");
    expect(p).toContain("if (!r) notFound()");
    expect(p).toContain("puedeGestionarGalerias(ctx)");
  });
  it("las pestañas llevan a la revisión de cada cliente en lugar del aviso provisorio", () => {
    const c = leer("../../components/galerias/pestana-clientes.tsx");
    expect(c).toContain("/clientes/${encodeURIComponent(c.id)}");
    expect(c).not.toContain("próxima entrega");
    expect(c).toContain("bg-violet-50");
  });
  it("finalizar y reactivar piden confirmación y las respuestas se limitan a 2.000 caracteres", () => {
    const r = leer("../../components/galerias/revision-cliente.tsx");
    expect(r.match(/window\.confirm\(/g)?.length).toBeGreaterThanOrEqual(1);
    expect(r).toContain("finalizarSeleccionGaleriaAction");
    expect(r).toContain("reactivarSeleccionGaleriaAction");
    expect(r).toContain("maxLength={MAX_COMENTARIO}");
    expect(r).toContain("Con comentarios");
    expect(r).toContain("Seleccionadas");
  });
  it("exportar explica Lightroom con 'Contiene', copia al portapapeles y descarga el CSV", () => {
    const e = leer("../../components/galerias/exportar-seleccion.tsx");
    expect(e).toContain("Biblioteca → Filtro de biblioteca → Texto → Nombre de archivo → <strong>Contiene</strong>");
    expect(e).toContain("navigator.clipboard.writeText");
    expect(e).toContain("Windows / Finder");
    expect(e).toContain("Descargar CSV");
    expect(e).toContain("/exportar");
  });
});
