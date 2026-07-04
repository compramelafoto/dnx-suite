# Propuesta Home – Banner + Cómo funciona + UX

## Cómo ver el ejemplo

1. Ejecutá `npm run dev`
2. Abrí **http://localhost:3000/demo-home**
3. Revisá el banner, los 3 pasos y los botones. Si te cierra, damos el OK y lo pasamos al home real.

---

## Qué incluye el mockup

### 1. Banner 16:9 (extra wide)
- **Una sola franja** con relación 16:9.
- **3 fotos** de fotógrafos sacando fotos, en fila (sin carrusel).
- Fotos de ejemplo: Unsplash (fotógrafo/cámara/sesión). Cuando lo pasemos al home real se pueden reemplazar por fotos propias o las que quieras.

### 2. Sección «¿Cómo funciona ComprameLaFoto?»
- **3 pasos** numerados (1, 2, 3):
  1. **Creá o entrá a una galería** – Fotógrafos suben álbumes; clientes entran por el link.
  2. **Elegí y comprá** – Selección de fotos (digital/impresa), pago con Mercado Pago.
  3. **Recibí todo listo** – Descarga o impresiones, con seguimiento.

- **Botones debajo** (bien visibles):
  - **Ver galerías** (primario)
  - **Registrarme como fotógrafo**
  - **Registrarme como laboratorio**

### 3. Galerías más visibles
- Título claro: **«Galerías disponibles»**.
- **Botón «Ver todas las galerías»** al lado del título (o arriba a la derecha en desktop).
- En el home real, esta sección queda **más arriba** (después de “Cómo funciona”) para que nuevos visitantes vean primero que hay galerías y puedan entrar.

---

## Orden propuesto para el home real (UX)

1. **Banner 16:9** – 3 fotos (fotógrafos en acción).
2. **Hero corto** – Frase + 1–2 CTAs (ej. «Imprimir mis fotos», «Soy fotógrafo»).
3. **¿Cómo funciona?** – 3 pasos + los 3 botones (Ver galerías, Registro fotógrafo, Registro lab).
4. **Galerías** – Título + botón «Ver todas las galerías» + grilla de álbumes (como hoy pero más arriba).
5. **Imprimí tus fotos** – Bloque actual de impresión.
6. **¿Sos fotógrafo?** – Bloque actual para fotógrafos + recomendar lab.

Con este orden:
- Quien llega entiende rápido **qué es** y **cómo funciona**.
- **Ver galerías** y **registrarse** (fotógrafo/lab) están a la vista.
- Las galerías ganan visibilidad y ayudan a convertir visitantes en clientes.

---

## Próximo paso

Cuando des el OK al ejemplo en `/demo-home`, se aplica este orden y estos bloques en `app/page.tsx` y se puede eliminar o dejar la ruta `demo-home` según prefieras.
