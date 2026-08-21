import Papa from "papaparse";
import { memberSchema, type MemberFormValues } from "@/lib/members/schema";
import { MEMBER_STATUS_LABELS, type MemberStatus } from "@/lib/members/status-labels";
import { MEMBER_IMPORT_MAX_ROWS, MEMBER_IMPORT_REQUIRED_COLUMNS } from "./columns";
import { documentDedupKey, normalizeDocument } from "@/lib/members/documents";

export type ImportRowStatus = "VALID" | "WARNING" | "ERROR";

export type ImportRowResult = {
  rowNumber: number; // 1-based, no cuenta el encabezado
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  memberNumber: string;
  firstName: string;
  lastName: string;
  categoryName: string;
  statusLabel: string;
  /** Solo presente cuando `status !== "ERROR"`: listo para crear. */
  resolved?: MemberFormValues;
};

export type ImportParseOutcome =
  | { ok: false; error: string }
  | {
      ok: true;
      rows: ImportRowResult[];
      totalRows: number;
      validCount: number;
      warningCount: number;
      errorCount: number;
    };

const STATUS_ALIASES: Record<string, MemberStatus> = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  INACTIVE: "INACTIVE",
  ACTIVO: "ACTIVE",
  SUSPENDIDO: "SUSPENDED",
  INACTIVO: "INACTIVE",
};

function normalizeStatus(raw: string): string {
  const key = raw.trim().toUpperCase();
  return STATUS_ALIASES[key] ?? raw.trim();
}

/**
 * Normaliza SOLO para comparar: recorta espacios y baja a minúsculas. Nunca reescribe la
 * dirección que se va a guardar (eso sigue saliendo de `memberSchema`), nunca inventa ni
 * agrega sufijos. `SOCIO@X.COM`, `socio@x.com` y ` socio@x.com ` son el mismo email.
 * Un email vacío devuelve null: ausencia de email, no un duplicado — varias filas sin email
 * no chocan entre sí.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase();
  return t ? t : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

/**
 * Parsea el CSV pegado y valida cada fila reutilizando `memberSchema` — las
 * MISMAS reglas que el alta manual (`createMemberAction`), para que import y
 * alta individual nunca queden con criterios contradictorios.
 *
 * NO inserta nada en la base. Categorías/duplicados se resuelven contra el
 * estado real del workspace (`categoriesByName`, `existingMemberNumbers`,
 * `existingDocuments`) pasado por el caller — quien ya lo leyó de la DB.
 */
