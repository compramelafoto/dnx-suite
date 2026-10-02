/**
 * Migra los portfolios de la web vieja de SFPR (sfpr.com.ar, alojada en Alboom) al módulo de
 * portfolios de FOTOFFICE.
 *
 * ── Estado al 02/10/2026 ──
 *
 * **Ya corrió en producción**: los siete portfolios están publicados con 116 fotos y sus
 * presentaciones. Pero corrió con `--fotos-externas`, así que **las fotos todavía viven en
 * Alboom**: las variables R2 están marcadas como sensibles en Vercel y no se pueden volver a leer,
 * así que no había credenciales a mano.
 *
 * Queda pendiente correr `--realojar` con las credenciales de Cloudflare para traerlas a nuestro
 * bucket. Hasta entonces, el día que SFPR deje esa cuenta de Alboom, las 116 fotos se caen.
 *
 * ── Los cuatro modos ──
 *
 *   (nada)             simula la migración completa y no escribe nada
 *   --apply            migra de verdad, bajando y subiendo cada foto a nuestro R2
 *   --apply --fotos-externas   migra guardando las direcciones de Alboom; no necesita R2
 *   --realojar         trae a nuestro bucket las fotos que quedaron apuntando afuera
 *   --arreglar-bios    rehace sólo las presentaciones, sin tocar las fotos
 *
 * ── Cómo correrlo ──
 *
 *   cd packages/db
 *   set -a && . ../../apps/fotoffice/.env.local && set +a
 *   pnpm exec tsx prisma/scripts/ops-portfolio-migrar-sfpr-web-vieja.ts --realojar
 *
 * Es idempotente: un socio que ya tiene portfolio se saltea, así que se puede repetir sin duplicar.
 */
import { prisma } from "@repo/db";
import { readImageDimensionsFromBytes } from "../../../../apps/fotoffice/lib/images/dimensions";
import { sniffImageFormat } from "../../../../apps/fotoffice/lib/images/validation";
import {
  generateFotofficeR2Key,
  getFotofficeR2PublicUrl,
  isFotofficeR2Configured,
  uploadToFotofficeR2,
} from "../../../../apps/fotoffice/lib/images/r2-client";
import { FOTOFFICE_R2_PREFIXES } from "../../../../apps/fotoffice/lib/images/r2-key-policy";
import { slugify } from "../../../../apps/fotoffice/lib/slug";

const WORKSPACE = "ws_sfpr_seed";
const BASE = "https://sfpr.com.ar/portfolio/fotografos-pofesionales/";
const TOPE_FOTOS = 20;
/** Mínimo del preset `memberPortfolioPhoto`, sobre el lado más largo. */
const MINIMO_LADO_MAYOR = 1000;
/** Marca de una foto que todavía vive en el proveedor viejo. La busca `--realojar`. */
const MARCA_EXTERNA = "externo:";

/**
 * El mapeo ficha vieja → número de socio, verificado a mano contra el padrón.
 *
 * Por número y no por nombre: los nombres de la web no coinciden exactos con los del padrón
 * ("Leo Gasparini" es "Leonel Jesús Gasparini", "Melisa Valeria" es "Melisa"), y una coincidencia
 * aproximada podría vincular la obra de alguien a la ficha de otro.
 *
 * Arturo Marinho queda afuera: no está en el padrón de SFPR.
 * Daniel Cuart queda afuera: ya había cargado su portfolio a mano.
 */
const FICHAS: { slug: string; memberNumber: string; nombreWeb: string }[] = [
  { slug: "1583301-melisa-valeria-chiappero-fotografa-de-xv", memberNumber: "661", nombreWeb: "Melisa Valeria Chiappero" },
  { slug: "1575699-claudia-begala", memberNumber: "651", nombreWeb: "Claudia Begala" },
  { slug: "1573471-marcelo-oehlenschlager-fotolager", memberNumber: "462", nombreWeb: "Marcelo Oehlenschlager" },
  { slug: "1573093-javier-gerez", memberNumber: "580", nombreWeb: "Javier Gerez" },
  { slug: "1572863-sin-titulo", memberNumber: "598", nombreWeb: "Leo Gasparini" },
  { slug: "1572666-sin-titulo", memberNumber: "614", nombreWeb: "Matías Terré" },
  { slug: "1572664-gustavo-abbate-abbate-fotografia", memberNumber: "537", nombreWeb: "Gustavo Abbate" },
];

