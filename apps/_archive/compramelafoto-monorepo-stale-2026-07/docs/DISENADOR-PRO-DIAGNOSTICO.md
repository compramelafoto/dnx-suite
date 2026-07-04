# Diseñador PRO — Diagnóstico inicial (qué estaba mal y qué se cambió)

## 1. Componentes principales identificados

| Componente | Ubicación | Función |
|------------|-----------|---------|
| **Header** | Fila 1 (Card superior) | Título "Editor de Fotolibros (MVP)", botones "Agregar imágenes" y "Guardar" |
| **Tabs de spreads** | Timeline.tsx | Fila horizontal de botones "Spread 1"… "Spread 6", selección y reorden por drag |
| **Canvas editor** | CanvasEditor.tsx | Stage Konva: doble página, frames, Transformer, drop de imágenes, zoom/pan |
| **Sidebar de imágenes** | ImageBrowser.tsx | Grid de thumbnails, tabs Todas/Usadas/No usadas/Favoritas, búsqueda, drag al canvas |
| **Inspector** | Inspector.tsx | Panel derecho: X, Y, W, H, rotación, fitMode, imageZoom del frame seleccionado |
| **DevPanel** | DevPanel.tsx | JSON del documento (debug) |
| **Undo/Redo** | Botones bajo el canvas | Deshacer / Rehacer |

## 2. Por qué se superponían / layout roto

### Causas detectadas

- **Estructura en 2 columnas solo (grid xl:grid-cols-[1fr_360px]):** La galería de imágenes (ImageBrowser) y el DevPanel estaban **fuera** del grid, en filas fijas debajo (`shrink-0 h-56` y `shrink-0 h-32`). Eso hacía que en viewports medios/pequeños el contenido vertical se acumulara y el canvas quedara empujado o tapado por scrolls.
- **Contenedores sin `min-height: 0`:** En cadenas flex (`flex-1 min-h-0`), algunos contenedores intermedios no tenían `min-height: 0`, por lo que el contenido no respetaba el espacio disponible y podía “reventar” el layout o generar doble scroll.
- **Canvas en div con `overflow-auto`:** El CanvasEditor vive dentro de un `div` con `h-full overflow-auto`. El Stage de Konva tiene tamaño fijo (totalWidth x totalHeight). Si el contenedor es más chico, aparece scroll; si es más grande, no se centra ni escala. No había “fit to container”, lo que contribuía a sensación de desorden y superposición visual.
- **DevPanel siempre visible:** Ocupaba altura fija al final; en pantallas chicas restaba espacio al canvas y sumaba sensación de “todo apretado”.
- **Orden visual:** En desktop, la galería estaba abajo en lugar de ser una columna lateral, por lo que el flujo natural (imágenes a un lado, canvas al centro, inspector al otro lado) no existía y la UI se sentía caótica.
- **Sin `position: absolute/fixed` problemáticos:** No se detectaron modales o paneles flotantes con z-index descontrolado; el problema era de **distribución del espacio** (grid/flow) y de **overflow**, no de capas superpuestas por position.

### Cambios aplicados (Layout PRO)

- **Desktop (≥1024px):**
  - **Fila 1 (header):** Título, acciones (Agregar imágenes, Guardar), zoom y “Agregar frame” integrados en la barra; tabs de spreads en la misma fila o justo debajo.
  - **Fila 2 (main):** CSS Grid de **3 columnas:**
    - **Columna izquierda:** Panel “Imágenes” (ImageBrowser) con `min-width: 0`, `overflow: auto`, altura definida por grid (`1fr`).
    - **Columna central:** Área “Canvas”: Timeline (spreads) + CanvasEditor en un contenedor con `min-height: 0`, `flex-1`, `overflow: auto` solo en este bloque, para que el canvas tenga scroll propio y nunca sea tapado por otros paneles.
    - **Columna derecha:** Inspector con `min-width: 0`, `overflow: auto`.
  - **Reglas CSS:** Todos los paneles de la fila 2 tienen `min-height: 0` (y donde aplica `min-width: 0`) para que el scroll funcione correctamente dentro de cada uno. Nada flotando sobre el canvas.
