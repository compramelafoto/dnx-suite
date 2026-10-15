"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, prisma } from "@repo/db";
import { z } from "zod";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "@/lib/presential-courses/availability";
import { resolverObjetivoDeInscripcion } from "@/lib/presential-courses/enrollment-target";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { beneficiariosParaMotor, estadoDeVenta } from "@/lib/course-marketplace/beneficiarios";
import { buscarAcuerdoDeVitrina, esSocioActivoDe, existeCursoPropio } from "@/lib/course-marketplace/vitrina";
import { decidirVenta, filasDeReparto, montosDeVenta, type MontosDeVenta } from "@/lib/course-marketplace/venta";
import { cobroConRepartoHabilitado } from "@/lib/payments/split-1n";
import { cargarBeneficiarios, cargarDueno } from "@/lib/course-marketplace/cargar";
import { montosDeCompraSinReparto } from "@/lib/course-marketplace/compra";
import { splitByPlatformFee } from "@/lib/platform-fee/fee";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";

const enrollmentSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  whatsapp: z.string().min(6).max(40),
  dni: z.string().min(5).max(24),
  city: z.string().max(120).optional().nullable(),
  instagram: z.string().max(120).optional().nullable(),
  courseInstanceId: z.string().min(1).optional(),
});

function emptyToNull(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type State = { error: string | null };

export async function createPublicCourseEnrollmentAction(
  workspaceSlug: string,
  courseSlug: string,
  _prev: State | undefined,
  formData: FormData,
): Promise<State> {
  const parsed = enrollmentSchema.safeParse({
    name: formData.get("name")?.toString()?.trim() ?? "",
    email: formData.get("email")?.toString()?.trim() ?? "",
    whatsapp: formData.get("whatsapp")?.toString()?.trim() ?? "",
    dni: formData.get("dni")?.toString()?.trim() ?? "",
    city: emptyToNull(formData.get("city")?.toString()),
    instagram: emptyToNull(formData.get("instagram")?.toString()),
    courseInstanceId: emptyToNull(formData.get("courseInstanceId")?.toString()) ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) return { error: "Workspace no encontrado." };

  const mod = await prisma.workspaceFeatureModule.findUnique({
    where: {
      workspaceId_moduleKey: { workspaceId: branding.workspaceId, moduleKey: COURSES_SALES_MODULE_KEY },
    },
  });
  if (!mod?.enabled) return { error: "Este módulo no está habilitado para este workspace." };

  const incluir = (id: string | undefined) => ({
    instances: id ? { where: { id } } : { where: { id: "" } }, // sin edición elegida: no trae ninguna
  });
  let course = await prisma.course.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: courseSlug,
      status: "PUBLISHED",
    },
    include: incluir(parsed.data.courseInstanceId),
  });
  // El curso propio gana con el mismo criterio que la página: si existe (aunque no esté publicado), no se busca reventa.
  const acuerdo = course || (await existeCursoPropio(branding.workspaceId, courseSlug))
    ? null
    : await buscarAcuerdoDeVitrina(branding.workspaceId, courseSlug);
  if (!course && acuerdo) {
    // Un curso revendido es siempre grabado: no tiene ediciones.
    course = await prisma.course.findFirst({
      where: { id: acuerdo.courseId, status: "PUBLISHED" },
      include: incluir(undefined),
    });
  }
  if (!course) return { error: "Curso no disponible para inscripción." };
  const instance = course.instances[0] ?? null;
  if (parsed.data.courseInstanceId && !instance) {
    return { error: "La edición seleccionada no es válida." };
  }

  let cuposLibres: number | null = null;
  if (instance) {
    const counts = await getApprovedEnrollmentCountsByInstanceIds([instance.id]);
    cuposLibres = computeAvailableSpots(instance.capacity, counts.get(instance.id) ?? 0);
  }

  const objetivo = resolverObjetivoDeInscripcion({
    deliveryMode: course.deliveryMode,
    precioDelCurso: course.priceArs,
    instancia: instance,
    cuposLibres,
  });
  if (!objetivo.ok) return { error: objetivo.error };

  // La comisión sale de WorkspaceModuleFee (default 5%), no de coursesFeePercent, que el
  // dueño del workspace podía editar y quedó deprecado.
  const feeBps = await getPlatformFeeBps(branding.workspaceId, COURSES_SALES_MODULE_KEY);

  // Curso grabado: el 5% de la plataforma va ENCIMA del precio de lista. Con reparto (revendido o
  // varios beneficiarios) sólo se vende con el split de Mercado Pago encendido.
  let montos: MontosDeVenta | null = null;
  let conReparto = false;
  if (objetivo.courseInstanceId === null) {
    const registrados = await cargarBeneficiarios(course.id);
    const decision = decidirVenta({
      estado: estadoDeVenta(course.workspaceId, registrados),
      revendido: acuerdo !== null,
      splitHabilitado: cobroConRepartoHabilitado(),
    });
    if (decision.tipo === "PROXIMAMENTE") return { error: "Este curso todavía no está a la venta." };
    if (decision.tipo === "SIN_REPARTO") {
      montos = montosDeCompraSinReparto({
        listaArs: objetivo.monto.toString(),
        comisionPlataformaBps: feeBps,
        owner: await cargarDueno(course.workspaceId),
      });
    } else {
      // Con reparto: sólo llega acá con el split encendido. El descuento lo decide la sesión.
      const [duenoDelCurso, vendedor, esSocio] = await Promise.all([
        cargarDueno(course.workspaceId),
        cargarDueno(branding.workspaceId),
        esSocioActivoDe(branding.workspaceId),
      ]);
      montos = montosDeVenta({
        listaArs: objetivo.monto.toString(),
        comisionPlataformaBps: feeBps,
        beneficiarios: beneficiariosParaMotor(duenoDelCurso, registrados),
        vendedorWorkspaceId: branding.workspaceId,
        reventa: acuerdo
          ? { workspaceId: branding.workspaceId, nombre: vendedor.nombre, bps: acuerdo.shareBps, descuentoSociosBps: acuerdo.memberDiscountBps }
          : null,
        esSocioDelVendedor: esSocio,
      });
      conReparto = true;
    }
    if (!montos.ok) return { error: montos.error };
  }

  const amount = montos?.ok ? new Prisma.Decimal(montos.amountArs) : objetivo.monto;
  const { fee, net } = montos?.ok
    ? { fee: new Prisma.Decimal(montos.platformFeeArs), net: new Prisma.Decimal(montos.netAmountArs) }
    : splitByPlatformFee(amount, feeBps);
  const feePercent = new Prisma.Decimal(feeBps).div(100);

  const enrollment = await prisma.$transaction(async (tx) => {
    const creada = await tx.courseEnrollment.create({
    data: {
      workspaceId: branding.workspaceId,
      courseId: course.id,
      courseInstanceId: objetivo.courseInstanceId,
      name: parsed.data.name,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp,
      dni: parsed.data.dni,
      city: parsed.data.city,
      instagram: parsed.data.instagram,
      paymentStatus: "PENDING",
      paymentMethod: "MERCADO_PAGO",
      paymentProvider: "MERCADO_PAGO",
      amountArs: amount,
      platformFeePercent: feePercent,
      platformFeeArs: fee,
      netAmountArs: net,
      // Sólo el curso grabado guarda el precio de lista; el presencial queda en null.
      listPriceArs: montos?.ok ? new Prisma.Decimal(montos.listPriceArs) : null,
      discountArs: montos?.ok ? new Prisma.Decimal(montos.discountArs) : null,
      resaleAgreementId: conReparto && acuerdo ? acuerdo.id : null,
    },
    select: { id: true },
    });
    if (conReparto && montos?.ok) {
      await tx.courseSaleShare.createMany({
        data: filasDeReparto(montos.partes).map((f) => ({ ...f, enrollmentId: creada.id, amountArs: new Prisma.Decimal(f.amountArs) })),
      });
    }
    return creada;
  });
  logCourseEvent("enrollment_created", {
    enrollmentId: enrollment.id,
    workspaceId: branding.workspaceId,
    courseId: course.id,
  });
  revalidatePath(`/w/${workspaceSlug}/cursos/${courseSlug}`);
  redirect(`/w/${workspaceSlug}/cursos/${courseSlug}/inscripcion/pending?enrollmentId=${enrollment.id}`);
}
