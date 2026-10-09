import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { leerAjustesContratos } from "./ajustes";
import { leerObjetoContrato, subirObjetoContrato } from "./almacen";
import { registrarEvento } from "./eventos";
import { huellaTexto } from "./huella";
import { construirPdf } from "./pdf-documento";
import { bloquearContrato } from "./versiones";

/**
 * PDF sellado del contrato firmado (etapa 5). Se genera una sola vez, cuando el contrato queda FIRMADO por
 * todas las partes, y se guarda en el bucket privado:
 *
 *   `contratos/<workspaceId>/<contratoId>/contrato-<número>-v<versión>.pdf`
 *
 * con su huella SHA-256 en `FotofficeContrato.pdfHash` (la del archivo; la del texto va dentro de la
 * constancia). Es IDEMPOTENTE: si el contrato ya tiene el PDF de la versión vigente no hace nada. Todo
 * se arma fuera de toda transacción y se guarda con una escritura corta bajo el candado del contrato: si dos
 * corridas simultáneas (`after()` y cron) arman el PDF, gana la primera que escribe y la otra descarta el suyo
 * sin subir nada, así no hay dos archivos distintos.
 */

export type DepsPdf = {
  ahora?: () => Date;
  leer?: (clave: string) => Promise<Uint8Array>;
  subir?: (clave: string, bytes: Uint8Array, tipo: string) => Promise<void>;
  /** Nombre de la organización (las pruebas lo fijan; si no, sale de la marca del workspace). */
  organizacion?: string;
};

export type ResultadoPdf =
  | { ok: true; contratoId: string; workspaceId: string; pdfKey: string; pdfHash: string; yaExistia: boolean }
  | { ok: false; codigo: string };

const no = (codigo: string): ResultadoPdf => ({ ok: false, codigo });

class Corte extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
  }
}

/** La clave del PDF de una versión de un contrato. */
export function clavePdf(workspaceId: string, contratoId: string, numero: string, version: number): string {
  const limpio = numero.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "contrato";
  return `contratos/${workspaceId}/${contratoId}/contrato-${limpio}-v${version}.pdf`;
}

export function huellaPdf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function registrarFalla(donde: string, e: unknown): void {
  const err = e as { name?: string; code?: unknown } | null;
  console.error(`[contratos] ${donde} falló`, { error: err?.name ?? "desconocido", codigo: typeof err?.code === "string" ? err.code : null });
}

/**
 * Genera y guarda el PDF del contrato `contratoId` (debe estar FIRMADO por las partes, no en papel).
 * Nunca lanza: devuelve un código.
 */
