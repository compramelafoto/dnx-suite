import type { Instructivo } from "../tipos";
import { GALLERY_MODULE_KEY } from "@/lib/galerias/acceso";

export const guia: Instructivo = {
  slug: "galerias-crear-y-publicar",
  titulo: "Crear una galería, subir las fotos y publicarla",
  resumen:
    "Armar la galería de un trabajo para que el cliente elija sus fotos, descargue la entrega o apruebe su álbum.",
  seccion: "Galerías",
  moduleKey: GALLERY_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Creá la galería",
      texto: [
        "En el menú abrí Consultas → «Galerías» y tocá «Nueva galería». También se crea desde la ficha del trabajo, en la tarjeta «Galerías».",
        "En «Proyecto» buscá el trabajo por número, nombre o cliente.",
        "Poné el «Nombre de la galería» (si lo dejás vacío, usa el del trabajo).",
      ],
      imagen: "/instructivos/galerias-crear-y-publicar/01-galerias.jpg",
      imagenAlt:
        "Pantalla Galerías con el botón Nueva galería, el buscador y los filtros Estado, Tipo y Revisión.",
    },
    {
      titulo: "Elegí el tipo",
      texto: [
        "«Selección»: el cliente elige sus fotos (y puede comprar extras). Para fotolibros, sesiones o eventos donde el cliente marca sus favoritas.",
        "«Entrega»: fotos y videos en alta para descargar. Para entregar el material final.",
        "«Álbum»: el cliente revisa las láminas del diseño, comenta y aprueba o pide cambios.",
        "Tocá «Crear galería».",
      ],
    },
    {
      titulo: "Subí las fotos",
      texto: [
        "En la pestaña «Fotos» («Láminas» si es álbum) arrastrá los archivos o elegilos. Sirven fotos JPG o PNG de hasta 50 MB y, en una Entrega, videos MP4 o MOV de hasta 5 GB.",
        "No cierres la página hasta que termine. Si alguna falla, tocá «Reintentar» o «Reintentar todas».",
        "Ordenalas «Por nombre» o a mano (arrastrando o con ◀ ▶) y elegí la portada.",
      ],
      nota: "Una galería admite hasta 3.000 fotos, 200 videos y 30 clientes.",
    },
    {
      titulo: "Configurá lo que ve el cliente",
      texto: [
        "En «Configuración» → «Lo que ve el cliente» escribí el «Nombre» y un «Mensaje de bienvenida».",
        "En una Selección, «Cómo elige»: «Libre» o «Por cantidad» con Mínimo y Máximo (por ejemplo, las 40 fotos de un fotolibro). Si querés, permití comentarios en las fotos.",
        "En «Descarga» elegí «Sin descarga», «Vista de galería» (liviana, 2048 px) o «Sólo las fotos elegidas o compradas, en alta».",
        "Tocá «Guardar».",
      ],
    },
    {
      titulo: "Si vendés fotos extra",
      texto: [
        "En la pestaña «Venta» (sólo en Selección) elegí el «Modo de venta»: «Sólo selección», «Selección con venta de extras» o «Sólo venta».",
        "Cargá las «Fotos incluidas sin costo» y «Cómo se cobra»: «Por foto» (con su precio) o «Por paquete». Si querés, un descuento único o progresivo.",
      ],
      sistema: ["Los cambios de precio valen para las compras que se hagan de ahora en adelante."],
    },
    {
      titulo: "Publicala",
      texto: [
        "En «Configuración» → «Estado» tocá «Publicar». Hace falta al menos una foto lista.",
        "Recién publicada se pueden compartir los enlaces con los clientes (guía siguiente).",
      ],
      nota: "«Archivar» cierra la galería: los clientes dejan de poder entrar. Se vuelve a abrir con «Reactivar».",
    },
  ],
};
