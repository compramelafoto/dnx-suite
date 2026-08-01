import { NextRequest, NextResponse } from "next/server";
import {
  requestPasswordReset,
  passwordResetNeutralMessage,
} from "@repo/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  if (!raw) return "http://localhost:3000";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

/**
 * Adapter fino — reset central DNX (`@repo/auth`).
 * Anti-enumeración: siempre responde éxito neutro.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").toString();

    if (!email.trim()) {
      return NextResponse.json({ error: "El email es requerido" }, { status: 400 });
    }

    await requestPasswordReset({
      email,
      appBaseUrl: resolveAppUrl(),
      appLabel: "ComprameLaFoto",
      resetPath: "/reset-password",
    });

    return NextResponse.json({
      success: true,
      message: passwordResetNeutralMessage(),
    });
  } catch (err: unknown) {
    console.error("FORGOT PASSWORD ERROR >>>", err);
    // Anti-enumeración: no revelar fallos internos al cliente
    return NextResponse.json({
      success: true,
      message: passwordResetNeutralMessage(),
    });
  }
}
