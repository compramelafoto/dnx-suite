import type { DefinicionCuestionario, Pregunta, TipoPregunta } from "./tipos";

/**
 * Los cuestionarios que vienen de fábrica: los dos Google Forms que el estudio usaba, pasados a
 * datos. Se copian a la base la primera vez que un workspace lista sus cuestionarios
 * (`asegurarCuestionariosDeFabrica`); desde ahí cada estudio tiene su copia.
 *
 * Los `id` de las preguntas son estables: NO se cambian aunque cambie el texto, porque con ellos
 * se vuelven a cargar las respuestas para corregirlas.
 */

export type CuestionarioDeFabrica = {
  clave: string;
  nombre: string;
  intro: string;
  orden: number;
  definicion: DefinicionCuestionario;
};

function p(id: string, etiqueta: string, tipo: TipoPregunta = "corto"): Pregunta {
  return { id, etiqueta, tipo };
}

/** La misma lista de proveedores para los dos, con dos renglones distintos. */
function proveedores(vestido: string, planner: string): Pregunta[] {
  return [
    p("prov_salon", "Salón del evento"),
    p("prov_ambientacion", "Ambientación, florista, iluminación y efectos especiales"),
    p("prov_dj", "DJ e iluminación"),
    p("prov_360", "Plataforma 360, cabina de fotos, etc."),
    p("prov_catering", "Catering y barra de tragos"),
    p("prov_vestido", vestido),
    p("prov_maquillaje", "Maquillaje"),
    p("prov_peluqueria", "Peluquería"),
    p("prov_zapatos", "Zapatos"),
    p("prov_planner", planner),
    p("prov_mesa_dulce", "Mesa dulce"),
    p("prov_otros", "Otros servicios"),
  ];
}

export const CUESTIONARIO_XV: CuestionarioDeFabrica = {
  clave: "xv",
  nombre: "Cuestionario para quinceañeras",
  orden: 1,
  intro:
    "Queremos que vivas una experiencia increíble y personalizada en tu sesión de fotos. Conocer más sobre vos y los detalles de tu fiesta nos ayudará a brindarte la mejor atención. Además, nos encanta sorprender a nuestras quinceañeras con beneficios exclusivos, así que completá este formulario y asegurate de que no se nos escape ningún detalle especial.",
  definicion: {
    secciones: [
      {
        id: "familia",
        titulo: "Información familiar",
        preguntas: [
          p("madre_nombre", "Nombre y apellido de la madre"),
          p("madre_whatsapp", "Número de WhatsApp de la madre", "telefono"),
          p("padre_nombre", "Nombre y apellido del padre"),
          p("padre_whatsapp", "Número de WhatsApp del padre", "telefono"),
          p("hermanos", "Nombre de los hermanos, si corresponde"),
          p("amigos", "Nombres de los amigos más importantes de la quinceañera"),
        ],
      },
      {
        id: "quinceanera",
        titulo: "Datos de la quinceañera",
        preguntas: [
          p("nombre", "Nombre"),
          p("fecha_nacimiento", "Fecha de nacimiento", "fecha"),
          p("apodo", "Apodo: ¿cómo preferís que te digan?"),
          p("instagram", "Instagram"),
        ],
      },
      {
        id: "sesion",
        titulo: "La sesión, la fiesta y la quinceañera",
        preguntas: [
          p("fecha_fiesta", "Fecha de la fiesta", "fecha"),
          p("tematica", "¿Tenés una temática o colores favoritos para la fiesta?", "largo"),
          p("musica", "¿Qué tipo de música te gusta escuchar en tu día a día?", "largo"),
          p("hobbies", "¿Cuáles son tus hobbies o actividades preferidas?", "largo"),
          p("detalle_especial", "¿Hay algún detalle especial que te gustaría que incluyamos en la sesión de fotos o en la fiesta?", "largo"),
          p("personalidad", "¿Cómo describirías tu personalidad?", "largo"),
          p("lugar_sesion", "¿Hay algún lugar especial donde te gustaría hacer la sesión de fotos previa a la fiesta?", "largo"),
          p("expectativas", "¿Qué esperás de tu sesión de fotos?", "largo"),
          p("sesion_previa", "¿Tuviste alguna vez una sesión fotográfica o te sacaste fotos profesionales?", "largo"),
          p("artista", "¿Sos fan de algún artista?", "largo"),
          p("algo_mas", "¿Hay algo más que quieras contarnos sobre vos?", "largo"),
        ],
      },
      {
        id: "proveedores",
        titulo: "Proveedores de la fiesta",
        descripcion: "Poné el Instagram o el teléfono de contacto de los proveedores de la fiesta.",
        preguntas: proveedores("Vestido / modista", "Planner"),
      },
    ],
  },
};

