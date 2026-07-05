import type { SchoolOperationOrderRow, SchoolOperationsFilters } from "./school-operations-query";

const EM = "—";

function dash(s: string | null | undefined): string {
  if (s == null || String(s).trim() === "") return EM;
  return String(s).trim();
}

function photosTakenLabel(photosTakenAt: string | null): string {
  return photosTakenAt ? "Sí" : "No";
}

/** Filas planas para Excel / dataset común. */
export function schoolOperationsToExportRows(orders: SchoolOperationOrderRow[]) {
  return orders.map((o) => ({
    "Apellido alumno": dash(o.studentLastName),
    "Nombre alumno": dash(o.studentFirstName),
    Nivel: dash(o.level),
    Turno: dash(o.shift),
    Curso: dash(o.courseName),
    División: dash(o.division),
    "Nombre del comprador": dash(o.buyerName),
    "Email comprador": o.buyerEmail?.trim() || EM,
    "Resumen de compra": o.packSummary || EM,
    "Total (ARS)": (o.totalCents / 100).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    "Fotos tomadas": photosTakenLabel(o.photosTakenAt),
    Observaciones: dash(o.studentNotes),
  }));
}

/** Texto para encabezado del PDF: filtros activos. */
export function describeExportFilters(filters: SchoolOperationsFilters): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`Búsqueda: «${filters.q}»`);
  if (filters.level) parts.push(`Nivel: ${filters.level}`);
  if (filters.shift) parts.push(`Turno: ${filters.shift}`);
  if (filters.courseName) parts.push(`Curso: ${filters.courseName}`);
  if (filters.division) parts.push(`División: ${filters.division}`);
  if (filters.photosTaken === "yes") parts.push("Solo filas con fotos ya tomadas");
  if (filters.photosTaken === "no") parts.push("Solo filas sin fotos tomadas");
  if (parts.length === 0) return "Sin filtros adicionales (todos los pedidos del álbum, hasta 500 filas).";
  return parts.join(" · ");
}
