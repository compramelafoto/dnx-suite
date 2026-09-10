# Reestructura de ventas de las landings DNX (XV y Bodas)

Fecha: 2026-09-10
Rutas afectadas: `/dnx/xv`, `/dnx/xv/sp`, `/dnx/bodas`, `/dnx/bodas/sp`

## Contexto

Las landings no reciben tráfico frío: Daniel manda el link desde el CRM de
Alboom a gente que ya consultó. Por lo tanto no son landings de captación,
son **presentaciones de venta**.

Eso convierte "con precio" vs "sin precio" en dos pasos de un mismo embudo,
no en un test A/B:

- `/sp` (sin precio): primer contacto. Construye valor.
- `/` (con precio): se manda después de la charla, con la fecha ya conversada.

## Diagnóstico de ventas (estado previo)

1. Botón "Ver precios" en el hero: atajo al número antes de construir valor.
2. Tabla comparativa con cruces rojas sobre la propia oferta.
3. Anclaje invertido: el primer precio visible es el más bajo.
4. Financiación tres secciones por debajo del precio.
5. Sin justificación del precio (no se dice qué incluye en concreto).
6. Testimonios después del precio.
7. Única acción posible: agendar entrevista (compromiso alto).
8. Mensaje intercambiable con cualquier fotógrafo de la zona.
9. Sin analítica: no hay forma de medir nada.

## Decisiones

### Arquitectura

Un componente de contenido por producto, con un interruptor `mostrarPrecios`.
No se duplican archivos.

- `components/dnx/xv/data.ts` — imágenes, planes, testimonios, FAQ
- `components/dnx/xv/XvLanding.tsx` — recibe `{ mostrarPrecios: boolean }`
- `components/dnx/bodas/data.ts`
- `components/dnx/bodas/BodasLanding.tsx`
- `components/dnx/PlanCards.tsx` — bloque de precios compartido
- `components/dnx/DnxTrack.tsx` — client component de analítica

Las cuatro rutas son envoltorios de tres líneas. `/sp` lleva
`robots: { index: false, follow: true }` para evitar contenido duplicado.

### Orden de secciones (ambos productos)

1. Hero — 2 CTAs, **sin** botón "Ver precios"
2. Portfolio (prueba visual inmediata)
3. Lo que está en juego (emocional, corto)
4. Dos testimonios fuertes (prueba social temprana)
5. **Qué te llevás exactamente** (nuevo)
6. **Por qué DNX y no otro** (nuevo)
7. Galerías por etapa (PRE XV / preparativos, ceremonia, fiesta)
8. Cómo trabajamos (proceso)
9. Productos impresos
10. Objeciones ("sabemos lo que les preocupa")
11. **Precios** — solo si `mostrarPrecios`
12. Resto de testimonios + reseñas de Google
13. FAQ
14. Cierre / CTA

En la versión `/sp` la sección 11 se reemplaza por un bloque que enumera
las tres propuestas sin importes e invita a pedir la propuesta.

### Bloque de precios

- Orden **Premium → Intermedio → Básico** (ancla alta primero).
- Sin cruces rojas. Cada plan lista solo lo que incluye.
- Lo que no incluye pasa a una línea gris "Podés sumar: ...".
- El número grande es **la cuota mensual**, calculada desde el total.
  El total y el precio de contado van debajo, más chicos.
- La financiación se muestra pegada al precio, no tres secciones abajo.

Parámetros por producto:

| | Cuotas | Descuento contado | Aplica a |
|---|---|---|---|
| XV | 6 | 20% | intermedio y premium |
| Bodas | 12 | 10% | los tres |

Las cuotas y el precio de contado se **calculan** desde el total, para que
no se desincronicen al actualizar precios.

Aclaración honesta bajo el bloque: los pagos se reparten hasta el día de la
fiesta, con un máximo de 6 (XV) o 12 (bodas), así que la cuota real depende
de cuánto falte para la fecha.

### Diferencial

Se construye solo con hechos verificables ya presentes en el sitio:

- Estudio físico en Funes donde ver los fotolibros e impresiones antes de decidir.
- Especialización (no se cubre cualquier evento).
- Entrevista sin costo y sin compromiso, presencial u online.
- Financiación sin recargo hasta el día de la fiesta.
- Familias que vuelven a contratar para la segunda hija (está textual en una
  reseña de Google y hoy vive enterrado al final de la página).

No se inventan cifras de entrega, cantidad de fotos ni plazos. Cuando Daniel
aporte esos datos duros, el bloque se refuerza.

### Medición

`@vercel/analytics` montado en `app/dnx/layout.tsx` (alcance limitado a `/dnx`).

Eventos:

- `dnx_precios_vistos` — la sección de precios entró en pantalla
- `dnx_cta_whatsapp`
- `dnx_cta_entrevista` — con propiedad `modo: presencial | online`

Cada evento lleva la propiedad `pagina` (`xv`, `xv-sp`, `bodas`, `bodas-sp`)
para poder comparar las dos versiones.

## Fuera de alcance

- Captura de emails y envío de propuestas en PDF (Daniel usa Alboom hoy;
  el CRM propio se hará en FOTOFFICE).
- Cambios de precio. Los importes se mantienen exactamente como están.