const aplicar = process.argv.includes("--apply");
const fotosExternas = process.argv.includes("--fotos-externas");
const realojar = process.argv.includes("--realojar");
const arreglarBios = process.argv.includes("--arreglar-bios");

function log(...partes: unknown[]) {
  console.log(...partes);
}

async function bajar(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (FOTOFFICE migracion)" } });
  if (!r.ok) throw new Error(`${r.status} al bajar ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Las fotos del álbum y el texto de presentación, sacados del HTML de la ficha vieja. */
async function leerFichaVieja(slug: string): Promise<{ fotos: string[]; bio: string }> {
  const r = await fetch(BASE + slug, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`${r.status} al leer la ficha ${slug}`);
  const html = await r.text();

  const crudas = html.match(/storage\.alboom\.ninja\/sites\/47869\/albuns\/\d+\/[^"'\s?)]+/g) ?? [];
  const fotos = [...new Set(crudas)].map((u) => `https://${u}`);

  const parrafos = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 120);

  /*
   * El primer párrafo arrastra el encabezado de la página: rubro, ciudad, fecha y el título de la
   * ficha, todo pegado antes del texto real. La primera corrida lo guardó así y se vio recién en la
   * ficha publicada: "Fotógrafos Pofesionales Rosario, Santa Fe, Argentina 07/Octubre/2025 Claudia
   * Begala Claudia Begala es una fotógrafa...".
   *
   * La fecha es el ancla confiable —todo lo anterior es encabezado— y lo que sigue es el título,
   * que se reconoce comparándolo con el `<title>` de la página.
   */
  const titulo = (html.match(/<title>\s*Fot[^<-]*-\s*([^<]*?)\s*-\s*[^<]*<\/title>/i)?.[1] ?? "").trim();

  let bio = parrafos.join("\n\n");
  bio = bio.replace(/^Fot[\s\S]*?\d{1,2}\/[A-Za-zñÑáéíóúÁÉÍÓÚ]+\/\d{4}\s*/, "");
  if (titulo && bio.startsWith(titulo)) bio = bio.slice(titulo.length).trim();

  return { fotos, bio: bio.trim() };
}

/**
 * Trae a nuestro bucket las fotos que quedaron apuntando a Alboom.
 *
 * **En producción esto se hace desde el panel, no desde acá.** Subir exige las claves de escritura
 * de R2, y en Vercel están marcadas como sensibles: no se pueden volver a leer. La app desplegada
 * sí las tiene, así que el realojado vive en `apps/fotoffice/lib/portfolio/localize-photos.ts` y se
 * dispara con un botón en `/admin/workspaces/{id}`. Este modo queda para una máquina que tenga las
 * claves a mano.
 *
 * Se puede correr cuantas veces haga falta: busca sólo las marcadas con `externo:`, y cada una que
 * logra traer deja de estarlo. Una que falle queda marcada y se reintenta la próxima vez.
 */
