"use server";

import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireLevel } from "@/lib/guards";
import { codigoDeError, type CodigoError } from "@/lib/avisos";
import { createInsuranceReport } from "@/lib/informe/snapshot";

const VOLVER = "/mi-equipo/informe";

function errorDe(err: unknown): CodigoError {
  return codigoDeError(err, { noEncontrado: "NO_ENCONTRADOS_EQUIPOS", origen: "informe" });
}

export async function generarInforme(formData: FormData) {
  const user = await requireLevel("identidad", VOLVER);
  const ids = formData
    .getAll("itemId")
    .map((v) => (typeof v === "string" ? Number(v) : Number.NaN));
  let query: string;
  try {
    await createInsuranceReport(user.id, ids);
    query = "ok=INFORME_GENERADO";
  } catch (err) {
    query = `error=${errorDe(err)}`;
  }
  redirect(`${VOLVER}?${query}`);
}

export async function guardarPoliza(formData: FormData) {
  const user = await requireLevel("identidad", VOLVER);
  const raw = formData.get("policyRenewalDate");
  const v = typeof raw === "string" ? raw.trim() : "";
  let policyRenewalDate: Date | null = null;
  if (v) {
    // Mediodía UTC: cae el mismo día calendario en Argentina (UTC-3).
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00.000Z`) : null;
    if (!d || Number.isNaN(d.getTime())) {
      redirect(`${VOLVER}?error=FECHA_INVALIDA`);
    }
    policyRenewalDate = d;
  }
  await prisma.gearOwnerSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, policyRenewalDate },
    // Si cambia la fecha, el próximo aviso vuelve a quedar habilitado.
    update: { policyRenewalDate, lastRenewalReminderAt: null },
  });
  redirect(`${VOLVER}?ok=${policyRenewalDate ? "POLIZA_GUARDADA" : "POLIZA_QUITADA"}`);
}
