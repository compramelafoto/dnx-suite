"use server";

import { prisma, withClickatonDb } from "@/lib/admin/db";
import {
  isContactReason,
  resolveContactReason,
  type ContactReasonValue,
} from "@/lib/contact/reasons";

export type ContactFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "company" | "phone" | "reason" | "message", string>
  >;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export async function submitContactMessageAction(
  _prev: ContactFormState | undefined,
  formData: FormData,
): Promise<ContactFormState> {
  // Honeypot anti-spam
  const website = clean(formData.get("website"), 200);
  if (website) {
    return { ok: true, message: "Recibimos tu mensaje. Te vamos a responder pronto." };
  }

  const name = clean(formData.get("name"), 120);
  const email = clean(formData.get("email"), 200).toLowerCase();
  const company = clean(formData.get("company"), 160);
  const phone = clean(formData.get("phone"), 40);
  const message = clean(formData.get("message"), 4000);
  const sourceRaw = clean(formData.get("source"), 40) || "contacto";
  const reasonRaw = clean(formData.get("reason"), 60);
  const reason: ContactReasonValue = isContactReason(reasonRaw)
    ? reasonRaw
    : resolveContactReason(reasonRaw);

  const fieldErrors: ContactFormState["fieldErrors"] = {};
  if (name.length < 2) fieldErrors.name = "Indicá tu nombre (mín. 2 caracteres).";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Indicá un email válido.";
  if (message.length < 10) {
    fieldErrors.message = "Contanos un poco más (mín. 10 caracteres).";
  }
  if (!isContactReason(reason)) fieldErrors.reason = "Elegí un motivo.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, message: "Revisá los campos marcados." };
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonContactMessage.create({
      data: {
        name,
        email,
        company: company || null,
        phone: phone || null,
        reason,
        message,
        source: sourceRaw,
      },
      select: { id: true },
    });
  });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "migration_pending"
          ? "El buzón todavía no está disponible. Probá de nuevo en unos minutos."
          : "No pudimos enviar tu mensaje. Intentá de nuevo.",
    };
  }

  return {
    ok: true,
    message: "¡Listo! Recibimos tus datos. El equipo de Clickatón te va a contactar.",
  };
}
