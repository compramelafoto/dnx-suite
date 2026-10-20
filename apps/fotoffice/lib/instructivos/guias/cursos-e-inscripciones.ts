import type { Instructivo } from "../tipos";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";

export const guia: Instructivo = {
  slug: "cursos-e-inscripciones",
  titulo: "Cursos: publicar una edición y seguir las inscripciones",
  resumen:
    "Cargar un curso presencial, abrirle una edición con fecha, lugar y cupo, publicarlo y ver cuántos se anotaron.",
  seccion: "Actividades",
  moduleKey: COURSES_SALES_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Creá el curso",
      texto: [
        "En el menú, entrá a Cursos y tocá Crear curso.",
        "En Información general escribí el Título. Dejá el Estado en Borrador mientras lo armás. En Modalidad elegí Presencial (o En vivo). Completá Instructor/a y Nivel, y si tenés la imagen, la Portada URL.",
      ],
    },
    {
      titulo: "Escribí la página de venta",
      texto: [
        "En Página de venta completá la Descripción corta (lo que se ve en el listado) y la Descripción larga (qué se aprende, a quién está dirigido, qué hay que llevar).",
        "Preguntas frecuentes y Acceso al aula son opcionales: si no los usás, dejalos como están. Tocá Crear curso.",
      ],
      nota:
        "Las Preguntas frecuentes tienen un formato especial. Si las querés cargar, copiá el ejemplo que aparece debajo del campo y cambiá sólo los textos.",
    },
    {
      titulo: "Abrí una edición",
      texto: [
        "Al crear el curso pasás a Editar curso. Bajá hasta Ediciones: cada edición es una vez que se dicta el curso, con su fecha y su cupo.",
        "Completá Fecha y hora de inicio, Fecha y hora de fin, Lugar, Dirección, Precio ARS y Cupo. Dejá el Estado en Activa y tocá Crear edición. Debajo aparece la edición con sus «Cupos disponibles».",
      ],
      nota:
        "Si el mismo curso se dicta varias veces, creá una edición por cada fecha. No hace falta un curso nuevo.",
    },
    {
      titulo: "Publicalo",
      texto: [
        "Subí a Información general, cambiá el Estado a Publicado y tocá Guardar cambios. Desde ese momento el curso aparece en la página de cursos de la institución y la gente se puede inscribir.",
        "Si querés mostrarlo sin abrir la inscripción todavía, elegí Próximamente. Oculto lo saca de la vista del público.",
      ],
    },
    {
      titulo: "Cómo se inscribe la gente",
      texto: [
        "En la página del curso, la persona elige la edición, completa Nombre y apellido, correo, WhatsApp, DNI, Ciudad e Instagram, toca Inscribirme y paga con Mercado Pago.",
        "No tenés que hacer nada: cuando el pago se aprueba, el lugar queda tomado y el cupo baja solo.",
      ],
      nota:
        "Conviene que el socio use el mismo correo con el que entra a su portal: así el curso aparece en su cuenta.",
    },
    {
      titulo: "Mirá cuántos se anotaron",
      texto: [
        "En Cursos, cada curso muestra cuántas Ediciones tiene y cuántas Inscripciones aprobadas lleva. Dentro de Editar curso, cada edición muestra los cupos que quedan, por ejemplo «Cupos disponibles: 4/12».",
        "Quien sea dueño o administrador ve el dinero de cada venta en Cursos → Cobros.",
      ],
    },
    {
      titulo: "Cerrá o cancelá una edición",
      texto: [
        "En Editar curso, dentro de la edición, tocá Editar edición. Cambiá el Estado a Completa (para cortar la inscripción) o Cancelada (si no se dicta) y tocá Guardar edición.",
      ],
    },
    {
      titulo: "Revisá las consultas en Inscripciones",
      texto: [
        "En Cursos → Inscripciones está la pantalla «Inscripciones y leads»: las consultas que dejaron personas interesadas, con la Fecha, el Curso, el Nombre, el Email y el Estado. Escribiles para responder.",
      ],
      nota:
        "Esta lista es de consultas, no de pagos. Las inscripciones pagas a un curso presencial no aparecen acá: se reflejan en los cupos de cada edición.",
    },
  ],
};
