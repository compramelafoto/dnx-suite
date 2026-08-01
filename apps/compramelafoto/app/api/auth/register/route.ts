import { NextRequest, NextResponse } from "next/server";
import { registerDnxAccount } from "@repo/auth";

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
 * Registro de Cuenta DNX (cliente). Adapter fino sobre `registerDnxAccount`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body.name ?? "").toString().trim();
    const email = (body.email ?? "").toString();
    const password = (body.password ?? "").toString();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son requeridos" },
        { status: 400 },
      );
    }

    const result = await registerDnxAccount({
      email,
      password,
      name,
      sourceApplication: "compramelafoto",
      appBaseUrl: resolveAppUrl(),
      appLabel: "ComprameLaFoto",
      verifyPath: "/verify-email",
      createRole: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true,
    });

    if (!result.ok) {
      const status = result.reason === "EXISTS" ? 400 : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("REGISTER ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 },
    );
  }
}
