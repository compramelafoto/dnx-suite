import { prisma } from "@repo/db";

export async function getApprovedEnrollmentCountsByInstanceIds(instanceIds: string[]) {
  if (instanceIds.length === 0) return new Map<string, number>();
  const rows = await prisma.courseEnrollment.groupBy({
    by: ["courseInstanceId"],
    where: {
      courseInstanceId: { in: instanceIds },
      paymentStatus: "APPROVED",
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.courseInstanceId, row._count._all]));
}

export function computeAvailableSpots(capacity: number, approvedCount: number) {
  return Math.max(capacity - approvedCount, 0);
}
