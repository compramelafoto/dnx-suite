import { NextResponse } from "next/server";
import { applyProviderResult } from "@/lib/identidad/aplicar-resultado";
import { getIdentityProvider } from "@/lib/identidad/proveedor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await getIdentityProvider().parseWebhook(rawBody, req.headers);
  if (!result) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  const outcome = await applyProviderResult(result);
  return NextResponse.json({ result: outcome });
}
