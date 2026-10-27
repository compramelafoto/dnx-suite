# Bot de WhatsApp — Etapa 2: archivos entrantes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un cliente manda una foto, documento, video o audio por WhatsApp, FOTOFFICE la baja de Meta enseguida, la guarda en el R2 privado, la muestra en la Bandeja y el bot sabe si la foto alcanza para la medida que pide.

**Architecture:** El webhook registra el mensaje como hoy y devuelve además los ids de los mensajes con archivo. Después de responder a Meta (`after()`), primero se bajan los archivos (Graph API → R2 privado; ancho/alto con sharp) y recién después contesta el bot, así el bot ya ve la resolución. El resultado de la descarga se guarda dentro de la columna `media` (JSON) que ya existe: **sin migración**.

**Tech Stack:** Next.js (app router, `after`), Prisma 6, `@aws-sdk/client-s3` (R2 privado), `sharp` 0.34, vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-bot-whatsapp-24x7-design.md` §4 "Etapa 2 — Archivos entrantes".

## Global Constraints

- Sin migración de base: todo lo nuevo vive en `FotofficeWaMensaje.media` (Json).
- La URL de Meta del medio vence en minutos: se baja en el mismo `after()` del webhook, nunca en un cron.
- Nunca loguear textos, teléfonos, tokens ni URLs firmadas (regla de la Bandeja).
- Tope de descarga: 100 MB por archivo (máximo de Meta para documentos). Más grande → `descarga: "GRANDE"`.
- Clave en R2: `bandeja/<workspaceId>/<chatId>/<mensajeId>.<ext>`.
- Calidad para imprimir: 300 dpi = ideal, 150 dpi = piso aceptable. Medidas reales (mm): 10x15 = 102×152, 13x18 = 127×180, 15x20 = 152×203, 15x21 = 152×210, 20x30 = 203×300, 25x38 = 254×380, 30x40 = 300×400, 30x45 = 300×450.
- Textos para el cliente en castellano rioplatense semiformal (ver guía del bot).
- Modo SIMULADO: los mensajes no traen `media.id`; no se baja nada.

## Review Focus

- Meta reintenta el webhook: el mismo mensaje no se baja dos veces (si `media.descarga` ya existe, `descargarMedio` no hace nada).
- Token vencido o Meta caída: el mensaje queda `descarga: "FALLO"`, la Bandeja lo dice y el bot pide reenviarla; el bot igual contesta.
- Foto de WhatsApp comprimida (1600×1200) y el cliente pide 20x30: el bot debe pedir reenviarla como Documento 📎.
- Foto vertical vs. medida horizontal: la comparación ignora la orientación (lado corto con lado corto).
- Un archivo de otro workspace: la ruta de lectura nunca entrega un archivo de un chat ajeno (filtra por `workspaceId` del contexto).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/bandeja/calidad.ts` (nuevo, PURO) | Píxeles vs. medida: qué medidas alcanza una foto. |
| `lib/bandeja/medios.ts` (nuevo, server) | Bajar un medio de Meta y guardarlo en R2; escribir el resultado en `media`. |
| `lib/bandeja/archivo-de-mensaje.ts` (nuevo, PURO) | Leer `media` (Json) → `ArchivoDeMensaje` seguro para la pantalla y el bot. |
| `lib/carpetas/subir-servidor.ts` | Permitir el prefijo `bandeja/`. |
| `lib/bandeja/registro.ts` | `ResultadoRegistro.medios: string[]`. |
| `lib/bandeja/bot/programar.ts` | `programarTrasRegistro({ medios, paraElBot })`: baja y después contesta. |
| `app/api/webhooks/whatsapp/route.ts` | Usar `programarTrasRegistro`. |
| `lib/bandeja/bot/historial.ts`, `responder.ts`, `guia.ts` | El bot ve resolución / falla y sabe pedir "como Documento". |
| `lib/bandeja/lecturas.ts`, `components/bandeja/burbuja-de-mensaje.tsx` | Miniatura, abrir y descargar. |
| `app/api/bandeja/archivos/[mensajeId]/route.ts` (nuevo) | Con permiso de la Bandeja, redirige a la URL firmada de R2. |