export const CUESTIONARIO_BODAS: CuestionarioDeFabrica = {
  clave: "bodas",
  nombre: "Cuestionario para bodas",
  orden: 2,
  intro:
    "Queremos capturar los momentos más importantes de su historia de amor con el máximo nivel de detalle y dedicación. Este cuestionario nos ayudará a conocerlos mejor y a personalizar su experiencia. Además, nos encanta sorprender a nuestras parejas con beneficios exclusivos, así que asegurémonos de que cada detalle esté cubierto.",
  definicion: {
    secciones: [
      {
        id: "novios",
        titulo: "Los novios",
        preguntas: [
          p("novia_nombre", "Nombre de la novia"),
          p("novia_whatsapp", "Número de WhatsApp de la novia", "telefono"),
          p("novia_instagram", "Instagram de la novia"),
          p("novio_nombre", "Nombre del novio"),
          p("novio_whatsapp", "Número de WhatsApp del novio", "telefono"),
          p("novio_instagram", "Instagram del novio"),
        ],
      },
      {
        id: "boda",
        titulo: "La boda",
        preguntas: [
          p("civil", "Fecha, hora y lugar del casamiento por civil"),
          p("ceremonia", "Fecha, hora y lugar de la ceremonia", "largo"),
          p("fiesta", "Fecha, hora y lugar de la fiesta", "largo"),
        ],
      },
      {
        id: "pareja",
        titulo: "Sobre la pareja",
        preguntas: [
          p("como_se_conocieron", "¿Cómo se conocieron?", "largo"),
          p("hobbies", "¿Cuáles son sus hobbies o actividades preferidas como pareja?", "largo"),
          p("lugar_especial", "¿Tienen algún lugar especial que quisieran incluir en la sesión de fotos?", "largo"),
          p("musica", "¿Qué tipo de música les gusta?", "largo"),
          p("detalle_personal", "¿Hay algún detalle personal que les gustaría que incluyamos en la sesión o en las fotos de la fiesta?", "largo"),
          p("relacion", "¿Cómo describirían su relación?", "largo"),
          p("expectativas", "¿Qué expectativas tienen para su sesión de fotos, si la contrataron?", "largo"),
          p("tradicion", "¿Hay alguna tradición familiar que les gustaría incluir en la boda?", "largo"),
          p("sesion_previa", "¿Alguna vez tuvieron una sesión fotográfica profesional juntos?", "largo"),
        ],
      },
      {
        id: "familia",
        titulo: "Invitados y familia",
        preguntas: [
          p("padres_novia", "Nombres del padre y la madre de la novia"),
          p("hermanos_novia", "Hermanos de la novia"),
          p("padres_novio", "Nombres del padre y la madre del novio"),
          p("hermanos_novio", "Hermanos del novio"),
          p("personas_cercanas", "Las personas más cercanas e importantes de la fiesta: familiares cercanos, amigos íntimos, etc.", "largo"),
        ],
      },
      {
        id: "preparativos",
        titulo: "Los preparativos",
        preguntas: [
          p("prepara_novia", "¿Dónde se prepara la novia? Lugar, horario aproximado y quiénes la acompañan", "largo"),
          p("prepara_novio", "¿Dónde se prepara el novio? Lugar, horario aproximado y quiénes lo acompañan", "largo"),
        ],
      },
      {
        id: "proveedores",
        titulo: "Proveedores de la fiesta",
        descripcion: "Pongan el Instagram o el teléfono de contacto de los proveedores de la fiesta.",
        preguntas: proveedores("Vestido, modista, traje", "Wedding planner"),
      },
    ],
  },
};

export const CUESTIONARIOS_DE_FABRICA: readonly CuestionarioDeFabrica[] = [CUESTIONARIO_XV, CUESTIONARIO_BODAS];

/** Las claves de fábrica que todavía no tiene un workspace (las que hay que crear). */
export function faltantesDeFabrica(clavesExistentes: Iterable<string>): CuestionarioDeFabrica[] {
  const hay = new Set(clavesExistentes);
  return CUESTIONARIOS_DE_FABRICA.filter((c) => !hay.has(c.clave));
}
