import { PrismaClient, Role, LabApprovalStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de datos de prueba...");

  // Hashear contraseñas por defecto para todos los usuarios de prueba
  const defaultPassword = "123456";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Crear usuario ADMIN si no existe
  const adminEmail = process.env.ADMIN_EMAIL || "admin@compramelafoto.com";
  const adminPassword = process.env.ADMIN_PASSWORD || defaultPassword;
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPasswordHash,
      role: Role.ADMIN,
      name: "Admin",
    },
    create: {
      email: adminEmail,
      password: adminPasswordHash,
      role: Role.ADMIN,
      name: "Admin",
    },
  });

  console.log("✅ Usuario ADMIN:", admin.email);

  // 2. Crear laboratorio de prueba (APROBADO)
  const labUser = await prisma.user.upsert({
    where: { email: "lab@compramelafoto.com" },
    update: {
      password: passwordHash,
      role: Role.LAB,
      name: "Laboratorio de Prueba",
    },
    create: {
      email: "lab@compramelafoto.com",
      password: passwordHash,
      role: Role.LAB,
      name: "Laboratorio de Prueba",
    },
  });

  const lab = await prisma.lab.upsert({
    where: { userId: labUser.id },
    update: {
      name: "Laboratorio de Prueba",
      email: "lab@compramelafoto.com",
      phone: "+54 11 1234-5678",
      address: "Av. Ejemplo 123",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      approvalStatus: LabApprovalStatus.APPROVED, // IMPORTANTE: APROBADO
      isActive: true,
    },
    create: {
      name: "Laboratorio de Prueba",
      email: "lab@compramelafoto.com",
      phone: "+54 11 1234-5678",
      address: "Av. Ejemplo 123",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      userId: labUser.id,
      approvalStatus: LabApprovalStatus.APPROVED, // IMPORTANTE: APROBADO
      isActive: true,
    },
  });

  console.log("✅ Laboratorio de prueba (APROBADO):", lab.email, "| Lab ID:", lab.id);

  // 3. Crear fotógrafo de prueba
  const photographer = await prisma.user.upsert({
    where: { email: "fotografo@compramelafoto.com" },
    update: {
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: "Juan Fotógrafo",
      phone: "+54 11 9876-5432",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      preferredLabId: lab.id,
    },
    create: {
      email: "fotografo@compramelafoto.com",
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: "Juan Fotógrafo",
      phone: "+54 11 9876-5432",
      city: "Buenos Aires",
      province: "CABA",
      country: "Argentina",
      preferredLabId: lab.id,
    },
  });

  console.log("✅ Fotógrafo de prueba:", photographer.email);

  // 4. Crear cliente de prueba
  const customer = await prisma.user.upsert({
    where: { email: "cliente@compramelafoto.com" },
    update: {
      password: passwordHash,
      role: Role.CUSTOMER,
      name: "María Cliente",
      phone: "+54 11 5555-1234",
    },
    create: {
      email: "cliente@compramelafoto.com",
      password: passwordHash,
      role: Role.CUSTOMER,
      name: "María Cliente",
      phone: "+54 11 5555-1234",
    },
  });

  console.log("✅ Cliente de prueba:", customer.email);

  // 5. Crear configuración de la app si no existe
  const appConfig = await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      minDigitalPhotoPrice: 5000, // $5000 ARS
      platformCommissionPercent: 10, // 10%
    },
  });

  console.log("✅ Configuración de la app creada/verificada");

  console.log("\n✨ Seed de datos de prueba completado!");
  console.log("\n📋 Usuarios de prueba creados:");
  console.log("   ADMIN:");
  console.log(`   - Email: ${adminEmail}`);
  console.log(`   - Password: ${adminPassword}`);
  console.log("\n   LABORATORIO (APROBADO):");
  console.log("   - Email: lab@compramelafoto.com");
  console.log("   - Password: 123456");
  console.log("\n   FOTÓGRAFO:");
  console.log("   - Email: fotografo@compramelafoto.com");
  console.log("   - Password: 123456");
  console.log("\n   CLIENTE:");
  console.log("   - Email: cliente@compramelafoto.com");
  console.log("   - Password: 123456");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
