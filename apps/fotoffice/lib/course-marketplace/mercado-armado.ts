import { beneficiariosParaMotor } from "./beneficiarios";
import type { BeneficiarioEntrada } from "./reparto";
import type { EstadoReventa } from "./reventa";

export type CursoEnMercado = {
  courseId: string;
  titulo: string;
  docente: string | null;
  dueno: { workspaceId: string; nombre: string };
  listaCentavos: number;
  sugeridoBps: number;
  clases: number;
  muestraUrl: string | null;
  beneficiarios: BeneficiarioEntrada[];
  miAcuerdo: { id: string; status: EstadoReventa; shareBps: number; memberDiscountBps: number } | null;
};


export type FilaDeCurso = {
  id: string;
  title: string;
  slug: string;
  instructorName: string | null;
  priceArs: { toString(): string } | number | null;
  suggestedResellerBps: number | null;
  workspaceId: string;
  lessons: Array<{ id: string; isPreview: boolean }>;
  beneficiaries: Array<{ id: string; workspaceId: string | null; invitedEmail: string | null; shareBps: number; absorbsProcessorFee: boolean }>;
  resaleAgreements: Array<{ id: string; status: string; shareBps: number; memberDiscountBps: number }>;
};

/**
 * Pasa las filas de la base a lo que viaja al navegador. Lo que sale es lo mínimo para simular:
 * de los beneficiarios, sólo el % y quién absorbe la comisión de Mercado Pago, con un rótulo
 * ("Invitado" si todavía no tiene negocio). Nunca correos ni ids de negocios ajenos.
 */
export function armarCursosEnMercado(entrada: {
  filas: FilaDeCurso[];
  nombres: Map<string, string>;
  slugs: Map<string, string>;
  baseUrl: string;
}): CursoEnMercado[] {
  return entrada.filas.map((f) => {
    const dueno = { workspaceId: f.workspaceId, nombre: entrada.nombres.get(f.workspaceId) ?? "Negocio" };
    const muestra = f.lessons.find((l) => l.isPreview);
    const slug = entrada.slugs.get(f.workspaceId);
    // Los ids se reemplazan por la posición: el simulador no necesita saber quién es quién.
    const beneficiarios = beneficiariosParaMotor(
      dueno,
      f.beneficiaries.map((b, i) => ({
        id: `b${i}`,
        workspaceId: null,
        shareBps: b.shareBps,
        absorbsProcessorFee: b.absorbsProcessorFee,
        nombre: b.workspaceId ? entrada.nombres.get(b.workspaceId) ?? "Negocio" : "Invitado",
      })),
    ).map((b): BeneficiarioEntrada => ({ id: b.id === dueno.workspaceId ? "dueno" : b.id, nombre: b.nombre, bps: b.bps, absorbeMp: b.absorbeMp }));
    const acuerdo = f.resaleAgreements[0];
    return {
      courseId: f.id,
      titulo: f.title,
      docente: f.instructorName,
      dueno: { workspaceId: dueno.workspaceId, nombre: dueno.nombre },
      listaCentavos: Math.round(Number(f.priceArs ?? 0) * 100),
      sugeridoBps: f.suggestedResellerBps ?? 0,
      clases: f.lessons.length,
      // La muestra se ve en el sitio del dueño: los videos sólo se reproducen desde FOTOFFICE.
      muestraUrl: muestra && slug && entrada.baseUrl ? `${entrada.baseUrl}/w/${slug}/cursos/${f.slug}/muestra/${muestra.id}` : null,
      beneficiarios,
      miAcuerdo: acuerdo
        ? { id: acuerdo.id, status: acuerdo.status as EstadoReventa, shareBps: acuerdo.shareBps, memberDiscountBps: acuerdo.memberDiscountBps }
        : null,
    };
  });
}
