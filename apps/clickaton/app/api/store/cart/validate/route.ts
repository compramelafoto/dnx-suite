import { NextResponse } from "next/server";
import { validateStoreCartPayload } from "@/lib/public-store/validate-store-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24_576; // 24 KB

/**
 * POST /api/store/cart/validate
 * Valida ítems del carrito contra el catálogo público.
 * No crea holds, pedidos ni pagos.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Content-Type debe ser application/json." },
      { status: 415 },
    );
  }

  const rawText = await request.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Payload demasiado grande." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const result = await validateStoreCartPayload(body);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, issues: result.issues },
      { status: result.status },
    );
  }

  return NextResponse.json(
    { ok: true, cart: result.cart },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
