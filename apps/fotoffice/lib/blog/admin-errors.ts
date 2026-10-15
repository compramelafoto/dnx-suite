import "server-only";
import { NextResponse } from "next/server";
import { isContentError } from "@repo/content";
import { contentErrorStatus, mensajeDeRelacion } from "./admin-utils";

/**
 * Respuesta uniforme para los errores del panel del blog (motor `@repo/content` y Prisma).
 *
 * Mismo criterio que el CMS de Clickatón: los errores de dominio salen con su código y un
 * estado HTTP que el formulario sabe mostrar; los de Prisma conocidos (slug repetido, fila
 * que no está) se traducen; el resto se registra y sale como 500 sin detalles internos.
 */
export function handleBlogApiError(error: unknown, entidad: string) {
  const relacion = mensajeDeRelacion(error);
  if (relacion) return NextResponse.json({ error: relacion }, { status: 400 });

  if (isContentError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: contentErrorStatus(error) },
    );
  }

  const code = (error as { code?: string })?.code;
  // Las claves únicas son (plataforma, institución, slug): el choque es siempre dentro del
  // mismo blog, nunca contra el de otra institución.
  if (code === "P2002") {
    return NextResponse.json({ error: "Ya hay otro con esa dirección (slug) en tu blog." }, { status: 409 });
  }
  if (code === "P2025") {
    return NextResponse.json({ error: `No se encontró ${entidad}.` }, { status: 404 });
  }
  if (code === "P2021" || code === "P2022") {
    return NextResponse.json(
      { error: "Faltan las tablas del blog en esta base. Hay que aplicar la migración pendiente." },
      { status: 503 },
    );
  }

  console.error(`[fotoffice][blog] error de API (${entidad}):`, error);
  return NextResponse.json({ error: `No se pudo procesar ${entidad}.` }, { status: 500 });
}

export function validacionFallida(details: string) {
  return NextResponse.json({ error: "Revisá los datos", details }, { status: 400 });
}

export const idInvalido = () => NextResponse.json({ error: "ID inválido" }, { status: 400 });
