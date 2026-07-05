import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKED_MESSAGE =
  "Los fotógrafos colaboradores no pueden modificar carpetas. Las carpetas oficiales las administra el organizador.";

/**
 * PATCH /api/fotografo/events/[id]/folders/[folderId] — bloqueado.
 */
export async function PATCH(
  _req: NextRequest,
  {
    params,
  }: { params: { id: string; folderId: string } | Promise<{ id: string; folderId: string }> }
) {
  void params;
  return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });
}

/**
 * DELETE /api/fotografo/events/[id]/folders/[folderId] — bloqueado.
 */
export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: { id: string; folderId: string } | Promise<{ id: string; folderId: string }> }
) {
  void params;
  return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });
}
