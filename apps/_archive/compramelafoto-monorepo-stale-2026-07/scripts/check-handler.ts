/**
 * Script para ver quién tiene un publicPageHandler y opcionalmente liberarlo.
 * Uso: npx tsx scripts/check-handler.ts [handler]
 * Ejemplo: npx tsx scripts/check-handler.ts dnxestudio
 * Para liberar: npx tsx scripts/check-handler.ts dnxestudio --liberar=user|lab|ambos
 */
import { prisma } from "../lib/prisma";

const HANDLER = (process.argv[2] || "dnxestudio").trim().toLowerCase();
const liberar = process.argv.find((a) => a.startsWith("--liberar="))?.split("=")[1]; // "user" | "lab" | "ambos"

async function main() {
  console.log(`\n🔍 Buscando handler: "${HANDLER}"\n`);

  const userWithHandler = await prisma.user.findFirst({
    where: { publicPageHandler: HANDLER },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      publicPageHandler: true,
      isPublicPageEnabled: true,
    },
  });

  const labWithHandler = await prisma.lab.findFirst({
    where: { publicPageHandler: HANDLER },
    select: {
      id: true,
      name: true,
      email: true,
      publicPageHandler: true,
      isPublicPageEnabled: true,
      userId: true,
    },
  });

  if (userWithHandler) {
    console.log("👤 Usuario (fotógrafo) con este handler:");
    console.log("   ID:", userWithHandler.id, "| Email:", userWithHandler.email, "| Nombre:", userWithHandler.name, "| Rol:", userWithHandler.role);
    console.log("   Página pública habilitada:", userWithHandler.isPublicPageEnabled);
    console.log("");
  } else {
    console.log("👤 Ningún usuario (fotógrafo) tiene este handler.\n");
  }

  if (labWithHandler) {
    console.log("🏭 Laboratorio con este handler:");
    console.log("   Lab ID:", labWithHandler.id, "| Nombre:", labWithHandler.name, "| Email:", labWithHandler.email);
    console.log("   userId (dueño):", labWithHandler.userId);
    console.log("   Página pública habilitada:", labWithHandler.isPublicPageEnabled);
    console.log("");
  } else {
    console.log("🏭 Ningún laboratorio tiene este handler.\n");
  }

  if (!userWithHandler && !labWithHandler) {
    console.log("✅ El handler está libre. Podés usarlo en configuración.\n");
    return;
  }

  // Resumen de URLs
  console.log("📍 URLs asociadas:");
  if (userWithHandler?.isPublicPageEnabled) {
    console.log("   Fotógrafo: https://www.compramelafoto.com/" + HANDLER);
  }
  if (labWithHandler?.isPublicPageEnabled) {
    console.log("   Laboratorio: https://www.compramelafoto.com/l/" + HANDLER);
  }
  console.log("");

  if (liberar) {
    if (liberar === "user" && userWithHandler) {
      await prisma.user.update({
        where: { id: userWithHandler.id },
        data: { publicPageHandler: null },
      });
      console.log("✅ Handler liberado del usuario ID", userWithHandler.id);
    } else if (liberar === "lab" && labWithHandler) {
      await prisma.lab.update({
        where: { id: labWithHandler.id },
        data: { publicPageHandler: null },
      });
      console.log("✅ Handler liberado del laboratorio ID", labWithHandler.id);
    } else if (liberar === "ambos") {
      if (userWithHandler) {
        await prisma.user.update({
          where: { id: userWithHandler.id },
          data: { publicPageHandler: null },
        });
        console.log("✅ Handler liberado del usuario ID", userWithHandler.id);
      }
      if (labWithHandler) {
        await prisma.lab.update({
          where: { id: labWithHandler.id },
          data: { publicPageHandler: null },
        });
        console.log("✅ Handler liberado del laboratorio ID", labWithHandler.id);
      }
    } else {
      console.log("Uso --liberar=user | --liberar=lab | --liberar=ambos");
    }
  } else {
    console.log("Para liberar el handler ejecutá:");
    if (userWithHandler) console.log("   npx tsx scripts/check-handler.ts", HANDLER, "--liberar=user");
    if (labWithHandler) console.log("   npx tsx scripts/check-handler.ts", HANDLER, "--liberar=lab");
    if (userWithHandler && labWithHandler) console.log("   npx tsx scripts/check-handler.ts", HANDLER, "--liberar=ambos");
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
