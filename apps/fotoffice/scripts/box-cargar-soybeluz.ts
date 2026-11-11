/**
 * Carga (o actualiza) las 10 cajas de la BOX mensual del Club de Beluz (SOYBELUZ). Los datos
 * viven en lib/box-mensual/catalogo-soybeluz.ts.
 *
 * Variable obligatoria: DATABASE_URL_FOTOFFICE (no se usa DATABASE_URL: el cliente de @repo/db
 * puede cargar packages/db/.env, que apunta a otra base).
 *
 * Uso (desde apps/fotoffice):
 *   En seco:     DATABASE_URL_FOTOFFICE=... ../../packages/db/node_modules/.bin/tsx --import ./scripts/sin-server-only.mjs scripts/box-cargar-soybeluz.ts
 *   Escribiendo: agregar --aplicar
 *   Otro workspace: --workspace <id> (por omisión, ws_soybeluz)
 *
 * Idempotente por N° de caja (`@@unique([workspaceId, number])`): correrlo otra vez actualiza
 * nombre y materiales sin duplicar nada. No toca `isActive` de una caja que ya existe (si alguien
 * la desactivó a propósito, sigue desactivada) ni las cajas N°11 en adelante.
 */
import { prisma, type PrismaClient } from "@repo/db";
import { CATALOGO_BOX_SOYBELUZ, WORKSPACE_SOYBELUZ } from "../lib/box-mensual/catalogo-soybeluz";
import { etiquetaBox } from "../lib/box-mensual/secuencia";

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function valorDe(args: string[], nombre: string): string | undefined {
  const i = args.indexOf(nombre);
  if (i < 0) return undefined;
  const valor = args[i + 1];
  if (valor === undefined || valor.startsWith("--")) salir(`Falta el valor de ${nombre}.`);
  return valor;
}

function abrirCliente(url: string): PrismaClient {
  const Clase = prisma.constructor as new (opciones: { datasourceUrl: string }) => PrismaClient;
  return new Clase({ datasourceUrl: url });
}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--aplicar");
  const workspaceId = valorDe(args, "--workspace") ?? WORKSPACE_SOYBELUZ;
  const url = process.env.DATABASE_URL_FOTOFFICE ?? salir("Falta DATABASE_URL_FOTOFFICE.");
  const db = abrirCliente(url);

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } });
  if (!workspace) salir(`No existe el workspace ${workspaceId}.`);
  console.log(`${aplicar ? "Cargando" : "En seco (agregá --aplicar para escribir)"} — ${workspace.name} (${workspace.id})`);

  const existentes = await db.fotofficeBox.findMany({
    where: { workspaceId },
    select: { number: true, name: true },
  });
  const porNumero = new Map(existentes.map((c) => [c.number, c]));

  for (const caja of CATALOGO_BOX_SOYBELUZ) {
    const previa = porNumero.get(caja.number);
    // Los materiales se definen desde el panel con el tiempo: a un BOX que ya existe solo se le
    // corrige el nombre, para no borrar lo que se haya cargado ahí.
    const igual = previa && previa.name === caja.name;
    const accion = !previa ? "crear" : igual ? "sin cambios" : "actualizar el nombre";
    console.log(`  ${etiquetaBox(caja)} — ${accion}`);
    if (!aplicar || igual) continue;
    await db.fotofficeBox.upsert({
      where: { workspaceId_number: { workspaceId, number: caja.number } },
      create: { workspaceId, number: caja.number, name: caja.name, materials: caja.materials },
      update: { name: caja.name },
    });
  }

  console.log(aplicar ? "Listo." : "Nada se escribió.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
