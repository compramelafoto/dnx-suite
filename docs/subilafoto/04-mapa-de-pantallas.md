# Mapa de pantallas y recorridos

Responde a los capítulos 9, 11, 16, 17 y 28 del documento maestro.

## Inventario de pantallas del MVP

Son **24 pantallas**. Todo lo que no está acá se pospone.

### Público (sin cuenta)

| # | Ruta | Pantalla | Prioridad |
|---|---|---|---|
| 1 | `/` | Landing del producto | Media |
| 2 | `/v/[slug]` | Página de venta del profesional | **Crítica** |
| 3 | `/v/[slug]/comprar` | Datos del comprador y pago | **Crítica** |
| 4 | `/compra/[id]/gracias` | Confirmación de compra | **Crítica** |

### Invitado (móvil, sin cuenta)

| # | Ruta | Pantalla | Prioridad |
|---|---|---|---|
| 5 | `/e/[codigo]` | Portada del evento y aceptación de términos | **Crítica** |
| 6 | `/e/[codigo]/subir` | Cámara o galería, carga múltiple | **Crítica** |
| 7 | `/e/[codigo]/subir/estado` | Progreso, reintentos, confirmación | **Crítica** |
| 8 | `/e/[codigo]/album` | Galería de aprobadas | Alta |
| 9 | `/e/[codigo]/mis-fotos` | Lo que subió uno mismo, con opción de borrar | Alta |
| 10 | `/e/[codigo]/cerrado` | Evento terminado | Media |

### Pantalla del salón

| # | Ruta | Pantalla | Prioridad |
|---|---|---|---|
| 11 | `/pantalla/[codigo]` | Proyección 16:9 a pantalla completa | **Crítica** |
| 12 | `/pantalla/[codigo]/emparejar` | Código de emparejamiento | Alta |
| 13 | `/control/[eventoId]` | Control remoto desde el celular | **Crítica** |

### Panel del profesional

| # | Ruta | Pantalla | Prioridad |
|---|---|---|---|
| 14 | `/panel` | Inicio: próximos eventos y ventas | Alta |
| 15 | `/panel/venta` | Editor del perfil y enlace permanente | **Crítica** |
| 16 | `/panel/venta/mercadopago` | Conectar Mercado Pago | **Crítica** |
| 17 | `/panel/eventos` | Lista de eventos | Alta |
| 18 | `/panel/eventos/[id]` | Configuración: datos, plantilla, portada, ventana | **Crítica** |
| 19 | `/panel/eventos/[id]/demo` | Modo DEMO | Alta |
| 20 | `/panel/eventos/[id]/moderacion` | Revisión de retenidas y bloqueadas | **Crítica** |
| 21 | `/panel/eventos/[id]/contenido` | Todo el contenido, con filtros | Alta |
| 22 | `/panel/eventos/[id]/proveedores` | Invitar y ver fichas | Media |
| 23 | `/panel/eventos/[id]/qr` | QR y materiales imprimibles | Alta |

### Cliente y proveedor

| # | Ruta | Pantalla | Prioridad |
|---|---|---|---|
| 24 | `/cliente/[token]` | Panel del cliente: álbum, descarga, comprar adicional | **Crítica** |
| 25 | `/proveedor/[token]` | Formulario de la ficha | Media |

## Los tres recorridos que no pueden fallar

### A. Venta → evento (capítulo 6.3)

```
/v/[slug]  →  /v/[slug]/comprar  →  Mercado Pago  →  webhook
                                                        ↓
                            crea SubilafotoEvent en CONFIGURING
                                                        ↓
                        email al fotógrafo + email al cliente
```

El punto frágil es el webhook. Debe ser **idempotente**: Mercado Pago reintenta, y dos
llegadas del mismo aviso no pueden crear dos eventos ni cobrar dos veces. La defensa es el
`@unique` en `mpPaymentId` más un registro de entrada previo al procesamiento. Es
exactamente el patrón que ya usa `finalize-album-order-mp-approved.ts` en CompraMeLaFoto.

### B. QR → carga → moderación → pantalla (capítulos 9, 10 y 11)

