/**
 * Genera las miniaturas que faltan de las fotos de Trabajos (las que se subieron o importaron
 * antes de que existieran). Las fotos nuevas ya la reciben al subirse: ver lib/trabajos/miniaturas.ts.
 *
 * Variables: DATABASE_URL_FOTOFFICE (la base de FOTOFFICE; no se usa DATABASE_URL porque
 * @repo/db puede cargar packages/db/.env, que apunta a otra). Con las R2_* (como en Vercel) baja y
 * sube por la API de R2; sin ellas (en una máquina de desarrollo, donde no están porque en Vercel
 * son sensibles) baja la original de su dirección pública y sube con `wrangler r2 object put`,
 * que usa la sesión de Cloudflare de la máquina (el mismo camino que el importador de Alboom).
 *
 * Uso (desde apps/fotoffice):
 *   En seco:     DATABASE_URL_FOTOFFICE=... pnpm trabajos:miniaturas
 *   Escribiendo: agregar -- --aplicar   (opcional: --workspace <id>)
 *
 * Idempotente: sólo toma fotos sin miniatura, y la key de la miniatura es siempre la misma.
 */
const url = process.env.DATABASE_URL_FOTOFFICE;
if (!url) {
  console.error("Falta DATABASE_URL_FOTOFFICE");
  process.exit(1);
}
process.env.DATABASE_URL = url;

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const iWs = args.indexOf("--workspace");
const workspaceId = iWs >= 0 ? args[iWs + 1] : undefined;

const { prisma } = await import("@repo/db");
const { achicarAMiniatura, depsMiniaturaReales, generarMiniaturas } = await import("../lib/trabajos/miniaturas");
const { isFotofficeR2Configured } = await import("../lib/images/r2-client");
const { depsConWrangler } = await import("../lib/sitio-importar/fotos-r2");

const where = { tipo: "FOTO", r2Key: { not: null }, miniaturaUrl: null, ...(workspaceId ? { workspaceId } : {}) };
const pendientes = await prisma.fotofficeTrabajoFoto.count({ where });
console.log(`Fotos sin miniatura: ${pendientes}${workspaceId ? ` (institución ${workspaceId})` : ""}`);
if (!aplicar) {
  console.log("En seco: no se generó nada. Agregá --aplicar para generarlas.");
  process.exit(0);
}

/** La dirección pública de las keys sale de una foto ya guardada: su url = base + "/" + key. */
async function basePublica(): Promise<string> {
  const f = await prisma.fotofficeTrabajoFoto.findFirst({ where: { r2Key: { not: null }, tipo: "FOTO" }, select: { url: true, r2Key: true } });
  if (!f?.r2Key || !f.url.endsWith(`/${f.r2Key}`)) throw new Error("No se pudo deducir la dirección pública de R2");
  return f.url.slice(0, -(f.r2Key.length + 1));
}

async function depsSinCredenciales() {
  const base = await basePublica();
  const wrangler = depsConWrangler({ bucket: "fotoffice-media", basePublica: base });
  console.log(`Sin credenciales R2: bajo de ${base} y subo con wrangler.`);
  return {
    bajar: async (key: string) => {
      const res = await fetch(`${base}/${key}`, { signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`R2 respondió ${res.status} al bajar ${key}`);
      return Buffer.from(await res.arrayBuffer());
    },
    achicar: (bytes: Buffer) => achicarAMiniatura(bytes),
    subir: (bytes: Buffer, key: string) => wrangler.subir(bytes, key, "image/webp"),
    guardar: depsMiniaturaReales().guardar,
  };
}

const deps = isFotofficeR2Configured() ? depsMiniaturaReales() : await depsSinCredenciales();
let hechas = 0;
const fallidas: { id: string; error: string }[] = [];
const vistas = new Set<string>();
for (;;) {
  // Sin `skip`: las que se van haciendo dejan de cumplir el filtro. Las que fallan se excluyen.
  const tanda = await prisma.fotofficeTrabajoFoto.findMany({
    where: { ...where, id: { notIn: [...vistas] } },
    select: { id: true, r2Key: true, tipo: true },
    orderBy: { id: "asc" },
    take: 60,
  });
  if (tanda.length === 0) break;
  for (const f of tanda) vistas.add(f.id);
  const r = await generarMiniaturas(tanda, deps, 8);
  for (const f of r.fallidas) console.error(`  error ${f.id}: ${f.error}`);
  hechas += r.hechas;
  fallidas.push(...r.fallidas);
  console.log(`  ${hechas} hechas, ${fallidas.length} con error (de ${pendientes})`);
}
if (fallidas.length > 0) console.error("Con error:", fallidas);
console.log(`Listo: ${hechas} miniaturas.`);
await prisma.$disconnect();

export {};