---

### Task 1: Calidad de impresión (PURO)

**Files:**
- Create: `apps/fotoffice/lib/bandeja/calidad.ts`
- Test: `apps/fotoffice/lib/bandeja/calidad.test.ts`

**Interfaces:**
- Produces: `type Calidad = "ideal" | "aceptable" | "insuficiente"`; `MEDIDAS_MM: Record<string, [number, number]>` (las de Global Constraints); `calidadParaMedida(ancho: number, alto: number, medida: string): Calidad | null` (null si la medida no está en la tabla); `medidasQueAlcanzan(ancho: number, alto: number): string[]` (medidas con calidad ≥ aceptable, en el orden de la tabla).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { calidadParaMedida, medidasQueAlcanzan } from "./calidad";

describe("calidad de impresión", () => {
  it("foto de celular original (4000×3000) es ideal para 20x30", () => {
    expect(calidadParaMedida(4000, 3000, "20x30")).toBe("ideal");
  });
  it("foto comprimida por WhatsApp (1600×1200) alcanza para 10x15 pero no para 20x30", () => {
    expect(calidadParaMedida(1600, 1200, "10x15")).not.toBe("insuficiente");
    expect(calidadParaMedida(1600, 1200, "20x30")).toBe("insuficiente");
  });
  it("ignora la orientación", () => {
    expect(calidadParaMedida(1200, 1800, "10x15")).toBe(calidadParaMedida(1800, 1200, "10x15"));
  });
  it("medida desconocida → null", () => {
    expect(calidadParaMedida(4000, 3000, "7x9")).toBeNull();
  });
  it("medidasQueAlcanzan lista en orden de la tabla", () => {
    expect(medidasQueAlcanzan(1600, 1200)).toEqual(["10x15", "13x18", "15x20", "15x21"]);
  });
});
```

Regla: una medida alcanza con calidad X si lado corto ≥ ceil(corto_mm / 25.4 × dpi) **y** lado largo ≥ ceil(largo_mm / 25.4 × dpi); ideal = 300 dpi, aceptable = 150 dpi. (1600×1200: 15x21 pide 898×1240 a 150 dpi → alcanza; 20x30 pide 1199×1772 → no.)

- [ ] **Step 2: Run** `pnpm vitest run lib/bandeja/calidad.test.ts` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** `calidad.ts` con la regla de arriba (redondeo hacia arriba de los píxeles requeridos).
- [ ] **Step 4: Run** el test — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Bandeja: calidad de impresión según píxeles y medida"`

---

### Task 2: Leer el archivo de un mensaje (PURO)

**Files:**
- Create: `apps/fotoffice/lib/bandeja/archivo-de-mensaje.ts`
- Test: `apps/fotoffice/lib/bandeja/archivo-de-mensaje.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type EstadoDescarga = "LISTO" | "FALLO" | "GRANDE" | "PENDIENTE";
  export type MediaGuardada = { id?: string; mimeType?: string; filename?: string; caption?: string;
    descarga?: Exclude<EstadoDescarga, "PENDIENTE">; clave?: string; bytes?: number; ancho?: number; alto?: number };
  export type ArchivoDeMensaje = { estado: EstadoDescarga; mime: string | null; nombre: string; bytes: number | null; ancho: number | null; alto: number | null };
  export function archivoDeMensaje(tipo: string, media: unknown): ArchivoDeMensaje | null; // null si tipo no es IMAGEN/DOCUMENTO/VIDEO/AUDIO o no hay media.id
  export function claveDeMedia(media: unknown): string | null; // sólo si descarga === "LISTO"
  ```
  `nombre`: `filename` si viene; si no, `"foto.jpg" | "video.mp4" | "audio.ogg" | "archivo"` según tipo/mime. Nunca expone `clave` ni `id` en `ArchivoDeMensaje`.

