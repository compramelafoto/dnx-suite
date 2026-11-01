import type { TourDefinition } from "@repo/guided-tour";

/** Ámbar de Cam Of Duty (`--st-amber` en simulador.css). */
export const COD_TOUR_ACCENT = "#ffb547";

export const COD_STREET_TOUR_ID = "camofduty-simulador";
export const COD_STUDIO_TOUR_ID = "camofduty-estudio";

/** Espera antes de ofrecer el recorrido: la pantalla de carga tarda en desvanecerse. */
export const COD_TOUR_OFFER_DELAY_MS = 2500;

const tab = (id: string) => `#cod-side-tab-${id}`;

/** Recorrido del simulador en la calle. */
export function buildStreetTour(onClose?: () => void): TourDefinition {
  return {
    id: COD_STREET_TOUR_ID,
    version: 1,
    screenName: "el simulador",
    intro: "Te mostramos en un minuto dónde está cada control de la cámara y cómo sacar tu primera foto.",
    onClose,
    steps: [
      {
        target: '[data-tour="cod-vista-3d"]',
        title: "Vista 3D",
        body: "Esto es lo que ve tu cámara: todo lo que cambies en los paneles se refleja acá al instante. Hacé clic en la escena para moverte con W A S D y mirar con el mouse (I y K cambian la altura, J y L inclinan el horizonte, Shift corre); Esc te devuelve el puntero.",
      },
      {
        target: '[data-tour="cod-exposicion"]',
        activate: tab("camera"),
        title: "Exposición",
        body: "En la solapa Cámara elegís el ISO, el tiempo de exposición, el diafragma y el balance de blancos (WB); las otras solapas son Objetivos, Escena, Luz natural y Flash. Hacé clic en cada regla, o usá ↑ ↓ para elegir un parámetro y ← → para cambiar su valor.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-modo"]',
        activate: tab("camera"),
        title: "Modo y medición",
        body: "Elegí el modo M (manual), A (prioridad de diafragma) o S (prioridad de tiempo de exposición), cómo mide la luz la cámara y la compensación. Más abajo, Visor alterna LIVE (exposición real) y DSLR, y Display suma guías de tercios, de centro o el histograma.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-fotometro"]',
        title: "Fotómetro",
        body: "Debajo del encuadre ves los valores de la toma y el fotómetro: con la marca en el ▼ (0) la exposición es correcta; hacia − la foto sale oscura y hacia + sale clara.",
        placement: "top",
      },
      {
        target: '[data-tour="cod-enfoque"]',
        activate: tab("camera"),
        title: "Enfoque",
        body: "Elegí AF-S, AF-C o MF y el área de enfoque (punto, zona o amplia). En la escena, V cambia el área y C, F o el clic derecho enfocan; acá ves a qué distancia quedó el foco.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-objetivos"]',
        activate: tab("lenses"),
        title: "Objetivos",
        body: "Cambiá de objetivo para ver cómo la distancia focal modifica el encuadre, el campo visual y la profundidad de campo.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-focal"]',
        activate: tab("lenses"),
        title: "Distancia focal",
        body: "Con un zoom, mové el deslizador o usá Z y X (también [ y ]). Con una focal fija, para cambiar el encuadre tenés que acercarte o alejarte caminando.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-transito"]',
        activate: tab("scene"),
        title: "Autos y peatones",
        body: "Poné o sacá el auto y los peatones y elegí qué tan rápido se mueven: sirven para practicar congelar o barrer el movimiento con el tiempo de exposición.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-luz-natural"]',
        activate: tab("sun"),
        title: "Hora del día y clima",
        body: "Mové la hora (o tocá un horario predefinido) para cambiar la altura y la intensidad del sol, elegí el clima y aplicá el balance de blancos que sugiere esa luz.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-flash"]',
        activate: tab("flash"),
        title: "Flash",
        body: "Encendé el flash sobre la cámara y ajustá su potencia, o poné hasta tres flashes fuera de cámara con modificadores. El tiempo de exposición controla la luz ambiente; el diafragma y el ISO, la del flash.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-vista-afuera"]',
        activate: tab("flash"),
        title: "Vista de afuera",
        body: "Mirá la escena en tercera persona, con tu fotógrafo y los flashes, para acomodar la luz. Para sacar la foto, volvé a la cámara.",
        placement: "left",
      },
      {
        title: "Dirigir a una persona",
        body: "Acercate a alguien en la calle y, cuando aparezca «Hablar con…», apretá T. Se abre un panel para indicarle el cuerpo, la mirada, la cara, qué hace y la distancia, o para escribirle lo que quieras.",
      },
      {
        target: '[data-tour="cod-obturar"]',
        title: "Sacar la foto",
        body: "Apretá Espacio para disparar con los ajustes actuales: suena el obturador y la foto aparece unos segundos en el visor.",
        placement: "top",
      },
      {
        target: '[data-tour="cod-galeria"]',
        title: "Tus fotos",
        body: "En la galería revisás las fotos que sacaste con sus datos de toma y las calificás con estrellas. Al lado, el botón de pantalla completa y el ? con todos los atajos.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ayuda"]',
        title: "Ayuda",
        body: "Repetí este recorrido cuando quieras desde este botón.",
        placement: "bottom",
      },
    ],
  };
}

