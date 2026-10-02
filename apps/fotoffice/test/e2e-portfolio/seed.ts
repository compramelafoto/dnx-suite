/**
 * Datos de prueba para recorrer el portfolio de punta a punta.
 *
 * Carga una institución con cinco personas, cada una en un estado distinto, para poder ver las
 * siete condiciones de la regla de visibilidad en una sola pantalla.
 *
 * Corre SOLO contra la base descartable local. No toca ninguna base real.
 */
import { prisma } from "@repo/db";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("fotoffice_portfolio_e2e")) {
    throw new Error(`Esta carga sólo corre contra la base de prueba. DATABASE_URL = ${url}`);
  }

  // Limpia primero, así la carga se puede repetir sin recrear la base a mano.
  await prisma.$executeRawUnsafe('TRUNCATE "User", "Workspace" CASCADE');

  // ── La institución ──────────────────────────────────────────────────────────
  const dueño = await prisma.user.create({
    data: {
      email: "secretaria@prueba.test",
      name: "Secretaría de Prueba",
      role: "PHOTOGRAPHER",
    },
  });

  const workspace = await prisma.workspace.create({
    data: { name: "Sociedad Fotográfica de Prueba" },
  });

  await prisma.workspaceMembership.create({
    data: { workspaceId: workspace.id, userId: dueño.id, role: "WORKSPACE_OWNER" },
  });

  await prisma.fotofficeWorkspaceBranding.create({
    data: {
      workspaceId: workspace.id,
      commercialName: "Sociedad Fotográfica de Prueba",
      publicSlug: "prueba",
      contactEmail: "secretaria@prueba.test",
      city: "Santa Fe",
      province: "Santa Fe",
    },
  });

  for (const moduleKey of ["members", "membership-dues", "portfolio", "website"]) {
    await prisma.workspaceFeatureModule.create({
      data: { workspaceId: workspace.id, moduleKey, enabled: true },
    });
  }

  // ── Las personas ────────────────────────────────────────────────────────────
  type Caso = {
    numero: string;
    nombre: string;
    apellido: string;
    optIn: boolean;
    publicado: boolean;
    fotos: number;
    estado: "ACTIVE" | "SUSPENDED" | "INACTIVE";
    cuotasVencidas: number;
    perdonado?: boolean;
    conSesion?: boolean;
  };

  const casos: Caso[] = [
    // El protagonista: entra con su cuenta y arma su portfolio desde el portal.
    {
      numero: "100",
      nombre: "Juan",
      apellido: "Pérez",
      optIn: true,
      publicado: true,
      fotos: 3,
      estado: "ACTIVE",
      cuotasVencidas: 0,
      conSesion: true,
    },
    // Tiene todo pero no dio el consentimiento: no se ve.
    {
      numero: "101",
      nombre: "Ana",
      apellido: "Álvarez",
      optIn: false,
      publicado: true,
      fotos: 2,
      estado: "ACTIVE",
      cuotasVencidas: 0,
    },
    // Debe 4 cuotas: no se ve.
    {
      numero: "102",
      nombre: "Carlos",
      apellido: "Benítez",
      optIn: true,
      publicado: true,
      fotos: 2,
      estado: "ACTIVE",
      cuotasVencidas: 4,
    },
    // Debe 4 cuotas pero la institución lo publicó igual: sí se ve.
    {
      numero: "103",
      nombre: "Diana",
      apellido: "Córdoba",
      optIn: true,
      publicado: true,
      fotos: 2,
      estado: "ACTIVE",
      cuotasVencidas: 4,
      perdonado: true,
    },
    // Suspendida: no se ve, aunque tenga todo en orden.
    {
      numero: "104",
      nombre: "Elena",
      apellido: "Duarte",
      optIn: true,
      publicado: true,
      fotos: 2,
      estado: "SUSPENDED",
      cuotasVencidas: 0,
    },
    // Sin una sola foto: no se ve, y aparece en el tercer número del panel.
    {
      numero: "105",
      nombre: "Fabián",
      apellido: "Esquivel",
      optIn: true,
      publicado: false,
      fotos: 0,
      estado: "ACTIVE",
      cuotasVencidas: 0,
    },
  ];

  const ESPECIALIDADES = [["retrato"], ["social"], ["retrato", "social"], ["producto"], ["retrato"], []];

  for (const [indice, caso] of casos.entries()) {
    let userId: number | null = null;
    if (caso.conSesion) {
      const u = await prisma.user.create({
        data: {
          email: "juan@prueba.test",
          name: `${caso.nombre} ${caso.apellido}`,
          role: "PHOTOGRAPHER",
        },
      });
      userId = u.id;
    }

    const member = await prisma.member.create({
      data: {
        workspaceId: workspace.id,
        memberNumber: caso.numero,
        firstName: caso.nombre,
        lastName: caso.apellido,
        email: `socio${caso.numero}@prueba.test`,
        documentType: "DNI",
        documentNumber: `3000000${caso.numero}`,
        status: caso.estado,
        joinedAt: new Date("2020-03-01"),
        userId,
        directoryOptIn: caso.optIn,
        businessName: `Estudio ${caso.apellido}`,
        specialties: ESPECIALIDADES[indice],
        bio: `Trabajo en fotografía desde hace años. Esta es la presentación de ${caso.nombre}.`,
        website: "miestudio.com.ar",
        instagram: `@${caso.nombre.toLowerCase()}foto`,
      },
    });

    // Cuotas vencidas e impagas, para la condición de deuda.
    for (let i = 0; i < caso.cuotasVencidas; i++) {
      const mes = new Date();
      mes.setMonth(mes.getMonth() - (i + 1));
      await prisma.membershipCharge.create({
        data: {
          workspaceId: workspace.id,
          memberId: member.id,
          concept: "MENSUAL",
          period: `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}`,
          dueDate: mes,
          amountArs: "15000",
          balanceArs: "15000",
        },
      });
    }

    if (caso.fotos === 0) continue;

    const portfolio = await prisma.fotofficeMemberPortfolio.create({
      data: {
        workspaceId: workspace.id,
        memberId: member.id,
        publicSlug: `${caso.nombre}-${caso.apellido}`
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
        memberPublished: caso.publicado,
        memberPublishedAt: caso.publicado ? new Date() : null,
        adminForcePublish: caso.perdonado ?? false,
        // Para poder mirar la franja de Instagram en la vista previa.
        instagramEnabled: caso.conSesion ?? false,
        instagramPostUrls: caso.conSesion
          ? [
              "https://www.instagram.com/p/C1example0001/",
              "https://www.instagram.com/p/C1example0002/",
              "https://www.instagram.com/p/C1example0003/",
            ]
          : [],
      },
    });

    /*
     * Fotos con proporciones distintas a propósito: una panorámica, una vertical y una cuadrada.
     * Es lo que verifica que la grilla y el visor aguanten obra real y no sólo cuadrados.
     */
    const FORMAS = [
      { w: 2400, h: 1200, nombre: "panoramica" },
      { w: 1200, h: 1800, nombre: "vertical" },
      { w: 1600, h: 1600, nombre: "cuadrada" },
    ];

    let primera: string | null = null;
    for (let i = 0; i < caso.fotos; i++) {
      const forma = FORMAS[i % FORMAS.length];
      const foto = await prisma.fotofficeMemberPortfolioPhoto.create({
        data: {
          portfolioId: portfolio.id,
          r2Key: `fotoffice/member-portfolio/${workspace.id}/${caso.numero}-${i}.jpg`,
          // Imagen de relleno local: la prueba es del circuito, no del almacenamiento.
          url: `https://placehold.co/${forma.w}x${forma.h}/333/fff.png?text=${caso.apellido}+${forma.nombre}`,
          contentType: "image/jpeg",
          sizeBytes: 1_200_000,
          width: forma.w,
          height: forma.h,
          order: i,
          title: i === 0 ? "Sin título" : `Serie ${i}`,
          year: 2024 - i,
        },
      });
      if (i === 0) primera = foto.id;
    }

    if (primera) {
      await prisma.fotofficeMemberPortfolio.update({
        where: { id: portfolio.id },
        data: { coverPhotoId: primera },
      });
    }
  }

  console.log("Listo.");
  console.log("  Institución: /w/prueba");
  console.log("  Administra:  secretaria@prueba.test");
  console.log("  Socio:       juan@prueba.test");
  console.log("  (sin contraseña: para entrar por el navegador hay que ponerles una)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
