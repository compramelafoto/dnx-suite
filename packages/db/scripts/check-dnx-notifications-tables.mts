import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
async function main() {
  const tables = await p.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name LIKE 'DnxNotification%'
     ORDER BY 1`,
  );
  const cols = await p.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='InfoSpotUserRole' AND column_name LIKE 'canNotify%'`,
  );
  console.log(JSON.stringify({ tables, cols }, null, 2));
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
