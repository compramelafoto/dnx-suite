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
import { guia as primerosPasosMostrador } from "./guias/primeros-pasos-mostrador";
import { guia as cajaAbrirTurno } from "./guias/caja-abrir-turno";
import { guia as cajaCerrarTurno } from "./guias/caja-cerrar-turno";
import { guia as cajaGastosYRetiros } from "./guias/caja-gastos-y-retiros";
import { guia as mostradorTransferenciaYQr } from "./guias/mostrador-transferencia-y-qr";
import { guia as mostradorAnularVenta } from "./guias/mostrador-anular-venta";
import { guia as fotoCarnet } from "./guias/foto-carnet";
import { guia as mostradorPedidoLaboratorio } from "./guias/mostrador-pedido-laboratorio";
import { guia as clientesBuscarYAlta } from "./guias/clientes-buscar-y-alta";
import { guia as pedidosNuevoYConfirmar } from "./guias/pedidos-nuevo-y-confirmar";
import { guia as pedidosFichaYCobros } from "./guias/pedidos-ficha-y-cobros";
import { guia as pedidosCuotasEstadoYEnvios } from "./guias/pedidos-cuotas-estado-y-envios";
import { guia as galeriasCrearYPublicar } from "./guias/galerias-crear-y-publicar";
import { guia as galeriasCompartirYSeleccion } from "./guias/galerias-compartir-y-seleccion";
import { guia as trabajosTomarConSena } from "./guias/trabajos-tomar-con-sena";
import { guia as trabajosRetiroYSaldo } from "./guias/trabajos-retiro-y-saldo";
import { guia as trabajosTableroEnCurso } from "./guias/trabajos-tablero-en-curso";
import { guia as trabajosEnviarAlProveedor } from "./guias/trabajos-enviar-al-proveedor";
import { guia as trabajosFichaYEtapas } from "./guias/trabajos-ficha-y-etapas";
import { guia as digitalizacionGrabarCassette } from "./guias/digitalizacion-grabar-cassette";
import { guia as digitalizacionEntregarVideos } from "./guias/digitalizacion-entregar-videos";
import { guia as digitalizacionConfiguracionYProblemas } from "./guias/digitalizacion-configuracion-y-problemas";
import { guia as stockCargarPasoAPaso } from "./guias/stock-cargar-paso-a-paso";
import { guia as stockInsumosAlta } from "./guias/stock-insumos-alta";
import { guia as stockRecetaConsumo } from "./guias/stock-receta-consumo";
import { guia as stockEmbalaje } from "./guias/stock-embalaje";
import { guia as stockContarYAjustar } from "./guias/stock-contar-y-ajustar";
import { guia as stockRecibirPedido } from "./guias/stock-recibir-pedido";
import { guia as stockImportarFactura } from "./guias/stock-importar-factura";
import { guia as stockImportarConChatgpt } from "./guias/stock-importar-con-chatgpt";
import { guia as stockAvisosYCompras } from "./guias/stock-avisos-y-compras";

/** Todas las guías, en el orden en que aparecen dentro de cada sección del índice. */
export const INSTRUCTIVOS: readonly Instructivo[] = [
  // Primeros pasos
  primerosPasosMostrador,
  primerosPasos,
  // Caja, en el orden del día: abrir, gastos, cerrar, corregir
  cajaAbrirTurno,
  cajaGastosYRetiros,
  cajaCerrarTurno,
  cajaMovimientosYArqueo,
  // Mostrador
  ventasMostrador,
  mostradorTransferenciaYQr,
  mostradorAnularVenta,
  fotoCarnet,
  mostradorPedidoLaboratorio,
  // Trabajos y entregas, en el orden en que pasa un trabajo
  trabajosTomarConSena,
  trabajosTableroEnCurso,
  trabajosEnviarAlProveedor,
  trabajosFichaYEtapas,
  trabajosRetiroYSaldo,
  // Digitalización de VHS y DVD, en el orden del circuito: grabar, entregar, resolver
  digitalizacionGrabarCassette,
  digitalizacionEntregarVideos,
  digitalizacionConfiguracionYProblemas,
  // Stock de insumos
  stockCargarPasoAPaso,
  stockInsumosAlta,
  stockRecetaConsumo,
  stockEmbalaje,
  stockContarYAjustar,
  stockRecibirPedido,
  stockImportarFactura,
  stockImportarConChatgpt,
  stockAvisosYCompras,
  // Clientes y pedidos
  clientesBuscarYAlta,
  pedidosNuevoYConfirmar,
  pedidosFichaYCobros,
  pedidosCuotasEstadoYEnvios,
  // Galerías
  galeriasCrearYPublicar,
  galeriasCompartirYSeleccion,
  // Institución
  carnetsPdfImprimir,
  sociosBuscarYFicha,
  sociosSolicitudes,
  cuotasRegistrarPago,
  placasBienvenidaYSocioDeLaSemana,
  campanasDeCorreo,
  blogPublicarArticulo,
  proyectosYTareas,
  reunionesYActas,
  votaciones,
  comisionRolesYCargos,
  reservasCargarYConfirmar,
  sorteosConducir,
  cursosEInscripciones,
];

export function buscarInstructivo(slug: string): Instructivo | null {
  return INSTRUCTIVOS.find((g) => g.slug === slug) ?? null;
}
