import type { TourDefinition } from "@repo/guided-tour";

/** Id del recorrido del Modo Fotolibro: lo usan el `<GuidedTour>` y el botón Ayuda. */
export const TOUR_FOTOLIBRO_ID = "fotolibro-modo";

/** El acento del Modo Fotolibro (`--fo-accent` de globals.css). */
export const ACENTO_TOUR_FOTOLIBRO = "#0ea5e9";

/**
 * El recorrido guiado del editor de fotolibros. Empieza por "Subir fotos" para que sirva aun con
 * el libro vacío; los pasos que necesitan fotos (la tira) se saltean solos si no hay ninguna.
 */
export const TOUR_FOTOLIBRO: TourDefinition = {
  id: TOUR_FOTOLIBRO_ID,
  version: 1,
  screenName: "el editor de fotolibros",
  intro: "Te mostramos en un minuto cómo armar el libro: fotos, pliegos, estilos, tapa y envío al laboratorio.",
  steps: [
    {
      target: '[data-tour="fotolibro-subir"]',
      title: "Subí las fotos",
      body: "Empezá por acá: elegí las fotos del trabajo o soltalas sobre la tira de abajo. Ya podés usarlas mientras el original termina de subir.",
      placement: "top",
    },
    {
      target: '[data-tour="fotolibro-tira"]',
      title: "La tira de fotos",
      body: "Arrastrá una foto (o varias, con ⌘/Ctrl o Mayús) al pliego y se acomodan solas. Las que ya usaste quedan más claritas, con la cantidad de veces.",
      placement: "top",
    },
    {
      target: '[data-tour="fotolibro-pliego"]',
      title: "El pliego en edición",
      body: "Arrastrá una foto sobre otra para intercambiarlas. Con doble clic la encuadrás dentro del marco, y la rueda del mouse acerca y aleja.",
      placement: "bottom",
    },
    {
      target: '[data-tour="fotolibro-distribucion"]',
      title: "Cambiá la distribución",
      body: "Elegí si armás el pliego entero o página por página y recorré las distribuciones con ▲/▼. Atajos: A y Q en la página izquierda, S y W en la derecha (en pliego entero, A/S avanzan y Q/W vuelven).",
      placement: "left",
    },
    {
      target: '[data-tour="fotolibro-extras"]',
      title: "Textos, fondo y favoritas",
      body: "Sumá un texto al pliego o cambiale el color de fondo. Debajo podés guardar como favorita una distribución que te guste para usarla en otros libros.",
      placement: "left",
    },
    {
      target: '[data-tour="fotolibro-navegacion"]',
      title: "Pasá de pliego",
      body: "Cada punto es un pliego: tocalo para ir a ese. También podés usar las flechas ← y → del teclado, o los pliegos vecinos que se ven a los costados.",
      placement: "top",
    },
    {
      target: '[data-tour="fotolibro-armado"]',
      title: "Armado automático",
      body: "Reparte las fotos en todo el libro, en orden y por momentos. Después retocás lo que quieras, y ⌘Z lo deshace.",
      placement: "bottom",
    },
    {
      target: '[data-tour="fotolibro-estilo"]',
      title: "Estilos por temática",
      body: "Elegí un estilo para sumar fondos, adornos, tipografías y portada listos según la temática. Las fotos siguen siendo las tuyas.",
      placement: "left",
    },
    {
      target: '[data-tour="fotolibro-tapa"]',
      title: "La tapa",
      body: "Este primer punto abre la tapa: elegís el modelo del laboratorio, el diseño y le soltás una foto. Con A/S y Q/W probás otros diseños.",
      placement: "top",
    },
    {
      target: '[data-tour="fotolibro-ver-libro"]',
      title: "Todo el libro de un vistazo",
      body: "Muestra todos los pliegos juntos para reordenarlos, duplicarlos o quitarlos. También se abre y se cierra con la tecla G.",
      placement: "bottom",
    },
    {
      target: '[data-tour="fotolibro-cliente"]',
      title: "Aprobación del cliente",
      body: "Creá un enlace para que el cliente hojee el libro, comente cada pliego y lo apruebe, sin necesidad de cuenta. Acá vas a ver sus comentarios pendientes.",
      placement: "bottom",
    },
    {
      target: '[data-tour="fotolibro-exportar"]',
      title: "Exportá para el laboratorio",
      body: "Antes revisa que no falte nada; después arma un ZIP con un JPG por pliego (y la tapa) a 300 ppp, listo para mandar.",
      placement: "bottom",
    },
    {
      target: '[data-tour="fotolibro-libre"]',
      title: "Diseño libre",
      body: "Si necesitás mover algo a mano o sumar formas, pasá al editor de siempre. Antes de salir se guarda lo que armaste.",
      placement: "bottom",
    },
    {
      target: '[data-tour="ayuda"]',
      title: "Volvé cuando quieras",
      body: "Con este botón repetís el recorrido en cualquier momento.",
      placement: "bottom",
    },
  ],
};
