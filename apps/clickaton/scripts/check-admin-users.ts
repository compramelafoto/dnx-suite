import { prisma } from "@repo/db";

const emails = [
  "dnxfotografia@gmail.com",
  "rodrigorincon40@gmail.com",
  "tammyytamer@gmail.com",
];

for (const email of emails) {
  const u = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      role: true,
      isBlocked: true,
      password: true,
      emailVerifiedAt: true,
      googleId: true,
    },
  });
  if (!u) {
    console.log(JSON.stringify({ email, status: "NOT_FOUND" }));
  } else {
    console.log(
      JSON.stringify({
        email: u.email,
        status: "FOUND",
        role: u.role,
        isBlocked: u.isBlocked,
        hasPassword: Boolean(u.password),
        emailVerifiedAt: u.emailVerifiedAt,
        hasGoogle: Boolean(u.googleId),
      }),
    );
  }
}

await prisma.$disconnect();
