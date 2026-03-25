# Diseñador de fotolibros / spreads – Información para mejoras (UX, UI y código)

Este documento reúne toda la información del editor de fotolibros (página de prueba y componentes) para que otra herramienta (ej. ChatGPT) pueda proponer mejoras. **El editor “anda muy mal”** y se busca mejorar UX/UI y comportamiento.

---

## 1. Ruta y propósito

- **URL:** `/fotolibros-test`
- **Archivo página:** `app/fotolibros-test/page.tsx`
- **Propósito:** Editor MVP para diseñar **spreads** de fotolibros (o dípticos). El usuario puede crear frames en cada spread, arrastrar imágenes desde un banco de imágenes, posicionar/redimensionar/rotar, y guardar el documento. Persistencia: `localStorage` + API (base de datos `PhotobookDocument`).

---

## 2. Estructura de archivos

```
app/fotolibros-test/
  page.tsx                    # Página principal del editor

app/api/fotolibros-test/[id]/
  route.ts                    # GET (leer doc) y PUT (guardar doc)

components/fotolibros/
  types.ts                    # Tipos: AlbumDocument, Spread, FrameItem, ImageAsset, AlbumSpec, FitMode
  useHistory.ts               # Hook undo/redo (past, present, future)
  Timeline.tsx                # Lista horizontal de spreads (selección + drag & drop para reordenar)
  CanvasEditor.tsx            # Canvas Konva: stage, capa, frames arrastrables, transformer, drop de imágenes
  Inspector.tsx               # Panel lateral: editar X, Y, W, H, rotación, fitMode, imageZoom del frame seleccionado
  ImageBrowser.tsx            # Grid de imágenes con pestañas (Todas / Usadas / No usadas / Favoritas), arrastrables al canvas
  DevPanel.tsx                # Panel de debug: JSON del documento
```

**Dependencias:** `react-konva`, `konva` (canvas 2D), y componentes UI del proyecto (`Card`, `Button`, `Tabs`, `Input`).

---

## 3. Modelo de datos (tipos)

**`types.ts`:**

- **FitMode:** `"cover" | "contain"`
- **FrameItem:** `id`, `type: "frame"`, `x`, `y`, `width`, `height`, `rotation`, `imageId?`, `fitMode`, `imageZoom`
- **Spread:** `id`, `items: FrameItem[]`
- **AlbumSpec:** `pageWidth`, `pageHeight`, `bleed`, `safe`
- **AlbumDocument:** `id`, `title`, `spec: AlbumSpec`, `spreads: Spread[]`
- **ImageAsset:** `id`, `url`, `name`, `favorite?`

**Persistencia:** El documento se guarda en Prisma como `PhotobookDocument`: `id` (string), `title`, `data` (JSON del `AlbumDocument`). La página usa por defecto `id: "demo"`.

---

## 4. Flujo UX actual (resumen)

1. Se carga la página; se intenta cargar desde `localStorage` y desde la API (`/api/fotolibros-test/demo`). Si hay datos, se reemplaza el estado.
2. **Timeline:** Muestra una fila de “Spread 1”, “Spread 2”, … Se puede hacer clic para seleccionar el spread activo y drag & drop para reordenar.
3. **Canvas:** Muestra el spread seleccionado como un doble página (pageWidth*2 + bleed). El usuario puede:
   - Arrastrar una imagen desde **ImageBrowser** y soltarla en el canvas: se crea un frame nuevo con esa imagen, o se asigna al frame sobre el que se soltó.
   - Clic en “Agregar frame”: crea un frame vacío en el centro.
   - Clic en un frame: lo selecciona (aparece borde y Transformer de Konva).
   - Arrastrar el frame para moverlo; usar los handles del Transformer para redimensionar/rotar.
   - Mantener **Espacio** para arrastrar el stage (pan).
   - **Ctrl/Cmd + +/-** para zoom.
