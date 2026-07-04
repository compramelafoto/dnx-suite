/**
 * Script de debug para verificar URLs de preview
 * 
 * Ejecutar con: npx tsx scripts/debug-preview-urls.ts <album-id>
 */

import { normalizePreviewUrl, getR2PublicUrl } from "../lib/r2-client";
import { prisma } from "../lib/prisma";

async function debugPreviewUrls(albumIdOrSlug: string) {
  console.log(`\n🔍 Debug de Preview URLs para álbum: ${albumIdOrSlug}\n`);

  // Buscar álbum
  const album = await prisma.album.findFirst({
    where: {
      OR: [
        { id: Number.parseInt(albumIdOrSlug) || -1 },
        { publicSlug: albumIdOrSlug },
      ],
    },
    include: {
      photos: {
        take: 5, // Solo las primeras 5 para no saturar
        select: {
          id: true,
          previewUrl: true,
          originalKey: true,
        },
      },
    },
  });

  if (!album) {
    console.error(`❌ Álbum no encontrado: ${albumIdOrSlug}`);
    process.exit(1);
  }

  console.log(`✅ Álbum encontrado: ${album.title} (ID: ${album.id})`);
  console.log(`📸 Total de fotos: ${album.photos.length}\n`);

  if (album.photos.length === 0) {
    console.log("⚠️  El álbum no tiene fotos");
    process.exit(0);
  }

  console.log("=".repeat(80));
  console.log("ANÁLISIS DE URLs\n");

  for (const photo of album.photos) {
    console.log(`\n📷 Foto ID: ${photo.id}`);
    console.log(`   originalKey: ${photo.originalKey}`);
    console.log(`   previewUrl (DB): ${photo.previewUrl || "(null)"}`);

    // Normalizar URL
    const normalizedUrl = normalizePreviewUrl(photo.previewUrl, photo.originalKey);
    console.log(`   previewUrl (normalizada): ${normalizedUrl || "(null)"}`);

    // Construir previewKey manualmente
    const previewKey = photo.originalKey.replace(/original_/, "preview_");
    const manualUrl = getR2PublicUrl(previewKey);
    console.log(`   URL manual desde originalKey: ${manualUrl}`);

    // Verificar formato
    if (normalizedUrl) {
      if (normalizedUrl.startsWith("http")) {
        console.log(`   ✅ Formato: URL absoluta`);
      } else {
        console.log(`   ❌ Formato: URL relativa o inválida`);
      }

      if (normalizedUrl.includes("localhost")) {
        console.log(`   ⚠️  ADVERTENCIA: Contiene localhost`);
      }

      if (normalizedUrl.includes("r2.cloudflarestorage.com")) {
        console.log(`   ✅ Dominio: Cloudflare R2`);
      }
    } else {
      console.log(`   ❌ ERROR: No se pudo normalizar la URL`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("VERIFICACIÓN DE CONFIGURACIÓN\n");

  const envVars = {
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "(no configurado)",
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL || "(no configurado)",
    R2_ENDPOINT: process.env.R2_ENDPOINT || "(no configurado)",
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || "(no configurado)",
  };

  console.log("Variables de entorno:");
  Object.entries(envVars).forEach(([key, value]) => {
    const masked = value.includes("(no") ? value : `${value.substring(0, 30)}...`;
    console.log(`   ${key}: ${masked}`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("RECOMENDACIONES\n");

  if (!envVars.R2_PUBLIC_URL && !envVars.R2_PUBLIC_BASE_URL) {
    console.log("⚠️  R2_PUBLIC_URL o R2_PUBLIC_BASE_URL no está configurado");
    console.log("   Las URLs se construirán desde R2_ENDPOINT");
    console.log("   Asegúrate de que el bucket tenga acceso público habilitado en Cloudflare R2");
  }

  console.log("\n✅ Para probar una URL, cópiala y pégala en el navegador");
  console.log("   Si ves 403 Forbidden → El bucket no tiene acceso público");
  console.log("   Si ves CORS error → Configura CORS en R2");
  console.log("   Si ves la imagen → Todo está bien configurado\n");
}

const albumIdOrSlug = process.argv[2];

if (!albumIdOrSlug) {
  console.error("❌ Uso: npx tsx scripts/debug-preview-urls.ts <album-id-o-slug>");
  process.exit(1);
}

debugPreviewUrls(albumIdOrSlug).catch(console.error);
