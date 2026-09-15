# Manual de operación

*Para el titular y para soporte. Escrito el 2026-09-15.*

Esto se lee **la noche del evento, apurado**. Por eso está ordenado por síntoma y no por
componente: buscá lo que te están diciendo por teléfono, no lo que creés que está roto.

---

## Lo primero, siempre

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/diagnostico
```

Responde en cuatro partes: `base`, `moderacion`, `almacenamiento` y `configuracion`. Si las
tres primeras dicen `ok: true`, el problema **no es de infraestructura** y hay que seguir
leyendo por síntoma.

Sin la llave devuelve 401. Es a propósito: escribe en R2 en cada visita y publica el host
de la base.

---

## "Subí una foto y no aparece en la pantalla"

Es lo más frecuente y casi nunca está roto.

**El camino de una foto:** el invitado la sube → queda en `PROCESSING` → la IA decide →
si aprueba, se le pone `publishedAt` → recién ahí la pantalla la muestra.

Entre subir y ver pasa hasta **un minuto**. Es normal y la pantalla del invitado lo dice.

### Si pasaron más de cinco minutos

```sql
SELECT status, count(*) FROM "SubilafotoMedia"
WHERE "eventId" = '<id>' GROUP BY status;
```

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| Muchas en `PROCESSING` | El cron de moderación no está corriendo | Disparalo a mano (abajo) |
| Muchas en `REVIEW_REQUIRED` con `errorCode` | Amazon está rechazando | Mirar `moderacion` en el diagnóstico |
| Muchas en `REVIEW_REQUIRED` sin error | La IA las está reteniendo | Es correcto: revisalas en el panel |
| En `APPROVED` pero no se ven | Puede faltarles la variante | Ver abajo |

**Disparar la moderación a mano:**

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/moderacion/procesar
```

Devuelve cuántas revisó, cuántas decidió y cuántas variantes generó.

### Si están aprobadas y aun así no se ven

Les falta la variante reducida. **Por diseño no se muestra el original**: antes que el
archivo bueno, no se muestra nada.

```sql
SELECT m.id FROM "SubilafotoMedia" m
LEFT JOIN "SubilafotoMediaVariant" v ON v."mediaId" = m.id
WHERE m."eventId" = '<id>' AND m.status = 'APPROVED' AND v.id IS NULL;
```

El mismo cron de moderación las levanta solo, de a cinco por vuelta. Corrélo dos o tres
veces y volvé a mirar.

---

## "La pantalla del salón se quedó clavada"

La pantalla se alimenta de una conexión que dura un rato y se vuelve a abrir sola. Si se
clavó:

1. **Recargá la página del televisor.** Resuelve el 90%.
2. Si al recargar aparecen las fotos viejas pero no las nuevas, el problema es la
   moderación, no la pantalla: andá a la sección de arriba.
3. Si la pantalla está en blanco, fijate que el evento esté `ACTIVE` y no `CLOSED`.

**No hay que reiniciar nada del lado nuestro.** No hay proceso que reiniciar.

---

## "El evento se cerró antes de tiempo" / "no se cierra"

El cierre es automático: **12 horas desde la activación**, ni más ni menos. Lo hace un cron
cada cinco minutos.

```sql
SELECT code, status, "activationAt", "deactivationAt", "closedAt", "retentionUntil"
FROM "SubilafotoEvent" WHERE code = '<CODIGO>';
```

