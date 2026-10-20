import { MOTIVOS } from "../campos";
import { campos, clave, correo, texto } from "../normalizar";
import type { Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Usuarios de Alboom → miembros del equipo de FOTOFFICE. NO se crean usuarios: se emparejan por correo con quien
 * ya es miembro del workspace (dueño, administrador, personal...). Sirve para atar en 8B-2 el responsable de cada
 * oportunidad y pedido. Sin pareja → OMITIR (se informa).
 *
 * Forma esperada (doc 05 §4.2, `POST /users/paginate`, no confirmada): `{ id, name, lastname, email, role }`.
 */

export const TIPO_USUARIO = "USER";

export type CtxUsuarios = {
  miembros: { userId: number; email: string | null }[];
  mapa: Map<string, EntradaMapa>;
};

export function traducirUsuario(c: Crudo, ctx: CtxUsuarios): Decision {
  const p = campos(c.payload);
  const rol = texto(p.role);
  if (rol && clave(rol) === "contact") return { accion: "OMITIR", motivo: MOTIVOS.esContacto };
  const mail = correo(p.email).valor;
  if (!mail) return { accion: "OMITIR", motivo: MOTIVOS.sinCorreo };
  const miembro = ctx.miembros.find((m) => m.email !== null && m.email.trim().toLowerCase() === mail);
  if (!miembro) return { accion: "OMITIR", motivo: MOTIVOS.sinMiembro };
  const targetId = String(miembro.userId);
  const mapa = ctx.mapa.get(c.alboomId);
  if (mapa && mapa.targetId === targetId && mapa.payloadHash === c.hash) return { accion: "IGUAL", targetId, escribirMapa: false };
  return { accion: "IGUAL", targetId, vincula: !mapa || mapa.targetId !== targetId, huellas: {} };
}
