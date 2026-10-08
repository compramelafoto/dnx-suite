/**
 * Importa (una sola vez) el perfil de ¿Cuánto Cobro? de un fotógrafo de CompraMeLaFoto
 * al perfil de precios de un workspace de FOTOFFICE.
 *
 * Variables de entorno obligatorias:
 *   DATABASE_URL_CLF  base de CompraMeLaFoto (sólo se lee)
 *   DATABASE_URL      base de FOTOFFICE (donde se escribe con --aplicar)
 *
 * Uso (desde la raíz del repo; tsx vive en packages/db):
 *   En seco (no escribe nada):
 *     pnpm --filter @repo/db exec tsx ../../apps/fotoffice/scripts/importar-perfil-precios-clf.ts --email <correo> --workspace dnxestudio
 *   Escribiendo:
 *     pnpm --filter @repo/db exec tsx ../../apps/fotoffice/scripts/importar-perfil-precios-clf.ts --email <correo> --workspace dnxestudio --aplicar
 *   Si el workspace ya tiene perfil, agregar --pisar.
 *
 * Nunca imprime montos: sólo correo, workspace, cantidad de grupos de gastos, completo/faltan, acción y motivo.
 */
import { prisma, type PrismaClient } from "@repo/db";
import { planDeImportacion } from "../lib/precios/importar-clf";
import { resumirPerfil } from "../lib/precios/resumen";

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function valorDe(args: string[], nombre: string): string | undefined {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
}

/** `prisma` es una instancia de PrismaClient: su constructor permite abrir otra conexión a otra base. */
function abrirCliente(url: string): PrismaClient {
  const Clase = prisma.constructor as new (opciones: { datasourceUrl: string }) => PrismaClient;
  return new Clase({ datasourceUrl: url });
}

async function main() {
  const args = process.argv.slice(2);
  const email = valorDe(args, "--email")?.trim();
  const slug = valorDe(args, "--workspace")?.trim();
  const aplicar = args.includes("--aplicar");
  const pisar = args.includes("--pisar");

  if (!email || !slug) {
    salir("Faltan argumentos. Uso: --email <correo> --workspace <slug> [--aplicar] [--pisar]");
  }
  const urlClf = process.env.DATABASE_URL_CLF?.trim();
  const urlFotoffice = process.env.DATABASE_URL?.trim();
  if (!urlClf) salir("Falta la variable de entorno DATABASE_URL_CLF (base de CompraMeLaFoto).");
  if (!urlFotoffice) salir("Falta la variable de entorno DATABASE_URL (base de FOTOFFICE).");

  const clf = abrirCliente(urlClf);
  const fotoffice = abrirCliente(urlFotoffice);
  try {
    const perfilClf = await clf.cuantoCobroFinancialProfile.findFirst({
      where: { user: { email: { equals: email, mode: "insensitive" } } },
      select: { profileData: true },
    });
    if (!perfilClf) salir(`CLF no tiene un perfil de ¿Cuánto Cobro? para ${email}.`);

    const branding = await fotoffice.fotofficeWorkspaceBranding.findUnique({
      where: { publicSlug: slug },
      select: { workspaceId: true },
    });
    if (!branding) salir(`No se encontró un workspace con el slug «${slug}».`);
    const workspaceId = branding.workspaceId;

    const existente = await fotoffice.fotofficePerfilPrecios.findUnique({
      where: { workspaceId },
      select: { id: true },
    });

    const plan = planDeImportacion({
      perfilClf: perfilClf.profileData,
      existente: existente !== null,
      aplicar,
      pisar,
    });

    console.log(`Correo: ${email}`);
    console.log(`Workspace: ${slug}`);
    if (plan.perfil) {
      const resumen = resumirPerfil(plan.perfil);
      console.log(`Grupos de gastos: ${plan.perfil.personalExpenseGroups.length}`);
      console.log(`Completo: ${resumen.completo ? "sí" : "no"}${resumen.faltan.length ? ` (faltan: ${resumen.faltan.join(", ")})` : ""}`);
    }

    if (plan.accion === "escribir" && plan.perfil) {
      const datos = JSON.parse(JSON.stringify(plan.perfil));
      await fotoffice.fotofficePerfilPrecios.upsert({
        where: { workspaceId },
        create: { workspaceId, schemaVersion: 1, profileData: datos, source: "clf-import", updatedByUserId: null },
        update: { schemaVersion: 1, profileData: datos, source: "clf-import", updatedByUserId: null },
      });
    }
    console.log(`Acción: ${plan.accion}`);
    console.log(`Motivo: ${plan.motivo}`);
  } finally {
    await clf.$disconnect();
    await fotoffice.$disconnect();
  }
}

main().catch((error) => {
  console.error("La importación falló:", error instanceof Error ? error.message : error);
  process.exit(1);
});
