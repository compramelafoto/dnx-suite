/**
 * «Preparar» de la demo escolar: crea lo que falte, sin pisar lo que ya existe. Se puede tocar las
 * veces que haga falta: si una corrida se corta (subir fotos lleva su tiempo), la siguiente sigue.
 *
 * Todo queda marcado como demo: usuarios con la etiqueta `DEMO_PRESENTACION` y correos `.test`,
 * álbum `isTest`. Nada de esto aparece en el directorio, las estadísticas ni los informes.
 */

import { randomBytes } from "node:crypto";
import {
  AlbumMode,
  BenefitSelectionMode,
  BenefitTemplatePolicy,
  OrganizerCommissionAppliesTo,
  PackAvailabilityPhase,
  PackBenefitKind,
  Role,
  StudentIdentificationMode,
  StudentSourceType,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@repo/auth";
import { DEMO_TAG } from "@/lib/demos/identidad";
import { archivoDeAlumno, DEMO_ESCOLAR } from "@/lib/demos/escolar/datos";
import { generarFotoProvisoria } from "@/lib/demos/escolar/fotos-provisorias";
import { normalizeFullName } from "@/lib/school-roster/student-normalize";
import { assertBenefitBusinessRules, parseBenefitBodyCreate } from "@/lib/preventa-canjeable/preventa-pack-benefit-validation";
import { uploadToR2 } from "@/lib/r2-client";
import { finalizeAlbumPhotoFromRaw } from "@/lib/albums/finalize-album-photo-from-raw";
import { getAlbumPhotoMaxBytes, getAlbumPhotoMaxMb } from "@/lib/albums/album-photo-upload-limits";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";
import { FOTOS_SIN_PUBLICAR } from "@/lib/demos/escolar/fotos-toma";

export type ResumenDemo = {
  fotografoId: number;
  colegioUserId: number;
  schoolId: number;
  albumId: number;
  albumSlug: string;
  plantillaId: string | null;
  fotos: { total: number; subidasAhora: number; faltan: number };
  avisos: string[];
};

/** Marca del token de MP falso: el álbum demo nunca cobra por Mercado Pago. */
export const MP_TOKEN_DEMO = "DEMO_SIN_MERCADO_PAGO";

const NIVEL: Record<string, string> = { S5: "Inicial", "6A": "Primaria" };

async function asegurarUsuario(opts: {
  email: string;
  nombre: string;
  role: Role;
  extra?: Record<string, unknown>;
}): Promise<number> {
  const existente = await prisma.user.findUnique({
    where: { email: opts.email },
    select: { id: true, tags: true },
  });
  if (existente) {
    if (!existente.tags.includes(DEMO_TAG)) {
      await prisma.user.update({
        where: { id: existente.id },
        data: { tags: { set: [...existente.tags, DEMO_TAG] } },
      });
    }
    return existente.id;
  }
  const creado = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.nombre,
      role: opts.role,
      tags: [DEMO_TAG],
      // Nadie entra con contraseña: se entra desde /admin/demos.
      password: hashPassword(randomBytes(24).toString("hex")),
      emailVerifiedAt: new Date(),
      ...(opts.extra ?? {}),
    } as never,
    select: { id: true },
  });
  return creado.id;
}

async function asegurarAlumnosYCursos(schoolId: number, albumId: number) {
  for (const [ci, curso] of DEMO_ESCOLAR.cursos.entries()) {
    let course = await prisma.schoolCourse.findFirst({
      where: { schoolId, name: curso.nombre, division: curso.division },
      select: { id: true },
    });
    if (!course) {
      course = await prisma.schoolCourse.create({
        data: { schoolId, name: curso.nombre, division: curso.division, sortOrder: ci },
        select: { id: true },
      });
    }
    for (const [ai, alumno] of curso.alumnos.entries()) {
      const externalStudentId = `demo-${curso.codigo}-${String(ai + 1).padStart(2, "0")}`;
      const student = await prisma.schoolStudent.upsert({
        where: { schoolId_externalStudentId: { schoolId, externalStudentId } },
        create: {
          schoolId,
          externalStudentId,
          firstName: alumno.nombre,
          lastName: alumno.apellido,
          normalizedFullName: normalizeFullName(alumno.nombre, alumno.apellido),
          sourceType: StudentSourceType.MANUAL_PHOTOGRAPHER,
        },
        update: {},
        select: { id: true },
      });
      await prisma.albumStudentRosterEntry.upsert({
        where: { albumId_studentId: { albumId, studentId: student.id } },
        create: {
          albumId,
          schoolId,
          studentId: student.id,
          level: NIVEL[curso.codigo] ?? "Primaria",
          shift: "Mañana",
          courseName: curso.nombre,
          division: curso.division,
          snapshotFirstName: alumno.nombre,
          snapshotLastName: alumno.apellido,
          sourceType: StudentSourceType.MANUAL_PHOTOGRAPHER,
          isManual: true,
        },
        update: {},
      });
    }
  }
}

