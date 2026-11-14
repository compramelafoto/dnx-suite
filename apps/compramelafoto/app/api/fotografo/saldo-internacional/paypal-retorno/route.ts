import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { finishTopUp, SALDO_PANEL_PATH } from "@/lib/international/topup-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PayPal vuelve acá con ?token=<id de la orden>. Se captura y se vuelve al panel de saldo. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (result: string) => NextResponse.redirect(new URL(`${SALDO_PANEL_PATH}&recarga=${result}`, url.origin));
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return back("error");
  try {
    return back(await finishTopUp(user.id, url.searchParams.get("token") ?? ""));
  } catch (err) {
    console.error("[saldo-internacional] retorno de PayPal falló", err);
    return back("error");
  }
}
