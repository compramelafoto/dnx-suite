# Protección de cron jobs

## 1. Qué hace

Todos los endpoints bajo `app/api/cron/*` ahora están protegidos por un secreto (`CRON_SECRET`). Cada request debe enviar:

```
Authorization: Bearer <CRON_SECRET>
```

Si el secreto no está definido el endpoint responde `500` en producción y muestra una advertencia (sin bloquear) en desarrollo. Además, en desarrollo podés bypassar la validación con esta cabecera:

```
x-cron-dev-bypass: 1
```

## 2. Configuración local

1. Generá un secreto fuerte:

   ```bash
   openssl rand -hex 32
   ```

2. Guardalo en tu `.env.local`:

   ```
   CRON_SECRET=tucadena90abcdef...
   ```

3. Probá el endpoint local con curl:

   - ✅ Con autorización correcta:
     ```bash
     curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-email-queue
     ```
   - ❌ Sin autorización (debería devolver 401):
     ```bash
     curl http://localhost:3000/api/cron/process-email-queue
     ```
   - ✅ Bypass dev (`NEXT_PUBLIC_NODE_ENV=development`):
     ```bash
     curl -H "x-cron-dev-bypass: 1" http://localhost:3000/api/cron/process-email-queue
     ```

## 3. Despliegue en Vercel

1. Agregá la variable `CRON_SECRET` en **Settings > Environment Variables** (production y preview).
2. Configurá el job programado (`Scheduled Function`) que invoca el endpoint con el header:

   ```
   Authorization: Bearer <CRON_SECRET>
   ```

3. Podés reutilizar la misma cabecera para otros cron endpoints bajo `/api/cron/*`.

## 4. Endpoints protegidos

 - `/api/cron/hourly`
 - `/api/cron/send-album-notifications`
 - `/api/cron/process-email-queue`
- `/api/cron/cleanup-expired-albums`
 - `/api/cron/album-interest-emails`
- `/api/cron/process-zip-jobs` (GET/POST; Vercel Cron envía GET)
- `/api/cron/cleanup-disenador`
- `/api/cron/cleanup-orphan-r2`
- `/api/cron/cleanup-zip-jobs`

### `/api/cron/process-zip-jobs`
- Protegido con el mismo `CRON_SECRET`.
- En `vercel.json` está programado cada 5 minutos (`*/5 * * * *`). En cada invocación procesa hasta cinco `ZipGenerationJob` pendientes.
- Cada job genera el ZIP, lo sube a R2 y avisa por email al terminar usando el template `digital_download`.

### `/api/cron/cleanup-expired-albums`
- Oculta álbumes a los 30 días y elimina archivos a los 45 días.
- Elimina **portadas de eventos** (Event.coverImageKey) 45 días después del evento.
- Elimina **direct upload** (`albums/{id}/`) cuando se eliminan las fotos del álbum.
- **Además elimina archivos de impresión (PrintOrder)** luego de **15 días** desde la creación del pedido.
- Marca los pedidos limpiados con el tag `FILES_DELETED` para evitar repetir la limpieza.
- **No elimina:** logos, banner.

### `/api/cron/cleanup-disenador`
- Ejecución diaria (4:00 AM UTC).
- Elimina del diseñador de fotolibros contenido con más de 7 días:
  - Imágenes en R2 bajo `template-images/` que no pertenecen a plantillas (Template).
  - Diseño del fotolibro (`PhotobookDocument`, `DesignProject` en DRAFT).
- No elimina plantillas ni sus imágenes de referencia.

### `/api/cron/cleanup-orphan-r2`
- Ejecución diaria (5:00 AM UTC).
- Elimina objetos con **riesgo alto de quedar huérfanas** a los **15 días**:
  - `print-uploads/` (subidas no convertidas en pedido)
  - `contact/` (adjuntos de contacto, enviados por email)
- **No elimina:** logos, banner, template-images, albums, print-orders, preventa-mockups.

### `/api/cron/cleanup-zip-jobs`
- Ejecución diaria (5:00 AM UTC).
- Elimina **ZIPs de descarga** a los **30 días** de realizado el pedido (finishedAt).