- [ ] **Step 1: Failing tests**: (a) IMAGEN con `{id, mimeType:"image/jpeg"}` sin `descarga` → `estado:"PENDIENTE"`, `nombre:"foto.jpg"`; (b) con `{descarga:"LISTO", clave:"bandeja/w/c/m.jpg", bytes:1000, ancho:1600, alto:1200}` → esos números y `claveDeMedia` = la clave; (c) `descarga:"FALLO"` → `claveDeMedia` null; (d) TEXTO → null; (e) media basura (`"x"`, `null`, `{ancho:"mil"}`) no rompe: números inválidos → null.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `"Bandeja: leer el archivo guardado de un mensaje"`

---

### Task 3: Bajar el medio de Meta y guardarlo en R2

**Files:**
- Create: `apps/fotoffice/lib/bandeja/medios.ts`
- Modify: `apps/fotoffice/lib/carpetas/subir-servidor.ts` (agregar `"bandeja/"` a `PERMITIDAS`)
- Test: `apps/fotoffice/lib/bandeja/medios.test.ts`

**Interfaces:**
- Consumes: `MediaGuardada` (Task 2); `leerTokenWhatsapp(workspaceId)` de `@/lib/integrations/whatsapp/credentials`; `subirBuffer(clave, cuerpo, tipo)`.
- Produces:
  ```ts
  export type DepsMedios = {
    fetch?: typeof fetch;
    leerToken?: (workspaceId: string) => Promise<string | null>;
    subir?: (clave: string, cuerpo: Buffer, tipo: string) => Promise<void>;
    medidas?: (cuerpo: Buffer) => Promise<{ ancho: number; alto: number } | null>; // sharp(cuerpo).metadata(), respetando orientation EXIF (5–8 intercambia)
    db?: typeof prisma;
  };
  export async function descargarMedio(mensajeId: string, deps?: DepsMedios): Promise<"LISTO" | "FALLO" | "GRANDE" | "omitido">;
  export async function descargarMedios(mensajeIds: readonly string[], deps?: DepsMedios): Promise<void>; // en serie, nunca lanza
  ```

Comportamiento de `descargarMedio`:
1. Lee el mensaje (`id, workspaceId, chatId, tipo, media`) y la conexión del workspace. `omitido` si: no existe, `media.id` falta, `media.descarga` ya está, o la conexión no es `REAL`.
2. `GET https://graph.facebook.com/${WHATSAPP_API_VERSION||"v21.0"}/${media.id}` con `Authorization: Bearer <token>` → `{ url, mime_type, file_size }`. Si `file_size > 100*1024*1024` → guarda `descarga:"GRANDE"` y devuelve `GRANDE`.
3. `GET url` con el mismo `Authorization` (Meta lo exige) → `Buffer`. Si supera 100 MB al leer → `GRANDE`.
4. Extensión desde el mime (`image/jpeg→jpg`, `image/png→png`, `image/webp→webp`, `video/mp4→mp4`, `audio/ogg→ogg`, `application/pdf→pdf`, otro → `bin`). Clave `bandeja/<workspaceId>/<chatId>/<mensajeId>.<ext>`. `subir`.
5. Si `tipo === "IMAGEN"` o el mime empieza con `image/`: `medidas(cuerpo)`.
6. `update` de `media` = `{ ...media, descarga:"LISTO", clave, bytes, ancho?, alto?, mimeType: media.mimeType ?? mime_type }`.
7. Cualquier error (sin token, HTTP no 2xx, R2) → `media.descarga = "FALLO"` y `console.error("[fotoffice][whatsapp] no se pudo bajar un archivo", { mensajeId, ...detalleDeError(e) })`; devuelve `FALLO`.

- [ ] **Step 1: Failing tests** (fetch, token, subir, medidas y `db` falsos; reusar `__fixtures__`/`base-en-memoria` si sirve):
  - flujo feliz de imagen: llama al Graph con el id, sube con clave `bandeja/w1/c1/m1.jpg`, guarda `{descarga:"LISTO", bytes, ancho:1600, alto:1200}` y conserva `caption`.
  - segundo llamado con `descarga` ya puesta → `"omitido"` y no llama a fetch.
  - `file_size` 200 MB → `"GRANDE"`, no sube.
  - token `null` → `"FALLO"` guardado.
  - Graph responde 401 → `"FALLO"`.
  - conexión SIMULADO → `"omitido"`.
  - el `console.error` no incluye la URL ni el token (espiar `console.error` y revisar los argumentos).
