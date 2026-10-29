/**
 * Diplomas: una hoja A4 con el título, el nombre del alumno, el motivo, el curso y colegio, la
 * fecha y dos firmas. El título, el motivo y la fecha son «Datos de la plantilla»: el fotógrafo
 * los escribe una vez y valen para todo el curso. Con foto individual o sin foto, con logo del
 * colegio o sin él.
 */
import type { Armador, Estilo, Rect } from "../lienzo";
import { FORMATOS, Hoja } from "./hoja";
import { TEMAS, escala, fondoCon, type ClaveDeTema, type FormaDeFoto, type Tema } from "./temas";
import type { EstiloDeCatalogo, ModeloProducto } from "./tipo";

const tam = (e: Estilo, k: number, por = 1): Estilo => ({ ...e, tam: Math.round(e.tam * k * por) });

type Textos = {
  titulo: string;
  motivo: string;
  fecha: string;
  /** La línea antes del nombre. */
  otorga?: string;
  firmas?: [string, string];
};

type Disposicion = "apaisado-con-foto" | "apaisado-sin-foto" | "vertical-con-foto";

/** Dónde va cada cosa, para el fondo (marcos, líneas) y para los bloques. */
function medidas(t: Tema, h: Hoja, disp: Disposicion, conLogo: boolean, forma: FormaDeFoto) {
  const k = escala(h);
  const m = h.mm(t.margenMm);
  const foto: Rect | null =
    disp === "apaisado-con-foto"
      ? forma === "circle"
        ? { x: m + 110 * k, y: h.cy - 400 * k - 60 * k, w: 800 * k, h: 800 * k }
        : { x: m + 110 * k, y: h.cy - 470 * k - 60 * k, w: 720 * k, h: 900 * k }
      : disp === "vertical-con-foto"
        ? forma === "circle"
          ? { x: h.cx - 420 * k, y: m + (conLogo ? 560 : 420) * k, w: 840 * k, h: 840 * k }
          : { x: h.cx - 380 * k, y: m + (conLogo ? 560 : 420) * k, w: 760 * k, h: 920 * k }
        : null;
  const x0 = disp === "apaisado-con-foto" ? foto!.x + foto!.w + 150 * k : m + 90 * k;
  const x1 = h.w - m - 90 * k;
  const cx = (x0 + x1) / 2;
  const ancho = x1 - x0;
  const logo: Rect | null = conLogo
    ? disp === "vertical-con-foto"
      ? h.centrado(m + 40 * k, 420 * k, 250 * k)
      : h.centrado(m + 10 * k, 380 * k, 220 * k, cx)
    : null;
  // El título: arriba de la foto en el vertical; en el apaisado, arriba de todo.
  const yTitulo = disp === "vertical-con-foto" ? m + (conLogo ? 300 : 120) * k : m + (conLogo ? 250 : 110) * k;
  const yTexto = disp === "vertical-con-foto" ? foto!.y + foto!.h + 70 * k : yTitulo + 300 * k;
  const yFirmas = h.h - m - 240 * k;
  return { k, m, foto, x0, x1, cx, ancho, logo, yTitulo, yTexto, yFirmas };
}

