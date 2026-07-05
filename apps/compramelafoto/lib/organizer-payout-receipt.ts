import { randomUUID } from "crypto";
import { generateR2Key, getSignedUrlForFile, uploadToR2 } from "@/lib/r2-client";
import {
  ORGANIZER_PAYOUT_RECEIPT_ALLOWED_MIME,
  ORGANIZER_PAYOUT_RECEIPT_MAX_BYTES,
} from "@/lib/organizer-withdrawal-payout-fields";

export function payoutReceiptExtensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "application/pdf") return "pdf";
  return "bin";
}

export async function uploadOrganizerWithdrawalReceipt(params: {
  withdrawalId: number;
  file: File | { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> };
}): Promise<{
  r2Key: string;
  fileName: string;
  mimeType: string;
  uploadedAt: Date;
}> {
  const contentType = (params.file.type || "").toLowerCase().split(";")[0].trim();
  if (!ORGANIZER_PAYOUT_RECEIPT_ALLOWED_MIME.has(contentType)) {
    throw new Error("Formato no permitido. Usá JPG, PNG o PDF.");
  }

  const size = "size" in params.file ? params.file.size : 0;
  if (size > ORGANIZER_PAYOUT_RECEIPT_MAX_BYTES) {
    throw new Error("El archivo no puede superar 10 MB.");
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const ext = payoutReceiptExtensionForMime(contentType);
  const safeName =
    params.file.name?.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) ||
    `comprobante.${ext}`;
  const key = generateR2Key(
    `retiro_${params.withdrawalId}_${randomUUID()}.${ext}`,
    `organizer-withdrawal-receipts/${params.withdrawalId}`
  );

  await uploadToR2(buffer, key, contentType, {
    type: "organizer_withdrawal_receipt",
    withdrawalId: String(params.withdrawalId),
  });

  return {
    r2Key: key,
    fileName: safeName,
    mimeType: contentType,
    uploadedAt: new Date(),
  };
}

export async function getOrganizerWithdrawalReceiptSignedUrl(
  r2Key: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  const key = r2Key?.trim();
  if (!key) return null;
  return getSignedUrlForFile(key, expiresIn);
}
