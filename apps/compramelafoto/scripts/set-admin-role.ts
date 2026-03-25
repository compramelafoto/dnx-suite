import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

async function setAdminRole() {
  try {
    const email = "cuart.daniel@gmail.com";
    
    // Buscar el usuario
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      console.error(`❌ Usuario con email ${email} no encontrado`);
      return;
    }

    console.log(`📋 Usuario encontrado:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nombre: ${user.name || "N/A"}`);
    console.log(`   Rol actual: ${user.role}`);

    if (user.role === Role.ADMIN) {
      console.log(`✅ El usuario ya tiene rol ADMIN`);
      return;
    }

    // Actualizar el rol a ADMIN
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
      select: { id: true, email: true, name: true, role: true },
    });

    console.log(`\n✅ Rol actualizado exitosamente:`);
    console.log(`   Rol nuevo: ${updated.role}`);
    console.log(`\n⚠️  IMPORTANTE: Necesitás cerrar sesión y volver a iniciar sesión para que los cambios surtan efecto.`);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

setAdminRole();