4. **Inspector:** Si hay un frame seleccionado, muestra controles para X, Y, W, H, rotación, “Ajuste de imagen” (cover/contain), “Zoom interno” (slider).
5. **Deshacer / Rehacer:** Botones bajo el canvas; atajos Cmd/Ctrl+Z y Cmd/Ctrl+Shift+Z.
6. **Guardado:** Automático con debounce (~1,2 s) al cambiar `state.present`; también botón “Guardar” que escribe en `localStorage` y hace PUT a la API.
7. **Imágenes:** Por defecto hay 8 imágenes mock (picsum.photos). “Agregar imágenes” abre un file input y agrega archivos como object URLs al estado local (no se suben a servidor).

---

## 5. Problemas conocidos / por mejorar (lista para ChatGPT)

- **Layout / overflow:** La página usa `h-screen`, `flex flex-col`, `min-h-0`, `overflow-hidden` y varios `overflow-auto`. En muchas resoluciones el canvas queda muy comprimido o los paneles (Timeline, ImageBrowser, DevPanel) ocupan demasiado y el área de diseño es pequeña.
- **Canvas no se adapta al contenedor:** El `Stage` de Konva tiene `width={totalWidth}` y `height={totalHeight}` fijos (píxeles del documento), no del contenedor. No hay “fit to container” (escala para que el spread se vea entero en el área disponible). Resultado: en pantallas chicas o con mucho UI el canvas se corta o se ve minúsculo.
- **Pan con Espacio:** El pan con tecla Espacio está implementado, pero la experiencia no es clara (no hay cursor “mano” ni feedback visual).
- **Drop de imágenes:** Las coordenadas del drop dependen de `stagePos` y `userZoom`; si el stage está desplazado o con zoom, el punto puede sentirse desalineado con el cursor.
- **Transformer y refs:** Se usa `itemRefs` para asignar el nodo seleccionado al Transformer. Si el orden de los items cambia o hay re-renders, a veces el Transformer no se actualiza bien (bug conocido en Konva cuando los refs no coinciden con el nodo seleccionado).
- **Imagen “contain” en Konva:** En `fitMode === "contain"` se usan `clipX`, `clipY`, `clipWidth`, `clipHeight` con `KonvaImage`; en algunas versiones de Konva el clipping puede fallar o no verse bien. Revisar API actual de Konva para imágenes recortadas.
- **Lógica de render de imagen en CanvasEditor:** Hay dos bloques: `{!image ? <Rect ... /> : null}` y `{!image && imageAsset ? <KonvaImage image={imageCache[imageAsset.id]} ... /> : null}`. Si la imagen aún no está en caché, `image` es undefined pero `imageAsset` existe; entonces se intenta dibujar `imageCache[imageAsset.id]`, que puede ser undefined → posibles errores o frames vacíos hasta que cargue.
- **ImageBrowser:** `usedImageIds` es un `Set` pero el componente recibe `usedImageIds` y en el código se usa `usedImageIds.has()`. Verificar que el tipo en la página sea coherente (en la página se calcula un `Set`, pero el prop podría estar tipado como array en algún lado).
- **DevPanel:** Siempre visible y ocupa altura fija (`h-32`); en pantallas chicas resta espacio al canvas. Debería ser colapsable o solo en desarrollo.
- **Sin feedback de guardado:** No hay indicador “Guardando…” / “Guardado” al hacer el autosave o al pulsar “Guardar”.
- **Sin validación de documento:** No se valida que los frames estén dentro de márgenes de seguridad (safe) ni que no se solapen en exceso (opcional).
- **Móvil:** El editor no está pensado para touch: arrastrar frames, usar Transformer y pan/zoom en táctil puede ser muy incómodo o no funcionar bien.

---

## 6. Código de la página principal (`app/fotolibros-test/page.tsx`)

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Timeline from "@/components/fotolibros/Timeline";
import CanvasEditor from "@/components/fotolibros/CanvasEditor";
import Inspector from "@/components/fotolibros/Inspector";
import ImageBrowser from "@/components/fotolibros/ImageBrowser";
import DevPanel from "@/components/fotolibros/DevPanel";
import { useHistory } from "@/components/fotolibros/useHistory";
import type { AlbumDocument, FrameItem, ImageAsset, Spread } from "@/components/fotolibros/types";

