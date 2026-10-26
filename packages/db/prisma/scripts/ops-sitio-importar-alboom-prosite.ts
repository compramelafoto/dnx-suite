/**
 * Importa el sitio de DNX Fotografía en Alboom Prosite (`www.dnxfotografia.com.ar`) al sitio de
 * DNX Estudio en FOTOFFICE: blog (en borrador), trabajos y galerías, testimonios, páginas propias,
 * portada y menú (en el BORRADOR del sitio: nunca se publica), redirecciones y logo.
 *
 * La lógica vive en `apps/fotoffice/lib/sitio-importar/` (probada con HTML guardado); acá sólo se
 * leen los argumentos, se arma el destino y se escribe el informe.
 *
 * ── Modos ──
 *
 *   (nada)             SIMULACIÓN: lee el sitio público y transforma todo, pero NO abre la base ni
 *                      sube nada a R2 (el destino es una memoria y las fotos no se copian). Los
 *                      «nuevos» del informe son lo que se crearía.
 *   --verificar-fotos  (sólo en simulación) además pregunta a Alboom por cada foto (HEAD), para que
 *                      el informe liste las que ya no existen. Sigue sin escribir nada.
 *   --aplicar          escribe de verdad en la base de FOTOFFICE y copia las fotos a R2. Idempotente:
 *                      se puede repetir; lo que ya está no se duplica.
 *   --subir-con-wrangler  (con --aplicar) sube las fotos con `npx wrangler r2 object put … --remote`
 *                      (la sesión de Cloudflare de esta máquina) en vez de las credenciales R2_*, que
 *                      no están en .env.local. Pide la dirección pública del bucket: R2_PUBLIC_URL o
 *                      `--r2-public-base=<url>`. Bucket: `fotoffice-media` (`--r2-bucket=<nombre>`).
 *
 * Otros: `--workspace <id>` (por omisión el de DNX), `--base <url>` (por omisión el sitio de
 * Alboom de DNX), `--slug <slug>` (sólo simulación: el slug público para armar los enlaces;
 * por omisión `dnx-estudio`), `--salida <carpeta>` (por omisión `apps/fotoffice/docs/alboom`).
 *
 * ── Cómo correrlo (desde apps/fotoffice) ──
 *
 *   Simulación:
 *     pnpm sitio:importar-alboom
 *
 *   De verdad (base de FOTOFFICE y R2 de producción; el SQL de redirecciones ya aplicado):
 *     set -a && . ./.env.local && set +a
 *     DATABASE_URL_FOTOFFICE="$DATABASE_URL" pnpm sitio:importar-alboom --aplicar
 *
 *   De verdad, sin las R2_* (fotos con wrangler):
 *     DATABASE_URL_FOTOFFICE="$DATABASE_URL" pnpm sitio:importar-alboom --aplicar --subir-con-wrangler \
 *       --r2-public-base=https://<la misma dirección que R2_PUBLIC_URL de producción>
 *
 * Variable para --aplicar: DATABASE_URL_FOTOFFICE (no se usa DATABASE_URL a propósito: el cliente
 * de @repo/db puede cargar packages/db/.env, que apunta a otra base). R2: las R2_* de FOTOFFICE.
 *
 * Deja el informe en `<salida>/sitio-importacion-<fecha>[-simulacion].md` y `.json`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Opciones = {
  aplicar: boolean;
  conWrangler: boolean;
  r2PublicBase: string | null;
  r2Bucket: string;
  verificarFotos: boolean;
  workspaceId: string;
  base: string;
  slug: string;
  salida: string;
};

const WORKSPACE_DNX = "cmv5z6qxwwmmhf0q5gp8qja1j";
const BASE_DNX = "https://www.dnxfotografia.com.ar";

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function leerOpciones(argv: string[]): Opciones {
  const o: Opciones = {
    aplicar: false,
    conWrangler: false,
    r2PublicBase: null,
    r2Bucket: "fotoffice-media",
    verificarFotos: false,
    workspaceId: WORKSPACE_DNX,
    base: BASE_DNX,
    slug: "dnx-estudio",
    salida: resolve(process.cwd(), "docs/alboom"),
  };
  for (let i = 0; i < argv.length; i++) {
    // `--opcion=valor` es lo mismo que `--opcion valor`.
    const [a, pegado] = argv[i].includes("=") ? [argv[i].slice(0, argv[i].indexOf("=")), argv[i].slice(argv[i].indexOf("=") + 1)] : [argv[i], undefined];
    const valor = () => pegado ?? argv[++i] ?? salir(`Falta el valor de ${a}`);
    if (a === "--aplicar") o.aplicar = true;
    else if (a === "--verificar-fotos") o.verificarFotos = true;
    else if (a === "--subir-con-wrangler") o.conWrangler = true;
    else if (a === "--r2-public-base") o.r2PublicBase = valor();
    else if (a === "--r2-bucket") o.r2Bucket = valor();
    else if (a === "--workspace") o.workspaceId = valor();
    else if (a === "--base") o.base = valor();
    else if (a === "--slug") o.slug = valor();
    else if (a === "--salida") o.salida = resolve(process.cwd(), valor());
    else salir(`No conozco la opción ${a}. Ver el encabezado del script.`);
  }
  if (o.aplicar && o.verificarFotos) salir("--verificar-fotos es sólo para la simulación (con --aplicar las fotos se copian de verdad).");
  if (o.conWrangler && !o.aplicar) salir("--subir-con-wrangler es sólo para --aplicar (la simulación no sube nada).");
  if (!/^[a-z0-9]{8,40}$/i.test(o.workspaceId)) salir("--workspace no parece un id de workspace.");
  return o;
}

function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(dirección ilegible)";
  }
}

async function main() {
  const o = leerOpciones(process.argv.slice(2));

  if (o.aplicar) {
    const url = process.env.DATABASE_URL_FOTOFFICE?.trim();
    if (!url) salir("Falta DATABASE_URL_FOTOFFICE (la base de FOTOFFICE). Ver el encabezado del script.");
    // Antes de cargar @repo/db: el cliente toma DATABASE_URL al crearse.
    process.env.DATABASE_URL = url;
    console.log(`Base: ${hostDe(url)}`);
  } else {
    // La simulación no abre la base: si algo la pidiera por error, falla en vez de leer otra.
    process.env.DATABASE_URL = "postgresql://simulacion-sin-base@127.0.0.1:1/simulacion";
    process.env.DATABASE_URL_FOTOFFICE = "";
  }

  // Imports dinámicos: recién ahora, con DATABASE_URL ya decidida.
  const { importarSitioAlboom } = await import("../../../../apps/fotoffice/lib/sitio-importar/cargar");
  const { crearDestinoEnMemoria, estadoVacio } = await import("../../../../apps/fotoffice/lib/sitio-importar/destino");
  const { crearFuenteAlboom, USER_AGENT_IMPORTADOR } = await import("../../../../apps/fotoffice/lib/sitio-importar/fuente");
  const { informeEnMarkdown } = await import("../../../../apps/fotoffice/lib/sitio-importar/informe");
  type CopiarFoto = import("../../../../apps/fotoffice/lib/sitio-importar/cargar").CopiarFoto;
  type Destino = import("../../../../apps/fotoffice/lib/sitio-importar/destino").DestinoImportacion;

  let destino: Destino;
  let copiarFoto: CopiarFoto;

  if (o.aplicar) {
    const { prisma } = await import("@repo/db");
    const { isFotofficeR2Configured } = await import("../../../../apps/fotoffice/lib/images/r2-client");
    const basePublica = (o.r2PublicBase ?? process.env.R2_PUBLIC_URL ?? process.env.R2_PUBLIC_BASE_URL ?? "").trim();
    if (o.conWrangler) {
      if (!basePublica) {
        salir(
          "Con --subir-con-wrangler hace falta la dirección pública del bucket (la misma que R2_PUBLIC_URL de producción): " +
            "pasala con --r2-public-base=https://…  Las fotos se guardan con esa dirección; si no es la de producción, el sitio no las muestra.",
        );
      }
    } else if (!isFotofficeR2Configured()) {
      salir("Faltan las variables R2_* de FOTOFFICE. Sin ellas, usá --subir-con-wrangler --r2-public-base=https://…");
    }
    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: o.workspaceId },
      select: { publicSlug: true, commercialName: true },
    });
    if (!branding) salir(`El workspace ${o.workspaceId} no existe en esa base (o no tiene sitio).`);
    try {
      await prisma.fotofficeSitioRedireccion.count({ where: { workspaceId: o.workspaceId } });
    } catch {
      salir("Falta la tabla FotofficeSitioRedireccion: aplicá antes el SQL 20261228120000_fotoffice_sitio_redirecciones.");
    }
    console.log(`Workspace: ${branding.commercialName} (/w/${branding.publicSlug})`);
    const { crearDestinoPrisma } = await import("../../../../apps/fotoffice/lib/sitio-importar/destino-prisma");
    const { crearCopiadorDeFotos } = await import("../../../../apps/fotoffice/lib/sitio-importar/fotos-r2");
    destino = crearDestinoPrisma(o.workspaceId);
    if (o.conWrangler) {
      const { depsConWrangler } = await import("../../../../apps/fotoffice/lib/sitio-importar/fotos-r2");
      const basePublica = (o.r2PublicBase ?? process.env.R2_PUBLIC_URL ?? process.env.R2_PUBLIC_BASE_URL ?? "").trim();
      console.log(`Fotos: con wrangler al bucket ${o.r2Bucket}, dirección pública ${basePublica}`);
      copiarFoto = crearCopiadorDeFotos(depsConWrangler({ bucket: o.r2Bucket, basePublica })).copiarFoto;
    } else {
      copiarFoto = crearCopiadorDeFotos().copiarFoto;
    }
  } else {
    destino = crearDestinoEnMemoria(estadoVacio(o.slug));
    const { createHash } = await import("node:crypto");
    const vistas = new Map<string, string | null>();
    copiarFoto = async (url, prefijo) => {
      const key = `simulacion/${prefijo}${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
      if (o.verificarFotos) {
        if (!vistas.has(url)) {
          let error: string | null = null;
          try {
            const r = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT_IMPORTADOR }, signal: AbortSignal.timeout(20_000) });
            if (!r.ok) error = `respondió ${r.status}`;
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
          }
          vistas.set(url, error);
        }
        const error = vistas.get(url);
        if (error) return { error };
      }
      // La «copia» de la simulación sigue apuntando a Alboom: no se sube nada.
      return { url, key, ancho: null, alto: null, tipo: null, peso: null };
    };
  }

  console.log(o.aplicar ? "Modo: APLICAR (escribe en la base y sube a R2)" : `Modo: simulación (no escribe nada)${o.verificarFotos ? ", verificando fotos" : ""}`);
  const informe = await importarSitioAlboom(
    { workspaceId: o.workspaceId, base: o.base, aplicar: o.aplicar, slugPublico: o.slug },
    { fuente: crearFuenteAlboom(o.base), destino, copiarFoto, avisar: (m) => console.log(`· ${m}`) },
  );

  mkdirSync(o.salida, { recursive: true });
  const nombre = `sitio-importacion-${hoyEnArgentina()}${o.aplicar ? "" : "-simulacion"}`;
  writeFileSync(join(o.salida, `${nombre}.json`), `${JSON.stringify(informe, null, 2)}\n`);
  writeFileSync(join(o.salida, `${nombre}.md`), informeEnMarkdown(informe));
  console.log("");
  console.log(
    `Artículos ${informe.articulos.creados}/${informe.articulos.existentes}/${informe.articulos.fallidos} · ` +
      `Trabajos ${informe.trabajos.creados}/${informe.trabajos.existentes}/${informe.trabajos.fallidos} · ` +
      `Testimonios ${informe.testimonios.creados}/${informe.testimonios.existentes}/${informe.testimonios.fallidos} · ` +
      `Páginas ${informe.paginas.creados}/${informe.paginas.existentes}/${informe.paginas.fallidos} (nuevos/ya estaban/fallaron)`,
  );
  console.log(`Fotos: ${informe.fotos.copiadas} · fallidas: ${informe.fotos.fallidas.length} · redirecciones nuevas: ${informe.redirecciones.creadas}/${informe.redirecciones.total}`);
  console.log(`Informe: ${join(o.salida, `${nombre}.md`)}`);
  if (o.aplicar) {
    const { prisma } = await import("@repo/db");
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
