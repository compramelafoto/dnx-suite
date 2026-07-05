import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

export type RosterUploadPayload = {
  csvText: string;
  fileName: string;
  importMode: "csv" | "xlsx";
  /** Id de año lectivo de la escuela (opcional). */
  academicYearId?: number | null;
};

function isExcelFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

function parseExcelToCsv(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("El archivo Excel no tiene hojas");
  }
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}

function parseOptionalAcademicYearId(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export async function readRosterUploadFromRequest(
  req: NextRequest
): Promise<RosterUploadPayload | null> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const ay = parseOptionalAcademicYearId(form.get("academicYearId"));
    const file = form.get("file");
    if (file instanceof File) {
      const fileName = file.name || "upload.csv";
      if (isExcelFileName(fileName)) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const csvText = parseExcelToCsv(buffer);
        return { csvText, fileName, importMode: "xlsx", academicYearId: ay };
      }
      const csvText = await file.text();
      return { csvText, fileName, importMode: "csv", academicYearId: ay };
    }

    const csvField = form.get("csv");
    if (typeof csvField === "string") {
      return { csvText: csvField, fileName: "paste.csv", importMode: "csv", academicYearId: ay };
    }
    return null;
  }

  const body = await req.json().catch(() => ({}));
  if (body && typeof body.csv === "string") {
    return {
      csvText: body.csv,
      fileName: "body.csv",
      importMode: "csv",
      academicYearId: parseOptionalAcademicYearId((body as { academicYearId?: unknown }).academicYearId),
    };
  }
  return null;
}
