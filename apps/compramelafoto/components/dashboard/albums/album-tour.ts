import type { TourDefinition } from "@repo/guided-tour";

/** Naranja de las pestañas activas del álbum (AlbumWorkspaceNav). */
export const ALBUM_TOUR_ACCENT = "#c27b3d";

const sel = (id: string) => `[data-tour="${id}"]`;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Solo volvemos a Resumen al cerrar si el recorrido llegó a cambiar de pestaña:
 * si el fotógrafo descarta la invitación estando en Venta, no lo movemos.
 */
let tourChangedTab = false;

function clickTour(id: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector<HTMLElement>(sel(id));
  if (!el) return false;
  el.click();
  return true;
}

/** Entra a un área del álbum (Resumen, Contenido, Venta, Publicación, Configuración…). */
function goToArea(area: string, subtab?: string) {
  return async () => {
    if (clickTour(`album-tab-${area}`)) tourChangedTab = true;
    if (subtab) {
      // La barra de subpestañas aparece recién cuando el área ya está activa.
      await wait(150);
      clickTour(`album-subtab-${subtab}`);
    }
  };
}

export const ALBUM_TOUR: TourDefinition = {
  id: "clf-album",
  version: 1,
  screenName: "la configuración del álbum",
  intro:
    "En un par de minutos te mostramos dónde se suben las fotos, se ponen los precios y se comparte el álbum.",
  steps: [
    {
      target: sel("album-encabezado"),
      title: "Tu álbum",
      body: "Arriba ves el nombre del álbum, el estado de la venta (activa, incompleta o pendiente), el lugar y la fecha.",
      placement: "bottom",
      before: goToArea("resumen"),
    },
    {
      target: sel("album-acciones"),
      title: "Acciones rápidas",
      body: "El lápiz abre la configuración, el ojo muestra el álbum como lo ve tu cliente, el siguiente botón lo comparte y el tacho lo elimina (eso no se puede deshacer).",
      placement: "bottom",
    },
    {
      target: sel("album-pestanas"),
      title: "Las secciones del álbum",
      body: "Todo el trabajo se ordena en estas pestañas. Vamos a recorrerlas una por una.",
      placement: "bottom",
    },
    {
      target: sel("album-resumen-estado"),
      title: "Estado del álbum",
      body: "Un vistazo a cuántas fotos tiene, hasta cuándo se ve, si Mercado Pago está conectado y si ya podés compartirlo. Si falta algo, acá te lo avisa.",
      placement: "bottom",
      before: goToArea("resumen"),
    },
    {
      target: sel("album-resumen-proximos"),
      title: "Qué hacer ahora",
      body: "Te sugerimos los próximos pasos para dejar el álbum listo, con botones que te llevan directo a cada sección.",
      placement: "top",
      before: goToArea("resumen"),
    },
    {
      target: sel("album-fotos-explorador"),
      title: "Tus fotos",
      body: "En Contenido organizás las fotos en carpetas, como en la computadora. A la izquierda elegís la carpeta y a la derecha ves sus fotos.",
      placement: "top",
      before: goToArea("contenido", "fotos"),
    },
    {
      target: sel("album-fotos-subir"),
      title: "Subir fotos",
      body: "Con este botón subís fotos a la carpeta que tengas abierta. También podés subir una carpeta entera desde el menú de carpetas.",
      placement: "bottom",
      before: goToArea("contenido"),
    },
    {
      target: sel("album-venta-productos"),
      title: "Qué vendés",
      body: "En Venta encendés las fotos digitales, las impresiones o ambas, y ponés sus precios.",
      placement: "top",
      before: goToArea("venta", "ventas"),
    },
    {
      target: sel("album-venta-estado"),
      title: "¿Está listo para vender?",
      body: "Esta lista te muestra qué falta para empezar a cobrar: Mercado Pago, precios y la aceptación de los términos.",
      placement: "top",
      before: goToArea("venta", "ventas"),
    },
    {
      target: sel("album-subpestanas"),
      title: "Packs y extras",
      body: "En estas solapas armás packs de galería, packs de preventa (se compran antes de ver las fotos) y extras que se ofrecen durante la compra.",
      placement: "bottom",
      before: goToArea("venta", "ventas"),
    },
    {
      target: sel("album-publicacion-compartir"),
      title: "Compartir el álbum",
      body: "En Publicación copiás el enlace del álbum, descargás el QR o abrís la galería pública para mandársela a tus clientes.",
      placement: "top",
      before: goToArea("publicacion", "publicacion-compartir"),
    },
    {
      target: sel("album-subpestanas"),
      title: "Más de la publicación",
      body: "Acá revisás hasta cuándo se ve el álbum, la protección de las fotos, la portada, el instructivo para tus clientes y los canjes de compras cobradas por fuera.",
      placement: "bottom",
      before: goToArea("publicacion"),
    },
    {
      target: sel("album-tab-pedidos"),
      title: "Pedidos y escuela",
      body: "En los álbumes vinculados a una escuela, acá manejás el listado de alumnos, el mosaico y el operativo escolar.",
      placement: "bottom",
    },
    {
      target: sel("album-config-privacidad"),
      title: "Privacidad y acceso",
      body: "En Configuración decidís si el álbum es público, si las fotos se ven solo con una selfie, la búsqueda por dorsal o patente y la protección al ampliar.",
      placement: "top",
      before: goToArea("configuracion"),
    },
    {
      target: sel("album-config-guardar"),
      title: "Guardá los cambios",
      body: "Los cambios de esta pestaña se aplican recién cuando tocás «Guardar configuración».",
      placement: "top",
      before: goToArea("configuracion"),
    },
    {
      target: sel("ayuda"),
      title: "¿Querés verlo de nuevo?",
      body: "Podés repetir este recorrido cuando quieras desde el botón Ayuda.",
      placement: "bottom",
      before: goToArea("resumen"),
    },
  ],
  onClose: () => {
    if (!tourChangedTab) return;
    tourChangedTab = false;
    clickTour("album-tab-resumen");
  },
};
