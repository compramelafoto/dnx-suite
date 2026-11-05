import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  connectCollectionAccount,
  disconnectCollectionAccount,
  getCollectionState,
} from "@/lib/international/collection-account-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticate() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return { response: NextResponse.json({ error: error || "No autorizado." }, { status: 401 }), user: null };
  }
  return { response: null, user };
}

/** Nunca responde 404: la pantalla decide qué mostrar con `available`. */
export async function GET() {
  try {
    const { response, user } = await authenticate();
    if (!user) return response;
    const { access, account } = await getCollectionState(user.id);
    if (!access.available) return NextResponse.json({ available: false });
    return NextResponse.json({ ...access, account });
  } catch {
    console.error("[cobros-internacionales] GET falló");
    return NextResponse.json({ error: "No pudimos cargar la cuenta. Probá de nuevo." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { response, user } = await authenticate();
    if (!user) return response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Completá las credenciales." }, { status: 400 });
    }

    const result = await connectCollectionAccount(user.id, body);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ account: result.account });
  } catch {
    console.error("[cobros-internacionales] POST falló");
    return NextResponse.json({ error: "No pudimos guardar la cuenta. Probá de nuevo." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { response, user } = await authenticate();
    if (!user) return response;
    const result = await disconnectCollectionAccount(user.id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[cobros-internacionales] DELETE falló");
    return NextResponse.json({ error: "No pudimos desconectar la cuenta. Probá de nuevo." }, { status: 500 });
  }
}