export function parseAndValidateMemberImport(params: {
  rawCsv: string;
  categoriesByName: Map<string, string>; // nombre normalizado (trim+lower) -> categoryId
  existingMemberNumbers: Set<string>;
  existingDocuments: Set<string>; // `${documentType}::${documentNumber}` normalizado
  /**
   * Emails ya usados en ESTE workspace, normalizados con `normalizeEmail`. El caller los
   * lee una sola vez (misma consulta que números/documentos), nunca una consulta por fila.
   * Opcional para no romper llamadores que todavía no lo pasen: sin el set, no se valida
   * contra la base, pero los duplicados DENTRO del archivo se siguen detectando igual.
   */
  existingEmails?: Set<string>;
}): ImportParseOutcome {
  const parsed = Papa.parse<Record<string, string>>(params.rawCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return { ok: false, error: `No pudimos leer el CSV (${first.message}, fila ${first.row ?? "?"}).` };
  }

  const data = parsed.data;
  if (data.length === 0) {
    return { ok: false, error: "No encontramos ninguna fila de datos." };
  }
  if (data.length > MEMBER_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `El archivo tiene ${data.length} filas. Por ahora el máximo por importación es ${MEMBER_IMPORT_MAX_ROWS}.`,
    };
  }

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = MEMBER_IMPORT_REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingHeaders.length > 0) {
    return {
      ok: false,
      error: `Faltan columnas obligatorias en el encabezado: ${missingHeaders.join(", ")}.`,
    };
  }

  const seenMemberNumbers = new Map<string, number[]>(); // memberNumber -> filas donde aparece
  const seenDocuments = new Map<string, number[]>();
  const docKeyByRow = new Map<number, string>(); // rowNumber -> docKey, para la segunda pasada
  const seenEmails = new Map<string, number[]>(); // email normalizado -> filas donde aparece
  const emailKeyByRow = new Map<number, string>(); // rowNumber -> email normalizado

  const rows: ImportRowResult[] = data.map((raw, idx) => {
    const rowNumber = idx + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    const memberNumber = (raw.memberNumber ?? "").trim();
    const firstName = (raw.firstName ?? "").trim();
    const lastName = (raw.lastName ?? "").trim();
    const categoryNameRaw = (raw.category ?? "").trim();
    const documentType = (raw.documentType ?? "").trim() || null;
    const documentNumber = (raw.documentNumber ?? "").trim() || null;
    const email = (raw.email ?? "").trim();
    const phone = (raw.phone ?? "").trim();
    const birthDate = (raw.birthDate ?? "").trim();
    const joinedAt = (raw.joinedAt ?? "").trim();
    const address = (raw.address ?? "").trim();
    const city = (raw.city ?? "").trim();
    const province = (raw.province ?? "").trim();
    const postalCode = (raw.postalCode ?? "").trim();
    const notes = (raw.notes ?? "").trim();
    const statusRaw = (raw.status ?? "").trim();
    const normalizedStatus = normalizeStatus(statusRaw);

    // Duplicados dentro del archivo (memberNumber es el identificador operativo).
    if (memberNumber) {
      const list = seenMemberNumbers.get(memberNumber) ?? [];
      list.push(rowNumber);
      seenMemberNumbers.set(memberNumber, list);
    }
    // Clave normalizada: `12.345.678` y `12345678` son el MISMO documento, así que un CSV
    // que mezcle formatos ya no cuela dos veces a la misma persona.
    const docKey = documentDedupKey(documentType, documentNumber);
    if (docKey) {
      const list = seenDocuments.get(docKey) ?? [];
      list.push(rowNumber);
      seenDocuments.set(docKey, list);
      docKeyByRow.set(rowNumber, docKey);
    }
    // Mismo criterio que número y documento. Sin email no se registra nada: dos filas
    // sin email nunca son "el mismo email".
    const emailKey = normalizeEmail(email);
    if (emailKey) {
      const list = seenEmails.get(emailKey) ?? [];
      list.push(rowNumber);
      seenEmails.set(emailKey, list);
      emailKeyByRow.set(rowNumber, emailKey);
    }

    // Categoría: debe existir YA en el workspace — nunca se crea una nueva acá.
    const categoryKey = categoryNameRaw.toLowerCase();
    const categoryId = categoryNameRaw ? params.categoriesByName.get(categoryKey) : undefined;
    if (categoryNameRaw && !categoryId) {
      errors.push(`La categoría «${categoryNameRaw}» no existe en este workspace.`);
    }

    // Fechas: formato estricto AAAA-MM-DD. Un dato ambiguo NUNCA se adivina.
    if (joinedAt && !isValidDateString(joinedAt)) {
      errors.push("Fecha de ingreso inválida (formato esperado: AAAA-MM-DD).");
    }
    if (birthDate && !isValidDateString(birthDate)) {
      errors.push("Fecha de nacimiento inválida (formato esperado: AAAA-MM-DD).");
    }

    // Mismas reglas que el alta manual (memberSchema), no un segundo validador.
    const candidate: MemberFormValues = {
      memberNumber,
      categoryId: categoryId ?? "",
      firstName,
      lastName,
      status: normalizedStatus as MemberFormValues["status"],
      joinedAt,
      leftAt: null,
      documentType,
      documentNumber,
      email: email || null,
      phone: phone || null,
      birthDate: birthDate || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      notes: notes || null,
    };
    const parsedRow = memberSchema.safeParse(candidate);
    if (!parsedRow.success) {
      for (const issue of parsedRow.error.issues) {
        // La ausencia de categoría ya se reportó arriba con un mensaje más claro.
        if (issue.path[0] === "categoryId" && categoryNameRaw && errors.some((e) => e.includes("no existe"))) continue;
        if (issue.path[0] === "categoryId" && !categoryNameRaw) {
          errors.push("Falta la categoría.");
          continue;
        }
        if (issue.path[0] === "status") {
          errors.push("Estado inválido: usá ACTIVE, SUSPENDED o INACTIVE.");
          continue;
        }
        errors.push(issue.message);
      }
    }

    // Duplicados contra la base real (categoría/documento/número ya existentes).
    if (memberNumber && params.existingMemberNumbers.has(memberNumber)) {
      errors.push("Ya existe un socio con ese número en este workspace.");
    }
    if (docKey && params.existingDocuments.has(docKey)) {
      errors.push("Ya existe un socio con ese documento en este workspace.");
    }

    // Formato del documento. Es entrada nueva, así que se valida siempre (a diferencia de la
    // edición de un socio ya cargado, donde solo se valida si el documento cambió).
    const doc = normalizeDocument(documentType, documentNumber);
    if (doc.validationStatus === "INVALID") {
      errors.push(doc.message ?? "Documento inválido.");
    }
    // Contra la base: lookup en memoria sobre un Set ya cargado (una sola consulta para
    // todo el lote), nunca una consulta por fila. No se revela NINGÚN dato del socio
    // existente: solo que ese email ya está tomado.
    if (emailKey && params.existingEmails?.has(emailKey)) {
      errors.push(
        "Ese email ya está registrado en otro socio de este workspace. Usá otro email o dejá esta fila sin email.",
      );
    }

    // Advertencias: campos opcionales vacíos, nunca bloquean.
    if (!email) warnings.push("Sin email.");
    if (!phone) warnings.push("Sin teléfono.");
    if (!documentNumber) warnings.push("Sin documento.");
    if (!birthDate) warnings.push("Sin fecha de nacimiento.");
    if (!notes) warnings.push("Sin observaciones.");

    return {
      rowNumber,
      status: "VALID", // se corrige abajo, después de resolver duplicados intra-archivo
      errors,
      warnings,
      memberNumber,
      firstName,
      lastName,
      categoryName: categoryNameRaw,
      statusLabel: MEMBER_STATUS_LABELS[normalizedStatus as MemberStatus] ?? statusRaw,
      resolved: errors.length === 0 ? parsedRow.success ? parsedRow.data : undefined : undefined,
    };
  });

  // Segunda pasada: marcar duplicados DENTRO del archivo (necesita haber visto todas las filas).
  for (const row of rows) {
    if (row.memberNumber && (seenMemberNumbers.get(row.memberNumber)?.length ?? 0) > 1) {
      row.errors.push("Número de socio duplicado en el archivo.");
      row.resolved = undefined;
    }
    const docKey = docKeyByRow.get(row.rowNumber);
    if (docKey && (seenDocuments.get(docKey)?.length ?? 0) > 1) {
      row.errors.push("Ese documento está duplicado en el archivo.");
      row.resolved = undefined;
    }
    // Se marcan TODAS las filas del grupo, no solo la segunda: FotoOffice no elige por el
    // administrador cuál de dos personas (ej. un matrimonio con un email compartido) se
    // queda con la dirección. El mensaje nombra las otras filas para que pueda corregir el
    // CSV: poner otro email válido, o dejar una de las filas sin email.
    const emailKey = emailKeyByRow.get(row.rowNumber);
    if (emailKey) {
      const rowsWithSameEmail = seenEmails.get(emailKey) ?? [];
      if (rowsWithSameEmail.length > 1) {
        const others = rowsWithSameEmail.filter((n) => n !== row.rowNumber);
        row.errors.push(
          `Ese email está repetido en el archivo (también en ${others.length === 1 ? "la fila" : "las filas"} ${others.join(", ")}). Cada socio necesita un email distinto, o dejá sin email a los demás.`,
        );
        row.resolved = undefined;
      }
    }
  }

  for (const row of rows) {
    row.status = row.errors.length > 0 ? "ERROR" : row.warnings.length > 0 ? "WARNING" : "VALID";
  }

  const validCount = rows.filter((r) => r.status !== "ERROR").length;
  const errorCount = rows.filter((r) => r.status === "ERROR").length;
  const warningCount = rows.filter((r) => r.status === "WARNING").length;

  return { ok: true, rows, totalRows: rows.length, validCount, warningCount, errorCount };
}
