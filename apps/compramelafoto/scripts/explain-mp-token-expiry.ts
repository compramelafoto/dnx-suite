/**
 * ¿Los tokens de Mercado Pago se caen por inactividad o por calendario?
 *
 * Cruza la fecha en que cada vendedor autorizó con si su token sirve hoy. Si el corte cae
 * en una fecha nítida, es un vencimiento por calendario y no tiene nada que ver con el uso.
 */
import { loadAnalysisEnv } from "./load-env-for-analysis";
loadAnalysisEnv();

const DIA_MS = 24 * 60 * 60 * 1000;

async function tokenIsValid(token: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { mpAccessToken: { not: null }, mpConnectedAt: { not: null } },
      select: { id: true, email: true, mpConnectedAt: true, mpAccessToken: true },
      orderBy: { mpConnectedAt: "asc" },
    });

    const ahora = Date.now();
    const filas: Array<{ id: number; dias: number; vivo: boolean; email: string; fecha: string }> = [];
    for (const u of users) {
      const vivo = await tokenIsValid(u.mpAccessToken as string);
      filas.push({
        id: u.id,
        dias: Math.floor((ahora - (u.mpConnectedAt as Date).getTime()) / DIA_MS),
        vivo,
        email: u.email ?? "",
        fecha: (u.mpConnectedAt as Date).toISOString().slice(0, 10),
      });
    }

    const muertos = filas.filter((f) => !f.vivo);
    const vivos = filas.filter((f) => f.vivo);

    console.log(`Vendedores con Mercado Pago conectado: ${filas.length}`);
    console.log(`  vivos: ${vivos.length} | muertos: ${muertos.length}\n`);

    const masNuevoMuerto = Math.min(...muertos.map((f) => f.dias));
    const masViejoVivo = Math.max(...vivos.map((f) => f.dias));
    console.log("ANTIGÜEDAD DE LA AUTORIZACIÓN (en días):");
    console.log(`  el token MUERTO más nuevo tiene ${masNuevoMuerto} días`);
    console.log(`  el token VIVO más viejo tiene    ${masViejoVivo} días`);

    // Si el corte es limpio, ningún vivo es más viejo que ningún muerto.
    const vivosMasViejosQueUnMuerto = vivos.filter((v) => v.dias > masNuevoMuerto);
    const muertosMasNuevosQueUnVivo = muertos.filter((m) => m.dias < masViejoVivo);

    console.log("\nCORTE POR CALENDARIO:");
    if (vivosMasViejosQueUnMuerto.length === 0) {
      console.log("  limpio: no hay ningún token vivo más viejo que el muerto más nuevo");
    } else {
      console.log(`  NO es limpio: ${vivosMasViejosQueUnMuerto.length} vivos son más viejos que un muerto`);
      for (const v of vivosMasViejosQueUnMuerto.slice(0, 10)) {
        console.log(`    vivo con ${v.dias} días (${v.fecha}) ${v.email}`);
      }
    }

    console.log("\nEXCEPCIONES (murieron antes de tiempo, no es vencimiento):");
    if (muertosMasNuevosQueUnVivo.length === 0) {
      console.log("  ninguna");
    }
    for (const m of muertosMasNuevosQueUnVivo.sort((a, b) => a.dias - b.dias)) {
      console.log(`  ${String(m.dias).padStart(3)} días (${m.fecha}) user ${m.id} ${m.email}`);
    }

    console.log("\nMUERTOS POR RANGO DE ANTIGÜEDAD:");
    const rangos = [150, 160, 170, 175, 180, 185, 190, 200, 250, 9999];
    let desde = 0;
    for (const hasta of rangos) {
      const enRango = filas.filter((f) => f.dias >= desde && f.dias < hasta);
      if (enRango.length) {
        const m = enRango.filter((f) => !f.vivo).length;
        console.log(`  ${String(desde).padStart(4)}-${String(hasta).padEnd(4)} días: ${enRango.length} vendedores, ${m} muertos`);
      }
      desde = hasta;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