const STORAGE_KEY = "fotolibros-test-doc";

const mockImages: ImageAsset[] = [
  { id: "img-1", url: "https://picsum.photos/id/1011/800/600", name: "Bosque" },
  // ... 8 imágenes
];

const createInitialDocument = (): AlbumDocument => ({
  id: "demo",
  title: "Fotolibro Demo",
  spec: { pageWidth: 700, pageHeight: 500, bleed: 6, safe: 6 },  // 3 mm área de corte y Safe Zone
  spreads: Array.from({ length: 6 }).map((_, index) => ({
    id: `spread-${index + 1}`,
    items: [],
  })),
});

const createId = () => `frame-${Math.random().toString(36).slice(2, 10)}`;

export default function FotolibrosTestPage() {
  const { state, setPresent, replacePresent, undo, redo, canUndo, canRedo } = useHistory<AlbumDocument>(createInitialDocument());
  const [selectedSpreadId, setSelectedSpreadId] = useState(state.present.spreads[0]?.id ?? "");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAsset[]>(mockImages);
  const imageBrowserRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSpread = useMemo(
    () => state.present.spreads.find((spread) => spread.id === selectedSpreadId) ?? state.present.spreads[0],
    [selectedSpreadId, state.present.spreads]
  );

  const usedImageIds = useMemo(() => {
    const ids = new Set<string>();
    state.present.spreads.forEach((spread) =>
      spread.items.forEach((item) => {
        if (item.imageId) ids.add(item.imageId);
      })
    );
    return ids;
  }, [state.present.spreads]);

  // ... efectos: sync selectedSpreadId, atajos undo/redo, load from localStorage + API, autosave debounce

  const updateDocument = (updater: (doc: AlbumDocument) => AlbumDocument) => { ... };
  const updateSpread = (spreadId: string, updater: (spread: Spread) => Spread) => { ... };
  const handleCreateFrame = (payload: Partial<FrameItem>) => { ... };
  const handleUpdateItem = (itemId: string, next: Partial<FrameItem>) => { ... };
  const handleAssignImage = (itemId: string, imageId: string) => { ... };
  const handleReorderSpreads = (next: Spread[]) => { ... };
  const handleToggleFavorite = (id: string) => { ... };
  const handleAddImages = (files: FileList | null) => { ... };

  const selectedItem = activeSpread?.items.find((item) => item.id === selectedItemId) ?? null;

  return (
    <div className="h-screen min-h-screen flex flex-col gap-4 overflow-hidden">
      <Card className="p-4 ..."> ... título, "Agregar imágenes", "Guardar" </Card>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 ...">
        <div className="space-y-3 ...">
          <Timeline ... />
          <Card className="... flex-1 min-h-0 overflow-hidden">
            {activeSpread ? (
              <div className="h-full overflow-auto">
                <CanvasEditor ... />
              </div>
            ) : ...}
            <div> Deshacer / Rehacer </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Inspector item={selectedItem} onChange={...} />
        </div>
      </div>
      <input ref={fileInputRef} type="file" ... />
      <div ref={imageBrowserRef} className="shrink-0 h-56 ...">
        <ImageBrowser ... />
      </div>
      <div className="shrink-0 h-32 ...">
        <DevPanel json={state.present} />
      </div>
    </div>
  );
}
```

---

## 7. API (`app/api/fotolibros-test/[id]/route.ts`)

- **GET:** Recibe `id` (ej. `demo`). Busca `PhotobookDocument` por `id`. Si no existe → 404. Si existe → devuelve el documento (incluye `data` con el JSON del álbum).
- **PUT:** Body: `{ title?: string, data: AlbumDocument }`. Hace `upsert` por `id`: crea o actualiza. Devuelve el documento guardado.

No hay autenticación: cualquiera puede leer/escribir por id. Es una API de prueba.

---

## 8. Componentes (resumen para mejorar)

### Timeline
- Fila de botones (un botón por spread), draggable para reordenar, onClick para seleccionar.
- Estilos: activo con borde naranja y fondo claro.

### CanvasEditor (Konva)
- **Stage** con tamaño fijo `totalWidth x totalHeight` (spec en píxeles).
- **Layer** con: fondo, rectángulo blanco doble página, línea central, rectángulo de safe area (punteado).
- Por cada item del spread: **Group** (draggable) con Rect (borde), KonvaImage (cover o contain según fitMode), y a veces Rect de relleno. **Transformer** asociado al item seleccionado vía refs.
- Drop: lee `application/x-image-id`, calcula posición en coordenadas del stage (restando stagePos y dividiendo por userZoom), busca si el punto cae en un frame existente (asigna imagen) o crea un frame nuevo.
- Zoom con state `userZoom`; pan con `stagePos` cuando `isSpaceDown`.

### Inspector
- Si no hay item: mensaje “Seleccioná un frame para editarlo.”
- Si hay item: inputs numéricos X, Y, W, H, Rotación; select fitMode (cover/contain); slider imageZoom.

### ImageBrowser
- Tabs: Todas, Usadas, No usadas, Favoritas. Input de búsqueda por nombre.
- Grid de imágenes; cada una es draggable con `dataTransfer.setData("application/x-image-id", img.id)`.
- Botón favorito (estrella) por imagen.

### DevPanel
- Muestra `JSON.stringify(json, null, 2)` en un `<pre>` con scroll. Solo debug.

---

## 9. Mejoras sugeridas (para quien implemente)

1. **Canvas que se adapte al contenedor:** Calcular escala para que `totalWidth/totalHeight` quepa en el div contenedor (manteniendo aspect ratio) y usar `scale` del Stage en consecuencia; opcionalmente centrar el stage.
2. **Layout responsive:** Dar más espacio al canvas en desktop (por ejemplo Inspector colapsable o en pestaña); reducir o colapsar ImageBrowser y DevPanel; en móvil considerar vista solo lectura o flujo simplificado.
3. **Feedback de guardado:** Estado “Guardando…” / “Guardado” / “Error” y mostrarlo cerca del botón Guardar.
4. **Corregir render de imágenes en CanvasEditor:** Unificar la lógica de “imagen cargando” vs “imagen lista” y evitar usar `imageCache[imageAsset.id]` cuando aún es undefined; mostrar un placeholder claro mientras carga.
5. **Transformer estable:** Asegurar que, al cambiar de spread o al actualizar items, los refs del Transformer se actualicen correctamente (por ejemplo con `key={selectedItemId}` en el Layer o forzando un re-mount cuando cambie la selección).
6. **DevPanel:** Oculto por defecto o detrás de un “Modo debug” para no restar espacio.
7. **Safe area visual:** Dejar claro en el canvas qué zona es “safe” y qué es “bleed” para que el usuario diseñe con criterio.
8. **Accesibilidad y teclado:** Eliminar frame seleccionado (Delete/Backspace), duplicar frame (Ctrl+D), etc., y anunciar acciones por teclado en la UI.

---

## 10. Prisma (modelo usado)

```prisma
model PhotobookDocument {
  id        String   @id @default(cuid())
  title     String?
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([createdAt])
  @@index([updatedAt])
}
```

La página usa `id: "demo"` fijo; el upsert crea/actualiza ese registro.

---

Si querés que ChatGPT (u otra herramienta) proponga cambios concretos, podés pasarle este documento y pedirle que:
- mejore el layout y la prioridad de espacio para el canvas,
- proponga un “fit to container” para el Stage,
- unifique y corrija el render de imágenes en CanvasEditor,
- estabilice el Transformer y el drop,
- y añada feedback de guardado y opción de ocultar el DevPanel.
