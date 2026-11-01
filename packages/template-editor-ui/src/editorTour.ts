import type { TourDefinition } from "@repo/guided-tour";

/** Identificador del recorrido del editor de plantillas (lo usa también el botón Ayuda). */
export const TEMPLATE_EDITOR_TOUR_ID = "editor-plantillas";

/** Lo que el recorrido necesita del editor para mostrar cada parte antes de señalarla. */
export type TemplateEditorTourActions = {
  /** Abre el panel lateral y despliega la sección indicada. */
  openSidebarSection: (section: "layers" | "inspector" | "review") => void;
  /** Segundos que espera el guardado automático. */
  autosaveSeconds: number;
};

/**
 * Recorrido con globos del editor de plantillas. Vive en el paquete porque el editor es el
 * mismo en CompraMeLaFoto y en FOTOFFICE (carnets, comunicación y diseño libre de fotolibros).
 */
export function buildTemplateEditorTour({
  openSidebarSection,
  autosaveSeconds,
}: TemplateEditorTourActions): TourDefinition {
  return {
    id: TEMPLATE_EDITOR_TOUR_ID,
    version: 1,
    screenName: "el editor de plantillas",
    intro: "Te mostramos en un minuto dónde está cada herramienta para armar tu diseño.",
    steps: [
      {
        target: '[data-tour="editor-barra"]',
        title: "Tu plantilla",
        body: "Arriba ves el nombre de la plantilla, en qué versión estás y si los cambios ya se guardaron. Con «Cerrar» volvés al listado.",
        placement: "bottom",
      },
      {
        target: '[data-tour="editor-guardar"]',
        title: "Guardar los cambios",
        body: `Guardá cuando quieras con este botón o con ⌘/Ctrl + S. Igual, el editor guarda solo ${autosaveSeconds} segundos después de que dejás de editar.`,
        placement: "bottom",
      },
      {
        target: '[data-tour="editor-documento"]',
        title: "Tamaño, vista previa y versiones",
        body: "Cambiá el tamaño del lienzo, mirá la vista previa tal como sale impresa o guardá una copia como versión nueva. «Versiones» te muestra las anteriores para abrirlas.",
        placement: "bottom",
      },
      {
        target: '[data-tour="editor-hojas"]',
        title: "Las hojas del diseño",
        body: "Cada pestaña es una hoja: tocala para trabajar en ella, hacé doble clic para cambiarle el nombre y arrastrala para ordenarla. Con «+» sumás una hoja nueva.",
        placement: "bottom",
      },
      {
        target: '[data-tour="editor-herramientas"]',
        title: "Agregar elementos",
        body: "Desde esta columna sumás textos, variables (datos que cambian en cada copia, como el nombre), formas, códigos QR, imágenes y el fondo. Arriba están la flecha para elegir y la mano para mover la vista.",
        placement: "right",
      },
      {
        target: '[data-tour="editor-lienzo"]',
        title: "El lienzo",
        body: "Hacé clic en un elemento para elegirlo y arrastralo para moverlo; con Mayús + clic elegís varios. Doble clic en un texto para escribir, y en una foto para acomodar su encuadre.",
        placement: "center",
      },
      {
        target: '[data-tour="editor-zoom"]',
        title: "Acercar y alejar",
        body: "Acercá, alejá, ajustá la hoja a la ventana o mirala en tamaño real. También podés hacer zoom con ⌘/Ctrl + rueda del mouse o pellizcando el trackpad.",
        placement: "top",
      },
      {
        target: '[data-tour="editor-reglas"]',
        title: "Reglas y guías",
        body: "Arrastrá desde una regla hacia la hoja para sacar una guía; para borrarla, soltala fuera de la hoja o hacé clic derecho. Al mover, los elementos se pegan a las guías y al centro.",
        placement: "bottom",
      },
      {
        target: '[data-tour="editor-guias"]',
        title: "Zona segura y referencias",
        body: "Prendé o apagá la zona segura (el margen que conviene respetar para que nada quede cortado) y las guías de referencia, como mitades y centros. Ninguna se imprime.",
        placement: "bottom",
      },
      {
        title: "Barra de formato",
        body: "Cuando elegís un elemento aparece una barra debajo de las hojas. En los textos cambiás fuente, tamaño, negrita, color e interlineado; en el resto, duplicás, eliminás o reemplazás la imagen.",
        placement: "center",
      },
      {
        target: '[data-tour="editor-capas"]',
        title: "Capas",
        body: "Cada elemento es una capa. Arrastralas para decidir qué queda adelante, y usá los botones de cada fila para ocultarla, bloquearla, duplicarla o borrarla.",
        placement: "left",
        before: () => openSidebarSection("layers"),
      },
      {
        target: '[data-tour="editor-propiedades"]',
        title: "Propiedades",
        body: "Con un elemento elegido, acá ajustás su tamaño, colores, opacidad y contenido. En las fotos, la sección «Encuadre» te ayuda a acomodar la imagen dentro del marco.",
        placement: "left",
        before: () => openSidebarSection("inspector"),
      },
      {
        target: '[data-tour="editor-revision"]',
        title: "Revisión rápida",
        body: "Te avisa lo que conviene revisar antes de imprimir: imágenes sin cargar, textos vacíos o elementos fuera de la zona segura. Casi siempre trae un botón para corregirlo.",
        placement: "left",
        before: () => openSidebarSection("review"),
      },
      {
        target: '[data-tour="ayuda"]',
        title: "Volver a ver esta guía",
        body: "Tocá «Ayuda» cuando quieras repetir el recorrido. El botón de al lado muestra todos los atajos de teclado, como deshacer o mover con las flechas.",
        placement: "bottom",
      },
    ],
  };
}

/**
 * ¿Hay un recorrido guiado abierto en la pantalla? Mientras está abierto, Enter y las flechas
 * avanzan el recorrido: el editor no tiene que usarlas además para mover el elemento elegido.
 * Se reconoce por la capa oscura que el recorrido pone sobre la pantalla.
 */
export function isGuidedTourOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(".dnx-tour-fade") !== null;
}