function disenar(
  tema: Tema,
  disp: Disposicion,
  textos: Textos,
  opciones: { logo: boolean; forma: FormaDeFoto },
): Pick<ModeloProducto, "hojas" | "armar"> {
  const textoDe = (h: Hoja) => medidas(tema, h, disp, opciones.logo, opciones.forma);
  const lineaNombre = (h: Hoja) => {
    const d = textoDe(h);
    return { y: d.yTexto + 110 * d.k + 290 * d.k, x0: d.cx - Math.min(d.ancho * 0.36, 800 * d.k), x1: d.cx + Math.min(d.ancho * 0.36, 800 * d.k) };
  };
  return {
    hojas: [
      {
        nombre: "Diploma",
        fondo: (h) => {
          const d = textoDe(h);
          const l = lineaNombre(h);
          return fondoCon(
            tema,
            h,
            (d.foto ? tema.marcoFoto(d.foto, opciones.forma, h) : "") + (tema.lineaNombre?.(l.x0, l.x1, l.y, h) ?? ""),
          );
        },
      },
    ],
    armar: (a: Armador, h: Hoja) => {
      const d = textoDe(h);
      const F = tema.fuentes;
      const k = d.k;
      if (d.foto) a.foto(0, "individual", d.foto, { mascara: opciones.forma === "circle" ? "circle" : "rect" });
      if (d.logo) a.logo(0, "logo", d.logo);
      a.variable(0, "titulo", "Título del diploma", h.centrado(d.yTitulo, d.ancho, 270 * k, d.cx), "diploma.title", textos.titulo, tam(F.titulo, k));
      let y = d.yTexto;
      a.texto(0, "otorga", "Texto antes del nombre", h.centrado(y, d.ancho, 100 * k, d.cx), textos.otorga ?? "Se otorga el presente diploma a", tam(F.chico, k, 1.2));
      y += 110 * k;
      a.variable(0, "alumno", "Nombre del alumno", h.centrado(y, d.ancho, 290 * k, d.cx), "student.fullName", "Nombre del alumno", tam(F.nombre, k, 1.15));
      y += 330 * k;
      a.variable(0, "motivo", "Motivo", h.centrado(y, Math.min(d.ancho, 2000 * k), 230 * k, d.cx), "diploma.reason", textos.motivo, {
        ...tam(F.cuerpo, k, 1.12),
        interlineado: 1.3,
      });
      y += 250 * k;
      a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(y, d.ancho, 100 * k, d.cx), "course.withSchool", "Curso - Colegio", tam(F.chico, k, 1.15));
      y += 105 * k;
      a.variable(0, "fecha", "Fecha del diploma", h.centrado(y, d.ancho, 90 * k, d.cx), "diploma.date", textos.fecha, tam(F.chico, k));

      // Firmas: una línea y debajo quién firma. Son bloques: se pueden mover o borrar.
      const firmas = textos.firmas ?? ["Docente", "Dirección"];
      const anchoFirma = Math.min(680 * k, d.ancho * 0.4);
      const sep = Math.min(d.ancho * 0.27, 700 * k);
      firmas.forEach((quien, i) => {
        const cx = d.cx + (i === 0 ? -sep : sep);
        a.forma(0, `firma_${i + 1}_linea`, `Línea de firma ${i + 1}`, { x: cx - anchoFirma / 2, y: d.yFirmas + 90 * k, w: anchoFirma, h: 5 * k }, { relleno: tema.tinta, opacidad: 0.7 });
        a.texto(0, `firma_${i + 1}`, `Firma ${i + 1}`, h.centrado(d.yFirmas + 110 * k, anchoFirma + 120 * k, 80 * k, cx), quien, tam(F.chico, k));
      });
    },
  };
}

type Pedido = {
  slug: string;
  nombre: string;
  tema: ClaveDeTema;
  categoria: "Jardín" | "Primaria" | "Secundaria" | "Egresados" | "Formal" | "Religioso";
  estilo: EstiloDeCatalogo;
  evento?: string;
  disp: Disposicion;
  logo: boolean;
  forma?: FormaDeFoto;
  textos: Textos;
  etiquetas: string[];
  /** Una frase para la descripción del catálogo. */
  como: string;
};

const FECHA = "Diciembre de 2026";

