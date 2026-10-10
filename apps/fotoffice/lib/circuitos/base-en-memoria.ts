/**
 * Base en memoria SÓLO PARA PRUEBAS del motor de etapas. Aplica de verdad los filtros que usa
 * el motor (igualdad —fechas por valor—, `in`, relaciones `circuit`/`stage`/`journey`),
 * `select`, `orderBy`, el índice único parcial de recorridos abiertos y deshace todo lo escrito
 * cuando la transacción lanza. Así las pruebas miran el resultado, no la forma de las llamadas.
 *
 * Como Prisma, `$transaction(fn)` le pasa a `fn` un cliente `tx` propio. Mientras la transacción
 * está abierta, usar el `prisma` global lanza (en la base real esa escritura quedaría afuera de
 * la transacción y no se desharía), y usar `tx` después de cerrada también lanza.
 * Para simular fallas o carreras, las pruebas reemplazan métodos en `tablas` (lo usan ambos).
 */

type Fila = Record<string, unknown>;
type Where = Record<string, unknown>;
type Orden = Record<string, "asc" | "desc">;

const TABLAS = [
  "fotofficeCircuit", "fotofficeStage", "fotofficeStageTaskTemplate", "fotofficeLossReason",
  "fotofficeJourney", "fotofficeJourneyStep", "fotofficeTask", "serviceSalesLead", "workspaceMembership",
  "fotofficeStageRule", "fotofficeProcessedEvent", "fotofficeWorkspaceBranding", "serviceLeadForm",
  // Campos personalizados (0.5) y los registros a los que se cuelgan.
  "fotofficeCustomField", "fotofficeCustomFieldOption", "fotofficeCustomValue", "fotofficeCustomValueChange",
  "client", "member",
  // Numeración (0.5).
  "fotofficeSequence", "fotofficeSequenceChange", "fotofficeRecordNumber",
  // Plantillas de mensajes (0.6).
  "fotofficeMessageTemplate", "fotofficeMessage",
  // Contactos y consultas (etapa 1).
  "clientAudit", "fotofficeContactoPerfil", "fotofficeConsulta", "fotofficeConsultaCategoria", "fotofficeOrigen",
  "fotofficeRolParticipante", "fotofficeConsultaParticipante", "fotofficeConsultaAjustes",
  // Usuarios del equipo (el aviso de consulta nueva lee su correo).
  "user",
  // Bitácora de las listas (la importación de consultas deja su registro).
  "fotofficeListActivity",
  // Catálogo de Ventas y su ampliación para presupuestos (etapa 2).
  "product", "productCategory", "fotofficeProductoCatalogo", "fotofficeComboItem", "fotofficeCostoPlantilla",
  // Presupuestos (etapa 2).
  "fotofficePresupuesto", "fotofficePresupuestoVersion", "fotofficePresupuestoVista", "fotofficePresupuestoAjustes",
  // Propuesta modelo por categoría (etapa 2, Entrega B).
  "fotofficePropuestaModelo", "fotofficePropuestaBorradorAuto",
  // Rubros de dos niveles (etapa 3): categorías de Caja y su perfil.
  "cashCategory", "fotofficeRubro",
  // Pedidos y cobros (etapa 3).
  "fotofficePedido", "fotofficePedidoCuota", "fotofficeCobro", "fotofficeCobroImputacion",
  // Cuentas a pagar, recordatorios de cuotas, ajustes de pedidos y checklist (etapa 3, Entrega B1).
  "fotofficeCuentaPagar", "fotofficeCuotaRecordatorio", "fotofficePedidoAjustes", "fotofficePedidoTarea",
  // Proyectos (etapa 4, Entrega A).
  "fotofficeProyecto", "fotofficeProductoProyecto", "fotofficeProyectoRol", "fotofficeProyectoParticipante",
  "fotofficeProyectoNota", "fotofficeProyectoAdjunto", "fotofficeProyectoEtapaPlan",
  // Agenda (etapa 4, Entrega B).
  "fotofficeCitaTipo", "fotofficeCita", "fotofficeCitaParticipante", "fotofficeProductoCita", "fotofficeAgendaAjustes",
  "fotofficeCitaRecordatorio",
  // Contratos (etapa 5).
  "fotofficeContratoPlantilla", "fotofficePedidoContratante", "fotofficeContrato", "fotofficeContratoVersion",
  "fotofficeContratoFirmante", "fotofficeContratoEvento", "fotofficeContratoAjustes",
  // Galería (etapa 7).
  "fotofficeGaleria", "fotofficeGaleriaFoto", "fotofficeGaleriaCliente", "fotofficeGaleriaSeleccion", "fotofficeGaleriaComentario", "fotofficeGaleriaEvento",
  "fotofficeGaleriaAjustes",
  // Caja (los cobros de pedidos depositan y se anulan con contramovimiento), módulos encendidos y adjuntos.
  "cashAccount", "cashShift", "cashMovement", "workspaceFeatureModule", "fotofficeAttachment",
  // Perfil de precios del workspace.
  "fotofficePerfilPrecios",
] as const;
export type Tabla = (typeof TABLAS)[number];

/** Relación → (columna con el id, tabla de destino). */
const RELACIONES: Record<string, { columna: string; tabla: Tabla }> = {
  circuit: { columna: "circuitId", tabla: "fotofficeCircuit" },
  stage: { columna: "stageId", tabla: "fotofficeStage" },
  journey: { columna: "journeyId", tabla: "fotofficeJourney" },
  field: { columna: "fieldId", tabla: "fotofficeCustomField" },
};

