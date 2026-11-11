import "server-only";
import { prisma } from "@repo/db";
import { cuestionarioPorClave } from "./cuestionarios";
import { limpiarRespuestas, type Cuestionario, type Respuestas } from "./tipos";

/**
 * El formulario de alta en la base. El token del enlace es la única credencial: no hay cuenta.
 */

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{20,80}$/;

export type FormularioDeAlta = {
  id: string;
  destinatario: string;
  estado: "BORRADOR" | "ENVIADO";
  enviadoAt: Date | null;
  cuestionario: Cuestionario;
  respuestas: Respuestas;
};

export async function cargarFormularioDeAlta(token: string): Promise<FormularioDeAlta | null> {
  if (!TOKEN_VALIDO.test(token)) return null;
  const fila = await prisma.fotofficeAltaCliente.findUnique({
    where: { token },
    select: { id: true, destinatario: true, estado: true, enviadoAt: true, cuestionario: true, respuestas: true },
  });
  if (!fila) return null;
  const cuestionario = cuestionarioPorClave(fila.cuestionario);
  if (!cuestionario) return null;
  return {
    id: fila.id,
    destinatario: fila.destinatario,
    estado: fila.estado === "ENVIADO" ? "ENVIADO" : "BORRADOR",
    enviadoAt: fila.enviadoAt,
    cuestionario,
    respuestas: limpiarRespuestas(cuestionario, fila.respuestas),
  };
}

/** Guarda lo que llegó, limpio. Devuelve null si el enlace no existe. */
export async function guardarRespuestasDeAlta(token: string, crudo: unknown): Promise<FormularioDeAlta | null> {
  const actual = await cargarFormularioDeAlta(token);
  if (!actual) return null;
  const respuestas = limpiarRespuestas(actual.cuestionario, crudo);
  await prisma.fotofficeAltaCliente.update({ where: { id: actual.id }, data: { respuestas } });
  return { ...actual, respuestas };
}

export async function marcarAltaEnviada(id: string): Promise<void> {
  await prisma.fotofficeAltaCliente.update({ where: { id }, data: { estado: "ENVIADO", enviadoAt: new Date() } });
}
