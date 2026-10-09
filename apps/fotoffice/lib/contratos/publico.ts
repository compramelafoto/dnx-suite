import "server-only";
import { prisma } from "@repo/db";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { clausulaVigente, leerAjustesContratos, urlFirmaEmpresa } from "./ajustes";
import { LEYENDA_FIRMA } from "./constantes";
import type { ResultadoTokenContrato } from "./enlace";
import { aBloques, type Bloque } from "./formato";
import { MINUTOS_VERIFICACION_VALIDA } from "./firma";

/**
 * Lo que ve el firmante en su enlace (etapa 5): un objeto de DATOS planos (se pasa a componentes del
 * navegador), armado a mano campo por campo. Nunca se vuelca una fila entera de la base.
 *
 * De los otros firmantes sólo salen el NOMBRE y si firmaron: nada de correo, documento, enlace, código,
 * IP, navegador ni ids. Del propio firmante, lo mínimo para el recorrido.
 */
export type EstadoFirmante = "FIRMO" | "RECHAZO" | "PENDIENTE";

export type VistaFirma = {
  organizacion: { nombre: string; logoUrl: string | null };
  contrato: { numero: string; nombre: string; estado: string; firmadoEn: string | null };
  bloques: Bloque[];
  empresa: { nombre: string | null; firmaUrl: string | null };
  clausula: string;
  leyenda: string;
  firmantes: { nombre: string; estado: EstadoFirmante; esUsted: boolean }[];
  yo: {
    nombre: string;
    estado: EstadoFirmante;
    firmadoEn: string | null;
    /** El nombre que escribió al pedir el código (para la firma), si ya lo pidió. */
    nombreEscrito: string | null;
    /** Código ya verificado y todavía vigente para firmar. */
    verificado: boolean;
  };
  /** Si puede firmar o decir que no está de acuerdo ahora. */
  puedeActuar: boolean;
  /** Si no puede actuar, por qué (texto para la pantalla). */
  aviso: string | null;
};

type Resuelto = Extract<ResultadoTokenContrato, { ok: true }>;

const AR = "America/Argentina/Buenos_Aires";
export function fechaAR(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: AR, dateStyle: "long", timeStyle: "short" }).format(d);
}

export async function armarVistaFirma(workspaceId: string, r: Resuelto, ahora: Date = new Date()): Promise<VistaFirma> {
  const [sitio, ajustes, filas, propio] = await Promise.all([
    sitioDelWorkspace(workspaceId),
    leerAjustesContratos(workspaceId),
    prisma.fotofficeContratoFirmante.findMany({
      where: { workspaceId, versionId: r.version.id },
      orderBy: [{ orden: "asc" }],
      select: { id: true, name: true, signedAt: true, rejectedAt: true },
    }),
    prisma.fotofficeContratoFirmante.findFirst({
      where: { id: r.firmante.id, workspaceId },
      select: { verifiedAt: true, typedName: true },
    }),
  ]);
  const firmaUrl = await urlFirmaEmpresa(ajustes.companySignatureKey);
  const estadoDe = (f: { signedAt: Date | null; rejectedAt: Date | null }): EstadoFirmante => (f.signedAt ? "FIRMO" : f.rejectedAt ? "RECHAZO" : "PENDIENTE");
  const yoEstado = estadoDe(r.firmante);
  const verificado =
    !!propio?.verifiedAt && ahora.getTime() - propio.verifiedAt.getTime() <= MINUTOS_VERIFICACION_VALIDA * 60_000 && propio.verifiedAt.getTime() <= ahora.getTime();

  const abierto = r.contrato.status === "ENVIADO" || r.contrato.status === "FIRMADO_PARCIAL";
  const puedeActuar = abierto && yoEstado === "PENDIENTE";
  let aviso: string | null = null;
  if (yoEstado === "FIRMO") aviso = r.contrato.status === "FIRMADO" ? "El contrato quedó firmado por todas las partes." : "Ya firmaste. Falta la firma de la otra parte.";
  else if (yoEstado === "RECHAZO" || r.contrato.status === "RECHAZADO") aviso = "Este contrato fue rechazado. Si querés retomarlo, escribile a quien te lo envió.";
  else if (!abierto) aviso = "Este contrato ya no admite firmas.";

  return {
    organizacion: { nombre: sitio?.nombre ?? "", logoUrl: sitio?.logoUrl ?? null },
    contrato: {
      numero: r.contrato.number,
      nombre: r.contrato.name,
      estado: r.contrato.status,
      firmadoEn: r.contrato.signedAt ? fechaAR(r.contrato.signedAt) : null,
    },
    bloques: aBloques(r.version.bodyText),
    empresa: { nombre: ajustes.companyName, firmaUrl },
    clausula: clausulaVigente(ajustes),
    leyenda: LEYENDA_FIRMA,
    firmantes: filas.map((f) => ({ nombre: f.name, estado: estadoDe(f), esUsted: f.id === r.firmante.id })),
    yo: {
      nombre: r.firmante.name,
      estado: yoEstado,
      firmadoEn: r.firmante.signedAt ? fechaAR(r.firmante.signedAt) : null,
      nombreEscrito: propio?.typedName ?? null,
      verificado,
    },
    puedeActuar,
    aviso,
  };
}