/** Recorrido del Estudio Fotográfico. */
export function buildStudioTour(onClose?: () => void): TourDefinition {
  const studioTab = (id: string) => `[data-tour="cod-estudio-tab-${id}"]`;
  const setMode = '[data-tour="cod-estudio-modo-set"]';
  return {
    id: COD_STUDIO_TOUR_ID,
    version: 1,
    screenName: "el Estudio Fotográfico",
    intro: "Te mostramos dónde están las luces, la cámara, el fotómetro y cómo capturar tus fotos.",
    onClose,
    steps: [
      {
        target: '[data-tour="cod-estudio-vista-3d"]',
        activate: setMode,
        title: "Vista 3D",
        body: "Este es el set: todo lo que cambies en los paneles se refleja acá al instante. Arrastrá el fondo para girar alrededor, usá la rueda para acercarte y arrastrá una luz para moverla (con Shift cambiás su altura y con la rueda encima, su potencia).",
      },
      {
        target: '[data-tour="cod-estudio-modos"]',
        title: "Set, Cámara o Caminar",
        body: "Set muestra el estudio desde afuera, Cámara muestra la foto tal como va a salir y Caminar te deja recorrer el estudio en primera persona con W A S D y el mouse (Esc para salir). La tecla V y la miniatura alternan entre Set y Cámara.",
        placement: "top",
      },
      {
        target: '[data-tour="cod-estudio-vistas"]',
        activate: setMode,
        title: "Vistas rápidas",
        body: "Saltá a una vista general, de frente, de costado, desde arriba, detrás de cámara o desde el sujeto.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cod-estudio-planta"]',
        title: "Planta del set",
        body: "El set visto desde arriba: arrastrá las luces y la cámara para ubicarlas en el piso.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-luces"]',
        activate: studioTab("lights"),
        title: "Luces del set",
        body: "Prendé o apagá cada luz, tocá su nombre para editarla y usá el ícono de solo para ver únicamente su efecto. Con el teclado: 1 a 6 eligen una luz, S la pone en solo y Supr la quita.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-agregar"]',
        activate: studioTab("lights"),
        title: "Luces y modificadores",
        body: "Elegí un modificador (softbox, octabox, paraguas, plato de belleza, snoot…) y agregá la luz. Al elegir una luz, abajo ajustás su potencia, ángulo, distancia, altura, gel y temperatura.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-encuadre"]',
        activate: studioTab("camera"),
        title: "Encuadre y focal",
        body: "Elegí el encuadre (rostro, medio cuerpo o cuerpo entero), afinalo con Altura del encuadre y cambiá la distancia focal de 24 a 200 mm.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-exposicion"]',
        activate: studioTab("camera"),
        title: "Exposición",
        body: "Diafragma, tiempo de exposición (Obturador), ISO y balance de blancos. Con flash mandan el diafragma y el ISO; el tiempo de exposición sólo cambia cuánto entra de la luz de la sala.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-posicion"]',
        activate: studioTab("camera"),
        title: "Posición de la cámara",
        body: "Subí o bajá la cámara, acercala o alejala del sujeto y girala a su alrededor. También podés moverla arrastrándola en la planta.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-fotometro"]',
        title: "Fotómetro",
        body: "Mide como uno de mano, la luz que llega a la cara del sujeto: te indica el diafragma que corresponde, y 0 EV es la exposición correcta. Abajo te explica el esquema de luz que armaste.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-modelo"]',
        activate: studioTab("scene"),
        title: "Modelo, pose y fondo",
        body: "Elegí un modelo de cuerpo entero o un busto, su pose y su movimiento (o articulalo a mano). Más abajo girás al sujeto y elegís el fondo y la luz de la sala.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-esquemas"]',
        activate: studioTab("presets"),
        title: "Esquemas clásicos",
        body: "Loop, Rembrandt, Mariposa, Clamshell, Split, Tres puntos y más: al tocar uno, las luces se arman solas con la potencia ajustada a tu cámara.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-capturar"]',
        title: "Capturar",
        body: "Tocá este botón o apretá Espacio para sacar la foto. Queda en las capturas de abajo, donde podés volver a ese set, descargarla o borrarla.",
        placement: "left",
      },
      {
        target: '[data-tour="cod-estudio-herramientas"]',
        title: "Deshacer y compartir",
        body: "Deshacé o rehacé cambios (⌘Z / Ctrl+Z), descargá el esquema de luces como imagen y copiá un enlace para que otra persona abra tu mismo set.",
        placement: "top",
      },
      {
        target: '[data-tour="ayuda"]',
        title: "Ayuda",
        body: "Repetí este recorrido cuando quieras desde este botón. El signo ? de la barra de herramientas muestra todos los atajos.",
        placement: "bottom",
      },
    ],
  };
}
