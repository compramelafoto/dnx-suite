import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import type { Instructivo } from "../tipos";

export const guia: Instructivo = {
  slug: "blog-publicar-articulo",
  titulo: "Publicar un artículo en el blog",
  resumen:
    "Escribir un artículo, ponerle imagen de portada, publicarlo ahora o programarlo, y destacarlo en el banner del sitio.",
  seccion: "Comunicación",
  moduleKey: WEBSITE_MODULE_KEY,
  minutos: 10,
  pasos: [
    {
      titulo: "Entrá al blog y creá el artículo",
      texto: [
        "En el menú de la izquierda tocá «Blog». Ves la lista de artículos con su estado: Borrador, Publicado, Programado o Archivado.",
        "Tocá «Nuevo artículo».",
      ],
    },
    {
      titulo: "Escribí título, resumen y texto",
      texto: [
        "Arriba va el título del artículo y, debajo, un resumen corto: se ve en el listado del blog y en Google.",
        "En «Cuerpo del artículo» escribí el texto. Para los subtítulos usá los botones H2 y H3 de la barra; el título ya es el principal de la página.",
        "Categoría, tags y autor son opcionales: si no los cargaste, el artículo se guarda igual.",
      ],
    },
    {
      titulo: "Poné la imagen de portada",
      texto: [
        "En «Imagen destacada» tocá «Subir imagen» y elegí la foto. Se muestra en el artículo, en las tarjetas del listado y como miniatura al compartir el enlace en redes.",
        "Para cambiarla, «Cambiar imagen»; para sacarla, «Quitar».",
      ],
      nota: "Sin imagen destacada, al compartir el enlace se ve el logo de la institución.",
    },
    {
      titulo: "Guardalo como borrador",
      texto: [
        "Tocá «Guardar borrador». Aparece «Artículo guardado.» y el artículo queda en la lista, sin verse en el sitio.",
        "Podés volver a abrirlo cuando quieras desde la lista y seguir escribiendo.",
      ],
    },
    {
      titulo: "Publicalo ahora",
      texto: [
        "Cuando esté listo, tocá «Publicar ahora». En ese momento aparece en el blog del sitio.",
        "Para ver cómo quedó, tocá «Ver publicado» arriba a la derecha.",
      ],
    },
    {
      titulo: "O programalo para otro día",
      texto: [
        "En «Programar publicación» elegí la «Fecha y hora de publicación» y tocá «Programar». El artículo se publica solo en ese momento.",
        "Mientras tanto figura como «Programado» y no se ve en el sitio. Para cancelarlo, guardalo como borrador.",
      ],
      nota: "La fecha tiene que ser futura. Si ya pasó, el sistema avisa «Elegí una fecha y hora que todavía no hayan pasado.».",
    },
    {
      titulo: "Destacalo en el banner de la portada (opcional)",
      texto: [
        "Con el artículo ya publicado, más abajo está «Banner principal del sitio». Elegí «En qué placa» del banner aparece y «Durante» cuántos días, y tocá «Mostrar en el banner».",
        "Al vencer el plazo deja de mostrarse solo. Para sacarlo antes, «Quitar del banner».",
      ],
    },
    {
      titulo: "Mandalo por correo a los socios (opcional)",
      texto: [
        "Con el artículo publicado, arriba aparece «Enviar a socios por email». Primero tocá «Enviarme una prueba» y revisá cómo llega.",
        "Después marcá «Revisé la prueba» y tocá el botón «Enviar a … socios». Cada artículo se manda una sola vez.",
      ],
      nota: "Si el envío no aparece, puede que los envíos a socios estén apagados en Comunicación → Correo.",
    },
  ],
};
