# Probador de cuadros v2 — Etapa 4 (Marcos reales) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el probador muestre los marcos reales del estudio (los de VGO cargados en Ventas), con su foto de frente, sus medidas y su precio, y que se puedan pedir.

**Architecture:**
- Un **modelo de marco** es un producto del catálogo más un color, con una foto de frente "enderezada": un PNG con la ventana transparente.
- El estudio la carga en el panel. Sube una foto del marco de frente, marca las 4 esquinas de afuera y las 4 de la ventana, y el navegador la endereza con la misma homografía del probador.
- El probador dibuja el marco "estirado por partes" (9 partes): las esquinas fijas y los lados estirados. Así una sola foto sirve para todas las medidas de ese modelo.
- Entre la ventana y la foto se dibuja paspartú blanco cuando la medida lo trae (VGO: "20x30 o 30x40").

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-30-probador-de-cuadros-v2-design.md`, sección 9.

## Decisiones (de Claude, para revisar)

1. **Medidas del marco:** salen del nombre del producto más el de la variante.
   - Si aparecen dos medidas ("13x18 / 28x35", "20x30 o 30x40"), la chica es la **foto** y la grande el **exterior**.
   - Si aparece una sola ("Marco box · 20x30cm"), es la foto, y el exterior se calcula con el ancho del perfil medido en la foto del modelo.
2. **Precio de un cuadro con marco:** precio del marco (variante o producto) más precio de la **ampliación** de la medida de la foto. Si falta alguno, esa medida queda "sin precio" y no se puede pedir.
   - Hoy los marcos VGO están en $0: hay que cargarles precio en Ventas.
   - Faltan las ampliaciones 10x15, 13x18 y 15x20: hay que crearlas en Ventas para ofrecer esos marcos.
3. **Pedido:** el laboratorio recibe la **foto** a su medida (el renglón de la ampliación). El marco sale del stock del estudio: el nombre del archivo y el mapa de armado dicen qué modelo y color lleva cada cuadro.
4. **Qué productos aparecen para cargar como modelo:** los de VGO cuyo nombre empieza con "Marco" o "Cuadro portarretratos", más cualquier producto cuyo nombre empiece con "Marco".
5. **Paspartú:**
   - Con modelo real, es el de la medida; el selector de paspartú se oculta.
   - Con el marco negro genérico (sin modelos cargados), sigue como en la etapa 1.

## Tasks

1. **`lib/probador/marcos.ts`** (puro, con pruebas):
   - `medidasDeMarco(nombreProducto, nombreVariante)` → `{ foto, exterior | null }`;
   - `colorDeVariante(nombre)`;
   - `bordesCm(modelo)`;
   - `medidaConMarco(modelo, foto, exterior)` → exterior, ventana y foto en cm;
   - `armarMarcos(productos, modelos, catalogoImpresion)` → opciones con precio.
2. **Migración:** tabla `FotofficeModeloMarco`, con `workspaceId`, `productId`, `color`, `imagenUrl`, `imagenAncho`, `imagenAlto`, `ventana*` (px), `exteriorAnchoCm`, `exteriorAltoCm`, `activo` y las fechas. Tiene clave única `(workspaceId, productId, color)`. Preset de imagen `frameModel` (PNG, prefijo `fotoffice/frame-models`).
3. **Panel `/probador/marcos`:** la lista de productos y colores, con su estado y "Cargar foto de frente". El editor marca 8 puntos, endereza en el navegador, se elige la medida de esa pieza, se guarda y se activa o desactiva.
4. **Probador:**
   - `Cuadro` suma `modeloMarco?` y `foto?: { w, h }`;
   - `rectFoto` usa la foto centrada;
   - el dibujo 9-slice reemplaza al marco genérico cuando hay modelo;
   - el selector de modelo, por miniaturas, va en el conjunto y en el cuadro;
   - las medidas de MARCO son las del modelo;
   - el presupuesto suma marco + ampliación;
   - en el asistente, "Con marco" se ve en el paso 3.
5. **Pedido:**
   - `validarPedido` acepta MARCO con modelo y medida válidos y precio combinado;
   - el renglón lleva la foto a la medida de la ampliación (laboratorio de la ampliación) y `marco: { modeloId, producto, color }` en la receta;
   - `rutaEnZip` y el mapa de armado nombran el marco.
6. Pruebas, migración en producción, PR y verificación.
