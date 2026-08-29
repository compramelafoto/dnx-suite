import { loadAnalysisEnv } from "./load-env-for-analysis";
loadAnalysisEnv();

async function checkToken(token: string): Promise<string> {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return "OK";
    const body: any = await res.json().catch(() => ({}));
    return `${res.status} ${body?.message ?? body?.error ?? ""}`.trim();
  } catch (e: any) {
    return `NETERR ${e?.message}`;
  }
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { mpAccessToken: { not: null } },
      select: {
        id: true,
        email: true,
        role: true,
        mpConnectedAt: true,
        mpAccessToken: true,
        mpRefreshToken: true,
        _count: { select: { albums: true } },
      },
      orderBy: { id: "asc" },
    });
    console.log(`Usuarios con mpAccessToken: ${users.length}`);
    const invalid: Array<{ id: number; connected: string; albums: number; email: string }> = [];
    let okCount = 0;
    for (const u of users) {
      const status = await checkToken(u.mpAccessToken as string);
      if (status === "OK") okCount++;
      else invalid.push({ id: u.id, connected: u.mpConnectedAt ? u.mpConnectedAt.toISOString().slice(0, 10) : "?", albums: u._count.albums, email: u.email ?? "" });
      console.log(
        [
          `user=${u.id}`,
          `role=${u.role}`,
          `albums=${u._count.albums}`,
          `connected=${u.mpConnectedAt ? u.mpConnectedAt.toISOString().slice(0, 10) : "?"}`,
          `refresh=${u.mpRefreshToken ? "SI" : "NO"}`,
          `token=${status}`,
          u.email,
        ].join(" | ")
      );
    }

    console.log(`\nRESUMEN usuarios: OK=${okCount} INVALIDOS=${invalid.length}`);
    const dates = invalid.map((i) => i.connected).sort();
    console.log("Invalidos: fecha de conexion mas antigua:", dates[0], "| mas reciente:", dates[dates.length - 1]);
    console.log("Invalidos CON albums:", invalid.filter((i) => i.albums > 0).length);
    console.log("\nTIENEN QUE RECONECTAR MERCADO PAGO (ordenado por album):");
    for (const i of [...invalid].sort((a, b) => b.albums - a.albums)) {
      console.log(`  user ${String(i.id).padStart(4)} | albums ${String(i.albums).padStart(3)} | conecto ${i.connected} | ${i.email}`);
    }

    const labs = await prisma.lab.findMany({
      where: { mpAccessToken: { not: null } },
      select: { id: true, name: true, mpConnectedAt: true, mpAccessToken: true, mpRefreshToken: true },
    });
    console.log(`\nLabs con mpAccessToken: ${labs.length}`);
    for (const l of labs) {
      const status = await checkToken(l.mpAccessToken as string);
      console.log(`lab=${l.id} | connected=${l.mpConnectedAt?.toISOString().slice(0,10) ?? "?"} | refresh=${l.mpRefreshToken ? "SI" : "NO"} | token=${status} | ${l.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
