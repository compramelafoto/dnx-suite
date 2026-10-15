import type { Instructivo } from "../tipos";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";


export const guia: Instructivo = {
  slug: "carnets-pdf-imprimir",
  titulo: "Generar y descargar el PDF de un carnet para imprimir",
  resumen:
    "Cómo encontrar un carnet pedido, bajar su PDF listo para la imprenta y registrar que se imprimió y se entregó.",
  seccion: "Socios",
  moduleKey: MEMBERS_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Entrá a Carnets",
      texto: [
        "En el menú lateral, abrí Comunicación y elegí Carnets. Si administrás el padrón, lo vas a encontrar en Socios → Carnets.",
        "Si no ves la opción, tu rol no tiene permiso para operar carnets: pedíselo a Presidencia o Secretaría.",
      ],
    },
    {
      titulo: "Conocé el tablero",
      texto: [
        "Cada fila es un carnet impreso que alguien pidió. Arriba hay filtros por etapa: Por cobrar (el socio todavía no pagó), Para imprimir (pagados, esperando la imprenta), Para entregar (ya impresos) y Cerrados (entregados o anulados).",
        "El número al lado de cada filtro te dice cuántos carnets hay en esa etapa.",
      ],
    },
    {
      titulo: "Si hay tarjetas pagadas sin emitir, emitilas",
      texto: [
        "Cuando aparece el recuadro «Tarjetas pagadas sin emitir», son socios que ya pagaron su tarjeta pero todavía no tienen el pedido armado. Tocá Emitir al lado de cada nombre y confirmá.",
        "Al emitirla pasa directo a «Para imprimir». No genera ningún cobro nuevo.",
      ],
      nota: "Si el recuadro no aparece, no hay nada pendiente de emitir: seguí con el paso siguiente.",
    },
    {
      titulo: "Abrí los carnets «Para imprimir»",
      texto: [
        "Tocá el filtro Para imprimir. Buscá el socio en la lista y tocá Detalle, a la derecha de su fila.",
        "Se abre la historia del carnet (quién lo pidió, cuándo pagó) y los botones disponibles.",
      ],
    },
    {
      titulo: "Descargá el PDF",
      texto: [
        "Tocá Descargar PDF. El archivo se genera en el momento con el diseño vigente del carnet y se abre en una pestaña nueva. Desde ahí lo guardás en la computadora o lo mandás a la imprenta.",
        "El PDF trae las dos caras del carnet en tamaño real (85,6 × 54 mm, como una tarjeta de crédito) con 3 mm de sangrado, que es el margen extra que pide la imprenta para el corte.",
      ],
      nota: "La descarga queda anotada en la historia del carnet como «PDF descargado», pero no cambia su etapa. Un carnet por cobrar o anulado no permite descargar el PDF.",
    },
    {
      titulo: "Imprimilo en tamaño real",
      texto: [
        "Si lo imprimís vos, elegí escala 100 % o «Tamaño real» en el cuadro de impresión. No uses «Ajustar a la página»: cambiaría la medida del carnet.",
        "Si lo lleva una imprenta, mandales el PDF tal como se descargó: ya tiene el sangrado que necesitan.",
      ],
    },
    {
      titulo: "Marcá el carnet como impreso",
      texto: [
        "De vuelta en el tablero, tocá Marcar impreso en la fila del carnet. Si imprimiste varios, tildá la casilla de cada uno y usá el botón de arriba para marcarlos todos juntos.",
        "El carnet pasa a «Para entregar» y queda registrado quién lo marcó y cuándo.",
      ],
    },
    {
      titulo: "Registrá la entrega",
      texto: [
        "Cuando el carnet está en la sede, tocá Listo para retirar: el socio recibe el aviso. Si lo mandás por correo, usá Registrar envío y escribí cómo se despachó (por ejemplo, el número de seguimiento).",
        "Cuando el socio lo tiene en la mano, tocá Marcar entregado. El carnet pasa a «Cerrados».",
      ],
    },
  ],
};
