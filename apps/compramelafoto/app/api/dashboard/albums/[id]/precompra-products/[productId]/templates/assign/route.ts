import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST retirado: el diseñador viejo ya no crea plantillas. Todo el circuito de diseño usa el
 * diseñador nuevo (`TemplateV2`); ver docs/compramelafoto/DISENO-V2-SELECCION-Y-APROBACION.md.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "El diseñador viejo se retiró. Creá la plantilla en el diseñador nuevo (Diseños → Mis plantillas).",
    },
    { status: 410 }
  );
}

