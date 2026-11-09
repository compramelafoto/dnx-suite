"use server";

import { redirect } from "next/navigation";
import { darDeBajaVendedor } from "@/lib/agentes/vendedor/baja";

/** «Darme de baja» desde la página del enlace de los correos del Vendedor. */
export async function darmeDeBajaAction(formData: FormData): Promise<void> {
  const token = String(formData.get("t") ?? "");
  const r = await darDeBajaVendedor(token);
  if (r === "INVALIDO") redirect("/correo/baja-dnx?error=1");
  redirect(`/correo/baja-dnx?t=${encodeURIComponent(token)}&listo=1`);
}
