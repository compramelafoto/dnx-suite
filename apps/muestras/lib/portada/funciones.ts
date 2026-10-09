/**
 * Lo que se puede hacer con una muestra, paso a paso, para la portada. Es una secuencia real
 * (de crear la muestra al archivo), por eso la portada la numera. Para cambiar el texto
 * alcanza con tocar esta lista.
 *
 * La protagonista es la muestra en la sala: cada paso habla de la sede, el montaje, la
 * inauguración y las visitas. Lo online aparece como medio (para convocar, difundir y vender),
 * nunca como reemplazo de la visita.
 */
export type PasoMuestra = { titulo: string; items: string[] };

export const PASOS_MUESTRA: PasoMuestra[] = [
  {
    titulo: "Creá tu muestra",
    items: [
      "Ficha con la sede marcada en el mapa, fechas, horarios, entrada y día de la inauguración.",
      "Muestras itinerantes: la misma muestra en varias sedes, cada una con sus fechas.",
      "Sumá coorganizadores y curadores.",
      "También charlas, talleres, salidas fotográficas, presentaciones de libros y proyecciones.",
    ],
  },
  {
    titulo: "Convocá y seleccioná",
    items: [
      "Abrí una convocatoria para que los fotógrafos envíen sus obras desde cualquier lugar.",
      "Hacé la curaduría a distancia, privada y anónima: el equipo curatorial ve las obras sin el nombre del autor, las puntúa y las filtra.",
      "O conectá tu concurso de FotoRank y llevá a la sala a los ganadores y preseleccionados.",
    ],
  },
  {
    titulo: "Gestioná obras y artistas",
    items: [
      "Hasta 40 obras con título, autor, año y técnica, en el orden que elijas y con destacadas.",
      "Perfil público de cada fotógrafo, con su biografía y las muestras donde expuso.",
      "Elegí obra por obra qué se cuelga, qué se imprime y qué se vende.",
      "Cada autor autoriza la exhibición y la venta con un clic.",
    ],
  },
  {
    titulo: "Montá la muestra en la sala",
    items: [
      "Plano y lista de montaje: qué obra va en cada pared, con medidas.",
      "Fichas de sala con código QR: quien la visita escanea y ve la obra, el autor y cómo comprarla.",
      "Marcos y remarcos con plantilla, con título y autor.",
      "Cartel con el texto curatorial y catálogo de la muestra.",
      "PDF listo para imprenta.",
    ],
  },
  {
    titulo: "Llevá gente a la sala",
    items: [
      "Tu muestra en el mapa nacional, con dirección, horarios y cómo llegar.",
      "Invitación a la inauguración con confirmación de asistencia.",
      "Ficha pública con un anticipo online: una selección de obras que invita a ir a verlas.",
      "Resumen semanal por mail a quienes viven cerca.",
      "Piezas para redes, listas para compartir.",
      "Publicación en el blog de tu institución y en el portal de sus socios.",
    ],
  },
  {
    titulo: "Vendé copias de las obras",
    items: [
      "Quien recorre la muestra compra desde el QR de la ficha de sala.",
      "Copias impresas y archivos digitales.",
      "Cobro con Mercado Pago, repartido entre organizador, fotógrafo y plataforma.",
      "Seguimiento de cada impresión hasta la entrega.",
      "Ediciones limitadas y numeradas, con certificado de autenticidad y QR para verificarlas.",
    ],
  },
  {
    titulo: "Después de la muestra",
    items: [
      "Archivo de la muestra: todas las obras que se colgaron, para quien no llegó a verla.",
      "Estadísticas de visitas a la ficha, escaneos de QR en la sala y ventas.",
      "Libro de visitas digital para que el público deje sus comentarios.",
    ],
  },
];
