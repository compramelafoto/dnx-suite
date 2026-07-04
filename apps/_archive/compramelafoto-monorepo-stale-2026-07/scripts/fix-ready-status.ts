import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.printOrder.updateMany({
    where: { status: "READY" },
    data: { status: "READY_TO_PICKUP", statusUpdatedAt: new Date() },
  });

  console.log("Pedidos actualizados:", result.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