- [ ] **Step 2: Run** `pnpm vitest run lib/bandeja/medios.test.ts` — FAIL.
- [ ] **Step 3: Implement** `medios.ts` (`import "server-only"`; `medidas` por defecto con `sharp(cuerpo).metadata()`).
- [ ] **Step 4: Run** — PASS. También `pnpm vitest run lib/carpetas`.
- [ ] **Step 5: Commit** `"Bandeja: bajar los archivos de WhatsApp al R2 privado"`

---

### Task 4: Bajar antes de que conteste el bot

**Files:**
- Modify: `apps/fotoffice/lib/bandeja/registro.ts` (`ResultadoRegistro`, `registrarMensaje`, `escribir`)
- Modify: `apps/fotoffice/lib/bandeja/bot/programar.ts`
- Modify: `apps/fotoffice/app/api/webhooks/whatsapp/route.ts`
- Test: `apps/fotoffice/lib/bandeja/registro.test.ts`

**Interfaces:**
- Consumes: `descargarMedios` (Task 3), `responderConBot`.
- Produces: `ResultadoRegistro.medios: string[]` (ids de mensajes ENTRANTES nuevos con `media.id`; ni ecos ni duplicados). `escribir` pasa a devolver `{ paraElBot: string | null; mensajeConMedio: string | null }`. `programarTrasRegistro(r: { medios: readonly string[]; paraElBot: readonly string[] }): void` — en un solo `after`: `await descargarMedios(r.medios)` y después los `responderConBot`. `programarBot` queda para el simulador.

- [ ] **Step 1: Failing tests** en `registro.test.ts`: un ENTRANTE con imagen → `medios` tiene el id del mensaje creado; el mismo evento repetido → `medios` vacío (duplicado); un ECO con imagen → no entra en `medios`; un TEXTO → no entra.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** registro + `programarTrasRegistro`; el webhook pasa de `programarBot(r.paraElBot)` a `programarTrasRegistro(r)`.
- [ ] **Step 4: Run** `pnpm vitest run lib/bandeja` — PASS.
- [ ] **Step 5: Commit** `"Bandeja: bajar los archivos y después contestar con el bot"`

---

### Task 5: El bot ve la resolución y pide "como Documento"

**Files:**
- Modify: `apps/fotoffice/lib/bandeja/bot/historial.ts`, `historial.test.ts`
- Modify: `apps/fotoffice/lib/bandeja/bot/responder.ts` (agregar `media: true` al `select` de la línea ~100)
- Modify: `apps/fotoffice/lib/bandeja/bot/guia.ts`, `guia.test.ts`

**Interfaces:**
- Consumes: `archivoDeMensaje` (Task 2), `medidasQueAlcanzan` (Task 1).
- Produces: `MensajeChat` suma `media?: unknown`. Etiquetas nuevas de `textoDe` para IMAGEN/DOCUMENTO con imagen:
  - LISTO con ancho/alto: `[el cliente mandó una foto de 1600×1200 px; alcanza para imprimir hasta: 10x15, 13x18, 15x20, 15x21]` (si no alcanza para ninguna: `…; no alcanza para imprimir`).
  - FALLO: `[el cliente mandó una foto pero no se pudo bajar: pedile que la reenvíe]`.
  - GRANDE: `[el cliente mandó un archivo de más de 100 MB que no se pudo guardar]`.
  - PENDIENTE o sin datos: la etiqueta de hoy.

