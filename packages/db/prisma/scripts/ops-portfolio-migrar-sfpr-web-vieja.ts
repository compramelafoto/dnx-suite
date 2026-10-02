/**
 * Migra los portfolios de la web vieja de SFPR (sfpr.com.ar, alojada en Alboom) al módulo de
 * portfolios de FOTOFFICE.
 *
 * ── Qué hace por cada socio ──
 *
 * 1. Lee su ficha vieja y saca las fotos y el texto de presentación.
 * 2. **Baja cada foto y la sube a nuestro R2.** No se guardan las direcciones de Alboom: el día que
 *    SFPR deje esa cuenta, las fotos se caerían de la web.
 * 3. Crea el portfolio, las fotos en orden, y marca la primera como destacada.
 * 4. Deja el portfolio **publicado** y marca la autorización para publicarse.
 * 5. Escribe la auditoría de ese socio diciendo de dónde salió todo.
 *
 * ── Sobre la autorización ──
 *
 * `directoryOptIn` arranca en false a propósito, porque publicar los datos de alguien requiere que
 * lo haya pedido. Acá se da por dada **porque su obra ya estaba pública en sfpr.com.ar**, publicada
 * por la Sociedad con su conformidad: esto migra una publicación que ya existía, no crea una nueva.
 * Decisión del usuario, tomada el 02/10/2026, y queda escrita en la auditoría de cada socio.
 *
 * ── Cómo correrlo ──
 *
 *   cd packages/db
 *   set -a && . ../../apps/fotoffice/.env.local && set +a
 *   pnpm exec tsx prisma/scripts/ops-portfolio-migrar-sfpr-web-vieja.ts --dry-run
 *   pnpm exec tsx prisma/scripts/ops-portfolio-migrar-sfpr-web-vieja.ts --apply
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

/**
 * El mapeo ficha vieja → número de socio, verificado a mano contra el padrón.
 *
 * Por número y no por nombre: los nombres de la web no coinciden exactos con los del padrón
 * ("Leo Gasparini" es "Leonel Jesús Gasparini", "Melisa Valeria" es "Melisa"), y una coincidencia
 * aproximada podría vincular la obra de alguien a la ficha de otro.
 *
 * Arturo Marinho queda afuera: no está en el padrón de SFPR.
 * Daniel Cuart queda afuera: ya cargó su portfolio a mano.
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

  return { fotos, bio: parrafos.join("\n\n") };
}

async function main() {
  // La simulación no sube nada, así que no necesita credenciales: sirve para ver el plan antes.
  if (aplicar && !isFotofficeR2Configured()) {
    throw new Error(
      "R2 no está configurado. Cargá las variables R2_* en apps/fotoffice/.env.local y volvé a correr.",
    );
  }

  log(aplicar ? "=== APLICANDO ===" : "=== SIMULACIÓN (sin escribir nada) ===");

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

        const nombre = decodeURIComponent(url.split("/").pop() ?? "foto.jpg");
        const key = generateFotofficeR2Key(nombre, `${FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto}/${WORKSPACE}`);
        await uploadToFotofficeR2(Buffer.from(bytes), key, formato, { origen: "migracion-sfpr" });

        const creada = await prisma.fotofficeMemberPortfolioPhoto.create({
          data: {
            portfolioId: portfolio.id,
            r2Key: key,
            url: getFotofficeR2PublicUrl(key),
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
        data: {
          coverPhotoId: primeraFoto,
          memberPublished: true,
          memberPublishedAt: new Date(),
        },
      });

      await tx.member.update({
        where: { id: socio.id },
        data: {
          // La autorización: su obra ya estaba pública en la web de la Sociedad.
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
