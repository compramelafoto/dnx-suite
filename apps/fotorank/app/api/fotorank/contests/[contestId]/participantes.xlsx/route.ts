/**
 * Descarga en Excel del listado de participantes de un concurso.
 *
 * Protegida: exige sesión y que quien la pide sea miembro activo de la
 * organización del concurso, igual que la pantalla de inscripciones. A
 * diferencia del CSV de interesados, lleva correo y teléfono: son personas
 * inscriptas en el concurso de esa organización, que las tiene que poder
 * contactar (avisar premios, pedir datos).
 */
import { NextResponse } from "next/server";

import { getAuthUser } from "../../../../../lib/auth";
import { EntryError, participantesParaElListado } from "../../../../../lib/fotorank/entries";
import { filasDelListado, libroDelListado } from "../../../../../lib/fotorank/entries/listadoDeParticipantes";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ contestId: string }> },
): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { contestId } = await context.params;

  let datos: Awaited<ReturnType<typeof participantesParaElListado>>;
  try {
    datos = await participantesParaElListado({ contestId, organizerUserId: user.id });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }

  const archivo = libroDelListado(filasDelListado(datos.inscripciones, datos.categorias), datos.titulo);
  const nombre = `participantes-${datos.titulo}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return new NextResponse(new Uint8Array(archivo), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
