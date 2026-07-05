export type SchoolData = {
  id: number;
  name: string;
  ownerId: number;
  owner: {
    id: number;
    name: string | null;
    email: string;
    role: string;
    companyName: string | null;
  };
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AlbumRow = {
  id: number;
  title: string;
  publicSlug: string | null;
  eventDate: string | null;
  schoolId: number | null;
  isTest: boolean;
  studentIdentificationMode: string | null;
  allowManualStudentFallback: boolean;
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
  organizerCommissionAppliesTo: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS">;
  createdAt: string;
  ownerUser: { id: number; name: string | null; email: string };
  metrics: {
    photoCount: number;
    studentCount: number;
    orderCount: number;
  };
};

export type PackRow = {
  id: number;
  name: string;
  description: string | null;
  priceClientArs: number;
  availabilityPhase: "PRE_UPLOAD" | "POST_UPLOAD" | null;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  orderCount: number;
  inUse: boolean;
  requiresDesign: boolean;
  templateId: number | null;
  albumId: number;
  albumTitle: string;
  source: "PACK_DEFINITION" | "ALBUM_PRODUCT";
};

export type StudentRow = {
  id: number;
  studentId: number;
  firstName: string;
  lastName: string;
  level: string;
  course: string;
  division: string;
  shift: string;
  notes: string | null;
  albumId: number;
  hasSensitiveRelations: boolean;
  sensitiveRelationsSummary: {
    preCompraOrdersCount: number;
    rosterPreCompraOrdersCount: number;
  } | null;
};

export type OrderRow = {
  id: number;
  studentName: string;
  clientEmail: string;
  packName: string;
  albumId: number;
  paymentStatus: string;
  createdAt: string;
};

export type OrderDetailResponse = {
  order: {
    id: number;
    createdAt: string;
    paymentStatus: string;
    total: number;
    checkoutPaymentSource: string | null;
    preCompraPaymentRef: string | null;
    isTest: boolean;
  };
  client: {
    name: string | null;
    email: string;
    phone: string | null;
  };
  student: {
    studentId: number | null;
    albumRosterEntryId: number | null;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    course: string | null;
    division: string | null;
    shift: string | null;
    level: string | null;
    studentSourceType: string | null;
  };
  school: {
    schoolId: number | null;
    name: string | null;
  };
  album: {
    albumId: number;
    title: string;
    publicSlug: string | null;
    isTest: boolean;
  };
  items: Array<{
    id: number;
    quantity: number;
    price: number;
    status: string;
    lineOrigin: string | null;
    pack: {
      id: number;
      name: string;
      isActive: boolean;
    } | null;
    product: {
      id: number;
      name: string;
      requiresDesign: boolean;
    } | null;
    snapshots: {
      student: {
        firstName: string | null;
        lastName: string | null;
        course: string | null;
        division: string | null;
        shift: string | null;
        level: string | null;
      };
      packPurchase: unknown;
      redeemOrderPackSnapshot: unknown;
      redemptionOrderLineOrigins: Array<{
        orderItemId: number;
        lineOrigin: string;
      }>;
    };
  }>;
  selection: {
    hasSelection: boolean;
    selectedPhotosCount: number;
    selectedPhotos: Array<{
      selectionPhotoId: number;
      photoId: number;
      previewUrl: string | null;
      position: number | null;
      role: string | null;
      orderItemId: number;
    }>;
  };
  design: {
    hasDesignProject: boolean;
    projects: Array<{
      orderItemId: number;
      projectId: number;
      status: string;
      previewUrl: string | null;
      exportUrl: string | null;
    }>;
  };
  diagnostics: DiagnosticAlert[];
};

export type DiagnosticAlert = {
  code: string;
  severity: "warning" | "error";
  message: string;
};

export type DetailResponse = {
  school: SchoolData;
  summary: {
    albumsCount: number;
    studentsCount: number;
    ordersCount: number;
    activePacksCount: number;
    totalPacksCount: number;
  };
  albums: AlbumRow[];
  packs: PackRow[];
  students: StudentRow[];
  orders: OrderRow[];
  diagnostics: DiagnosticAlert[];
  academicYears?: Array<{ id: number; label: string; isCurrent: boolean }>;
  limits: {
    students: number;
    orders: number;
  };
};

export type SchoolOption = {
  id: number;
  name: string;
};

export type PhotographerOption = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  studioName: string | null;
};

export type SchoolOrganizerMember = {
  id: string;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  user: {
    id: number;
    name: string | null;
    email: string;
    role: string;
  };
};

export type CreateSchoolOrganizerFormState = {
  name: string;
  email: string;
};

export type SchoolOrganizerInvitationRow = {
  id: string;
  email: string;
  name: string | null;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type SchoolFormState = {
  name: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  province: string;
  country: string;
  notes: string;
  logoUrl: string;
};

export type AlbumConfigFormState = {
  title: string;
  publicSlug: string;
  eventDate: string;
  schoolId: string;
  isTest: boolean;
  studentIdentificationMode: string;
  allowManualStudentFallback: boolean;
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: string;
  organizerCommissionAppliesTo: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS">;
};

export type StudentFormState = {
  studentId?: number;
  rosterEntryId?: number;
  firstName: string;
  lastName: string;
  level: string;
  course: string;
  division: string;
  shift: string;
  notes: string;
  albumId: string;
};

export type PackFormState = {
  name: string;
  description: string;
  priceClientArs: string;
  availabilityPhase: "" | "PRE_UPLOAD" | "POST_UPLOAD";
  isActive: boolean;
  validFrom: string;
  validUntil: string;
};

export type StudentImportSummary = {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  rowErrors: Array<{ rowNumber: number; message: string }>;
  enrollmentsCreated?: number;
  enrollmentsReused?: number;
  rosterLinksCreated?: number;
  rosterLinksUpdated?: number;
  duplicateDniWarnings?: number;
  rosterSkippedDueToOrders?: number;
  rosterSkippedManual?: number;
};

export const ROSTER_CSV_COLUMNS = [
  "level",
  "shift",
  "courseName",
  "division",
  "firstName",
  "lastName",
  "externalStudentId",
  "dni",
] as const;

export const ROSTER_CSV_HEADER_LINE = ROSTER_CSV_COLUMNS.join(",");
export const ROSTER_CSV_EXAMPLE_ROW = "Primaria,Mañana,3ro,A,Juan,Pérez,,";

export type OrganizerCommissionRow = {
  id: number;
  amount: number;
  percentage: number;
  baseAmount: number;
  status: "PENDING" | "REQUESTED" | "PAID" | "REJECTED" | "CANCELLED";
  createdAt: string;
  requestedAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentProofUrl: string | null;
  organizerUser: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  album: { id: number; title: string };
  order: { id: number };
};

export type OrganizerCommissionSummary = {
  acumulado: number;
  pendiente: number;
  solicitado: number;
  pagado: number;
};