- **DevPanel:** Oculto por defecto; toggle “Debug” en el header lo muestra en una **fila 3** dedicada, con altura máxima y `overflow: auto`, sin invadir el área del canvas.
- **Mobile (<1024px):** Layout de una columna: canvas ocupa la parte central; Imágenes e Inspector pasan a drawers (bottom sheet o lateral) abiertos por botones flotantes “Imágenes” y “Editar”, de modo que nada se superponga de forma permanente al canvas.

## 3. Hotspots de rendimiento identificados

| Hotspot | Descripción |
|---------|-------------|
| **Rerenders en drag/move** | Cada `onDragEnd` / `onTransformEnd` actualiza estado (document) → re-render de toda la página y de listas (Timeline, ImageBrowser). |
| **Galería sin virtualización** | ImageBrowser renderiza todos los thumbnails; con muchas imágenes hay muchos DOM nodes y rerenders. |
| **Estado en un solo lugar** | `state.present` (documento completo) en useHistory; cualquier cambio de un frame hace que todos los componentes que dependen del documento se re-rendericen. |
| **Canvas** | Konva redibuja la capa; no se usa RAF explícito para throttling durante drag. El Stage tiene tamaño fijo y no está escaleado al contenedor, lo que puede afectar rendimiento en algunos dispositivos. |
| **useEffect de load** | Depende de `state.present.id`; replacePresent tras load puede causar doble render y en algunos casos race con autosave. |
| **Autosave en useEffect** | Cada cambio a `state.present` dispara un setTimeout de 1.2s; si el usuario edita rápido, se acumulan timeouts y múltiples guardados. |

### Mejoras previstas (no todas en primera entrega)

- Separar estado: documento vs UI (selectedId, panel abierto, zoom) vs assets; usar selectors o store (ej. Zustand) para que solo se re-rendericen los componentes que lean la parte afectada.
- Memoizar listas: Timeline items, ImageBrowser items (React.memo + keys estables).
- Virtualizar galería (react-window o similar) y lazy-load de thumbnails.
- Canvas: throttling con requestAnimationFrame en drag/transform; opcionalmente “fit to container” con escala para reducir píxeles dibujados en pantallas chicas.
- Autosave: un solo timeout por “ola” de cambios (resetear timeout en cada cambio en lugar de múltiples timeouts).

## 4. Resumen “qué estaba mal y qué se cambió”

- **Mal:** Layout de 2 columnas + galería y debug fijos abajo → canvas apretado, scrolls confusos, sensación de superposición.
- **Cambio:** Layout de 3 columnas en desktop (Imágenes | Canvas | Inspector), con `min-height: 0` / `min-width: 0` y overflow por panel; DevPanel opcional en fila 3; mobile con drawers.
- **Mal:** Sin atajos Delete/Esc; borrar solo desde inspector (implícito).
- **Cambio:** Delete/Backspace borra el frame seleccionado; Esc deselecciona; no capturar si el foco está en input/textarea/select.
- **Mal:** DevPanel siempre visible y restando espacio.
- **Cambio:** Toggle “Debug” para mostrar/ocultar en fila propia.
- **Implementado en esta fase:** Delete/Backspace borra el frame seleccionado; Esc deselecciona; Ctrl/Cmd+Z y Ctrl/Cmd+Shift+Z undo/redo. No se capturan atajos cuando el foco está en input/textarea/select. DevPanel oculto por defecto con toggle "Debug". Feedback de guardado (Guardando… / Guardado) en el botón Guardar.
- **Pendiente (fases siguientes):** Nudge con flechas (1px / Shift+10px), Ctrl+C/V copiar/pegar frame, virtualización galería, estado más granular, RAF en canvas, plantillas por producto, chroma/máscaras, export 300 DPI.