const PEDIDOS: Pedido[] = [
  /* ---- Jardín ---- */
  {
    slug: "jardin-arcoiris", nombre: "Diploma Jardín · Arcoíris", tema: "arcoiris", categoria: "Jardín", estilo: "Divertido", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: true,
    textos: { titulo: "¡Diploma de egreso!", motivo: "Por haber terminado con alegría su paso por el Nivel Inicial", fecha: FECHA },
    etiquetas: ["arcoíris", "acuarela", "egreso de sala de 5"], como: "arcoíris de acuarela en las esquinas y nubes",
  },
  {
    slug: "jardin-animalitos", nombre: "Diploma Jardín · Animalitos", tema: "animalitos", categoria: "Jardín", estilo: "Divertido", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: false,
    textos: { titulo: "Diploma", motivo: "Por todo lo que aprendió y compartió este año en el jardín", fecha: FECHA },
    etiquetas: ["animales", "osito", "conejo"], como: "osito, conejito, gatito y pollito en el pasto",
  },
  {
    slug: "jardin-estrellas", nombre: "Diploma Jardín · Noche de estrellas", tema: "estrellas", categoria: "Jardín", estilo: "Divertido", evento: "Fin de año",
    disp: "vertical-con-foto", logo: true,
    textos: { titulo: "¡Sos una estrella!", motivo: "Por brillar todos los días en la sala", fecha: FECHA },
    etiquetas: ["estrellas", "luna", "noche"], como: "cielo azul de noche con luna y estrellas",
  },
  {
    slug: "jardin-crayones", nombre: "Diploma Jardín · Crayones", tema: "crayones", categoria: "Jardín", estilo: "Divertido", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Diploma de egreso", motivo: "Por haber finalizado el Nivel Inicial", fecha: FECHA, firmas: ["Seño", "Dirección"] },
    etiquetas: ["crayones", "dibujo", "colores"], como: "bordes en zigzag pintados con crayón",
  },
  {
    slug: "jardin-globos", nombre: "Diploma Jardín · Globos", tema: "globos", categoria: "Jardín", estilo: "Divertido", evento: "Fin de año",
    disp: "vertical-con-foto", logo: false,
    textos: { titulo: "¡Felicitaciones!", motivo: "Por terminar la sala con muchas ganas de seguir creciendo", fecha: FECHA, firmas: ["Seño", "Dirección"] },
    etiquetas: ["globos", "confeti", "fiesta"], como: "ramos de globos y confeti",
  },
  {
    slug: "jardin-flores", nombre: "Diploma Jardín · Flores pastel", tema: "floresPastel", categoria: "Jardín", estilo: "Clásico", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: true,
    textos: { titulo: "Diploma de egreso", motivo: "Por haber finalizado con éxito el Nivel Inicial", fecha: FECHA },
    etiquetas: ["flores", "pastel", "delicado"], como: "ramitos de flores en tonos pastel",
  },
  {
    slug: "jardin-sin-foto-arcoiris", nombre: "Diploma Jardín · Arcoíris sin foto", tema: "arcoiris", categoria: "Jardín", estilo: "Divertido", evento: "Fin de año",
    disp: "apaisado-sin-foto", logo: true,
    textos: { titulo: "Diploma", motivo: "Por su alegría y su compañerismo durante todo el año", fecha: FECHA },
    etiquetas: ["arcoíris", "sin foto"], como: "arcoíris de acuarela, sin foto (para imprimir aparte)",
  },
  /* ---- Primaria ---- */
  {
    slug: "primaria-pizarron", nombre: "Diploma Primaria · Pizarrón", tema: "pizarron", categoria: "Primaria", estilo: "Divertido", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Diploma de honor", motivo: "Por su dedicación y esfuerzo durante el ciclo lectivo 2026", fecha: FECHA, firmas: ["Maestra", "Dirección"] },
    etiquetas: ["pizarrón", "tiza", "escuela"], como: "pizarrón verde con marco de madera y dibujos en tiza",
  },
  {
    slug: "primaria-cuaderno", nombre: "Diploma Primaria · Cuaderno", tema: "cuaderno", categoria: "Primaria", estilo: "Informal", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: false, forma: "rect",
    textos: { titulo: "¡Diploma!", motivo: "Por las ganas de aprender que puso en cada clase", fecha: FECHA, firmas: ["Maestra", "Dirección"] },
    etiquetas: ["cuaderno", "renglones", "escolar"], como: "hoja de cuaderno con renglones, margen y la foto pegada con cinta",
  },
  {
    slug: "primaria-lapices", nombre: "Diploma Primaria · Lápices de colores", tema: "lapices", categoria: "Primaria", estilo: "Divertido", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: true,
    textos: { titulo: "Diploma", motivo: "Por completar con éxito el año escolar", fecha: FECHA, firmas: ["Maestra", "Dirección"] },
    etiquetas: ["lápices", "colores", "útiles"], como: "lápices de colores arriba y abajo",
  },
  {
    slug: "primaria-espacio", nombre: "Diploma Primaria · Espacio", tema: "espacio", categoria: "Primaria", estilo: "Divertido", evento: "Fin de año",
    disp: "vertical-con-foto", logo: true,
    textos: { titulo: "Misión cumplida", motivo: "Por llegar tan lejos en este año de aprendizajes", fecha: FECHA, firmas: ["Maestra", "Dirección"] },
    etiquetas: ["espacio", "planetas", "cohete"], como: "planetas, estrellas y un cohete",
  },
  {
    slug: "primaria-medalla", nombre: "Diploma Primaria · Medalla al mejor compañero", tema: "medallaDorada", categoria: "Primaria", estilo: "Divertido", evento: "Reconocimiento",
    disp: "apaisado-con-foto", logo: false,
    textos: { titulo: "Mejor compañero", motivo: "Por estar siempre dispuesto a ayudar y por su alegría contagiosa", fecha: FECHA, firmas: ["Maestra", "Dirección"] },
    etiquetas: ["medalla", "compañerismo", "premio"], como: "medalla dorada con cintas celeste y blanca",
  },
  {
    slug: "primaria-honor-clasico", nombre: "Diploma Primaria · Cuadro de honor", tema: "honor", categoria: "Primaria", estilo: "Clásico", evento: "Reconocimiento",
    disp: "apaisado-sin-foto", logo: true,
    textos: { titulo: "Cuadro de honor", motivo: "Por su excelente desempeño académico y su conducta ejemplar durante el ciclo lectivo 2026", fecha: FECHA, otorga: "Se distingue a", firmas: ["Maestra", "Dirección"] },
    etiquetas: ["honor", "dorado", "abanderado"], como: "doble marco dorado con filigranas, sin foto",
  },
  {
    slug: "primaria-egreso-septimo", nombre: "Diploma Primaria · Egreso de 7.º", tema: "honor", categoria: "Primaria", estilo: "Formal", evento: "Egreso",
    disp: "vertical-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Diploma de egreso", motivo: "Por haber completado sus estudios de Nivel Primario", fecha: FECHA, otorga: "Se otorga el presente diploma a" },
    etiquetas: ["egreso", "séptimo", "sexto"], como: "marco dorado con filigranas y la foto al centro",
  },
  /* ---- Secundaria ---- */
  {
    slug: "secundaria-geometrico", nombre: "Diploma Secundaria · Geométrico", tema: "geometrico", categoria: "Secundaria", estilo: "Moderno", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Reconocimiento", motivo: "Por su compromiso y participación durante el ciclo lectivo 2026", fecha: FECHA, otorga: "Se otorga a" },
    etiquetas: ["geométrico", "triángulos", "colores"], como: "triángulos de colores en dos esquinas",
  },
  {
    slug: "secundaria-minimal-azul", nombre: "Diploma Secundaria · Minimal azul", tema: "minimalAzul", categoria: "Secundaria", estilo: "Minimalista", evento: "Reconocimiento",
    disp: "apaisado-sin-foto", logo: true,
    textos: { titulo: "Mención especial", motivo: "Por su destacado desempeño en el área de Ciencias", fecha: FECHA, otorga: "Se otorga a" },
    etiquetas: ["minimalista", "azul", "mención"], como: "blanco con una banda azul al costado, sin foto",
  },
  {
    slug: "secundaria-neon", nombre: "Diploma Secundaria · Neón", tema: "neon", categoria: "Secundaria", estilo: "Moderno", evento: "Fin de año",
    disp: "apaisado-con-foto", logo: false,
    textos: { titulo: "Diploma", motivo: "Por la energía que le puso a cada proyecto del año", fecha: FECHA, otorga: "Para" },
    etiquetas: ["neón", "oscuro", "moderno"], como: "fondo oscuro con esquinas de luces de neón",
  },
  {
    slug: "secundaria-laureles", nombre: "Diploma Secundaria · Laureles", tema: "laurel", categoria: "Secundaria", estilo: "Formal", evento: "Reconocimiento",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Mejor promedio", motivo: "Por haber alcanzado el mejor promedio de su división en el ciclo lectivo 2026", fecha: FECHA, otorga: "Se distingue a" },
    etiquetas: ["laureles", "promedio", "abanderado"], como: "corona de laureles suave detrás del texto",
  },
  {
    slug: "secundaria-deportivo", nombre: "Diploma Secundaria · Deportivo", tema: "deportivo", categoria: "Secundaria", estilo: "Moderno", evento: "Deportes",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Campeones", motivo: "Por su espíritu deportivo en los Juegos Intercolegiales 2026", fecha: FECHA, otorga: "Reconocimiento a", firmas: ["Profesor de Educación Física", "Dirección"] },
    etiquetas: ["deportes", "torneo", "intercolegial"], como: "rayas diagonales en naranja y negro",
  },
  /* ---- Egresados ---- */
  {
    slug: "egresados-negro-dorado", nombre: "Diploma Egresados · Negro y dorado", tema: "negroDorado", categoria: "Egresados", estilo: "Formal", evento: "Egreso",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Diploma de egresado", motivo: "Por haber culminado sus estudios secundarios con la Promoción 2026", fecha: FECHA, otorga: "Se otorga el presente diploma a" },
    etiquetas: ["negro", "dorado", "elegante", "promoción"], como: "fondo negro con doble marco y filigranas doradas",
  },
  {
    slug: "egresados-pergamino", nombre: "Diploma Egresados · Pergamino", tema: "pergamino", categoria: "Egresados", estilo: "Clásico", evento: "Egreso",
    disp: "apaisado-sin-foto", logo: true,
    textos: { titulo: "Diploma", motivo: "Por haber completado con honor el ciclo de Educación Secundaria", fecha: FECHA, otorga: "Se otorga el presente diploma a" },
    etiquetas: ["pergamino", "sello", "lacre", "clásico"], como: "papel pergamino con borde dorado y sello de lacre, sin foto",
  },
  {
    slug: "egresados-azul-oro", nombre: "Diploma Egresados · Azul y oro", tema: "azulOro", categoria: "Egresados", estilo: "Formal", evento: "Egreso",
    disp: "vertical-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Egresados 2026", motivo: "Por el camino recorrido y todo lo que viene", fecha: FECHA, otorga: "Diploma de egreso de" },
    etiquetas: ["azul", "dorado", "laureles", "promoción"], como: "azul marino con filigranas y laureles dorados",
  },
  {
    slug: "egresados-bordo", nombre: "Diploma Egresados · Bordó", tema: "bordo", categoria: "Egresados", estilo: "Formal", evento: "Egreso",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Diploma de honor", motivo: "Por su trayectoria y su compromiso con la Promoción 2026", fecha: FECHA, otorga: "Se otorga el presente diploma a" },
    etiquetas: ["bordó", "cuero", "dorado"], como: "bordó como cuero, con costura y marco dorados",
  },
  {
    slug: "egresados-minimal", nombre: "Diploma Egresados · Minimal blanco", tema: "minimalBlanco", categoria: "Egresados", estilo: "Minimalista", evento: "Egreso",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Promoción 2026", motivo: "Por haber completado sus estudios secundarios", fecha: FECHA, otorga: "Diploma de egreso" },
    etiquetas: ["minimalista", "blanco", "moderno"], como: "blanco con un filete fino y mucho aire",
  },
  {
    slug: "egresados-birretes", nombre: "Diploma Egresados · Birretes", tema: "birretes", categoria: "Egresados", estilo: "Divertido", evento: "Egreso",
    disp: "vertical-con-foto", logo: false,
    textos: { titulo: "¡Lo logramos!", motivo: "Egresado de la Promoción 2026", fecha: FECHA, otorga: "Felicitaciones" },
    etiquetas: ["birretes", "confeti", "fiesta"], como: "azul con birretes y confeti",
  },
  /* ---- Religioso y formal ---- */
  {
    slug: "comunion", nombre: "Diploma · Primera Comunión", tema: "comunion", categoria: "Religioso", estilo: "Clásico", evento: "Primera Comunión",
    disp: "vertical-con-foto", logo: true,
    textos: { titulo: "Primera Comunión", motivo: "Recibió por primera vez a Jesús en la Eucaristía", fecha: FECHA, otorga: "Recuerdo de", firmas: ["Catequista", "Párroco"] },
    etiquetas: ["comunión", "cruz", "olivo"], como: "rayos dorados, cruz y ramas de olivo",
  },
  {
    slug: "confirmacion", nombre: "Diploma · Confirmación", tema: "confirmacion", categoria: "Religioso", estilo: "Clásico", evento: "Confirmación",
    disp: "apaisado-con-foto", logo: true,
    textos: { titulo: "Confirmación", motivo: "Recibió el sacramento de la Confirmación", fecha: FECHA, otorga: "Recuerdo de", firmas: ["Catequista", "Obispo"] },
    etiquetas: ["confirmación", "paloma", "llamas"], como: "paloma, rayos de luz y llamas",
  },
  {
    slug: "certificado-asistencia", nombre: "Certificado · Asistencia perfecta", tema: "certificado", categoria: "Formal", estilo: "Formal", evento: "Reconocimiento",
    disp: "apaisado-sin-foto", logo: true,
    textos: { titulo: "Certificado", motivo: "Por su asistencia perfecta durante todo el ciclo lectivo 2026", fecha: FECHA, otorga: "Se certifica que", firmas: ["Preceptoría", "Dirección"] },
    etiquetas: ["certificado", "asistencia", "guarda"], como: "guarda clásica de certificado con medalla, sin foto",
  },
  {
    slug: "certificado-con-foto", nombre: "Certificado · Clásico con foto", tema: "certificado", categoria: "Formal", estilo: "Formal", evento: "Reconocimiento",
    disp: "apaisado-con-foto", logo: true, forma: "rect",
    textos: { titulo: "Certificado de egreso", motivo: "Por haber completado el nivel con las mejores calificaciones", fecha: FECHA, otorga: "Se certifica que" },
    etiquetas: ["certificado", "guarda", "formal"], como: "guarda clásica con medalla y la foto al costado",
  },
];

export const DIPLOMAS: ModeloProducto[] = PEDIDOS.map((p) => {
  const tema = TEMAS[p.tema];
  const forma = p.forma ?? (tema.fotoRedonda ? "circle" : "rect");
  const formato = p.disp === "vertical-con-foto" ? FORMATOS.a4Vertical : FORMATOS.a4Apaisado;
  const conFoto = p.disp !== "apaisado-sin-foto";
  return {
    tipo: "Diploma",
    serie: "diplomas",
    slug: p.slug,
    nombre: p.nombre,
    descripcion: `Diploma ${formato.nombre}: ${p.como}. ${conFoto ? `Lleva la foto individual del alumno${forma === "circle" ? " en un círculo" : ""}` : "Sin foto"}, su nombre, el curso y el colegio${p.logo ? " y el logo del colegio" : ""}. El título («${p.textos.titulo}»), el motivo y la fecha se cambian una sola vez para todo el curso en «Datos de la plantilla».`,
    categoria: p.categoria,
    estilo: p.estilo,
    ...(p.evento ? { evento: p.evento } : {}),
    etiquetas: ["diploma", ...p.etiquetas],
    formato,
    ...disenar(tema, p.disp, p.textos, { logo: p.logo, forma }),
  };
});