- `deactivationAt` en el futuro y `status = 'ACTIVE'` → está bien, todavía no cerró.
- `deactivationAt` pasado y sigue `ACTIVE` → el cron no corrió. Disparalo:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/eventos/cerrar`

**Cerrar no interrumpe nada en curso.** Una foto que entró un minuto antes se modera y se
publica igual. Está hecho a propósito.

---

## "El cliente pagó y no le llegó nada"

### Primero: ¿entró la plata?

```sql
SELECT id, kind, status, "amountCents", "paidAt", "mpPaymentId", "eventId"
FROM "SubilafotoOrder" WHERE "buyerEmail" = '<mail>' ORDER BY "createdAt" DESC;
```

| Estado | Qué significa |
|---|---|
| `PENDING` | Mercado Pago todavía no avisó. Un pago en efectivo tarda hasta 3 días hábiles |
| `PAID` con `eventId` | Todo bien, el evento existe |
| `PAID` sin `eventId` | **La plata entró y el evento no se creó.** Hay que crearlo a mano |

Ese último caso está previsto: la orden queda pagada igual, porque perder el pago sería
mucho peor que crear el evento tarde. Queda registrado en los logs con
`[subilafoto][aviso] no se pudo crear el evento`.

### Si compró la descarga y no le llegó el paquete

```sql
SELECT status, "partIndex", "partCount", "itemCount", error, "completedAt"
FROM "SubilafotoPackage" WHERE "eventId" = '<id>';
```

- Sin filas → el evento no figura como comprado. Mirá `downloadStatus` del evento.
- `QUEUED` o `BUILDING` → se está armando. Un casamiento tarda minutos.
- `FAILED` con `error` → ahí está el motivo.
- `READY` → el paquete existe. El problema es el correo, no el paquete.

**Armar un paquete a mano:**
`curl -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/paquetes/armar`

---

## "No le llegó ningún correo"

**Lo más probable: los correos están saliendo en seco.** Hasta que estén configuradas las
variables de Resend, todo queda anotado y no sale nada.

```sql
SELECT aviso, status, error, "createdAt" FROM "SubilafotoEmailSent"
WHERE "eventId" = '<id>' ORDER BY "createdAt";
```

| `status` | Qué pasó |
|---|---|
| `DRY_RUN` | El envío está apagado. No es una falla: falta configuración |
| `SENT` | Salió |
| `FAILED` | Salió mal, el motivo está en `error` |
| Sin filas | Todavía no le tocaba ningún aviso |

Los avisos son cinco: al día siguiente del cierre y a los 3, 7, 15 y 30 días. **Uno por
vuelta**, y los atrasados más de un día se saltean a propósito.

---

## "Se borró el material antes de tiempo"

No debería poder pasar: son **30 días desde el cierre**, la fecha se fija al cerrar y no se
recalcula nunca.

```sql
SELECT code, "closedAt", "retentionUntil", "purgedAt" FROM "SubilafotoEvent" WHERE code = '<CODIGO>';
```

Si `purgedAt` tiene fecha, se borró. **No se puede deshacer.** Queda el registro de por qué
en la auditoría:

```sql
SELECT action, metadata, "createdAt" FROM "SubilafotoAudit"
WHERE "eventId" = '<id>' AND action = 'retencion.borrado';
```

### Al revés: "un evento viejo sigue ocupando lugar"

El candado lo está frenando. Los motivos, del más grave al menos: una disputa abierta, una
entrega que nunca salió, un pago en curso de menos de 72 horas, o un paquete armándose.

**`entrega-pendiente` frena para siempre y está bien**: alguien pagó la descarga y nunca la
recibió. Se resuelve entregándosela, no borrando.

---

## Las cinco tareas automáticas

| Cuándo | Qué hace | Ruta |
|---|---|---|
| Cada 5 min | Modera lo pendiente y genera variantes rezagadas | `/api/moderacion/procesar` |
| Cada 5 min | Cierra los eventos vencidos | `/api/eventos/cerrar` |
| Cada 15 min | Arma un paquete | `/api/paquetes/armar` |
| Cada hora | Manda los avisos | `/api/correos/avisos` |
| 4:30 diario | Borra lo que venció | `/api/eventos/purgar` |

Todas piden `Authorization: Bearer $CRON_SECRET`. Todas se pueden disparar a mano y
**ninguna hace daño si se corre de más**: la protección está en la base, no en el horario.

---

## Qué NO hay que hacer

- **No borrar filas de `SubilafotoMedia` a mano** para "limpiar". El archivo queda en R2 y
  el paquete de descarga no lo va a incluir, pero se sigue pagando.
- **No cambiar `retentionUntil` para dar más tiempo** sin avisarle al cliente: los correos
  ya le prometieron una fecha.
- **No crear una segunda aplicación en Mercado Pago.** Es una sola para toda la suite; otra
  necesitaría su propia homologación.
- **No reencolar una foto ya decidida** poniéndola en `PROCESSING`: se le vuelve a cobrar
  el análisis a Amazon. Si lo que falta es la variante, el cron ya la levanta.