async function realojarFotosExternas() {
  const pendientes = await prisma.fotofficeMemberPortfolioPhoto.findMany({
    where: { r2Key: { startsWith: MARCA_EXTERNA }, portfolio: { workspaceId: WORKSPACE } },
    select: { id: true, r2Key: true },
    orderBy: { createdAt: "asc" },
  });

  log(`=== REALOJANDO ${pendientes.length} fotos que todavía viven en Alboom ===`);
  let traidas = 0;

  for (const foto of pendientes) {
    const origen = foto.r2Key.slice(MARCA_EXTERNA.length);
    try {
      const bytes = await bajar(origen);
      const formato = sniffImageFormat(bytes);
      if (!formato) {
        log(`   ✗ ${origen.slice(-40)}: no es una imagen válida`);
        continue;
      }

      const nombre = decodeURIComponent(origen.split("/").pop() ?? "foto.jpg");
      const key = generateFotofficeR2Key(nombre, `${FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto}/${WORKSPACE}`);
      await uploadToFotofficeR2(Buffer.from(bytes), key, formato, { origen: "realojado-sfpr" });

      await prisma.fotofficeMemberPortfolioPhoto.update({
        where: { id: foto.id },
        data: { r2Key: key, url: getFotofficeR2PublicUrl(key), sizeBytes: bytes.byteLength },
      });
      traidas += 1;
    } catch (e) {
      log(`   ✗ ${origen.slice(-40)}: ${e instanceof Error ? e.message : e}`);
    }
  }

  log(`=== ${traidas} de ${pendientes.length} traídas a nuestro bucket ===`);
}

