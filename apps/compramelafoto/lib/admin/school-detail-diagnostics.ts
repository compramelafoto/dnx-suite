import type { StudentRow } from "@/components/admin/school-detail/types";

export function formatSensitiveRelationsTooltip(student: StudentRow): string {
  const directCount = student.sensitiveRelationsSummary?.preCompraOrdersCount ?? 0;
  const linkedToListCount =
    student.sensitiveRelationsSummary?.rosterPreCompraOrdersCount ?? 0;
  const directLabel = directCount === 1 ? "pedido directo" : "pedidos directos";
  const linkedToListLabel =
    linkedToListCount === 1
      ? "pedido vinculado al listado de alumnos"
      : "pedidos vinculados al listado de alumnos";
  return `Este alumno tiene relaciones sensibles: ${directCount} ${directLabel} y ${linkedToListCount} ${linkedToListLabel}.`;
}

export function getAlbumIdFromIdentModeDiagnostic(code: string): number | null {
  const match = code.match(/^album_ident_mode_missing_(\d+)$/);
  if (!match) return null;
  const albumId = Number(match[1]);
  return Number.isInteger(albumId) && albumId > 0 ? albumId : null;
}

export function getAlbumIdFromNoActivePacksDiagnostic(code: string): number | null {
  const match = code.match(/^album_without_active_packs_(\d+)$/);
  if (!match) return null;
  const albumId = Number(match[1]);
  return Number.isInteger(albumId) && albumId > 0 ? albumId : null;
}

export function getPackIdFromDiagnostic(code: string): number | null {
  const match = code.match(
    /^(?:pack_active_without_products|pack_without_phase|pack_active_out_of_validity|pack_phase_mismatch)_(\d+)$/
  );
  if (!match) return null;
  const packId = Number(match[1]);
  return Number.isInteger(packId) && packId > 0 ? packId : null;
}

export function getOrderIdFromDiagnostic(code: string): number | null {
  const match = code.match(
    /^(?:manual_student_source|inactive_or_missing_pack|without_pending_selection)_(\d+)$/
  );
  if (!match) return null;
  const orderId = Number(match[1]);
  return Number.isInteger(orderId) && orderId > 0 ? orderId : null;
}

export function getDiagnosticCategory(code: string): "configuracion" | "packs" | "pedidos" {
  if (code.startsWith("pack_") || code.startsWith("album_without_active_packs_")) return "packs";
  if (
    code.startsWith("manual_student_") ||
    code.startsWith("inactive_or_missing_pack") ||
    code.startsWith("without_pending_selection")
  ) {
    return "pedidos";
  }
  return "configuracion";
}
