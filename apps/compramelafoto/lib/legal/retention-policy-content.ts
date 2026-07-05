/**
 * Política de Retención y Eliminación de Datos — LEGAL-PACK-2026-06 / RETENTION-v1.0
 */

export const RETENTION_POLICY_VERSION = "RETENTION-v1.0";
export const RETENTION_POLICY_EFFECTIVE_DATE = "2026-06-01";

export type RetentionTableRow = {
  category: string;
  location: string;
  activePeriod: string;
  deletion: string;
};

export const RETENTION_TABLE_ROWS: RetentionTableRow[] = [
  {
    category: "Cuenta de usuario",
    location: "Base de datos (User)",
    activePeriod: "Mientras activa",
    deletion: "30 días tras solicitud de baja; luego anonimización salvo obligación legal",
  },
  {
    category: "Sesión / cookies",
    location: "Navegador / servidor",
    activePeriod: "Sesión o según Política de Cookies",
    deletion: "Expiración automática",
  },
  {
    category: "Pedido álbum",
    location: "BD + R2",
    activePeriod: "10 años datos de facturación; contenido digital según abajo",
    deletion: "Anonimizar comprador tras plazo fiscal si se solicita supresión",
  },
  {
    category: "Pedido impresión",
    location: "BD + archivos lab",
    activePeriod: "10 años metadatos; archivos impresión 15 días",
    deletion: "Cron cleanup-expired-albums / tags FILES_DELETED",
  },
  {
    category: "Preventa escolar",
    location: "BD (PreCompraOrder)",
    activePeriod: "Ciclo lectivo + 12 meses",
    deletion: "Archivar o anonimizar",
  },
  {
    category: "Fotos originales",
    location: "R2 (Photo.originalKey)",
    activePeriod: "**45 días** desde publicación del álbum",
    deletion: "Cron cleanup-expired-albums: borrado R2 + BD",
  },
  {
    category: "Previews / watermarks",
    location: "R2",
    activePeriod: "Mismo que foto",
    deletion: "Mismo cron",
  },
  {
    category: "ZIP descarga",
    location: "R2 + ZipGenerationJob",
    activePeriod: "Según expiresAt del job (orientativo: 7–30 días)",
    deletion: "Cron cleanup-zip-jobs",
  },
  {
    category: "Selfie interés álbum",
    location: "R2 + AlbumInterest",
    activePeriod: "**90 días** o fin de álbum (lo primero)",
    deletion: "Cron biometric-cleanup",
  },
  {
    category: "Plantilla facial (Rekognition)",
    location: "AWS + AlbumInterest.faceId",
    activePeriod: "Mismo que selfie",
    deletion: "deleteFace() en cleanup / revocación",
  },
  {
    category: "Selfie menor preventa",
    location: "R2 (SubjectSelfie)",
    activePeriod: "**90 días** o cierre preventa/canje",
    deletion: "Procedimiento de expiración programada",
  },
  {
    category: "Selfie álbum oculto",
    location: "R2 + HiddenAlbumAttempt",
    activePeriod: "Según selfieExpiresAt del álbum",
    deletion: "Cron / expiración",
  },
  {
    category: "Padrón escolar",
    location: "Student, StudentEnrollment, AlbumStudentRosterEntry",
    activePeriod: "Ciclo lectivo + 12 meses",
    deletion: "Procedimiento manual o cron institucional",
  },
  {
    category: "Import CSV auditoría",
    location: "StudentRosterImportRow",
    activePeriod: "24 meses",
    deletion: "Anonimizar rawRowJson",
  },
  {
    category: "Marketing opt-in",
    location: "User.marketingOptIn*",
    activePeriod: "Hasta baja + 2 años prueba de consentimiento",
    deletion: "unsubscribedAt",
  },
  {
    category: "Solicitudes ARCO",
    location: "PrivacyRequest",
    activePeriod: "5 años",
    deletion: "Archivo",
  },
  {
    category: "Consentimientos legales",
    location: "Registro de aceptaciones",
    activePeriod: "10 años",
    deletion: "Archivo probatorio",
  },
];

export type RetentionPolicySection = {
  id: string;
  title: string;
  content: string;
};

export const RETENTION_POLICY_SECTIONS: RetentionPolicySection[] = [
  {
    id: "principios",
    title: "Principios",
    content: `- Minimización: conservar solo lo necesario.
- Plazos definidos por categoría.
- Eliminación segura o anonimización al vencer el plazo.
- Excepciones por obligación legal, litigio o solicitud ARCO pendiente.`,
  },
  {
    id: "procedimientos",
    title: "Procedimientos de eliminación",
    content: `**Solicitud del titular (ARCO supresión):**
1. Recepción vía /privacidad/solicitud
2. Verificación de identidad
3. Ejecución en plazo orientativo: 15 días hábiles (supresión simple) a 30 días (casos complejos)
4. Comunicación al titular
5. Registro en PrivacyRequest

**Revocación biométrica:** automática vía API revoke-face-consent o /delete-biometric — plazo máximo 72 h hábiles.

**Eliminación por abandono de cuenta:** tras 24 meses de inactividad, aviso por email → 30 días → anonimización si no hay pedidos pendientes ni obligación legal.`,
  },
  {
    id: "copias",
    title: "Copias de seguridad",
    content: `Los backups pueden conservar datos eliminados hasta **90 días** adicionales; luego se rotan sin restauración activa salvo desastre.`,
  },
  {
    id: "responsables",
    title: "Responsables internos",
    content: `Definir roles: DPO / responsable de privacidad, operaciones (crons), soporte (ARCO).`,
  },
  {
    id: "revision",
    title: "Revisión",
    content: `Esta política se revisa al menos **anualmente** o ante cambios materiales del producto.`,
  },
];
