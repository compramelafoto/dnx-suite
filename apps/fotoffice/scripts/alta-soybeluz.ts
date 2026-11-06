/**
 * Alta de SOYBELUZ en FOTOFFICE (Etapa 1): institución, marca, administradores, vocabulario,
 * módulos y el borrador del sitio. En seco por omisión: sólo LEE la base y muestra el plan. Con
 * `--aplicar` crea lo que falta en una sola transacción. Volver a correrlo no duplica ni pisa
 * nada (ver `planDeAlta`). El sitio queda SIN publicar: se publica desde el panel.
 *
 * Uso:
 *   DATABASE_URL_FOTOFFICE=... pnpm --filter fotoffice soybeluz:alta [--aplicar]
 */
import { prisma, type PrismaClient } from "@repo/db";
import { ADMINISTRADORES, CONTACTO, MODULOS, NOMBRE, SLUG, TIEMPO_TRANSACCION_MS, WORKSPACE_ID, planDeAlta, type Accion, type EstadoActual } from "./soybeluz/alta";
import { SOYBELUZ_COLORES, SOYBELUZ_DISENO, SOYBELUZ_MENU, SOYBELUZ_SECCIONES } from "./soybeluz/sitio";

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

async function leerEstado(db: PrismaClient): Promise<EstadoActual> {
  const ws = await db.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: {
      id: true,
      fotofficeBranding: { select: { id: true } },
      vocabulary: { select: { id: true } },
      featureModules: { where: { enabled: true }, select: { moduleKey: true } },
      fotofficeWebsite: { select: { sectionsJson: true } },
      workspaceMembershipsUnified: { select: { role: true, user: { select: { email: true } } } },
    },
  });
  if (!ws) return { workspace: false, branding: false, membresias: [], vocabulario: false, modulos: [], sitio: null };
  const paginas = (ws.fotofficeWebsite?.sectionsJson as { pages?: Record<string, unknown[]> } | null)?.pages ?? {};
  return {
    workspace: true,
    branding: ws.fotofficeBranding !== null,
    membresias: ws.workspaceMembershipsUnified.map((m) => ({ email: m.user.email, role: m.role })),
    vocabulario: ws.vocabulary !== null,
    modulos: ws.featureModules.map((m) => m.moduleKey),
    sitio: ws.fotofficeWebsite ? { tienePaginas: Object.values(paginas).some((bloques) => bloques.length > 0) } : null,
  };
}

function describir(a: Accion): string {
  switch (a.tipo) {
    case "crearWorkspace":
      return `Crear la institución ${WORKSPACE_ID} («${NOMBRE}»)`;
    case "crearBranding":
      return `Crear la marca: dirección /w/${SLUG}, colores del manual`;
    case "crearMembresia":
      return `Sumar a ${a.email} como ${a.role === "WORKSPACE_OWNER" ? "dueña" : "administrador"}`;
    case "crearVocabulario":
      return "Llamar «participante / participantes» a las personas del padrón";
    case "encenderModulo":
      return `Encender el módulo ${a.key}`;
    case "crearSitio":
      return "Cargar el borrador del sitio (sin publicar)";
    case "saltear":
      return `Saltear: ${a.motivo}`;
  }
}