/** Rehace sólo las presentaciones, por si la extracción mejoró. No toca las fotos. */
async function rehacerPresentaciones() {
  for (const ficha of FICHAS) {
    const socio = await prisma.member.findFirst({
      where: { workspaceId: WORKSPACE, memberNumber: ficha.memberNumber },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!socio) continue;

    const { bio } = await leerFichaVieja(ficha.slug);
    if (!bio) {
      log(`✗ ${socio.firstName} ${socio.lastName}: sin texto`);
      continue;
    }
    log(`${aplicar ? "✓" : "→"} ${socio.firstName} ${socio.lastName}: "${bio.slice(0, 70)}…"`);
    if (aplicar) await prisma.member.update({ where: { id: socio.id }, data: { bio } });
  }
}

async function main() {
  // Sólo los modos que de verdad suben archivos necesitan credenciales.
  const vaASubir = (aplicar && !fotosExternas && !arreglarBios) || realojar;
  if (vaASubir && !isFotofficeR2Configured()) {
    throw new Error(
      "R2 no está configurado. Cargá las variables R2_* en apps/fotoffice/.env.local y volvé a correr.",
    );
  }

  if (realojar) return realojarFotosExternas();
  if (arreglarBios) return rehacerPresentaciones();

  log(aplicar ? "=== APLICANDO ===" : "=== SIMULACIÓN (sin escribir nada) ===");
  if (fotosExternas) {
    log("   (las fotos quedan alojadas en Alboom; después hay que correr --realojar)");
  }

  const tomados = await prisma.fotofficeMemberPortfolio.findMany({
    where: { workspaceId: WORKSPACE },
    select: { publicSlug: true },
  });
  const slugsTomados = new Set(tomados.map((t) => t.publicSlug));

  for (const ficha of FICHAS) {
    const socio = await prisma.member.findFirst({
      where: { workspaceId: WORKSPACE, memberNumber: ficha.memberNumber },
      select: { id: true, firstName: true, lastName: true, bio: true, portfolio: { select: { id: true } } },
    });

    if (!socio) {
      log(`✗ ${ficha.nombreWeb}: no hay socio N° ${ficha.memberNumber}. Se saltea.`);
      continue;
    }
    if (socio.portfolio) {
      log(`· ${socio.firstName} ${socio.lastName}: ya tiene portfolio. Se saltea.`);
      continue;
    }

    const { fotos, bio } = await leerFichaVieja(ficha.slug);
    const aMigrar = fotos.slice(0, TOPE_FOTOS);
    log(
      `→ ${socio.firstName} ${socio.lastName} (N° ${ficha.memberNumber}): ${fotos.length} fotos en la web, migro ${aMigrar.length}` +
        (bio && !socio.bio ? `, y la presentación (${bio.length} caracteres)` : ""),
    );

    if (!aplicar) continue;

    const publicSlug = (() => {
      const base = slugify(`${socio.firstName} ${socio.lastName}`) || "socio";
      if (!slugsTomados.has(base)) return base;
      let n = 2;
      while (slugsTomados.has(`${base}-${n}`)) n += 1;
      return `${base}-${n}`;
    })();
    slugsTomados.add(publicSlug);

    const portfolio = await prisma.fotofficeMemberPortfolio.create({
      data: { workspaceId: WORKSPACE, memberId: socio.id, publicSlug },
      select: { id: true },
    });

    let orden = 0;
    let primeraFoto: string | null = null;

    for (const url of aMigrar) {
      try {
        const bytes = await bajar(url);

        const formato = sniffImageFormat(bytes);
        if (!formato) {
          log(`   ✗ ${url.slice(-40)}: no es una imagen válida`);
          continue;
        }
        const medidas = readImageDimensionsFromBytes(bytes);
        if (!medidas) {
          log(`   ✗ ${url.slice(-40)}: no pude leer sus medidas`);
          continue;
        }
        if (Math.max(medidas.width, medidas.height) < MINIMO_LADO_MAYOR) {
          log(`   · ${url.slice(-40)}: ${medidas.width}×${medidas.height}, por debajo del mínimo. Se saltea.`);
          continue;
        }

        let key: string;
        let publica: string;
        if (fotosExternas) {
          // La foto sigue en Alboom. La marca deja el rastro para `--realojar`.
          key = `${MARCA_EXTERNA}${url}`;
          publica = url;
        } else {
          const nombre = decodeURIComponent(url.split("/").pop() ?? "foto.jpg");
          key = generateFotofficeR2Key(nombre, `${FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto}/${WORKSPACE}`);
          await uploadToFotofficeR2(Buffer.from(bytes), key, formato, { origen: "migracion-sfpr" });
          publica = getFotofficeR2PublicUrl(key);
        }

        const creada = await prisma.fotofficeMemberPortfolioPhoto.create({
          data: {
            portfolioId: portfolio.id,
            r2Key: key,
            url: publica,
            contentType: formato,
            sizeBytes: bytes.byteLength,
            width: medidas.width,
            height: medidas.height,
            order: orden,
          },
          select: { id: true },
        });
        if (orden === 0) primeraFoto = creada.id;
        orden += 1;
      } catch (e) {
        log(`   ✗ ${url.slice(-40)}: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (orden === 0) {
      // Sin una sola foto el portfolio no sirve y además no cumple la condición de visibilidad.
      await prisma.fotofficeMemberPortfolio.delete({ where: { id: portfolio.id } });
      log(`   ✗ no se migró ninguna foto. Portfolio descartado.`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.fotofficeMemberPortfolio.update({
        where: { id: portfolio.id },
        data: { coverPhotoId: primeraFoto, memberPublished: true, memberPublishedAt: new Date() },
      });

      await tx.member.update({
        where: { id: socio.id },
        data: {
          /*
           * La autorización para publicarse.
           *
           * `directoryOptIn` arranca en false a propósito, porque publicar los datos de alguien
           * requiere que lo haya pedido. Acá se da por dada **porque su obra ya estaba pública en
           * sfpr.com.ar**, publicada por la Sociedad con su conformidad: esto migra una publicación
           * que ya existía, no crea una nueva. Decisión del usuario, 02/10/2026.
           */
          directoryOptIn: true,
          // La presentación sólo si no tenía una propia: lo que escribió el socio manda.
          ...(bio && !socio.bio ? { bio } : {}),
        },
      });

      await tx.memberAudit.create({
        data: {
          workspaceId: WORKSPACE,
          memberId: socio.id,
          action: "UPDATED",
          // SYSTEM: lo hizo un script, sin una persona apretando un botón por cada socio.
          source: "SYSTEM",
          actorLabel: "Migración de la web vieja (sfpr.com.ar)",
          reason:
            `Portfolio migrado de ${BASE}${ficha.slug} con ${orden} fotos. ` +
            "Se marcó la autorización para publicarse porque su obra ya estaba pública en el sitio " +
            "anterior de la Sociedad; esto migra una publicación existente, no crea una nueva.",
        },
      });
    });

    log(`   ✓ ${orden} fotos migradas, portfolio publicado en /socios/${publicSlug}`);
  }

  log(aplicar ? "=== LISTO ===" : "=== Fin de la simulación. Para aplicar: --apply ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
