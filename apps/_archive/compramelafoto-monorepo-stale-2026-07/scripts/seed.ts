import { prisma } from "../lib/prisma";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "daniel@demo.com" },
    update: { name: "Daniel", role: "ADMIN" },
    create: { email: "daniel@demo.com", name: "Daniel", role: "ADMIN" },
  });

  const album = await prisma.album.upsert({
    where: { publicSlug: "caminito-prueba" },
    update: { title: "Caminito - Prueba", userId: user.id },
    create: {
      title: "Caminito - Prueba",
      publicSlug: "caminito-prueba",
      userId: user.id,
    },
  });

  console.log("✅ Seed completado");
  console.log({ userId: user.id, albumId: album.id, slug: album.publicSlug });
}

main().catch((e) => {
  console.error("❌ Error en seed", e);
  process.exit(1);
});