async function aplicar(db: PrismaClient, acciones: Accion[], usuarios: Map<string, number>): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const a of acciones) {
      switch (a.tipo) {
        case "crearWorkspace":
          await tx.workspace.create({ data: { id: WORKSPACE_ID, name: NOMBRE } });
          break;
        case "crearBranding":
          await tx.fotofficeWorkspaceBranding.create({
            data: {
              workspaceId: WORKSPACE_ID,
              publicSlug: SLUG,
              commercialName: NOMBRE,
              ...SOYBELUZ_COLORES,
              contactEmail: CONTACTO.email,
              whatsapp: CONTACTO.whatsapp,
              phone: CONTACTO.whatsapp,
              instagram: "soybeluz",
              website: "https://soybeluz.com",
              organizationType: "CULTURAL_ORGANIZATION",
              city: "Rosario",
              province: "Santa Fe",
              country: "Argentina",
            },
          });
          break;
        case "crearMembresia": {
          const userId = usuarios.get(a.email)!;
          await tx.workspaceMembership.create({ data: { workspaceId: WORKSPACE_ID, userId, role: a.role } });
          // La tabla vieja todavía la leen algunos caminos (ver `createFotofficeWorkspaceForUser`).
          await tx.membership.upsert({
            where: { userId_workspaceId: { userId, workspaceId: WORKSPACE_ID } },
            create: { workspaceId: WORKSPACE_ID, userId, role: "ADMIN" },
            update: {},
          });
          break;
        }
        case "crearVocabulario":
          await tx.workspaceVocabulary.create({ data: { workspaceId: WORKSPACE_ID, personSingular: "participante", personPlural: "participantes" } });
          break;
        case "encenderModulo":
          await tx.workspaceFeatureModule.upsert({
            where: { workspaceId_moduleKey: { workspaceId: WORKSPACE_ID, moduleKey: a.key } },
            create: { workspaceId: WORKSPACE_ID, moduleKey: a.key, enabled: true },
            update: { enabled: true },
          });
          break;
        case "crearSitio": {
          const datos = { sectionsJson: SOYBELUZ_SECCIONES, navJson: SOYBELUZ_MENU, designPresetsJson: SOYBELUZ_DISENO };
          await tx.fotofficeWorkspaceWebsite.upsert({ where: { workspaceId: WORKSPACE_ID }, create: { workspaceId: WORKSPACE_ID, ...datos }, update: datos });
          break;
        }
        case "saltear":
          break;
      }
    }
  }, { timeout: TIEMPO_TRANSACCION_MS, maxWait: TIEMPO_TRANSACCION_MS });
}

async function main() {
  const aplicarCambios = process.argv.includes("--aplicar");
  const url = process.env.DATABASE_URL_FOTOFFICE?.trim();
  if (!url) salir("Falta la variable de entorno DATABASE_URL_FOTOFFICE (base de FOTOFFICE).");
  const Clase = prisma.constructor as new (opciones: { datasourceUrl: string }) => PrismaClient;
  const db = new Clase({ datasourceUrl: url });

  try {
    // Antes de escribir: las dos cuentas tienen que existir y la dirección tiene que estar libre.
    const usuarios = new Map<string, number>();
    for (const admin of ADMINISTRADORES) {
      const u = await db.user.findFirst({ where: { email: { equals: admin.email, mode: "insensitive" } }, select: { id: true } });
      if (!u) salir(`No existe la cuenta ${admin.email} en esta base: que entre una vez a FOTOFFICE y volvé a correrlo.`);
      usuarios.set(admin.email, u.id);
    }
    const ocupada = await db.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: SLUG }, select: { workspaceId: true } });
    if (ocupada && ocupada.workspaceId !== WORKSPACE_ID) salir(`La dirección /w/${SLUG} ya es de otra institución (${ocupada.workspaceId}).`);

    const acciones = planDeAlta(await leerEstado(db));
    console.log(`Módulos previstos: ${MODULOS.join(", ")}`);
    for (const a of acciones) console.log(`- ${describir(a)}`);

    if (acciones.every((a) => a.tipo === "saltear")) {
      console.log("\nNo hay nada que hacer: SOYBELUZ ya está dada de alta.");
      return;
    }
    if (!aplicarCambios) {
      console.log("\nEn seco: no se escribió nada. Para aplicar, volvé a correrlo con --aplicar.");
      return;
    }
    await aplicar(db, acciones, usuarios);
    console.log(`\nListo. Revisá el borrador en /website de ${NOMBRE} y publicalo desde el panel.`);
  } finally {
    await db.$disconnect();
  }
}

void main();