async function asegurarPacks(albumId: number, fotografoId: number): Promise<string | null> {
  let plantillaId: string | null = null;
  const producto =
    (await prisma.photographerProduct.findFirst({
      where: { userId: fotografoId, name: "Librito 30×20" },
      select: { id: true },
    })) ??
    (await prisma.photographerProduct.create({
      data: { userId: fotografoId, name: "Librito 30×20", size: "30x20", acabado: "Mate", retailPrice: 20000 },
      select: { id: true },
    }));

  for (const [i, pack] of DEMO_ESCOLAR.packs.entries()) {
    const existente = await prisma.packDefinition.findFirst({
      where: { albumId, name: pack.nombre },
      include: { benefits: { select: { templateV2Id: true } } },
    });
    if (existente) {
      plantillaId = plantillaId ?? existente.benefits.find((b) => b.templateV2Id)?.templateV2Id ?? null;
      continue;
    }
    const creado = await prisma.packDefinition.create({
      data: {
        albumId,
        name: pack.nombre,
        description: pack.descripcion,
        priceClientArs: pack.precioPesos,
        displayOrder: i,
        isRecommended: pack.conLibrito,
        availabilityPhase: PackAvailabilityPhase.PRE_UPLOAD,
      },
      select: { id: true },
    });
    const beneficios: Record<string, unknown>[] = [];
    if (pack.conLibrito) {
      beneficios.push({
        kind: PackBenefitKind.PHYSICAL,
        includedQuantity: 1,
        sortOrder: 0,
        photographerProductId: producto.id,
        templatePolicy: BenefitTemplatePolicy.REQUIRED,
        templateV2Id: DEMO_ESCOLAR.plantillaSistemaBase,
        requiredPhotoCount: DEMO_ESCOLAR.fotosDelLibrito,
        selectionMode: BenefitSelectionMode.MULTI_PHOTO_FIXED,
      });
    }
    beneficios.push({
      kind: PackBenefitKind.DIGITAL,
      includedQuantity: pack.digitales,
      sortOrder: 1,
      templatePolicy: BenefitTemplatePolicy.NONE,
      // N descargas de una foto cada una: «10 fotos digitales», no 10 de 10.
      requiredPhotoCount: 1,
      selectionMode: BenefitSelectionMode.SINGLE_PHOTO,
    });
    for (const cuerpo of beneficios) {
      // Mismas reglas que el panel: la plantilla de sistema se copia a la cuenta del fotógrafo.
      const fields = parseBenefitBodyCreate(cuerpo);
      await assertBenefitBusinessRules(albumId, fotografoId, fields);
      await prisma.benefitDefinition.create({ data: { ...fields, packDefinitionId: creado.id } });
      if (fields.templateV2Id) plantillaId = fields.templateV2Id;
    }
  }
  return plantillaId;
}

type FotoPlan = { archivo: string; obtener: () => Promise<Buffer> };

function planDeFotos(origen: string): FotoPlan[] {
  const plan: FotoPlan[] = [];
  for (const curso of DEMO_ESCOLAR.cursos) {
    const etiqueta = `${curso.nombre} ${curso.division}`;
    curso.alumnos.forEach((a, i) => {
      plan.push({
        archivo: archivoDeAlumno(curso.codigo, i),
        obtener: () => generarFotoProvisoria({ nombre: `${a.nombre} ${a.apellido}`, curso: etiqueta, tipo: "retrato", semilla: i }),
      });
    });
    plan.push({
      archivo: `${curso.codigo}-GRUPO.jpg`,
      obtener: () => generarFotoProvisoria({ nombre: etiqueta, curso: DEMO_ESCOLAR.escuela.nombre, tipo: "grupal" }),
    });
  }
  plan.push({
    archivo: DEMO_ESCOLAR.profesor.archivo,
    obtener: async () => {
      const res = await fetch(`${origen}/demos/escolar/profe.jpg`, { cache: "no-store" });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      return generarFotoProvisoria({ nombre: "Profesor", curso: "6º grado A", tipo: "retrato" });
    },
  });
  return plan;
}

/** Sube las fotos que falten, con el mismo proceso que una subida desde el panel. */
async function asegurarFotos(albumId: number, fotografoId: number, origen: string, presupuestoMs: number) {
  const existentes = await prisma.photo.findMany({
    where: { albumId, originalFilename: { not: null } },
    select: { originalFilename: true },
  });
  const ya = new Set(existentes.map((p) => p.originalFilename));
  const plan = planDeFotos(origen);
  const inicio = Date.now();
  let subidasAhora = 0;
  for (const foto of plan) {
    if (ya.has(foto.archivo)) continue;
    if (Date.now() - inicio > presupuestoMs) break;
    const buffer = await foto.obtener();
    const key = `albums/${albumId}/raw/demo-${randomBytes(6).toString("hex")}-${foto.archivo}`;
    await uploadToR2(buffer, key, "image/jpeg");
    const { photo } = await finalizeAlbumPhotoFromRaw({
      albumId,
      userId: fotografoId,
      key,
      maxBytes: getAlbumPhotoMaxBytes(),
      maxMb: getAlbumPhotoMaxMb(),
      originalFilename: foto.archivo,
    });
    // Sin publicar hasta el paso «Subís las fotos»: la preventa se muestra antes de la toma.
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        originalFilename: foto.archivo,
        isRemoved: true,
        removedAt: new Date(),
        removedReason: FOTOS_SIN_PUBLICAR,
      },
    });
    ya.add(foto.archivo);
    subidasAhora += 1;
  }
  const faltan = plan.filter((f) => !ya.has(f.archivo)).length;
  return { total: plan.length, subidasAhora, faltan };
}

