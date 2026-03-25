# Recomendar un laboratorio

## Resumen de la funcionalidad

1. **Dónde aparece el botón**
   - **Home (www.compramelafoto.com):** En el hero (junto a "Imprimir mis fotos" y "Soy fotógrafo") y en la sección "¿Sos Fotógrafo?" (junto a "Empezar como fotógrafo").
   - **Panel del fotógrafo:** En el dashboard, junto a "Ir a Negocio", "Álbums" y "Soporte técnico".

2. **Formulario (modal)**
   - Ancho: `min-width: 380px`, `max-width: 32rem` (512px) para que no quede angosto.
   - Campos: Nombre del fotógrafo *, Nombre del laboratorio *, Email del laboratorio *, WhatsApp del laboratorio (opcional).
   - Al enviar: se guarda en la tabla `LabRecommendation`, se encola un email al laboratorio y se marca `emailSentAt`. El email se envía cuando corre el cron de cola de emails.

3. **Panel Admin**
   - Menú: **Laboratorios recomendados** → `/admin/recomendados`.
   - Tabla con: ID, Fotógrafo, Laboratorio, Email, WhatsApp, Fecha, Email enviado (fecha en que se encoló el envío).

4. **Flujo técnico**
   - `POST /api/recommend-lab` (público): valida datos, crea `LabRecommendation`, arma el email, llama a `queueEmail()` y actualiza `emailSentAt`.
   - El cron `process-email-queue` envía el email con el contenido fijo (saludo + instructivo).
   - `GET /api/admin/recommended-labs`: solo admin, devuelve la lista para la tabla.

---

## Comandos para actualizar la base de datos

Con `DIRECT_URL` y `DATABASE_URL` configurados en tu `.env`:

```bash
npx prisma migrate deploy
```

O en desarrollo:

```bash
npx prisma migrate dev
```

Esto aplica la migración `20260202200000_add_lab_recommendations` que crea la tabla `LabRecommendation`.

---

## Texto del email que recibe el laboratorio

**Asunto:**  
`Un fotógrafo te recomendó ComprameLaFoto`

**Cuerpo (versión texto):**

```
Hola [Nombre del laboratorio],

Desde ComprameLaFoto te saludamos. [Nombre del fotógrafo] te recomendó para usar nuestra plataforma.

ComprameLaFoto conecta fotógrafos con laboratorios y clientes: los fotógrafos suben álbumes, los clientes eligen fotos para imprimir o descargar, y los laboratorios reciben pedidos de impresión. Vas a tener disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.

Para darte de alta como laboratorio:
1. Entrá a https://www.compramelafoto.com
2. Registrate y elegí la opción de Laboratorio.
3. Completá el formulario con los datos de tu laboratorio.
4. Una vez aprobada tu cuenta, tendrás disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.

Si querés más información enviános un WhatsApp al 3413748324 (link con texto incluido).

Saludos,
Equipo de ComprameLaFoto
www.compramelafoto.com
```

La versión HTML incluye el mismo contenido con formato (negritas, lista numerada, enlace al sitio y enlace a WhatsApp con texto predefinido) y la firma con logo de ComprameLaFoto al final (como el resto de correos).

**Probar el correo:** En Admin → Emails → pestaña «Probar templates», elegir «Recomendación a laboratorio» y enviar a un email de prueba con datos JSON: `{"photographerName":"Juan Pérez","labName":"Lab Foto"}`
