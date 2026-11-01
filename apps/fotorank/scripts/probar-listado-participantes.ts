/**
 * Arma el Excel de participantes de un concurso como lo pediría un miembro de
 * la organización, sin pasar por la pantalla. Sólo lee; muestra el resumen y
 * los encabezados, no los datos de las personas.
 *
 * Uso: DATABASE_URL=... tsx scripts/probar-listado-participantes.ts <contestId> <userId> [archivo.xlsx]
 */
import { writeFileSync } from "node:fs";

import { prisma } from "@repo/db";

import { participantesParaElListado } from "../app/lib/fotorank/entries/entry-service";
import { filasDelListado, libroDelListado } from "../app/lib/fotorank/entries/listadoDeParticipantes";

async function main() {
  const [contestId, userId, salida] = process.argv.slice(2);
  if (!contestId || !userId) throw new Error("Uso: tsx scripts/probar-listado-participantes.ts <contestId> <userId>");

  const datos = await participantesParaElListado({ contestId, organizerUserId: Number(userId) });
  const filas = filasDelListado(datos.inscripciones, datos.categorias);
  const archivo = libroDelListado(filas, datos.titulo);

  console.log(`${datos.titulo}: ${filas.length} participantes, ${archivo.length} bytes`);
  console.log(`columnas: ${Object.keys(filas[0] ?? {}).join(" | ")}`);
  const suma = (col: string) => filas.reduce((n, f) => n + Number(f[col] ?? 0), 0);
  for (const c of datos.categorias) console.log(`  obras en ${c}: ${suma(`Obras en ${c}`)}`);
  console.log(`  en concurso: ${suma("Obras en concurso")} · rechazadas: ${suma("Obras rechazadas")}`);
  console.log(`  sin teléfono ni WhatsApp: ${filas.filter((f) => !f["Teléfono"] && !f["WhatsApp"]).length}`);
  if (salida) writeFileSync(salida, archivo);
}

main()
  .catch((error) => {
    console.error("FALLÓ:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