export async function prepararDemoEscolar(opts: { origen: string; presupuestoFotosMs?: number }): Promise<ResumenDemo> {
  const avisos: string[] = [];
  const d = DEMO_ESCOLAR;

  const fotografoId = await asegurarUsuario({
    email: d.fotografo.email,
    nombre: d.fotografo.nombre,
    role: Role.PHOTOGRAPHER,
    extra: {
      companyName: d.fotografo.nombre,
      publicPageHandler: d.fotografo.handler,
      isPublicPageEnabled: true,
      phone: d.fotografo.telefono,
      whatsapp: d.fotografo.telefono,
      city: d.fotografo.ciudad,
      province: d.fotografo.provincia,
      // Sin esto el panel no deja subir fotos; nunca se usa para cobrar (el pago es simulado).
      mpAccessToken: MP_TOKEN_DEMO,
      mpConnectedAt: new Date(),
    },
  });
  const colegioUserId = await asegurarUsuario({
    email: d.colegioUsuario.email,
    nombre: d.colegioUsuario.nombre,
    role: Role.SCHOOL_ORGANIZER,
  });

  const school = await prisma.school.upsert({
    where: { slug: d.escuela.slug },
    create: {
      ownerId: fotografoId,
      name: d.escuela.nombre,
      slug: d.escuela.slug,
      contactEmail: d.escuela.email,
      contactPhone: d.escuela.telefono,
      address: d.escuela.direccion,
      city: d.escuela.ciudad,
      province: d.escuela.provincia,
      country: "Argentina",
    },
    update: {},
    select: { id: true, ownerId: true },
  });
  if (school.ownerId !== fotografoId) {
    throw new Error("La escuela demo pertenece a otro usuario: no se toca.");
  }

  await prisma.schoolOrganizer.upsert({
    where: { schoolId_userId: { schoolId: school.id, userId: colegioUserId } },
    create: { schoolId: school.id, userId: colegioUserId },
    update: { status: "ACTIVE" },
  });

  const enUnAnio = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  let album = await prisma.album.findUnique({
    where: { publicSlug: d.album.slug },
    select: { id: true, userId: true, isTest: true },
  });
  if (album && (album.userId !== fotografoId || !album.isTest)) {
    throw new Error("El álbum demo no es del fotógrafo demo o no está en prueba: no se toca.");
  }
  if (!album) {
    album = await prisma.album.create({
      data: {
        userId: fotografoId,
        title: d.album.titulo,
        publicSlug: d.album.slug,
        location: `${d.escuela.direccion}, ${d.escuela.ciudad}`,
        type: "SCHOOL",
        mode: AlbumMode.SCHOOL,
        isTest: true,
        isPublic: true,
        schoolId: school.id,
        enableDigitalPhotos: true,
        enablePrintedPhotos: false,
        digitalPhotoPriceCents: 4000,
        hiddenPhotosEnabled: true,
        studentIdentificationMode: StudentIdentificationMode.ROSTER_OPTIONAL,
        allowManualStudentFallback: true,
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: d.album.comisionColegioPorcentaje,
        organizerCommissionAppliesTo: [OrganizerCommissionAppliesTo.PREVENTA],
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        expiresAt: enUnAnio,
      } as never,
      select: { id: true, userId: true, isTest: true },
    });
  } else {
    // Que no venza mientras se ensaya.
    await prisma.album.update({ where: { id: album.id }, data: { expiresAt: enUnAnio, deletedAt: null } });
  }

  await asegurarAlumnosYCursos(school.id, album.id);

  let plantillaId: string | null = null;
  try {
    plantillaId = await asegurarPacks(album.id, fotografoId);
  } catch (err) {
    avisos.push(`Packs: ${err instanceof Error ? err.message : String(err)}`);
  }

  let fotos = { total: 0, subidasAhora: 0, faltan: 0 };
  try {
    fotos = await asegurarFotos(album.id, fotografoId, opts.origen, opts.presupuestoFotosMs ?? 200_000);
    if (fotos.faltan > 0) avisos.push(`Faltan ${fotos.faltan} fotos: tocá «Preparar» otra vez para seguir.`);
  } catch (err) {
    avisos.push(`Fotos: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    fotografoId,
    colegioUserId,
    schoolId: school.id,
    albumId: album.id,
    albumSlug: d.album.slug,
    plantillaId,
    fotos,
    avisos,
  };
}
