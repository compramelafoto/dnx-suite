/**
 * Saldo de apertura de las cuentas de Caja (etapa E, spec 7.5). Lee un JSON con la fecha de arranque
 * y las cuentas (saldo en pesos, o `null` si todavía no se sabe), compara con la base y muestra el
 * plan. En seco por omisión: sólo LEE la base. Con `--aplicar` crea las cuentas que faltan y registra
 * los saldos; con `--corregir`, cambia una apertura ya registrada.
 *
 * Uso:
 *   DATABASE_URL_FOTOFFICE=... pnpm --filter fotoffice caja:apertura --workspace <slug> --cuentas <apertura.json> [--aplicar] [--corregir]
 *
 * Ejemplo de apertura.json:
 *   { "fecha": "2026-10-16", "cuentas": [
 *       { "nombre": "Mercado Pago", "tipo": "DIGITAL", "saldo": 0 },
 *       { "nombre": "Caja fuerte", "tipo": "EFECTIVO", "esBoveda": true, "saldo": null },
 *       { "nombre": "Mostrador", "tipo": "EFECTIVO", "saldo": null, "tambien": ["Caja diaria"] } ] }
 */
import { readFileSync } from "node:fs";
import { prisma, type PrismaClient } from "@repo/db";
import { instanteDeApertura, leerPedidoApertura, planDeApertura } from "../lib/cash/apertura";
import { aplicarApertura, leerEstadoApertura } from "../lib/cash/apertura-aplicar";
import { formatMinorArs } from "../lib/membership/money";

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function valorDe(args: string[], nombre: string): string | undefined {
  const i = args.indexOf(nombre);
  return i < 0 ? undefined : args[i + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const slug = valorDe(args, "--workspace");
  const ruta = valorDe(args, "--cuentas");
  if (!slug || !ruta) salir("Uso: --workspace <slug> --cuentas <apertura.json> [--aplicar] [--corregir]");
  const pedido = leerPedidoApertura(JSON.parse(readFileSync(ruta, "utf8")));
  if (!pedido.ok) salir(`El archivo de cuentas tiene errores: ${pedido.error}`);
  const url = process.env.DATABASE_URL_FOTOFFICE?.trim();
  if (!url) salir("Falta la variable de entorno DATABASE_URL_FOTOFFICE (base de FOTOFFICE).");

  const Clase = prisma.constructor as new (opciones: { datasourceUrl: string }) => PrismaClient;
  const db = new Clase({ datasourceUrl: url });
  try {
    const branding = await db.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: slug }, select: { workspaceId: true } });
    if (!branding) salir(`No se encontró un workspace con el slug «${slug}».`);
    const estado = await leerEstadoApertura(db, branding.workspaceId);
    const pasos = planDeApertura(pedido.cuentas, estado.cuentas, estado.aperturas, { corregir: args.includes("--corregir") });
    for (const p of pasos) {
      if (p.tipo === "crear-cuenta") console.log(`${p.cuenta}: crear cuenta ${p.kind}${p.isVault ? " (caja fuerte)" : ""}`);
      else if (p.tipo === "registrar-saldo") console.log(`${p.cuenta}: registrar saldo de apertura ${formatMinorArs(p.centavos)}`);
      else if (p.tipo === "corregir-saldo") console.log(`${p.cuenta}: corregir apertura ${formatMinorArs(p.deCentavos)} → ${formatMinorArs(p.aCentavos)}`);
      else console.log(`${p.cuenta}: ${p.tipo} — ${p.motivo}`);
    }
    if (pasos.some((p) => p.tipo === "conflicto")) salir("Hay conflictos: no se aplicó nada.");
    if (!args.includes("--aplicar")) {
      console.log("En seco: no se escribió nada.");
      return;
    }
    await aplicarApertura(db, { workspaceId: branding.workspaceId, pasos, ocurrido: instanteDeApertura(pedido.fecha), userId: null });
    console.log("Listo.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("La apertura falló:", error instanceof Error ? error.message : error);
  process.exit(1);
});
