/**
 * Importación histórica de Caja (etapa E, spec 7.6): lee el CSV normalizado del libro viejo y el
 * archivo de mapeo, arma un lote por mes y, en seco (por omisión), sólo imprime el resumen y
 * opcionalmente escribe un informe Markdown. NO abre la base en seco.
 *
 * Con `--aplicar --workspace <slug> --mes AAAA-MM` guarda ese mes como BORRADOR en
 * `FotofficeHistoricoLote`/`FotofficeHistoricoMovimiento` (re-importar reemplaza el lote; si ya
 * estaba confirmado, hace falta `--reemplazar-confirmado`). Confirmar o descartar se hace en
 * Caja → Historial importado. Nada de esto toca `CashMovement` ni los saldos.
 *
 * Variable de entorno para --aplicar: DATABASE_URL_FOTOFFICE (no se usa DATABASE_URL a propósito:
 * el cliente de @repo/db puede cargar packages/db/.env, que apunta a otra base).
 *
 * Los datos reales del cliente (CSV y mapeo) NO van en el repositorio.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { leerReferencia, opcionesDeImportacion, USO_IMPORTACION } from "../lib/historico-caja/cli";
import { leerCsvHistorico } from "../lib/historico-caja/csv";
import { armarLotes } from "../lib/historico-caja/lote";
import { validarMapeo } from "../lib/historico-caja/mapeo";
import { reporteEnSeco } from "../lib/historico-caja/reporte";
import type { FilaCsv } from "../lib/historico-caja/tipos";
import { formatMinorArs } from "../lib/membership/money";

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

async function main() {
  const r = opcionesDeImportacion(process.argv.slice(2));
  if (!r.ok) salir(`${r.error}\n\n${USO_IMPORTACION}`);
  const o = r.opciones;

  const m = validarMapeo(JSON.parse(readFileSync(o.mapeo, "utf8")));
  if (!m.ok) salir(`El mapeo tiene errores:\n- ${m.errores.join("\n- ")}`);

  const filas: FilaCsv[] = [];
  for (const ruta of o.csv) {
    const leido = leerCsvHistorico(readFileSync(ruta, "utf8"));
    for (const e of leido.errores) console.warn(`${basename(ruta)}, fila ${e.fila}: ${e.mensaje}`);
    filas.push(...leido.filas);
  }
  if (filas.length === 0) salir("No hay filas para importar.");

  const lotes = armarLotes(filas, m.mapeo, { meses: o.meses ?? undefined });
  const faltan = (o.meses ?? []).filter((mes) => !lotes.some((l) => l.mes === mes));
  if (faltan.length) salir(`El archivo no tiene movimientos de: ${faltan.join(", ")}.`);

  for (const l of lotes) {
    const x = l.resumen;
    console.log(
      `${l.mes}: ${x.filas} filas · ingresos ${formatMinorArs(x.ingresosCentavos)} · egresos del libro ${formatMinorArs(x.egresosLibroCentavos)} · estimados ${formatMinorArs(x.estimadosCentavos)} · internos ${formatMinorArs(x.porClase.MOVIMIENTO_INTERNO)} · para revisar ${x.filasRevisar}${x.avisos.length ? ` · ${x.avisos.join("; ")}` : ""}`,
    );
  }

  if (o.reporte) {
    const referencia = o.referencia ? leerReferencia(readFileSync(o.referencia, "utf8")) : undefined;
    writeFileSync(o.reporte, reporteEnSeco(lotes, { referencia, generado: hoyEnArgentina(), mesActual: o.mesActual ?? undefined }));
    console.log(`Informe: ${o.reporte}`);
  }

  if (!o.aplicar) {
    console.log("En seco: no se escribió nada. Para guardar un mes como borrador: --aplicar --workspace <slug> --mes AAAA-MM.");
    return;
  }

  const url = process.env.DATABASE_URL_FOTOFFICE?.trim();
  if (!url) salir("Falta la variable de entorno DATABASE_URL_FOTOFFICE (base de FOTOFFICE).");
  const { prisma } = await import("@repo/db");
  const { guardarLoteBorrador } = await import("../lib/historico-caja/repositorio");
  const Clase = prisma.constructor as new (opciones: { datasourceUrl: string }) => typeof prisma;
  const db = new Clase({ datasourceUrl: url });
  try {
    const branding = await db.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: o.workspace! }, select: { workspaceId: true } });
    if (!branding) salir(`No se encontró un workspace con el slug «${o.workspace}».`);
    const archivo = o.csv.map((c) => basename(c)).join(" + ");
    for (const lote of lotes) {
      const accion = await guardarLoteBorrador(db, { workspaceId: branding.workspaceId, lote, archivo, reemplazarConfirmado: o.reemplazarConfirmado });
      console.log(`${lote.mes}: ${accion.accion}${accion.accion === "rechazar" ? ` — ${accion.motivo}` : ""}`);
    }
    console.log("Listo. Revisá y confirmá cada mes en Caja → Historial importado.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("La importación falló:", error instanceof Error ? error.message : error);
  process.exit(1);
});