const DEFECTOS: Partial<Record<Tabla, () => Fila>> = {
  fotofficeCircuit: () => ({ isActive: true, isDefault: false, createdAt: new Date() }),
  fotofficeStage: () => ({ color: "gris", days: 0, requireTasks: false, leadStatus: null, archivedAt: null }),
  fotofficeStageTaskTemplate: () => ({ days: 0, required: false }),
  fotofficeLossReason: () => ({ order: 0, isActive: true }),
  fotofficeJourney: () => ({
    stageId: null, outcome: null, lossReasonId: null, enteredStageAt: new Date(), stageDueAt: null,
    ownerUserId: null, closedAt: null, createdAt: new Date(),
  }),
  fotofficeJourneyStep: () => ({
    fromStageId: null, toStageId: null, outcome: null, note: null, auto: false, event: null,
    forcedWithPendingTasks: false, actorUserId: null, createdAt: new Date(),
  }),
  fotofficeTask: () => ({
    journeyId: null, stageId: null, dueAt: null, assigneeUserId: null, required: false, doneAt: null,
    doneByUserId: null, createdByUserId: null, createdAt: new Date(),
  }),
  serviceSalesLead: () => ({ status: "NEW", eventDate: null, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeCustomField: () => ({ required: false, showInList: false, order: 0, archivedAt: null, createdAt: new Date() }),
  fotofficeCustomFieldOption: () => ({ order: 0, archivedAt: null }),
  fotofficeCustomValue: () => ({
    valueText: null, valueNumber: null, valueDate: null, valueBool: null, optionId: null, updatedAt: new Date(),
    updatedByUserId: null,
  }),
  fotofficeCustomValueChange: () => ({ before: null, after: null, actorUserId: null, actorLabel: null, createdAt: new Date() }),
  fotofficeSequence: () => ({ prefix: "", withYear: false, digits: 1, nextValue: 1, currentYear: null }),
  fotofficeSequenceChange: () => ({ before: null, after: null, actorUserId: null, actorLabel: null, createdAt: new Date() }),
  fotofficeRecordNumber: () => ({ year: null, createdAt: new Date() }),
  fotofficeMessageTemplate: () => ({
    subject: null, systemKey: null, enabled: false, order: 0, archivedAt: null, createdAt: new Date(), updatedAt: new Date(),
    updatedByUserId: null,
  }),
  fotofficeMessage: () => ({
    templateId: null, subject: null, automatic: false, providerId: null, errorCode: null, actorUserId: null, actorLabel: null,
    createdAt: new Date(),
  }),
  clientAudit: () => ({ actorUserId: null, changesJson: null, createdAt: new Date() }),
  fotofficeContactoPerfil: () => ({
    category: "CLIENTE", mobile: null, email2: null, birthday: null, website: null, province: null, country: null,
    postalCode: null, about: null, updatedAt: new Date(),
  }),
  fotofficeConsulta: () => ({
    originId: null, referrerClientId: null, estimatedValue: null, expectedCloseDate: null, eventStartsAt: null,
    eventTimeKnown: false, venue: null, ceremonyVenue: null, receptionVenue: null, city: null, guests: null,
    partnerOneName: null, partnerTwoName: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeConsultaCategoria: () => ({ order: 0, archivedAt: null, legacyEventType: null, createdAt: new Date() }),
  fotofficeOrigen: () => ({ order: 0, archivedAt: null, createdAt: new Date() }),
  fotofficeRolParticipante: () => ({ order: 0, archivedAt: null, createdAt: new Date() }),
  fotofficeConsultaParticipante: () => ({ note: null, createdAt: new Date() }),
  fotofficeConsultaAjustes: () => ({ defaultOwnerUserId: null, notifyEmail: true, createTask: true, updatedAt: new Date() }),
  product: () => ({ kind: "PRODUCTO", categoryId: null, isActive: true, costArs: null, createdAt: new Date(), updatedAt: new Date() }),
  productCategory: () => ({ order: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeProductoCatalogo: () => ({
    inPriceList: false, incomeLabel: null, incomeCategoryId: null, isCombo: false, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeComboItem: () => ({ quantity: 1, order: 0, createdAt: new Date() }),
  fotofficeCostoPlantilla: () => ({ supplierClientId: null, perUnit: false, daysFromEvent: 0, order: 0, createdAt: new Date(), updatedAt: new Date() }),
  fotofficePresupuesto: () => ({
    status: "BORRADOR", currentVersionId: null, acceptedVersionId: null, ownerUserId: null, validUntil: null,
    pedidoPorConfirmar: false, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficePresupuestoVersion: () => ({
    terms: null, paymentProposal: null, paymentOptions: null, chosenPaymentOptionId: null, costSnapshot: null,
    createdByUserId: null, createdAt: new Date(), sentAt: null,
    tokenHash: null, tokenExpiresAt: null, revokedAt: null, acceptedAt: null, acceptedName: null, acceptedIpHash: null,
    acceptedUserAgent: null,
  }),
  fotofficePresupuestoVista: () => ({ viewedAt: new Date(), ipHash: null, userAgent: null }),
  fotofficePresupuestoAjustes: () => ({
    validityDays: 15, terms: null, paymentProposal: null, paymentOptions: null, followUpDays: 3, followUpEnabled: false,
    updatedAt: new Date(),
  }),
  fotofficePropuestaModelo: () => ({ terms: null, autoSendOnWeb: false, templateId: null, updatedAt: new Date(), updatedByUserId: null }),
  fotofficePropuestaBorradorAuto: () => ({ createdAt: new Date(), createdByUserId: null }),
  cashCategory: () => ({ isActive: true, order: 0, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeRubro: () => ({ parentCategoryId: null, code: null, createdAt: new Date(), updatedAt: new Date() }),
  fotofficePedido: () => ({
    presupuestoId: null, acceptedVersionId: null, consultaLeadId: null, status: "CONFIRMADO", cancelReason: null,
    paymentOption: null, eventDate: null, eventLabel: null, incomeCategoryId: null, ownerUserId: null, accessTokenHash: null,
    createdByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficePedidoCuota: () => ({ suggestedMethod: null, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeCobro: () => ({
    feeArs: null, netArs: null, providerPaymentRef: null, cashMovementId: null, attachmentId: null, voidedAt: null,
    voidReason: null, voidCashMovementId: null, idempotencyKey: null, createdByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeCobroImputacion: () => ({ createdAt: new Date() }),
  fotofficeCuentaPagar: () => ({
    pedidoId: null, supplierClientId: null, costoPlantillaId: null, dueDate: null, costCategoryId: null, paidAt: null,
    paidMethod: null, paidCashMovementId: null, voidedAt: null, voidReason: null, voidCashMovementId: null,
    idempotencyKey: null, createdByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeCuotaRecordatorio: () => ({ sentAt: new Date() }),
  fotofficePedidoAjustes: () => ({
    reminderDays: 1, reminderEnabled: false, incomeCategoryId: null, checklistTemplates: null, updatedAt: new Date(),
  }),
  fotofficePedidoTarea: () => ({ doneAt: null, doneByUserId: null, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeProyecto: () => ({
    pedidoId: null, pedidoItemIndex: null, productId: null, eventDate: null, finalDueDate: null, ownerUserId: null,
    delegateUserId: null, description: null, suspendedAt: null, suspendReason: null, externalId: null,
    createdByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeProductoProyecto: () => ({
    ownerUserId: null, daysFromEvent: 0, nameTemplate: null, order: 0, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeProyectoRol: () => ({ order: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeProyectoParticipante: () => ({ userId: null, clientId: null, roleId: null, note: null, createdAt: new Date() }),
  fotofficeProyectoNota: () => ({ authorUserId: null, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeProyectoAdjunto: () => ({
    status: "PENDIENTE", uploadedByUserId: null, deletedAt: null, purgeAfter: null, createdAt: new Date(),
  }),
  fotofficeCitaTipo: () => ({ color: "#6b7280", order: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeCita: () => ({
    status: "AGENDADA", allDay: false, typeId: null, location: null, notes: null, ownerUserId: null, clientId: null,
    proyectoId: null, pedidoId: null, consultaLeadId: null, reglaId: null, pedidoItemIndex: null, googleEventId: null,
    googleEtag: null, googleUpdatedAt: null, createdByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeCitaParticipante: () => ({ userId: null, clientId: null, roleId: null, note: null, createdAt: new Date() }),
  fotofficeProductoCita: () => ({
    typeId: null, title: null, daysFromEvent: 0, startTime: null, durationMinutes: 60, ownerUserId: null, order: 0,
    createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeAgendaAjustes: () => ({
    googleCalendarId: null, googleSyncToken: null, googleLastSyncAt: null, defaultLayers: null, reminderEnabled: false,
    reminderHours: 24, updatedAt: new Date(),
  }),
  fotofficeCitaRecordatorio: () => ({ sentAt: new Date() }),
  fotofficeContratoPlantilla: () => ({ isActive: true, order: 0, createdAt: new Date(), updatedAt: new Date() }),
  fotofficePedidoContratante: () => ({ createdAt: new Date() }),
  fotofficeContrato: () => ({
    templateId: null, status: "BORRADOR", currentVersionId: null, sentAt: null, signedAt: null, rejectedAt: null,
    voidedAt: null, voidReason: null, pdfKey: null, pdfHash: null, pdfSentAt: null, manualSignedAt: null,
    manualAttachmentId: null, ownerUserId: null, createdByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeContratoVersion: () => ({ revokedAt: null }),
  fotofficeContratoFirmante: () => ({
    clientId: null, docNumber: null, viewedAt: null, codeHash: null, codeExpiresAt: null, codeAttempts: 0,
    codesSentInWindow: 0, codeWindowStart: null, verifiedAt: null, typedName: null, signatureKey: null, signedAt: null,
    ipHash: null, userAgent: null, rejectedAt: null, rejectReason: null, lastReminderAt: null,
  }),
  fotofficeContratoEvento: () => ({ firmanteId: null, actorUserId: null, data: null, createdAt: new Date() }),
  fotofficeContratoAjustes: () => ({
    companySignatureKey: null, companyName: null, companyTaxId: null, companyAddress: null, consentClause: null,
    reminderEnabled: false, reminderDays: 3, updatedAt: new Date(),
  }),
  fotofficeGaleria: () => ({
    message: null, saleMode: "SELECCION", kind: "SELECCION", selectionMode: "LIBRE", minSelect: null, maxSelect: null,
    allowComments: true, downloadMode: "VISTA", status: "BORRADOR", coverFotoId: null, orderMode: "NOMBRE", publishedAt: null,
    archivedAt: null, ownerUserId: null, createdByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeGaleriaFoto: () => ({
    viewKey: null, thumbKey: null, status: "PENDIENTE", errorReason: null, sizeBytes: null, width: null, height: null, order: 0,
    attempts: 0, uploadedByUserId: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeGaleriaCliente: () => ({
    clientId: null, email: null, phone: null, revokedAt: null, status: "EN_PROGRESO", firstSeenAt: null, lastSeenAt: null,
    submittedAt: null, submitMessage: null, finalizedAt: null, reopenedAt: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  fotofficeGaleriaSeleccion: () => ({ createdAt: new Date() }),
  fotofficeGaleriaComentario: () => ({ authorUserId: null, createdAt: new Date() }),
  fotofficeGaleriaEvento: () => ({ galeriaClienteId: null, actorUserId: null, data: null, createdAt: new Date() }),
  fotofficeGaleriaAjustes: () => ({
    defaultMessage: null, defaultSelectionMode: "LIBRE", defaultAllowComments: true, defaultDownloadMode: "VISTA", updatedAt: new Date(),
  }),
  cashAccount: () => ({ kind: "EFECTIVO", isVault: false, isDefault: false, isActive: true, order: 0, fixedFloatArs: null }),
  cashShift: () => ({ status: "ABIERTO", openedAt: new Date(), closedAt: null }),
  cashMovement: () => ({
    shiftId: null, categoryId: null, paymentMethod: "EFECTIVO", clientId: null, receiptRef: null, sourceModule: "manual",
    sourceRef: null, reversesMovementId: null, reverseReason: null, transferId: null, createdByUserId: null, createdAt: new Date(),
  }),
  workspaceFeatureModule: () => ({ enabled: false, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeAttachment: () => ({ clientId: null, memberId: null, status: "LISTO", deletedAt: null, createdAt: new Date() }),
  fotofficePerfilPrecios: () => ({ schemaVersion: 1, source: null, updatedAt: new Date(), updatedByUserId: null }),
};

function igual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function clonar(v: unknown): unknown {
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(clonar);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clonar(x)]));
  return v;
}

export function crearBaseEnMemoria() {
  const datos = Object.fromEntries(TABLAS.map((t) => [t, [] as Fila[]])) as Record<Tabla, Fila[]>;
  let secuencia = 0;
  const transacciones: { opciones: unknown }[] = [];

  function cumple(f: Fila, where: Where | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([k, cond]) => {
      if (cond === undefined) return true;
      if (k === "OR") return (cond as Where[]).some((w) => cumple(f, w));
      if (k === "AND") return (cond as Where[]).every((w) => cumple(f, w));
      const rel = RELACIONES[k];
      if (rel && cond && typeof cond === "object") {
        const destino = datos[rel.tabla].find((x) => x.id === f[rel.columna]);
        return destino !== undefined && cumple(destino, cond as Where);
      }
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Record<string, unknown>;
        const v = f[k] ?? null;
        const n = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number | string));
        return Object.entries(c).every(([op, x]) => {
          if (x === undefined) return true;
          if (op === "in") return (x as unknown[]).some((y) => igual(v, y));
          if (op === "notIn") return !(x as unknown[]).some((y) => igual(v, y));
          if (op === "not") return !igual(v, x);
          // `mode` sólo modifica a `contains` y `equals`.
          if (op === "mode") return true;
          if (v === null) return false;
          if (op === "equals") {
            if (c.mode !== "insensitive") return igual(v, x);
            return String(v).toLowerCase() === String(x).toLowerCase();
          }
          if (op === "contains") {
            const a = String(v), b = String(x);
            return c.mode === "insensitive" ? a.toLowerCase().includes(b.toLowerCase()) : a.includes(b);
          }
          if (op === "lt") return n(v) < n(x);
          if (op === "lte") return n(v) <= n(x);
          if (op === "gt") return n(v) > n(x);
          if (op === "gte") return n(v) >= n(x);
          throw new Error(`Filtro no soportado en ${k}: ${op}`);
        });
      }
      return igual(f[k] ?? null, cond);
    });
  }

  function elegir(f: Fila, select?: Record<string, boolean>): Fila {
    const copia = clonar(f) as Fila;
    if (!select) return copia;
    return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, copia[k]]));
  }

  function ordenar(filas: Fila[], orderBy?: Orden | Orden[]): Fila[] {
    if (!orderBy) return filas;
    const claves = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
    return [...filas].sort((a, b) => {
      for (const [k, dir] of claves) {
        const va = a[k] instanceof Date ? (a[k] as Date).getTime() : (a[k] as number | string);
        const vb = b[k] instanceof Date ? (b[k] as Date).getTime() : (b[k] as number | string);
        if (va < vb) return dir === "asc" ? -1 : 1;
        if (va > vb) return dir === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  /** Índices únicos que el motor usa para detectar carreras y repeticiones. */
  type Unico = { columnas: string[]; aplica?: (f: Fila) => boolean };
  const UNICOS: Partial<Record<Tabla, Unico[]>> = {
    fotofficeJourney: [{ columnas: ["workspaceId", "subjectType", "subjectId", "kind"], aplica: (f) => f.closedAt === null }],
    fotofficeProcessedEvent: [{ columnas: ["journeyId", "event", "sourceRef"] }],
    fotofficeCustomField: [{ columnas: ["workspaceId", "entityType", "key"] }],
    fotofficeCustomValue: [{ columnas: ["fieldId", "entityId"] }],
    fotofficeSequence: [{ columnas: ["workspaceId", "key"] }],
    // Como en la migración: uno común y dos parciales (con año / sin año).
    fotofficeRecordNumber: [
      { columnas: ["entityType", "entityId"] },
      { columnas: ["workspaceId", "sequenceKey", "year", "value"], aplica: (f) => f.year !== null && f.year !== undefined },
      { columnas: ["workspaceId", "sequenceKey", "value"], aplica: (f) => f.year === null || f.year === undefined },
    ],
    // Como en la migración: único parcial donde systemKey no es null.
    fotofficeMessageTemplate: [
      { columnas: ["workspaceId", "systemKey"], aplica: (f) => f.systemKey !== null && f.systemKey !== undefined },
    ],
    // Las pruebas viejas cargan clientes sin número: el único sólo aplica a los que lo tienen.
    client: [{ columnas: ["workspaceId", "clientNumber"], aplica: (f) => f.clientNumber !== null && f.clientNumber !== undefined }],
    // Etapa 1: los de la migración.
    fotofficeContactoPerfil: [{ columnas: ["clientId"] }],
    fotofficeConsulta: [{ columnas: ["leadId"] }],
    fotofficeConsultaCategoria: [{ columnas: ["workspaceId", "name"] }],
    fotofficeOrigen: [{ columnas: ["workspaceId", "name"] }],
    fotofficeRolParticipante: [{ columnas: ["workspaceId", "name"] }],
    fotofficeConsultaParticipante: [{ columnas: ["consultaId", "clientId", "roleId"] }],
    fotofficeConsultaAjustes: [{ columnas: ["workspaceId"] }],
    // Etapa 2: los de la migración (y el de categorías de Ventas, que ya existía).
    productCategory: [{ columnas: ["workspaceId", "name"] }],
    fotofficeProductoCatalogo: [{ columnas: ["productId"] }],
    fotofficeComboItem: [{ columnas: ["comboProductId", "componentProductId"] }],
    fotofficePresupuesto: [
      { columnas: ["currentVersionId"], aplica: (f) => f.currentVersionId !== null && f.currentVersionId !== undefined },
      { columnas: ["acceptedVersionId"], aplica: (f) => f.acceptedVersionId !== null && f.acceptedVersionId !== undefined },
    ],
    fotofficePresupuestoVersion: [
      { columnas: ["presupuestoId", "number"] },
      { columnas: ["tokenHash"], aplica: (f) => f.tokenHash !== null && f.tokenHash !== undefined },
    ],
    fotofficePresupuestoAjustes: [{ columnas: ["workspaceId"] }],
    fotofficePropuestaModelo: [{ columnas: ["workspaceId", "categoryId"] }],
    fotofficePropuestaBorradorAuto: [{ columnas: ["workspaceId", "categoryId"] }],
    // Etapa 3.
    cashCategory: [{ columnas: ["workspaceId", "kind", "name"] }],
    fotofficeRubro: [{ columnas: ["categoryId"] }],
    // Los de la migración de pedidos (los que admiten nulo, sólo con valor, como en Postgres).
    fotofficePedido: [
      { columnas: ["workspaceId", "number"] },
      { columnas: ["presupuestoId"], aplica: (f) => f.presupuestoId !== null && f.presupuestoId !== undefined },
      { columnas: ["accessTokenHash"], aplica: (f) => f.accessTokenHash !== null && f.accessTokenHash !== undefined },
    ],
    fotofficeCobro: [
      { columnas: ["workspaceId", "receiptNumber"] },
      { columnas: ["receiptTokenHash"] },
      { columnas: ["cashMovementId"], aplica: (f) => f.cashMovementId !== null && f.cashMovementId !== undefined },
      { columnas: ["voidCashMovementId"], aplica: (f) => f.voidCashMovementId !== null && f.voidCashMovementId !== undefined },
      { columnas: ["providerPaymentRef"], aplica: (f) => f.providerPaymentRef !== null && f.providerPaymentRef !== undefined },
      { columnas: ["workspaceId", "idempotencyKey"], aplica: (f) => f.idempotencyKey !== null && f.idempotencyKey !== undefined },
    ],
    fotofficeCobroImputacion: [{ columnas: ["cobroId", "cuotaId"] }],
    // Entrega B1: los de la migración de cuentas a pagar.
    fotofficeCuentaPagar: [
      { columnas: ["paidCashMovementId"], aplica: (f) => f.paidCashMovementId !== null && f.paidCashMovementId !== undefined },
      { columnas: ["voidCashMovementId"], aplica: (f) => f.voidCashMovementId !== null && f.voidCashMovementId !== undefined },
      { columnas: ["workspaceId", "idempotencyKey"], aplica: (f) => f.idempotencyKey !== null && f.idempotencyKey !== undefined },
    ],
    // El vencimiento es una fecha: se compara por valor (`igual`).
    fotofficeCuotaRecordatorio: [{ columnas: ["cuotaId", "dueDate"] }],
    fotofficePedidoAjustes: [{ columnas: ["workspaceId"] }],
    // Etapa 4, Entrega A: los de la migración de proyectos (los que admiten nulo, sólo con valor).
    fotofficeProyecto: [
      { columnas: ["workspaceId", "number"] },
      {
        columnas: ["pedidoId", "pedidoItemIndex", "circuitId"],
        aplica: (f) => f.pedidoId !== null && f.pedidoId !== undefined && f.pedidoItemIndex !== null && f.pedidoItemIndex !== undefined,
      },
    ],
    fotofficeProyectoRol: [{ columnas: ["workspaceId", "name"] }],
    fotofficeProyectoAdjunto: [{ columnas: ["storageKey"] }],
    fotofficeProyectoEtapaPlan: [{ columnas: ["proyectoId", "stageId"] }],
    // Etapa 4, Entrega B: los de la migración de agenda (los que admiten nulo, sólo con valor).
    fotofficeCitaTipo: [{ columnas: ["workspaceId", "name"] }],
    fotofficeCita: [
      { columnas: ["workspaceId", "googleEventId"], aplica: (f) => f.googleEventId !== null && f.googleEventId !== undefined },
      {
        columnas: ["pedidoId", "pedidoItemIndex", "reglaId"],
        aplica: (f) =>
          f.pedidoId !== null && f.pedidoId !== undefined && f.pedidoItemIndex !== null && f.pedidoItemIndex !== undefined &&
          f.reglaId !== null && f.reglaId !== undefined,
      },
    ],
    fotofficeAgendaAjustes: [{ columnas: ["workspaceId"] }],
    fotofficeCitaRecordatorio: [{ columnas: ["citaId", "startAt"] }],
    // Etapa 5: los de la migración de contratos.
    fotofficeContratoPlantilla: [{ columnas: ["workspaceId", "name"] }],
    fotofficePedidoContratante: [{ columnas: ["pedidoId", "orden"] }],
    fotofficeContrato: [
      { columnas: ["workspaceId", "number"] },
      { columnas: ["currentVersionId"], aplica: (f) => f.currentVersionId !== null && f.currentVersionId !== undefined },
    ],
    fotofficeContratoVersion: [{ columnas: ["contratoId", "number"] }],
    fotofficeContratoFirmante: [{ columnas: ["tokenHash"] }],
    fotofficeContratoAjustes: [{ columnas: ["workspaceId"] }],
    // Etapa 7: los de la migración de galerías.
    fotofficeGaleria: [{ columnas: ["workspaceId", "number"] }],
    fotofficeGaleriaCliente: [
      { columnas: ["tokenHash"] },
      { columnas: ["galeriaId", "clientId"], aplica: (f) => f.clientId !== null && f.clientId !== undefined },
    ],
    fotofficeGaleriaSeleccion: [{ columnas: ["galeriaClienteId", "fotoId"] }],
    fotofficeGaleriaAjustes: [{ columnas: ["workspaceId"] }],
    // Caja: el depósito automático es idempotente por (sourceModule, sourceRef); un asiento se anula una vez.
    cashMovement: [
      { columnas: ["sourceModule", "sourceRef"], aplica: (f) => f.sourceRef !== null && f.sourceRef !== undefined },
      { columnas: ["reversesMovementId"], aplica: (f) => f.reversesMovementId !== null && f.reversesMovementId !== undefined },
    ],
    workspaceFeatureModule: [{ columnas: ["workspaceId", "moduleKey"] }],
    fotofficePerfilPrecios: [{ columnas: ["workspaceId"] }],
  };

  /**
   * `where` de un `findUnique`/`update`/`upsert`: aplana las claves compuestas de Prisma
   * (`workspaceId_clientNumber: { workspaceId, clientNumber }`) a igualdades comunes.
   */
  function aplanarUnico(where: Where): Where {
    const out: Where = {};
    for (const [k, v] of Object.entries(where)) {
      if (k.includes("_") && v && typeof v === "object" && !(v instanceof Date)) Object.assign(out, v);
      else out[k] = v;
    }
    return out;
  }

  function verificarUnicidad(tabla: Tabla, f: Fila) {
    for (const u of UNICOS[tabla] ?? []) {
      if (u.aplica && !u.aplica(f)) continue;
      const choca = datos[tabla].some((x) => x !== f && (!u.aplica || u.aplica(x)) && u.columnas.every((c) => igual(x[c], f[c])));
      if (choca) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    }
  }

  function insertar(tabla: Tabla, data: Fila): Fila {
    const f: Fila = { id: `${tabla}-${++secuencia}`, ...(DEFECTOS[tabla]?.() ?? {}), ...(clonar(data) as Fila) };
    verificarUnicidad(tabla, f);
    datos[tabla].push(f);
    return f;
  }

  function delegado(tabla: Tabla) {
    return {
      findFirst: async (a: { where?: Where; select?: Record<string, boolean>; orderBy?: Orden | Orden[] } = {}) => {
        const f = ordenar(datos[tabla].filter((x) => cumple(x, a.where)), a.orderBy)[0];
        return f ? elegir(f, a.select) : null;
      },
      findMany: async (a: { where?: Where; select?: Record<string, boolean>; orderBy?: Orden | Orden[]; take?: number } = {}) =>
        ordenar(datos[tabla].filter((x) => cumple(x, a.where)), a.orderBy).slice(0, a.take ?? Infinity).map((x) => elegir(x, a.select)),
      count: async (a: { where?: Where } = {}) => datos[tabla].filter((x) => cumple(x, a.where)).length,
      findUnique: async (a: { where: Where; select?: Record<string, boolean> }) => {
        const f = datos[tabla].find((x) => cumple(x, aplanarUnico(a.where)));
        return f ? elegir(f, a.select) : null;
      },
      findUniqueOrThrow: async (a: { where: Where; select?: Record<string, boolean> }) => {
        const f = datos[tabla].find((x) => cumple(x, aplanarUnico(a.where)));
        if (!f) throw Object.assign(new Error("No record was found"), { code: "P2025" });
        return elegir(f, a.select);
      },
      /** Como Prisma: el `where` es único y, si no hay fila, lanza P2025. */
      update: async (a: { where: Where; data: Fila; select?: Record<string, boolean> }) => {
        const f = datos[tabla].find((x) => cumple(x, aplanarUnico(a.where)));
        if (!f) throw Object.assign(new Error("Record to update not found"), { code: "P2025" });
        Object.assign(f, clonar(a.data));
        verificarUnicidad(tabla, f);
        return elegir(f, a.select);
      },
      upsert: async (a: { where: Where; create: Fila; update: Fila; select?: Record<string, boolean> }) => {
        const f = datos[tabla].find((x) => cumple(x, aplanarUnico(a.where)));
        if (!f) return elegir(insertar(tabla, a.create), a.select);
        Object.assign(f, clonar(a.update));
        verificarUnicidad(tabla, f);
        return elegir(f, a.select);
      },
      /** Mínimo: agrupa por columnas y sólo admite `_count: true` (cantidad de filas por grupo). */
      groupBy: async (a: { by: string[]; where?: Where; _count?: true }) => {
        const grupos = new Map<string, Fila>();
        for (const x of datos[tabla].filter((f) => cumple(f, a.where))) {
          const clave = JSON.stringify(a.by.map((c) => x[c] ?? null));
          const g = grupos.get(clave) ?? { ...Object.fromEntries(a.by.map((c) => [c, x[c] ?? null])), _count: 0 };
          g._count = (g._count as number) + 1;
          grupos.set(clave, g);
        }
        return [...grupos.values()];
      },
      create: async (a: { data: Fila; select?: Record<string, boolean> }) => elegir(insertar(tabla, a.data), a.select),
      /** Con `skipDuplicates` (ON CONFLICT DO NOTHING) saltea las filas que chocan con un único. */
      createMany: async (a: { data: Fila[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const d of a.data) {
          try {
            insertar(tabla, d);
            count++;
          } catch (e) {
            if (!a.skipDuplicates || (e as { code?: unknown }).code !== "P2002") throw e;
          }
        }
        return { count };
      },
      updateMany: async (a: { where?: Where; data: Fila }) => {
        const hits = datos[tabla].filter((x) => cumple(x, a.where));
        for (const h of hits) {
          Object.assign(h, clonar(a.data));
          verificarUnicidad(tabla, h);
        }
        return { count: hits.length };
      },
      deleteMany: async (a: { where?: Where } = {}) => {
        const antes = datos[tabla].length;
        datos[tabla] = datos[tabla].filter((x) => !cumple(x, a.where));
        return { count: antes - datos[tabla].length };
      },
    };
  }

  type Delegado = ReturnType<typeof delegado>;
  /** Los métodos reales de cada tabla. Lo usan el `prisma` global y cada `tx`. */
  const tablas = Object.fromEntries(TABLAS.map((t) => [t, delegado(t)])) as Record<Tabla, Delegado>;
  let abiertas = 0;

  /** Cliente que llama a `tablas` en el momento (así ve los reemplazos) si `permitido()` lo deja. */
  /** SQL crudo recibido (`$executeRaw` sólo se registra: el bloqueo de la base real acá no hace nada). */
  const sql: { texto: string; valores: unknown[] }[] = [];
  /** Se llama con cada SQL crudo ($executeRaw y $queryRaw), dentro de la transacción: sirve para simular otra corrida. */
  const ganchos: { alEjecutarSql: ((texto: string, valores: unknown[]) => void) | null } = { alEjecutarSql: null };

  function cliente(permitido: () => string | null): Record<string, unknown> {
    const c: Record<string, unknown> = Object.fromEntries(
      TABLAS.map((t) => [
        t,
        new Proxy({}, {
          get: (_o, metodo: string) => async (...args: unknown[]) => {
            const error = permitido();
            if (error) throw new Error(error);
            return (tablas[t] as unknown as Record<string, (...a: unknown[]) => unknown>)[metodo]!(...args);
          },
        }),
      ]),
    );
    c.$executeRaw = async (partes: TemplateStringsArray, ...valores: unknown[]) => {
      const error = permitido();
      if (error) throw new Error(error);
      const texto = partes.join("$");
      sql.push({ texto, valores });
      ganchos.alEjecutarSql?.(texto, valores);
      return 1;
    };
    c.$queryRaw = async (partes: TemplateStringsArray, ...valores: unknown[]) => {
      const error = permitido();
      if (error) throw new Error(error);
      const texto = partes.join("$");
      sql.push({ texto, valores });
      ganchos.alEjecutarSql?.(texto, valores);
      return emularConsulta(texto, valores);
    };
    return c;
  }

  /**
   * Sólo emula el SQL crudo que el motor usa, reconocido por su comentario; cualquier otro
   * lanza. "consultas-sin-recorrido": consultas del workspace sin ningún recorrido de venta;
   * "consultas-sin-numero" y "consultas-pendientes": las de la numeración de Captación (0.5).
   */
  function emularConsulta(texto: string, valores: unknown[]): unknown[] {
    if (texto.includes("numeracion-asignar")) return emularAsignacion(valores);
    if (texto.includes("numeracion-candado")) return emularCandado(valores);
    if (texto.includes("numeracion-anio-anterior")) return emularAnioAnterior(valores);
    const workspaceId = valores[0];
    const tieneRecorrido = (l: Fila) =>
      datos.fotofficeJourney.some(
        (j) => j.workspaceId === l.workspaceId && j.subjectType === "CAPTACION" && j.subjectId === l.id && j.kind === "VENTA",
      );
    const tieneNumero = (l: Fila) => datos.fotofficeRecordNumber.some((r) => r.entityType === "CONSULTA" && r.entityId === l.id);
    const delWorkspace = datos.serviceSalesLead.filter((l) => l.workspaceId === workspaceId);
    // "consultas-pendientes: cuenta": sin recorrido de venta o sin número.
    if (texto.includes("consultas-pendientes: cuenta")) {
      return [{ n: BigInt(delWorkspace.filter((l) => !tieneRecorrido(l) || !tieneNumero(l)).length) }];
    }
    // "consultas-sin-numero": lista (workspaceId, límite) u otra (workspaceId, id a excluir).
    if (texto.includes("consultas-sin-numero: lista")) {
      return ordenar(delWorkspace.filter((l) => !tieneNumero(l)), [{ createdAt: "asc" }, { id: "asc" }])
        .slice(0, valores[1] as number)
        .map((l) => elegir(l, { id: true, createdAt: true }));
    }
    if (texto.includes("consultas-sin-numero: otra")) {
      return delWorkspace.some((l) => l.id !== valores[1] && !tieneNumero(l)) ? [{ hay: 1 }] : [];
    }
    // "consultas-sin-ficha" (etapa 1): consultas sin `FotofficeConsulta`. Lista (workspaceId,
    // límite) o cuenta (workspaceId).
    const sinFicha = () => delWorkspace.filter((l) => !datos.fotofficeConsulta.some((c) => c.leadId === l.id));
    if (texto.includes("consultas-sin-ficha: cuenta")) return [{ n: BigInt(sinFicha().length) }];
    if (texto.includes("consultas-sin-ficha: lista")) {
      return ordenar(sinFicha(), [{ createdAt: "asc" }, { id: "asc" }])
        .slice(0, valores[1] as number)
        .map((l) => elegir(l))
        .map((l) => ({
          id: l.id, name: l.name, email: l.email ?? null, phone: l.phone ?? null, eventType: l.eventType,
          eventDate: l.eventDate ?? null, eventLocation: l.eventLocation ?? null,
        }));
    }
    if (!texto.includes("consultas-sin-recorrido")) throw new Error("SQL crudo no emulado en la base en memoria");
    const sinRecorrido = delWorkspace.filter((l) => !tieneRecorrido(l));
    if (texto.includes("consultas-sin-recorrido: cuenta")) return [{ n: BigInt(sinRecorrido.length) }];
    const [, conPerdidas, limite] = valores as [string, boolean, number];
    return ordenar(sinRecorrido.filter((l) => conPerdidas || l.status !== "LOST"), [{ createdAt: "asc" }, { id: "asc" }])
      .slice(0, limite)
      .map((l) => elegir(l, { id: true, status: true, createdAt: true, updatedAt: true }));
  }

  /**
   * "numeracion-candado": el SELECT … FOR UPDATE de `lib/numeracion/asignar.ts` (acá no hay
   * concurrencia: sólo lee). Parámetros: workspaceId y key.
   */
  function emularCandado(valores: unknown[]): unknown[] {
    const [ws, key] = valores as [string, string];
    const s = datos.fotofficeSequence.find((x) => x.workspaceId === ws && x.key === key);
    if (!s) return [];
    return [{ prefix: s.prefix, withYear: s.withYear, digits: s.digits, currentYear: s.currentYear === null ? null : BigInt(s.currentYear as number) }];
  }

  /**
   * "numeracion-anio-anterior": MAX(value) + 1 de los números de ese año. Parámetros: workspaceId,
   * key y año. Devuelve `value` como bigint.
   */
  function emularAnioAnterior(valores: unknown[]): unknown[] {
    const [ws, key, anio] = valores as [string, string, number];
    const usados = datos.fotofficeRecordNumber
      .filter((r) => r.workspaceId === ws && r.sequenceKey === key && r.year === anio)
      .map((r) => r.value as number);
    return [{ value: BigInt(Math.max(0, ...usados) + 1) }];
  }

  /**
   * "numeracion-asignar": el UPDATE … RETURNING de `lib/numeracion/asignar.ts`. Parámetros: el
   * año (CASE, subconsulta, currentYear), workspaceId, key y el año de la condición final (no
   * actualiza si la secuencia lleva año y su año es posterior). Devuelve lo mismo que el
   * RETURNING (con `value` y `year` como bigint, como puede llegar de Prisma).
   */
  function emularAsignacion(valores: unknown[]): unknown[] {
    const [anio, , , ws, key, anioCondicion] = valores as [number, number, number, string, string, number];
    const s = datos.fotofficeSequence.find((x) => x.workspaceId === ws && x.key === key);
    if (!s) return [];
    if (s.withYear && s.currentYear !== null && (s.currentYear as number) > anioCondicion) return [];
    if (s.withYear && s.currentYear !== anio) {
      const usados = datos.fotofficeRecordNumber
        .filter((r) => r.workspaceId === ws && r.sequenceKey === key && r.year === anio)
        .map((r) => r.value as number);
      s.nextValue = Math.max(0, ...usados) + 2;
    } else {
      s.nextValue = (s.nextValue as number) + 1;
    }
    s.currentYear = s.withYear ? anio : null;
    return [{
      value: BigInt((s.nextValue as number) - 1),
      year: s.currentYear === null ? null : BigInt(s.currentYear as number),
      prefix: s.prefix, withYear: s.withYear, digits: s.digits,
    }];
  }

  /** La foto de la transacción abierta (lo que se restaura si lanza). */
  let fotoAbierta: Record<Tabla, Fila[]> | null = null;

  const FUERA = "uso de prisma fuera de la transacción";
  const prisma: Record<string, unknown> = cliente(() => (abiertas > 0 ? FUERA : null));
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>, opciones?: unknown) => {
    if (abiertas > 0) throw new Error(FUERA);
    transacciones.push({ opciones });
    const foto = Object.fromEntries(TABLAS.map((t) => [t, datos[t].map((f) => clonar(f) as Fila)])) as Record<Tabla, Fila[]>;
    let viva = true;
    const tx = cliente(() => (viva ? null : "uso de tx con la transacción ya terminada"));
    fotoAbierta = foto;
    abiertas++;
    try {
      return await fn(tx);
    } catch (error) {
      for (const t of TABLAS) datos[t] = foto[t];
      throw error;
    } finally {
      viva = false;
      abiertas--;
      fotoAbierta = null;
    }
  };

  return {
    prisma,
    /** Para simular fallas o carreras: reemplazar un método acá lo cambia para `prisma` y para `tx`. */
    tablas,
    sql,
    ganchos,
    datos,
    transacciones,
    /** Inserta una fila de prueba con los valores por defecto de su tabla. */
    agregar: (tabla: Tabla, fila: Fila) => insertar(tabla, fila),
    /**
     * Inserta una fila como si OTRA transacción la hubiera confirmado: si hay una transacción
     * abierta y lanza, la fila queda (no se deshace con la foto). Sirve para simular carreras
     * que se resuelven con un índice único.
     */
    agregarDeOtraTransaccion: (tabla: Tabla, fila: Fila) => {
      const f = insertar(tabla, fila);
      fotoAbierta?.[tabla].push(clonar(f) as Fila);
      return f;
    },
    vaciar: () => {
      for (const t of TABLAS) datos[t] = [];
      transacciones.length = 0;
      abiertas = 0;
      fotoAbierta = null;
      sql.length = 0;
      ganchos.alEjecutarSql = null;
    },
  };
}
