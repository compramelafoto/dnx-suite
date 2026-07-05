import { prisma } from "@/lib/prisma";
import {
  DNX_FOTO_BASICA_PENDING_HOLD_MS,
} from "@/lib/dnx-foto-basica-funes";

export async function countOccupiedCourseSeats(courseKey: string): Promise<number> {
  const cutoff = new Date(Date.now() - DNX_FOTO_BASICA_PENDING_HOLD_MS);
  const [approved, pendingRecent] = await Promise.all([
    prisma.dnxCourseEnrollment.count({ where: { courseKey, status: "APPROVED" } }),
    prisma.dnxCourseEnrollment.count({
      where: {
        courseKey,
        status: "PENDING_PAYMENT",
        createdAt: { gt: cutoff },
      },
    }),
  ]);
  return approved + pendingRecent;
}

export async function countApprovedForCourse(courseKey: string): Promise<number> {
  return prisma.dnxCourseEnrollment.count({
    where: { courseKey, status: "APPROVED" },
  });
}
