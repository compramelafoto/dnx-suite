import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Reglas de fuente de la Bandeja: no se ejecutan las pantallas, se leen. Son las barreras que no
 * se pueden romper sin que alguien lo note: la guarda va primero, los componentes de cliente no
 * tocan la base, el envío lleva su identificador y el botón se deshabilita mientras envía.
 */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const PAGINAS = ["app/(shell)/bandeja/page.tsx", "app/(shell)/bandeja/[chatId]/page.tsx"];

describe("pantallas de la Bandeja", () => {
  it("el layout hace la guarda antes de dibujar nada", () => {
    const layout = leer("app/(shell)/bandeja/layout.tsx");
    expect(layout).toContain("requireBandeja()");
    expect(layout.indexOf("requireBandeja()")).toBeLessThan(layout.indexOf("leerConexion(ctx"));
  });

  it.each(PAGINAS)("%s pide la guarda antes de leer datos", (ruta) => {
    const fuente = leer(ruta);
    const guarda = fuente.indexOf("await requireBandeja()");
    expect(guarda).toBeGreaterThan(-1);
    for (const lectura of ["listarChats(", "detalleChat("]) {
      const i = fuente.indexOf(lectura, fuente.indexOf("export default"));
      if (i !== -1) expect(guarda).toBeLessThan(i);
    }
  });

  it("la guarda sigue el orden: sesión, workspace, módulo encendido y Ver", () => {
    const g = leer("lib/bandeja/pagina.ts");
    const orden = ["requireAuth()", "resolveActiveWorkspace(", "isModuleEnabledForWorkspace(", "puede(acceso, \"ver\""].map((t) => g.indexOf(t));
    expect(orden.every((i) => i > -1)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });

  it("la lista se refresca cada 10 s y la conversación cada 5 s", () => {
    expect(leer("app/(shell)/bandeja/page.tsx")).toContain("<RefrescoPeriodico segundos={10} />");
    expect(leer("app/(shell)/bandeja/[chatId]/page.tsx")).toContain("<RefrescoPeriodico segundos={5} />");
  });

  it("el refresco se pausa con la pestaña oculta", () => {
    const f = leer("components/bandeja/refresco-periodico.tsx");
    expect(f).toContain('document.visibilityState === "visible"');
    expect(f).toContain("router.refresh()");
  });

  it("la conversación marca como leído al abrir y muestra el cartel del modo de prueba", () => {
    expect(leer("app/(shell)/bandeja/[chatId]/page.tsx")).toContain("<MarcarLeido");
    expect(leer("app/(shell)/bandeja/layout.tsx")).toContain("Modo de prueba: los mensajes no salen a WhatsApp.");
  });
});

describe("componentes de cliente", () => {
  const cliente = readdirSync(join(RAIZ, "components/bandeja"))
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) => leer(`components/bandeja/${f}`).trimStart().startsWith('"use client"'));

  it("hay componentes de cliente que revisar", () => {
    expect(cliente.length).toBeGreaterThanOrEqual(5);
  });

  it.each(cliente)("%s no importa la base ni módulos de servidor", (archivo) => {
    const f = leer(`components/bandeja/${archivo}`);
    expect(f).not.toMatch(/@repo\/db|server-only|from "@\/lib\/bandeja\/(acciones|lecturas|contexto|conexion|envio|registro)"/);
    expect(f).not.toMatch(/\bprisma\b/);
  });
});

describe("caja de respuesta", () => {
  const f = leer("components/bandeja/caja-de-respuesta.tsx");

  it("genera un identificador por envío y lo manda a la acción", () => {
    expect(f).toContain("crypto.randomUUID()");
    expect(f).toMatch(/responderAction\(chatId, limpio, token\)/);
  });

  it("deshabilita el botón mientras envía y lo evita si no hay texto", () => {
    expect(f).toMatch(/disabled=\{enviando \|\| vacio\}/);
    expect(f).toContain("if (enviando || vacio || !dentroDeVentana) return;");
  });

  it("avisa con role alert / status y vacía el texto cuando sale bien", () => {
    expect(f).toContain('role="alert"');
    expect(f).toContain('role="status"');
    expect(f).toContain('setTexto("")');
  });

  it("fuera de las 24 h no muestra el cuadro de texto, sólo el aviso", () => {
    expect(f).toContain("if (!dentroDeVentana)");
    expect(f).toContain("Pasaron más de 24 horas desde el último mensaje del cliente");
  });
});

describe("permisos en pantalla", () => {
  it("las acciones sólo se dibujan para quien puede operar", () => {
    const f = leer("app/(shell)/bandeja/[chatId]/page.tsx");
    expect(f).toMatch(/puedeOperar \? \(\s*<BotonesDelChat/);
    expect(f).toMatch(/puedeOperar \? \(\s*<CajaDeRespuesta/);
  });

  it("el panel del cliente sólo ofrece vincular o crear con permiso de operar", () => {
    expect(leer("components/bandeja/panel-del-cliente.tsx")).toContain("puedeOperar && !cliente && !clienteOculto");
  });
});

describe("ajustes de la ronda 1", () => {
  it("'Crear contacto' sólo se ofrece con permiso de Clientes, y la guarda se calcula una vez por pedido", () => {
    expect(leer("components/bandeja/panel-del-cliente.tsx")).toContain("puedeCrearContacto ? (");
    expect(leer("app/(shell)/bandeja/[chatId]/page.tsx")).toContain("puedeCrearContacto={puedeOperarClientes}");
    expect(leer("lib/bandeja/pagina.ts")).toContain("cache(requireBandejaSinCache)");
  });

  it("marcar leído evita llamadas simultáneas", () => {
    expect(leer("components/bandeja/marcar-leido.tsx")).toContain("enCurso.current");
  });
});

describe("menú", () => {
  it("el ítem figura con la ruta y el nivel Ver del módulo", () => {
    const f = leer("components/shell/shell-nav.tsx");
    expect(f).toContain("ve(BANDEJA_MODULE_KEY)");
    expect(f).toContain('href: "/bandeja"');
    expect(f).toContain("badge: bandejaNoLeidos");
  });

  it("el total de no leídos sólo se consulta con Ver en el módulo", () => {
    const f = leer("components/shell/admin-shell.tsx");
    expect(f).toMatch(/hasLevel\(levels\[BANDEJA_MODULE_KEY\] \?\? "NONE", "VIEW"\) \? await noLeidosDelWorkspace/);
  });
});
