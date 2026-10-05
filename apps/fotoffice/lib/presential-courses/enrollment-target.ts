import type { Prisma } from "@repo/db";
import { esGrabado, validarModalidad, type CourseDeliveryMode } from "./delivery-mode";

/**
 * A qué se inscribe alguien y cuánto paga.
 *
 * Un presencial se compra por edición (fecha, lugar, cupo y precio propios). Un grabado no
 * tiene ediciones: se compra el curso, al precio del curso, sin cupo. Hasta el 2026-10-03 la
 * acción pública exigía edición siempre, y un curso grabado no se podía comprar.
 */
export function resolverObjetivoDeInscripcion(input: {
  deliveryMode: CourseDeliveryMode;
  precioDelCurso: Prisma.Decimal | null;
  instancia: { id: string; status: string; priceArs: Prisma.Decimal } | null;
  cuposLibres: number | null;
}):
  | { ok: true; courseInstanceId: string | null; monto: Prisma.Decimal }
  | { ok: false; error: string } {
  const modalidad = validarModalidad({
    deliveryMode: input.deliveryMode,
    tieneEdicion: input.instancia !== null,
  });
  if (!modalidad.ok) return modalidad;

  if (esGrabado(input.deliveryMode)) {
    if (!input.precioDelCurso || input.precioDelCurso.lte(0)) {
      return { ok: false, error: "Este curso todavía no tiene precio." };
    }
    return { ok: true, courseInstanceId: null, monto: input.precioDelCurso };
  }

  const instancia = input.instancia!;
  if (instancia.status !== "ACTIVE") {
    return { ok: false, error: "La edición no está disponible para inscripción." };
  }
  if ((input.cuposLibres ?? 0) <= 0) {
    return { ok: false, error: "No hay cupos disponibles para esta edición." };
  }
  return { ok: true, courseInstanceId: instancia.id, monto: instancia.priceArs };
}