```
QR  →  /e/[codigo]  →  acepta términos  →  /e/[codigo]/subir
                                                  ↓
                             sube a R2 (privado) — status: UPLOADING
                                                  ↓
                                          status: PROCESSING
                                                  ↓
                       Rekognition DetectModerationLabels (async, con reintentos)
                                                  ↓
                    ┌──────────────┬──────────────┬──────────────┐
                 APPROVED    REVIEW_REQUIRED    BLOCKED      error → REVIEW_REQUIRED
                    ↓
              evento SSE "foto.aprobada"
                    ↓
            /pantalla/[codigo] y /e/[codigo]/album
```

Sólo la rama `APPROVED` llega a la pantalla. **Ninguna otra**, y el error técnico se trata
igual que la duda: se retiene. El capítulo 10.2 lo llama fallar de manera cerrada.

### C. Cierre → paquete → recuperación comercial (capítulos 12.1 y 6.6)

```
deactivationAt  →  se cierran las cargas
                        ↓
        espera a que terminen las moderaciones ya iniciadas
                        ↓
         ┌──────────────────────────┬──────────────────────────┐
   compró la descarga          no la compró
         ↓                              ↓
  genera el ZIP                emails días 1, 3, 7, 15 y 30
         ↓                              ↓
 email día 1 con enlace         paga tarde → genera el ZIP
                                        ↓
                          día 30 + gracia → elimina el contenido
```

La carrera peligrosa está al final: alguien paga a las 23:58 del día 30 y el borrado corre
a las 00:00. La defensa es un candado — el borrado no toca un evento con un pago iniciado
en las últimas horas — más la ventana de gracia que el propio documento pide definir.

## Materiales impresos del evento

La pantalla 23 no es "un botón que baja un PNG del QR". Es lo que el fotógrafo lleva
impreso al salón, y es la primera cosa que ve un invitado del producto.

**Cada pieza lleva el logo de quien vende el evento** — fotógrafo, DJ, salón, productora o
quien sea. El capítulo 18 no lo decía; es un requisito agregado el 2026-09-11. La marca que
el invitado ve en la mesa es la de quien contrató, no la de Subí la Foto.

Piezas del lanzamiento:

| Pieza | Formato | Para qué |
|---|---|---|
| Centro de mesa | PDF A5 y cuadrado 15×15, con sangrado | Se imprime y se para en cada mesa |
| Cartel de entrada | PDF A4 y A3 | Recibe a la gente |
| Placa de pantalla | PNG 1920×1080 | Se proyecta entre fotos |
| Historia para redes | PNG 1080×1920 | El anfitrión lo manda por WhatsApp antes |
| QR suelto | PNG y SVG | Para que el fotógrafo arme su propia pieza |

Cada pieza combina: el QR del evento, el logo del vendedor, el nombre del evento, la
instrucción en una línea y el código escrito como alternativa para quien no logra escanear.

**Se genera con `@repo/design-studio`**, que ya produce PDF con sangrado listo para imprenta
y resuelve las imágenes por bytes — es el mismo motor que emite el carnet de socio de
Fotoffice (`apps/fotoffice/lib/carnet/render.ts`). No hay que escribir un generador de PDF.

Tres reglas que evitan el papelón en el salón:

1. **Prueba de lectura antes de descargar.** El sistema decodifica su propio QR y verifica
   que apunte a la URL correcta. Un QR ilegible impreso en cuarenta centros de mesa no tiene
   arreglo el día del evento.
2. **Contraste obligatorio.** El QR va oscuro sobre claro, nunca amarillo sobre violeta por
   más lindo que quede: los lectores necesitan contraste real.
3. **El código escrito siempre.** Debajo del QR va el código en texto, para el invitado cuya
   cámara no lo toma.

El logo del vendedor sale de su perfil de venta (`SubilafotoSellerProfile.logoUrl`). Si no
cargó ninguno, la pieza sale sin logo y limpia — nunca con un espacio vacío ni con un
"tu logo acá".

## Criterios visuales

- **Móvil primero de verdad.** La pantalla 6 (subir) se diseña para un pulgar en un salón
  oscuro con una mano ocupada sosteniendo una copa. Botón grande, un solo paso, sin menús.
- **La pantalla 11 no tiene interfaz.** Ni barras, ni logos de la plataforma, ni cursor.
  Sólo la foto y, cuando el operador lo decide, el QR. La marca Subí la Foto no se
  proyecta en el casamiento de nadie salvo que el fotógrafo lo elija.
- **Cada plantilla cambia las pantallas 5, 8 y 11**, que son las que ve el invitado. El
  panel del profesional no se tematiza: es una herramienta de trabajo.
