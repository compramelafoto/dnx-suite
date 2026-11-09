/**
 * Qué contactos de la base Contactos DNX se le pueden escribir al Vendedor y en qué orden. `motivoNoApto`
 * es pura; `colaDelDia` arma la lista del día y `sigueApto` vuelve a mirar la base justo antes de enviar.
 * Falla cerrado: si no se puede leer la lista de la campaña escolar de octubre, no entra ninguna escuela.
 */
import "server-only";
import { prisma } from "@repo/db";
import { leerCampanaEscolar } from "./clf";
import { GRUPOS_CON_LANDING_PROPIA, grupoDe, type Grupo } from "./tipos";

export type MotivoNoApto =
  | "SIN_EMAIL" | "EMAIL_GENERICO" | "ESTADO" | "USUARIO_CLF" | "CONOCIDO" | "CAMPANA_ESCOLAR"
  | "YA_TIENE_HILO" | "EMAIL_YA_ESCRITO" | "SIN_GRUPO" | "FUSIONADO";

type DatosApto = {
  email: string | null; claveEmail: string | null; estado: string; vinculo: string | null;
  fusionadoEnId: string | null; tipo: string; nichos: string[];
};

export function motivoNoApto(
  c: DatosApto,
  ctx: { campanaEscolar: Set<string>; emailsConHilo: Set<string>; tieneHilo: boolean },
): MotivoNoApto | null {
  if (!c.email) return "SIN_EMAIL";
  if (!c.claveEmail) return "EMAIL_GENERICO";
  if (c.estado !== "NUEVO" && c.estado !== "REVISADO") return "ESTADO";
  if (c.vinculo === "USUARIO_CLF") return "USUARIO_CLF";
  if (c.vinculo === "CONOCIDO_DNX_ESTUDIO") return "CONOCIDO";
  if (ctx.campanaEscolar.has(c.claveEmail)) return "CAMPANA_ESCOLAR";
  if (ctx.tieneHilo) return "YA_TIENE_HILO";
  if (ctx.emailsConHilo.has(c.claveEmail)) return "EMAIL_YA_ESCRITO";
  if (!grupoDe(c)) return "SIN_GRUPO";
  if (c.fusionadoEnId) return "FUSIONADO";
  return null;
}

export function puntajeDatos(c: { ciudad: string | null; web: string | null; instagram: string | null; telefono: string | null; nichos: string[] }): number {
  return [c.ciudad, c.web, c.instagram, c.telefono].filter(Boolean).length + (c.nichos.length > 0 ? 1 : 0);
}

export type ElementoCola = { contactoId: string; grupo: Grupo };

const SELECCION = {
  id: true, email: true, claveEmail: true, estado: true, vinculo: true, fusionadoEnId: true, tipo: true, nichos: true,
  ciudad: true, web: true, instagram: true, telefono: true, creadoEn: true,
} as const;

/** Los correos (claveEmail) de los contactos que ya tienen hilo, salvo `excepto`. */
async function emailsEscritos(excepto?: string): Promise<{ emails: Set<string>; conHilo: Set<string> }> {
  const hilos = await prisma.dnxVendedorHilo.findMany({ select: { contactoId: true } });
  const conHilo = new Set(hilos.map((h) => h.contactoId));
  const ids = [...conHilo].filter((id) => id !== excepto);
  const contactos = ids.length
    ? await prisma.dnxContacto.findMany({ where: { id: { in: ids } }, select: { claveEmail: true } })
    : [];
  return { emails: new Set(contactos.map((c) => c.claveEmail).filter((x): x is string => !!x)), conHilo };
}

/** Sin la lista de la campaña no se sabe qué colegios ya recibieron correo: ninguna escuela entra. */
const esEscuelaSinLista = (grupo: Grupo | null, campana: Set<string> | null) => grupo === "ESCUELA" && campana === null;

export async function colaDelDia(
  limite: number,
  opciones: { soloContactoId?: string | null },
): Promise<{ cola: ElementoCola[]; gruposSinModelo: Array<{ grupo: Grupo; contactoId: string }> }> {
  const campana = await leerCampanaEscolar();
  const { emails, conHilo } = await emailsEscritos();
  const candidatos = await prisma.dnxContacto.findMany({
    where: {
      estado: { in: ["NUEVO", "REVISADO"] },
      ...(opciones.soloContactoId ? { id: opciones.soloContactoId } : {}),
    },
    select: SELECCION,
  });
  const aptos: Array<{ id: string; grupo: Grupo; puntaje: number; creadoEn: Date }> = [];
  for (const c of candidatos) {
    if (!c.claveEmail) continue;
    const grupo = grupoDe(c);
    if (esEscuelaSinLista(grupo, campana)) continue;
    const motivo = motivoNoApto(c, { campanaEscolar: campana ?? new Set(), emailsConHilo: emails, tieneHilo: conHilo.has(c.id) });
    if (motivo || !grupo) continue;
    aptos.push({ id: c.id, grupo, puntaje: puntajeDatos(c), creadoEn: c.creadoEn });
  }
  aptos.sort((a, b) => {
    const pa = GRUPOS_CON_LANDING_PROPIA.includes(a.grupo) ? 0 : 1;
    const pb = GRUPOS_CON_LANDING_PROPIA.includes(b.grupo) ? 0 : 1;
    return pa - pb || b.puntaje - a.puntaje || a.creadoEn.getTime() - b.creadoEn.getTime();
  });

  const modelos = await prisma.dnxVendedorModelo.findMany({
    where: { estado: "APROBADO", reemplazadoEn: null },
    select: { grupo: true },
  });
  const conModelo = new Set(modelos.map((m) => m.grupo));
  const cola: ElementoCola[] = [];
  const gruposSinModelo: Array<{ grupo: Grupo; contactoId: string }> = [];
  const avisados = new Set<Grupo>();
  for (const a of aptos) {
    if (!conModelo.has(a.grupo)) {
      if (!avisados.has(a.grupo)) {
        avisados.add(a.grupo);
        gruposSinModelo.push({ grupo: a.grupo, contactoId: a.id });
      }
      continue;
    }
    if (cola.length < limite) cola.push({ contactoId: a.id, grupo: a.grupo });
  }
  return { cola, gruposSinModelo };
}

/**
 * Relee el contacto de la base justo antes de enviar. Su propio hilo (el que se está por enviar) no cuenta
 * como impedimento; sí cuentan los hilos de otros contactos con el mismo correo. Un contacto que ya no
 * existe devuelve "ESTADO".
 */
export async function sigueApto(contactoId: string): Promise<MotivoNoApto | null> {
  const c = await prisma.dnxContacto.findUnique({ where: { id: contactoId }, select: SELECCION });
  if (!c) return "ESTADO";
  const campana = await leerCampanaEscolar();
  if (esEscuelaSinLista(grupoDe(c), campana)) return "CAMPANA_ESCOLAR";
  const { emails } = await emailsEscritos(contactoId);
  return motivoNoApto(c, { campanaEscolar: campana ?? new Set(), emailsConHilo: emails, tieneHilo: false });
}
