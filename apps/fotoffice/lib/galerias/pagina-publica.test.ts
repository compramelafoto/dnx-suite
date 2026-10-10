import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const BASE = "../../app/w/[workspaceSlug]/galeria/[token]";
const page = leer(`${BASE}/page.tsx`);
const acciones = leer(`${BASE}/acciones.ts`);
const visitante = leer(`${BASE}/visitante.ts`);
const config = leer("../../next.config.ts");

const NOMBRES = [...acciones.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]!);
const cuerpoDe = (n: string) => {
  const i = acciones.indexOf(`export async function ${n}(`);
  const j = acciones.indexOf("\nexport async function ", i + 10);
  return acciones.slice(i, j === -1 ? undefined : j);
};

describe("página pública de la galería (fuente)", () => {
  it("es dinámica, no se indexa, no manda el referer, y pasa por el freno por IP antes de leer la base", () => {
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(page).toContain('referrer: "no-referrer"');
    expect(page.indexOf("visitanteDelEnlace()")).toBeGreaterThan(-1);
    expect(page.indexOf("visitanteDelEnlace()")).toBeLessThan(page.indexOf("workspaceDelSlug("));
  });
  it("lo que abre el equipo no cuenta como 'entró'", () => {
    expect(page).toMatch(/!\(await abreAlguienDelEquipo\(workspaceId\)\)\) await registrarEntrada/);
  });
  it("un enlace que no resuelve da 404 (notFound), con su página 'Este enlace ya no es válido'", () => {
    expect(page).toMatch(/if \(!r\.ok\) notFound\(\)/);
    expect(leer(`${BASE}/not-found.tsx`)).toContain("Este enlace ya no es válido");
  });
});

describe("acciones públicas (fuente)", () => {
  it("es 'use server' y sólo exporta funciones async", () => {
    expect(acciones.startsWith('"use server";')).toBe(true);
    expect(acciones).not.toMatch(/^export (const|let|var|type|interface|class)\b/m);
    expect(NOMBRES.sort()).toEqual(["comentarAction", "descargarAction", "elegirFotoAction", "enviarSeleccionAction", "vistasAction"]);
  });
  it("toda acción pasa por el freno por IP y por el workspace del slug antes de tocar nada", () => {
    for (const n of NOMBRES) expect(cuerpoDe(n), n).toMatch(/await entrar\("/);
    const e = acciones.slice(acciones.indexOf("async function entrar"), acciones.indexOf("export async function"));
    expect(e.indexOf("visitanteDeAccion")).toBeLessThan(e.indexOf("workspaceDelSlug"));
  });
  it("ninguna acción confía en un workspace o cliente que mande el navegador: sólo slug y token", () => {
    expect(acciones).not.toMatch(/workspaceId: unknown|galeriaClienteId: unknown|clienteId: unknown/);
  });
  it("los correos salen con after(), después de responder", () => {
    expect(cuerpoDe("enviarSeleccionAction")).toMatch(/after\(\(\) => avisarSeleccionEnviada\(/);
  });
  it("enviar tiene el freno más estricto", () => {
    expect(cuerpoDe("enviarSeleccionAction")).toContain('entrar("enviar", 10,');
  });
  it("el freno usa claves propias por acción y no guarda la IP", () => {
    expect(visitante).toContain("galeria-ver:");
    expect(visitante).toMatch(/`galeria-\$\{accion\}:\$\{ip\}`/);
    expect(visitante).not.toMatch(/prisma/);
  });
});

describe("cabeceras de la galería (next.config.ts)", () => {
  it("la página y el dominio propio van sin referer y sin marco, como el contrato", () => {
    expect(config).toContain('source: "/w/:slug/galeria/:path*", headers: [...noReferrer, ...sinMarco]');
    expect(config).toContain('source: "/galeria/:path*", headers: [...noReferrer, ...sinMarco]');
  });
});

describe("componentes del cliente (fuente)", () => {
  const grilla = leer("../../components/galeria-publica/grilla.tsx");
  const visor = leer("../../components/galeria-publica/visor.tsx");
  const cliente = leer("../../components/galeria-publica/galeria-cliente.tsx");
  it("las imágenes no se arrastran, no abren el menú del clic derecho y la grilla carga perezosa", () => {
    for (const f of [grilla, visor, cliente]) {
      expect(f).toContain("onContextMenu");
      expect(f).toContain("draggable={false}");
    }
    expect(grilla).toContain('loading="lazy"');
    expect(cliente).toContain("select-none");
  });
  it("el visor responde a las flechas del teclado, a Escape y al deslizar", () => {
    expect(visor).toContain('"ArrowLeft"');
    expect(visor).toContain('"ArrowRight"');
    expect(visor).toContain('"Escape"');
    expect(visor).toContain("onTouchStart");
    expect(visor).toContain("onTouchEnd");
  });
  it("elegir es optimista y se deshace si el servidor dice que no", () => {
    expect(cliente).toMatch(/setElegidas\(\(s\) => conCambio\(s, id, !marcar\)\)/);
  });
  it("las imágenes nunca llevan el referer", () => {
    for (const f of [grilla, visor, cliente]) expect(f).toContain('referrerPolicy="no-referrer"');
  });
});