export async function generarPdfContrato(contratoId: string, deps: DepsPdf = {}): Promise<ResultadoPdf> {
  if (typeof contratoId !== "string" || !contratoId || contratoId.length > 64) return no("DATOS");
  const ahora = (deps.ahora ?? (() => new Date()))();
  const leer = deps.leer ?? leerObjetoContrato;
  const subir = deps.subir ?? subirObjetoContrato;
  try {
    const inicial = await prisma.fotofficeContrato.findFirst({ where: { id: contratoId }, select: { workspaceId: true } });
    if (!inicial) return no("NO_EXISTE");
    const workspaceId = inicial.workspaceId;
    const organizacion = deps.organizacion ?? (await loadWorkspaceEmailContext(workspaceId)).organizationName;
    const ajustes = await leerAjustesContratos(workspaceId);

    // 1) Lecturas, firmas y armado del PDF FUERA de toda transacción (R2 lento no vence ningún candado).
    const c = await prisma.fotofficeContrato.findFirst({
      where: { id: contratoId, workspaceId },
      select: { id: true, number: true, name: true, status: true, currentVersionId: true, manualSignedAt: true, pdfKey: true, pdfHash: true },
    });
    if (!c) throw new Corte("NO_EXISTE");
    if (c.status !== "FIRMADO" || c.manualSignedAt || !c.currentVersionId) throw new Corte("NO_FIRMADO");
    const v = await prisma.fotofficeContratoVersion.findFirst({
      where: { id: c.currentVersionId, workspaceId, contratoId },
      select: { id: true, number: true, bodyText: true, contentHash: true, revokedAt: true },
    });
    if (!v || v.revokedAt) throw new Corte("SIN_VERSION");

    const clave = clavePdf(workspaceId, contratoId, c.number, v.number);
    if (c.pdfKey === clave && c.pdfHash) return { ok: true, contratoId, workspaceId, pdfKey: clave, pdfHash: c.pdfHash, yaExistia: true };

    // El texto sellado tiene que ser el que se firmó: si la huella guardada ya no coincide, no se sella.
    if (huellaTexto(v.bodyText) !== v.contentHash) throw new Corte("HUELLA_DISTINTA");

    const firmantes = await prisma.fotofficeContratoFirmante.findMany({
      where: { workspaceId, versionId: v.id },
      orderBy: [{ orden: "asc" }],
      select: {
        id: true, orden: true, name: true, docNumber: true, email: true, typedName: true, signatureKey: true, signedAt: true,
        verifiedAt: true, ipHash: true, userAgent: true,
      },
    });
    if (firmantes.length === 0 || firmantes.some((f) => !f.signedAt || !f.signatureKey)) throw new Corte("FALTAN_FIRMAS");

    let firmaEmpresa: Uint8Array | null = null;
    try {
      if (ajustes.companySignatureKey) firmaEmpresa = await leer(ajustes.companySignatureKey);
    } catch (e) {
      registrarFalla("leer la firma de la empresa", e);
      throw new Corte("LECTURA_FIRMA_EMPRESA");
    }
    const dibujos: Uint8Array[] = [];
    for (const f of firmantes) {
      try {
        dibujos.push(await leer(f.signatureKey!));
      } catch (e) {
        registrarFalla("leer la firma de un firmante", e);
        throw new Corte("LECTURA_FIRMA");
      }
    }

    const salida = await construirPdf({
      organizacion,
      numero: c.number,
      nombre: c.name,
      version: v.number,
      texto: v.bodyText,
      huellaTexto: v.contentHash,
      empresa: { nombre: ajustes.companyName?.trim() || organizacion, firmaImagen: firmaEmpresa },
      firmantes: firmantes.map((f, i) => ({
        orden: f.orden, nombre: f.name, documento: f.docNumber, email: f.email, nombreEscrito: f.typedName, firmaPng: dibujos[i]!,
        firmadoEn: f.signedAt, verificadoEn: f.verifiedAt, ipHash: f.ipHash, userAgent: f.userAgent,
      })),
      generadoEn: ahora,
    });
    const hash = huellaPdf(salida.bytes);

    // 2) Escritura corta y condicional, con el candado: si otra corrida ya dejó el PDF de esta versión, se
    //    descarta lo armado (sin subir nada, así no se pisa el archivo cuya huella ya quedó guardada). La subida
    //    es de un solo objeto, ya armado: es lo único de R2 que queda dentro del candado.
    return await prisma.$transaction(async (tx): Promise<ResultadoPdf> => {
      await bloquearContrato(tx, contratoId);
      const ahoraC = await tx.fotofficeContrato.findFirst({
        where: { id: contratoId, workspaceId },
        select: { status: true, currentVersionId: true, manualSignedAt: true, pdfKey: true, pdfHash: true },
      });
      if (!ahoraC) throw new Corte("NO_EXISTE");
      if (ahoraC.pdfKey === clave && ahoraC.pdfHash) return { ok: true, contratoId, workspaceId, pdfKey: clave, pdfHash: ahoraC.pdfHash, yaExistia: true };
      if (ahoraC.status !== "FIRMADO" || ahoraC.manualSignedAt || ahoraC.currentVersionId !== v.id) throw new Corte("NO_FIRMADO");
      const vigente = await tx.fotofficeContratoVersion.findFirst({ where: { id: v.id, workspaceId, contratoId }, select: { revokedAt: true } });
      if (!vigente || vigente.revokedAt) throw new Corte("SIN_VERSION");
      await subir(clave, salida.bytes, "application/pdf");
      const r = await tx.fotofficeContrato.updateMany({
        where: { id: contratoId, workspaceId, status: "FIRMADO", currentVersionId: v.id },
        data: { pdfKey: clave, pdfHash: hash, pdfSentAt: null },
      });
      if (r.count !== 1) throw new Corte("NO_FIRMADO");
      await registrarEvento(tx, { workspaceId, contratoId, tipo: "PDF_GENERADO", data: { version: v.number, paginas: salida.paginas, reemplazados: salida.reemplazados } });
      return { ok: true, contratoId, workspaceId, pdfKey: clave, pdfHash: hash, yaExistia: false };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.codigo);
    registrarFalla("generar el PDF", e);
    return no("ERROR");
  }
}
