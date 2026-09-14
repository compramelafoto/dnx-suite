import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePeriodo(searchParams: URLSearchParams): { year: number; month: number } | null {
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const periodo = parsePeriodo(searchParams);
    if (!periodo) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const fx = await prisma.fxRate.findUnique({
      where: { periodYear_periodMonth: { periodYear: periodo.year, periodMonth: periodo.month } },
    });

    // No es un 404: que no haya tipo de cambio cargado todavía es un
    // resultado válido, no un error.
    return NextResponse.json({ usdToArs: fx ? fx.usdToArs.toNumber() : null });
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/fx ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo el tipo de cambio", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      year?: number;
      month?: number;
      usdToArs?: number;
      notes?: string | null;
    };
    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const usdToArs = Number(body.usdToArs);
    if (!Number.isFinite(usdToArs) || usdToArs <= 0) {
      return NextResponse.json({ error: "El tipo de cambio no es válido." }, { status: 400 });
    }

    // La pantalla de "Dólar del mes" no manda `notes` en su PUT: sólo edita
    // el número. Si `notes` no vino en el body, no hay que tocar la
    // columna — mandarla como `null` borraría notas como "es el dólar
    // tarjeta, ya incluye impuestos" que alguien haya cargado a mano antes.
    // Sí se respeta que el body la mande explícitamente en null/"" para
    // borrarla a propósito.
    const notesEnviadas = Object.prototype.hasOwnProperty.call(body, "notes");

    const fx = await prisma.fxRate.upsert({
      where: { periodYear_periodMonth: { periodYear: year, periodMonth: month } },
      create: {
        periodYear: year,
        periodMonth: month,
        usdToArs,
        source: "MANUAL",
        notes: body.notes ? String(body.notes) : null,
      },
      update: {
        usdToArs,
        ...(notesEnviadas ? { notes: body.notes ? String(body.notes) : null } : {}),
      },
    });

    return NextResponse.json({ usdToArs: fx.usdToArs.toNumber() });
  } catch (err: any) {
    console.error("PUT /api/admin/finance-dnx/fx ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando el tipo de cambio", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
