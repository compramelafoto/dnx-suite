import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Reglas de fuente de la página pública de firma (etapa 5, tarea 4): seguridad y no filtración. */
const RAIZ = (() => {
  let dir = dirname(new URL(import.meta.url).pathname);
  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir);
  return dir;
})();
const leer = (ruta: string) => readFileSync(join(RAIZ, ...ruta.split("/")), "utf8");
const BASE = "app/w/[workspaceSlug]/contrato/[token]";

describe("página pública de firma: fuente", () => {
  it("no se indexa, no manda el referrer y no se enmarca (ni en la ruta de /w ni en el dominio propio)", () => {
    const page = leer(`${BASE}/page.tsx`);
    expect(page).toContain("index: false");
    expect(page).toContain('referrer: "no-referrer"');
    const cfg = leer("next.config.ts");
    expect(cfg).toContain('source: "/w/:slug/contrato/:path*", headers: [...noReferrer, ...sinMarco]');
    expect(cfg).toContain('source: "/contrato/:path*", headers: [...noReferrer, ...sinMarco]');
    expect(cfg).not.toMatch(/contrato[^\n]*frame-ancestors \*/);
  });

  it("la página resuelve el slug a la organización, frena por IP y no hay 'use client' con acceso a la base", () => {
    const page = leer(`${BASE}/page.tsx`);
    expect(page).toContain("workspaceDelSlug(workspaceSlug)");
    expect(page).toContain("visitanteDelEnlace()");
    expect(page).toContain("resolverTokenFirmantePorWorkspace(workspaceId, token)");
    expect(page).toMatch(/if \(!r\.ok\) notFound\(\)/);
    for (const f of ["firma-flujo.tsx", "firma-canvas.tsx"]) {
      const c = leer(`${BASE}/${f}`);
      expect(c.startsWith('"use client"'), f).toBe(true);
      expect(c, f).not.toContain("@repo/db");
      expect(c, f).not.toContain("server-only");
      expect(c, f).not.toMatch(/from "@\/lib\/contratos\/(firma|publico|enlace|almacen)"/);
    }
    expect(leer(`${BASE}/visitante.ts`)).toContain("checkRateLimit");
  });

  it("cada acción pública frena por IP, resuelve el slug y se apoya en firma.ts (nunca recibe el workspace del navegador)", () => {
    const a = leer(`${BASE}/actions.ts`);
    expect(a.startsWith('"use server"')).toBe(true);
    expect(a).toContain("visitanteDeAccion(");
    expect(a).toContain("workspaceDelSlug(slug)");
    for (const f of ["solicitarCodigoAction", "verificarCodigoAction", "firmarAction", "rechazarAction"]) {
      expect(a, f).toContain(`export async function ${f}(slug: unknown, token: unknown`);
    }
    expect(a).not.toMatch(/workspaceId: unknown|workspaceId\??: string/);
    // El PDF cuelga de after() y sólo cuando firmaron todos.
    expect(a).toContain("after(() => alFirmarContrato(r.contratoId))");
    expect(a).toContain("if (r.completo)");
  });

  it("firma.ts: re-resuelve el token en cada paso, usa el candado y UPDATE condicional, y nunca guarda el código", () => {
    const f = leer("lib/contratos/firma.ts");
    expect(f.match(/resolverParaActuar\(/g)!.length).toBeGreaterThanOrEqual(4);
    expect(f).toContain("bloquearContrato(tx");
    expect(f).toContain("signedAt: null, rejectedAt: null");
    // El código sólo aparece como hash en la base y como parámetro del correo.
    expect(f).not.toMatch(/codeHash:\s*codigo\b/);
    expect(f).not.toMatch(/registrarEvento\([^)]*codigo[^)]*\)/s);
    // El único registro en consola es `registrarFalla`, que sólo escribe el nombre del error y su código.
    expect(f.match(/console\./g)).toHaveLength(1);
    expect(f).toContain("{ error: e?.name ?? \"desconocido\", codigo: e?.code ?? null }");
    // Sube la imagen DESPUÉS de tomar al firmante.
    expect(f.indexOf("updateMany({\n        where: { id: f.id, workspaceId, signedAt: null, rejectedAt: null, verifiedAt")).toBeLessThan(f.indexOf("await subir(clave"));
  });

  it("la vista pública se arma campo por campo (sin volcar filas ni ids ni datos de otros firmantes)", () => {
    const p = leer("lib/contratos/publico.ts");
    expect(p).not.toMatch(/\.\.\.(f|r|c|filas|propio)\b/);
    const sel = p.slice(p.indexOf("findMany"), p.indexOf("findFirst"));
    expect(sel).toContain("select: { id: true, name: true, signedAt: true, rejectedAt: true }");
    for (const prohibido of ["email", "docNumber", "tokenHash", "ipHash", "userAgent", "codeHash", "signatureKey"]) {
      expect(sel, prohibido).not.toContain(prohibido);
    }
  });

  it("el recuadro de firma usa eventos de puntero, sin librerías", () => {
    const c = leer(`${BASE}/firma-canvas.tsx`);
    for (const e of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel"]) expect(c).toContain(e);
    expect(c).toContain('toDataURL("image/png")');
    expect(c).not.toMatch(/from "(?!react")[^"]*"/);
  });

  it("los textos no dicen 'firma digital' como si lo fuera (sólo la leyenda que la niega)", () => {
    for (const f of [`${BASE}/page.tsx`, `${BASE}/firma-flujo.tsx`, `${BASE}/not-found.tsx`, "lib/contratos/firma.ts", "lib/contratos/publico.ts"]) {
      const sinLeyenda = leer(f).replace(/no tiene firma digital con certificado/gi, "");
      expect(sinLeyenda, f).not.toMatch(/firma digital/i);
    }
  });

  it("el PDF se ofrece sólo cuando existe, con un enlace absoluto, y su ruta resuelve el token cada vez", () => {
    const page = leer(`${BASE}/page.tsx`);
    expect(page).toContain("vista.pdfDisponible");
    expect(page).toContain("/pdf`");
    expect(page).toContain("href={pdfHref}");
    const ruta = leer(`${BASE}/pdf/route.ts`);
    expect(ruta).toContain("resolverTokenFirmante(workspaceSlug, token)");
    expect(ruta).toContain('r.contrato.status !== "FIRMADO"');
    expect(ruta).toContain("visitanteDeAccion");
  });
});
