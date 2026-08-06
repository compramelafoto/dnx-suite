import type { UploadPolicy } from "../entries/upload-policy";
import type { UploadWindowView } from "../participant-experience/upload-window";

export type UploadWizardStepId =
  | "requirements"
  | "photo"
  | "data"
  | "review"
  | "confirmation";

export type UploadWizardStepDef = {
  id: UploadWizardStepId;
  label: string;
  shortLabel: string;
};

export const UPLOAD_WIZARD_STEPS: UploadWizardStepDef[] = [
  { id: "requirements", label: "Requisitos", shortLabel: "1" },
  { id: "photo", label: "Fotografía", shortLabel: "2" },
  { id: "data", label: "Datos", shortLabel: "3" },
  { id: "review", label: "Revisión", shortLabel: "4" },
  { id: "confirmation", label: "Confirmación", shortLabel: "5" },
];

export type ClientFileValidationResult =
  | { ok: true; width: number; height: number; sizeBytes: number; mimeType: string; name: string }
  | { ok: false; code: string; message: string };

export type WorkDataForm = {
  title: string;
  /** No persistido por API de upload actual — solo sesión/fixture. */
  description: string;
  instagramHandle: string;
  captureLocality: string;
  captureDepartment: string;
  territoryConfirmed: boolean;
  captureWithinPeriod: boolean;
  declaredDeviceKind: string;
  declaredDeviceMake: string;
  declaredDeviceModel: string;
  droneAck: boolean;
  authorshipDeclared: boolean;
  editingPolicyDeclared: boolean;
  noGenerativeAiDeclared: boolean;
};

export const EMPTY_WORK_DATA: WorkDataForm = {
  title: "",
  description: "",
  instagramHandle: "",
  captureLocality: "",
  captureDepartment: "",
  territoryConfirmed: false,
  captureWithinPeriod: false,
  declaredDeviceKind: "UNKNOWN",
  declaredDeviceMake: "",
  declaredDeviceModel: "",
  droneAck: false,
  authorshipDeclared: false,
  editingPolicyDeclared: false,
  noGenerativeAiDeclared: false,
};

export type UploadRequirementsSummary = {
  categoryName: string;
  categorySlug: string;
  maxFiles: number;
  formatsLabel: string;
  maxSizeLabel: string;
  minDimensionsLabel: string;
  maxDimensionsLabel: string;
  minMegapixelsLabel: string;
  uploadWindow: UploadWindowView;
  allowReplace: boolean;
  specialBadges: string[];
  requirementNotes: string[];
  basesHref: string;
  policy: UploadPolicy;
  requiresSantaFeEligibility: boolean;
  capturePeriodLabel: string | null;
};

export type PublicUploadFileStatus =
  | "idle"
  | "validating"
  | "selected"
  | "uploading"
  | "processing"
  | "uploaded"
  | "draft"
  | "ready_to_confirm"
  | "submitted"
  | "needs_correction"
  | "replaced"
  | "frozen"
  | "rejected"
  | "error";
