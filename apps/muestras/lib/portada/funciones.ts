/**
 * Lo que se puede hacer con una muestra, paso a paso, para la portada. Es una secuencia real
 * (de crear la muestra al archivo), por eso la portada la numera. Para cambiar el texto
 * alcanza con tocar esta lista.
 */
export type PasoMuestra = { titulo: string; items: string[] };

export const PASOS_MUESTRA: PasoMuestra[] = [
  {
    titulo: "Creá tu muestra",
    items: [
      "Ficha completa: fechas, horarios, entrada y sede marcada en el mapa.",
      "Muestras presenciales, virtuales o itinerantes por varias sedes.",
      "Sumá coorganizadores y curadores.",
      "También charlas, talleres, salidas fotográficas, presentaciones de libros y proyecciones.",
    ],
  },
  {
    titulo: "Convocá y seleccioná",
    items: [
      "Abrí una convocatoria online para que los fotógrafos envíen sus obras.",
      "Hacé la curaduría online, privada y anónima: el equipo curatorial ve las obras sin el nombre del autor, las puntúa y las filtra.",
      "O conectá tu concurso de FotoRank y armá la muestra con los ganadores y preseleccionados.",
    ],
  },
  {
    titulo: "Gestioná obras y artistas",
    items: [
      "Hasta 40 obras con título, autor, año y técnica, en el orden que elijas y con destacadas.",
      "Perfil público de cada fotógrafo, con su biografía y sus obras.",
      "Elegí obra por obra qué va a la galería, qué se imprime y qué se vende.",
      "Cada autor autoriza la exhibición y la venta con un clic.",
    ],
  },
  {
    titulo: "Montá la muestra",
    items: [
      "Marcos y remarcos con plantilla, con título y autor.",
      "Fichas de sala con código QR que lleva a la obra, al autor y a la compra.",
      "PDF listo para imprenta.",
      "Cartel con el texto curatorial y catálogo de la muestra.",
      "Plano y lista de montaje: qué obra va en cada pared, con medidas.",
    ],
  },
  {
    titulo: "Difundila",
    items: [
      "Mapa nacional de muestras y actividades.",
      "Ficha pública con galería virtual.",
      "Publicación en el blog de tu institución y en el portal de sus socios.",
      "Resumen semanal por mail a quienes están cerca.",
      "Piezas para redes, listas para compartir.",
      "Invitación a la inauguración con confirmación de asistencia.",
    ],
  },
  {
    titulo: "Vendé las obras",
    items: [
      "Copias impresas y archivos digitales.",
      "Cobro con Mercado Pago, repartido entre organizador, fotógrafo y plataforma.",
      "Seguimiento de cada impresión hasta la entrega.",
      "Ediciones limitadas y numeradas, con certificado de autenticidad y QR para verificarlas.",
    ],
  },
  {
    titulo: "Después de la muestra",
    items: [
      "Archivo permanente con la galería completa.",
      "Estadísticas de visitas, escaneos de QR y ventas.",
      "Libro de visitas digital para que el público deje sus comentarios.",
    ],
  },
];
