import type { Instructivo } from "./tipos";
import { guia as primerosPasos } from "./guias/primeros-pasos";
import { guia as carnetsPdfImprimir } from "./guias/carnets-pdf-imprimir";
import { guia as sociosBuscarYFicha } from "./guias/socios-buscar-y-ficha";
import { guia as sociosSolicitudes } from "./guias/socios-solicitudes";
import { guia as placasBienvenidaYSocioDeLaSemana } from "./guias/placas-bienvenida-y-socio-de-la-semana";
import { guia as campanasDeCorreo } from "./guias/campanas-de-correo";
import { guia as blogPublicarArticulo } from "./guias/blog-publicar-articulo";
import { guia as proyectosYTareas } from "./guias/proyectos-y-tareas";
import { guia as reunionesYActas } from "./guias/reuniones-y-actas";
import { guia as votaciones } from "./guias/votaciones";
import { guia as comisionRolesYCargos } from "./guias/comision-roles-y-cargos";
import { guia as cuotasRegistrarPago } from "./guias/cuotas-registrar-pago";
import { guia as cajaMovimientosYArqueo } from "./guias/caja-movimientos-y-arqueo";
import { guia as ventasMostrador } from "./guias/ventas-mostrador";
import { guia as reservasCargarYConfirmar } from "./guias/reservas-cargar-y-confirmar";
import { guia as sorteosConducir } from "./guias/sorteos-conducir";
import { guia as cursosEInscripciones } from "./guias/cursos-e-inscripciones";

/** Todas las guías, en el orden en que aparecen dentro de cada sección del índice. */
export const INSTRUCTIVOS: readonly Instructivo[] = [
  primerosPasos,
  carnetsPdfImprimir,
  sociosBuscarYFicha,
  sociosSolicitudes,
  placasBienvenidaYSocioDeLaSemana,
  campanasDeCorreo,
  blogPublicarArticulo,
  proyectosYTareas,
  reunionesYActas,
  votaciones,
  comisionRolesYCargos,
  cuotasRegistrarPago,
  cajaMovimientosYArqueo,
  ventasMostrador,
  reservasCargarYConfirmar,
  sorteosConducir,
  cursosEInscripciones,
];

export function buscarInstructivo(slug: string): Instructivo | null {
  return INSTRUCTIVOS.find((g) => g.slug === slug) ?? null;
}
