/**
 * Prepara el Registro docente de María Belén Saldaña (13/11/2026): un espacio privado SEPARADO de
 * SOYBELUZ, con ella como dueña, el módulo encendido, su escuela con el modelo «Santa Fe secundaria
 * (Mi Escuela)» y sus reglas, y los 5 cursos de Historia. Todo sale de sus respuestas al
 * cuestionario `registro-docente-v1`.
 *
 * NO carga estudiantes: el padrón lo pega ella desde Excel (son datos de menores).
 *
 * Variable obligatoria: DATABASE_URL_FOTOFFICE (no se usa DATABASE_URL: el cliente de @repo/db
 * puede cargar packages/db/.env, que apunta a otra base).
 *
 * Uso (desde apps/fotoffice):
 *   En seco:     DATABASE_URL_FOTOFFICE=... ../../packages/db/node_modules/.bin/tsx --import ./scripts/sin-server-only.mjs scripts/registro-docente-cargar-belen.ts
 *   Escribiendo: agregar --aplicar
 *
 * Idempotente: correrlo otra vez no duplica nada ni pisa lo que ella haya cambiado (sólo crea lo
 * que falta).
 */
import { prisma, type PrismaClient } from "@repo/db";
import { REGISTRO_DOCENTE_MODULE_KEY } from "../lib/registro-docente/constants";
import { sanearCambios } from "../lib/registro-docente/reglas";

const WORKSPACE_ID = "ws_belen_docente";
const NOMBRE = "Belén Saldaña · Docente";
const EMAIL = "belenfister@gmail.com";
const SLUG = "belen-saldana-docente";
const CICLO = 2026;

const ESCUELA = { nombre: "Escuela Juan Chassaing", numero: "109", modelo: "santa-fe-secundaria" };
/** Sus respuestas: trimestral, con decimales, aprueba con 7, 15 faltas, Mi Escuela; pesos 50/30/10/10; recuperatorio promedia. */
const REGLAS_ESCUELA = {
  decimales: true,
  notaAprobacion: 7,
  limiteFaltas: 15,
  pesos: { examen: 50, trabajos: 30, carpeta: 10, participacion: 10 },
  recuperatorio: "promedia",
};
const CURSOS = ["1°", "2°", "3°", "4°", "5°"].map((anio) => ({ anio, materia: "Historia", turno: "Mañana", division: null as string | null }));

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function abrirCliente(url: string): PrismaClient {
  const Clase = prisma.constructor as new (opciones: { datasourceUrl: string }) => PrismaClient;
  return new Clase({ datasourceUrl: url });
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const url = process.env.DATABASE_URL_FOTOFFICE ?? salir("Falta DATABASE_URL_FOTOFFICE.");
  const db = abrirCliente(url);
  const reglas = sanearCambios(REGLAS_ESCUELA, "escuela");
  if (Object.keys(reglas).length !== Object.keys(REGLAS_ESCUELA).length) salir("Alguna regla de la escuela no es válida.");

  const user = await db.user.findFirst({ where: { email: { equals: EMAIL, mode: "insensitive" } }, select: { id: true, name: true } });
  if (!user) salir(`No existe el usuario ${EMAIL}.`);
  console.log(`${aplicar ? "Cargando" : "En seco (agregá --aplicar para escribir)"} — dueña: ${user.name} (usuario ${user.id})`);

  const ws = await db.workspace.findUnique({ where: { id: WORKSPACE_ID }, select: { id: true } });
  console.log(ws ? `· El espacio ${WORKSPACE_ID} ya existe.` : `· Crear el espacio «${NOMBRE}» (${WORKSPACE_ID}).`);
  const slugOcupado = await db.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: SLUG }, select: { workspaceId: true } });
  if (slugOcupado && slugOcupado.workspaceId !== WORKSPACE_ID) salir(`El nombre público ${SLUG} ya lo usa otro espacio.`);

  if (!aplicar) {
    console.log(`· Escuela «${ESCUELA.nombre} N.° ${ESCUELA.numero}» con ${JSON.stringify(reglas)}`);
    console.log(`· Cursos ${CICLO}: ${CURSOS.map((c) => `${c.anio} ${c.materia}`).join(", ")}`);
    await db.$disconnect();
    return;
  }

  await db.$transaction(async (tx) => {
    if (!ws) await tx.workspace.create({ data: { id: WORKSPACE_ID, name: NOMBRE } });
    await tx.workspaceMembership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: WORKSPACE_ID } },
      create: { userId: user.id, workspaceId: WORKSPACE_ID, role: "WORKSPACE_OWNER" },
      update: {},
    });
    await tx.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: WORKSPACE_ID } },
      create: { userId: user.id, workspaceId: WORKSPACE_ID, role: "ADMIN" },
      update: {},
    });
    // Sin branding, el selector de perfil no deja entrar al espacio. Nace con la bienvenida hecha
    // (no es un negocio que configurar) y sin sitio: la portada pública da 404 por el módulo.
    await tx.fotofficeWorkspaceBranding.upsert({
      where: { workspaceId: WORKSPACE_ID },
      create: { workspaceId: WORKSPACE_ID, publicSlug: SLUG, commercialName: NOMBRE, contactEmail: EMAIL, onboardingCompletedAt: new Date() },
      update: {},
    });
    await tx.workspaceFeatureModule.upsert({
      where: { workspaceId_moduleKey: { workspaceId: WORKSPACE_ID, moduleKey: REGISTRO_DOCENTE_MODULE_KEY } },
      create: { workspaceId: WORKSPACE_ID, moduleKey: REGISTRO_DOCENTE_MODULE_KEY, enabled: true },
      update: { enabled: true },
    });

    let escuela = await tx.docenteEscuela.findFirst({ where: { workspaceId: WORKSPACE_ID, nombre: ESCUELA.nombre }, select: { id: true } });
    if (!escuela) {
      escuela = await tx.docenteEscuela.create({ data: { workspaceId: WORKSPACE_ID, ...ESCUELA, reglas }, select: { id: true } });
      console.log(`· Escuela creada (${escuela.id}).`);
    } else console.log("· La escuela ya estaba: no se tocan sus reglas.");

    for (const c of CURSOS) {
      const existe = await tx.docenteCurso.findFirst({ where: { escuelaId: escuela.id, anio: c.anio, materia: c.materia, cicloLectivo: CICLO }, select: { id: true } });
      if (existe) continue;
      await tx.docenteCurso.create({ data: { workspaceId: WORKSPACE_ID, escuelaId: escuela.id, cicloLectivo: CICLO, ...c } });
      console.log(`· Curso ${c.anio} ${c.materia} creado.`);
    }
  }, { timeout: 60_000, maxWait: 20_000 });

  const cursos = await db.docenteCurso.count({ where: { workspaceId: WORKSPACE_ID } });
  const estudiantes = await db.docenteEstudiante.count({ where: { workspaceId: WORKSPACE_ID } });
  console.log(`Listo: ${cursos} cursos, ${estudiantes} estudiantes (el padrón lo pega ella).`);
  await db.$disconnect();
}

void main();
