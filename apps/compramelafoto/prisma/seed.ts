import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // Verificar variables de entorno
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "❌ Faltan variables de entorno:\n" +
      "ADMIN_EMAIL y ADMIN_PASSWORD deben estar en .env.local\n" +
      "\nEjemplo:\n" +
      "ADMIN_EMAIL=cuart.daniel@gmail.com\n" +
      "ADMIN_PASSWORD=Daniel1608$"
    );
  }

  console.log(`📧 Creando usuario ADMIN con email: ${adminEmail}`);

  // Hashear contraseña
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Verificar si el usuario ya existe
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, name: true },
  });

  // Crear o actualizar usuario ADMIN
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      // Si ya existe, actualizar la contraseña por si cambió
      password: passwordHash,
      role: Role.ADMIN,
      // Mantener el nombre existente si lo tiene, sino poner "Admin"
      name: existingAdmin?.name || "Admin",
    },
    create: {
      email: adminEmail,
      password: passwordHash,
      role: Role.ADMIN,
      name: "Admin",
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
    },
  });

  console.log("✅ Usuario ADMIN creado/actualizado:", admin);

  // Crear configuración inicial de la app si no existe
  const appConfig = await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {}, // No actualizar si ya existe
    create: {
      id: 1,
      minDigitalPhotoPrice: 5000, // $5000 ARS
      platformCommissionPercent: 10, // 10%
    },
  });

  console.log("✅ Configuración de la app creada/verificada:", appConfig);

  console.log("\n✨ Seed completado exitosamente!");
  console.log("\n📝 Comandos útiles:");
  console.log("   - npx prisma studio (ver datos en navegador)");
  console.log("   - npx prisma migrate dev (aplicar cambios al schema)");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