- [ ] **Step 1: Failing tests** en `historial.test.ts` para las cuatro etiquetas; en `guia.test.ts`: la guía contiene `"como Documento"`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Agregar a la guía, en la sección de fotos: "Si el cliente pide una medida que la foto no alcanza, explicale que WhatsApp achica las fotos y pedile que la mande como Documento (el clip 📎 → Documento) para que llegue en calidad original. No digas píxeles ni dpi."
- [ ] **Step 4: Run** `pnpm vitest run lib/bandeja/bot` — PASS.
- [ ] **Step 5: Commit** `"Bot de WhatsApp: ver la resolución de las fotos y pedirlas como documento"`

---

### Task 6: Ver y descargar en la Bandeja

**Files:**
- Create: `apps/fotoffice/app/api/bandeja/archivos/[mensajeId]/route.ts`
- Modify: `apps/fotoffice/lib/bandeja/lecturas.ts` (`MensajeDeChat.archivo`, `select` con `media`)
- Modify: `apps/fotoffice/components/bandeja/burbuja-de-mensaje.tsx`
- Test: `apps/fotoffice/lib/bandeja/lecturas.test.ts`, `apps/fotoffice/components/bandeja/burbuja-de-mensaje.test.tsx` (si existe el patrón; si no, test de la función pura `textoDeArchivo`)

**Interfaces:**
- Consumes: `archivoDeMensaje`, `claveDeMedia` (Task 2); `urlDeLecturaArchivo(clave, nombre, modo)`; `requireBandeja()`.
- Produces: `MensajeDeChat.archivo: ArchivoDeMensaje | null` (la lectura sigue sin devolver `media` crudo). Ruta `GET /api/bandeja/archivos/<mensajeId>?modo=ver|descargar`: `requireBandeja()`, busca el mensaje por `id` **y** `workspaceId: ctx.workspaceId`, `claveDeMedia` → 302 a `urlDeLecturaArchivo`; si no hay → 404. `Cache-Control: private, no-store`.

Burbuja:
- IMAGEN LISTO: `<img src="/api/bandeja/archivos/<id>?modo=ver" loading="lazy" class="max-h-64 rounded">` dentro de un link a la misma URL (abre en pestaña nueva) + texto chico `1600×1200 · 240 KB · Descargar`.
- Otros LISTO: ícono + nombre + peso + "Descargar"; VIDEO con `<video controls preload="none">`.
- PENDIENTE: "Bajando el archivo…". FALLO: "No se pudo bajar el archivo de WhatsApp" (color warning). GRANDE: "Archivo de más de 100 MB: pedile al cliente que lo mande por otro medio".
- Se borra el texto "(todavía no se muestra en la bandeja)" de `TIPO_SIN_TEXTO` para IMAGEN/DOCUMENTO/VIDEO/AUDIO.

- [ ] **Step 1: Failing test** en `lecturas.test.ts`: `detalleChat` de un chat con una imagen LISTO devuelve `archivo` con ancho/alto y **no** una propiedad `clave` ni `media`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** lectura, ruta y burbuja.
- [ ] **Step 4: Run** `pnpm vitest run lib/bandeja components/bandeja` — PASS; `pnpm tsc --noEmit -p .` sin errores nuevos en los archivos tocados.
- [ ] **Step 5: Commit** `"Bandeja: mostrar y descargar las fotos y archivos de WhatsApp"`

---

### Task 7: Prueba real en producción

- [ ] Abrir PR, esperar CI verde, fusionar, esperar el deploy "Ready".
- [ ] Daniel manda desde su WhatsApp al número de prueba: una foto normal, la misma foto como Documento, y un PDF.
- [ ] Verificar en la base (`FotofficeWaMensaje.media`) que las tres quedaron `descarga:"LISTO"` con clave `bandeja/…`, y en la Bandeja que se ven y se descargan.
- [ ] Verificar que el bot, si se le pide 20x30 con la foto comprimida, pide reenviarla como Documento.

## Fuera de esta etapa (va con la 3b)

- Pasar los archivos del chat a la carpeta del pedido (`FotofficeArchivoTrabajo`) y el botón "Pasar al pedido…".
- Enlace para que el cliente suba muchos archivos o muy pesados (modo "el cliente puede subir" de la carpeta).
- Borrado automático de los archivos de la Bandeja (definir plazo con Daniel).
