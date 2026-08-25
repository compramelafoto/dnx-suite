# Informe Diario DNX — Diseño

**Fecha:** 2026-08-24
**Estado:** diseño aprobado, pendiente de plan de implementación
**Módulo responsable:** DNX Comunicaciones (`@repo/communications`)

---

## 1. Qué se construye

Un informe diario automático que se genera todos los días a las **00:00 hora de
Argentina**, reúne las estadísticas de las seis plataformas de la suite, detecta
incidentes técnicos, ordena las alertas por urgencia y lo envía por correo a
`dnxfotografia@gmail.com`.

El correo es **corto y accionable**: alertas ordenadas por gravedad, números
clave del día y variación contra el día anterior. El detalle completo vive en un
**panel web privado** dentro del admin, enlazado desde el correo.

### Plataformas cubiertas

| Plataforma | Fuente de datos |
|---|---|
| ComprameLaFoto (monorepo) | Base compartida (`DATABASE_URL`) |
| ComprameLaFoto (legacy) | Base legacy, solo lectura (`CLF_READONLY_DATABASE_URL`) |
| Clickatón | Base compartida |
| FotoRank | Base compartida |
| InfoSpot | Base compartida |
| FotOffice | Base compartida |

---

## 2. Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Formato de entrega | Correo resumido + panel web con detalle | Un correo con todo sería ilegible en el teléfono |
| Alcance de incidentes | Solo lo que ya deja rastro en la base | Sin dependencias externas ni claves nuevas; cubre casi todo lo accionable |
| Períodos | Día anterior + comparativa contra el día previo y el promedio de 7 días | Un número solo no permite decidir; la comparativa cuesta poco |
| Aplicación anfitriona | `apps/compramelafoto` | Única app con 17 crons operativos, `CRON_SECRET` activo y el admin más maduro |
| Motor de envío | `@repo/communications` con proveedor Resend | Ya está montado, con marcas, idioma y plantillas |

### Por qué ComprameLaFoto es la aplicación anfitriona

No es preferencia, es lo que ya está montado:

- Tiene `vercel.json` con 17 tareas programadas funcionando y `CRON_SECRET` activo.
- Tiene el área de administración más completa, con secciones análogas ya
  construidas (`/admin/salud-plataforma`, `/admin/antifraude`, `/admin/conversion`).
- Es la aplicación que genera el mayor volumen de datos.

La lógica de recolección vive en un paquete independiente, así que mover el
anfitrión a otra aplicación en el futuro es cambiar dos archivos, no rehacer el
trabajo.

---

## 3. Arquitectura

```text
Vercel Cron  03:00 UTC  (= 00:00 Argentina)
        ↓
GET /api/cron/daily-report        (apps/compramelafoto)
        ↓
buildDailyReport()                (@repo/ops-daily-report)
        ↓
   ┌────┴─────────────────────────────────────────┐
   │  recolectores independientes y tolerantes     │
   │  a fallos, ejecutados en paralelo             │
   └────┬─────────────────────────────────────────┘
        ↓
DailyReportSnapshot   (objeto único, tipado)
        ↓
   ┌────┴────┐
   ↓         ↓
guardar    renderizar plantilla  ops.daily-report
en base    (@repo/communications)
   ↓         ↓
panel      communications.send() → Resend → dnxfotografia@gmail.com
/admin/informe-diario
```

### El horario, con cuidado

Las tareas programadas de Vercel corren en **UTC**. Argentina es UTC−3. Para que
el informe salga a las 00:00 hora local, la expresión de cron es `0 3 * * *`.
Escribir `0 0 * * *` lo enviaría a las 21:00 del día anterior.

Consecuencia sobre el recorte de datos: el informe cubre el día calendario
argentino que acaba de terminar, calculado en zona `America/Argentina/Buenos_Aires`,
no en UTC. Todos los recolectores reciben la ventana ya resuelta; ninguno
calcula fechas por su cuenta.

### Estructura del paquete nuevo

```text
packages/ops-daily-report/
  src/
    contracts/
      snapshot.ts        Tipos del informe completo
      metric.ts          Métrica con valor, comparativa y formato
      alert.ts           Alerta con severidad, urgencia y acción sugerida
    window/
      day-window.ts      Resuelve el día argentino y las ventanas de comparación
    collectors/
      clf-monorepo.ts    ComprameLaFoto en la base compartida
      clf-legacy.ts      ComprameLaFoto legacy (solo lectura)
      clickaton.ts
      fotorank.ts
      infospot.ts
      fotoffice.ts
      incidents.ts       Incidentes técnicos transversales
      face-recognition.ts Salud del reconocimiento facial
    alerts/
      rank.ts            Ordena alertas por urgencia y gravedad
    report/
      build.ts           Orquesta todo, tolerante a fallos
    persistence/
      snapshot-repository.ts
```

**Regla de aislamiento:** cada recolector recibe un cliente de base de datos y
una ventana de tiempo, y devuelve una sección tipada. No sabe nada del correo,
del panel ni de los demás recolectores. Se puede probar solo.

### Tolerancia a fallos (requisito, no adorno)

Si un recolector falla, **el informe igual se genera y se envía**. La sección
afectada aparece marcada como no disponible, con el error, y se genera una
alerta técnica. Sin esto, un error en FotOffice te dejaría sin informe de nada.

Si falla el envío del correo, el informe queda igual guardado en la base y
visible en el panel; el reintento lo cubre la ejecución del día siguiente, que
avisa que el anterior no se pudo enviar.

---

## 4. Catálogo de estadísticas

### 4.1 ComprameLaFoto (monorepo y legacy, mismo catálogo)

**Ventas**
- Pedidos pagados: cantidad y monto bruto en ARS
- Ticket promedio
- Reparto por origen: checkout normal vs. canje de preventa
- Comisión de plataforma generada
- Pedidos pendientes de pago y pedidos abandonados

**Ranking de fotógrafos** (el pedido explícito)
- Top 5 fotógrafos por monto vendido en el día: nombre, cantidad de pedidos,
  monto, cantidad de fotos vendidas
- Top 5 álbumes por monto vendido
- Fotógrafos con ventas por primera vez

**Actividad**
- Fotos subidas, álbumes creados, eventos nuevos
- Usuarios nuevos registrados (compradores y fotógrafos)
- Descargas entregadas y packs canjeados

**Advertencias de datos que hay que respetar**
- `Order.totalCents` contiene **pesos enteros**, no centavos. El nombre quedó
  por compatibilidad histórica. Tratarlo como centavos dividiría todos los
  montos por cien.
- `Order.isTest = true` marca pedidos de simulación escolar. Se excluyen de
  todas las métricas comerciales.

### 4.2 Clickatón

- Inscripciones nuevas por edición, con estado (confirmadas, pendientes de pago,
  expiradas, canceladas)
- **Ranking de ediciones por accesos vendidos** (el pedido explícito): qué
  edición vendió más y cuánto facturó, con variación contra el día anterior
- Ingresos por tipo de entrada y por fase de precio
- Tienda: pedidos, monto, productos más vendidos, faltantes de stock
- Fotos enviadas por participantes y resultado de la admisión técnica
  (aprobadas, rechazadas y por qué)
- Acreditaciones y check-ins realizados
- Votación social: votos emitidos y marcas de fraude detectadas
- Se excluyen las inscripciones con `isOpsTest = true`

### 4.3 FotoRank

- Concursos activos y su etapa
- Inscripciones nuevas y obras recibidas, por concurso y categoría
- Avance del jurado: votos emitidos, jurados activos, evaluaciones pendientes
- Obras con conflicto declarado o excluidas
- Diplomas emitidos y resultados publicados
- Ingresos por inscripciones pagas

### 4.4 InfoSpot

- Artículos publicados y en revisión
- Vistas del día y notas más leídas
- Coberturas nuevas y fotos editoriales utilizadas
- Suscriptores nuevos
- Eventos importados desde ComprameLaFoto

### 4.5 FotOffice

- Espacios de trabajo nuevos y activos
- Módulos habilitados por espacio
- Socios y categorías de socios
- Cursos publicados, inscripciones y ventas
- Consultas de servicios y de cursos recibidas
- Sitios web publicados y versiones nuevas

### 4.6 Incidentes técnicos (transversal)

Reutiliza `apps/compramelafoto/lib/admin/platform-health.ts`, que ya calcula
esto, y lo amplía a las demás plataformas:

- Cola de correos trabada o con fallos
- Pagos de MercadoPago sin conciliar y anomalías detectadas
- Webhooks fallidos o sin verificar
- Trabajos de procesamiento de fotos, ZIP o video trabados o con error
- Publicaciones a redes sociales rechazadas
- Alertas de fraude abiertas
- Ingesta por FTP/cámara caída o degradada
- Fotos sin archivo asociado o huérfanas

### 4.7 Reconocimiento facial

Sección propia, porque lo pediste explícitamente:

- Selfies procesadas en el día y coincidencias encontradas
- Tasa de coincidencia (cuántas búsquedas devolvieron resultado)
- Rostros detectados pendientes de procesar y acumulación de cola
- Trabajos de análisis fallidos, con el motivo
- Tiempo promedio de procesamiento
- Comparativa contra el promedio de la semana, para notar degradación

---

## 5. Motor de alertas ordenadas

Cada alerta lleva dos ejes separados, porque no son lo mismo:

- **Gravedad:** crítica, alta, media, baja. Cuánto duele si no se atiende.
- **Urgencia:** inmediata, hoy, esta semana, informativa. Cuánto se puede esperar.

El orden en el correo surge de combinar ambos, con la urgencia pesando más: una
alerta crítica que puede esperar a la semana que viene va después de una alta
que hay que atender ahora.

Cada alerta incluye: qué pasó, desde cuándo, cuántos casos afecta, qué
plataforma, y un enlace directo a la pantalla del admin donde se resuelve.

**Ejemplos de reglas iniciales**

| Situación | Gravedad | Urgencia |
|---|---|---|
| Cola de correos trabada más de 2 horas | crítica | inmediata |
| Pagos aprobados sin conciliar hace más de 24 h | crítica | inmediata |
| Reconocimiento facial con 0 coincidencias en todo el día habiendo selfies | alta | inmediata |
| Ingesta por cámara/FTP caída | alta | inmediata |
| Alertas de fraude abiertas | alta | hoy |
| Trabajos de ZIP trabados más de 1 hora | media | hoy |
| Fotos huérfanas acumulándose | baja | esta semana |
| Caída de ventas mayor al 50 % contra el promedio de 7 días | media | hoy |

Los umbrales quedan en un archivo de configuración, no dispersos en el código,
para poder ajustarlos sin tocar la lógica.

---

## 6. Persistencia

Dos tablas nuevas en el esquema compartido:

**`DnxDailyReportSnapshot`** — un registro por día
- `reportDate` (fecha argentina, única)
- `payload` (JSON con el informe completo)
- `status` (completo, parcial, fallido)
- `generationMs`, `collectorErrors`
- `createdAt`

**`DnxDailyReportDelivery`** — un registro por intento de envío
- `snapshotId`, `channel`, `recipient`
- `status` (enviado, fallido, omitido)
- `providerMessageId`, `error`
- `sentAt`

Guardar el informe completo como JSON permite que el panel muestre el histórico
sin recalcular nada, y que la comparativa del día siguiente lea el valor de ayer
en lugar de volver a consultar toda la base.

---

## 7. Panel web

Ruta `/admin/informe-diario` en ComprameLaFoto, protegida por el mismo control
de acceso que el resto del admin.

- **Listado:** un renglón por día, con estado del informe, cantidad de alertas
  críticas y totales de ventas.
- **Detalle:** el informe completo del día, dividido por plataforma, con las
  alertas arriba y cada métrica mostrando su comparativa.
- **Acción manual:** botón para generar el informe del día en curso sin esperar
  a la medianoche, útil para verificar y para el desarrollo.

---

## 8. Plantilla de correo

Se agrega `ops.daily-report` a `@repo/communications`, siguiendo el patrón de
las plantillas existentes (`system.test`, `user.welcome`): definición con
`validate`, `renderSubject`, `renderHtml` y `renderText`, componentes de
`templates/components` y marca `dnx`.

**Asunto:** `Informe DNX — 23/08/2026 — 3 alertas críticas`

**Cuerpo, en este orden:**
1. Alertas que requieren atención, ordenadas
2. Números clave del día, con variación
3. Un bloque compacto por plataforma
4. Botón al panel web
5. Pie con estado de generación (secciones que fallaron, si las hubo)

Versión en texto plano incluida, como todas las plantillas del paquete.

---

## 9. Configuración necesaria

| Variable | Dónde | Estado |
|---|---|---|
| `CRON_SECRET` | ComprameLaFoto | Ya existe |
| `RESEND_API_KEY` | ComprameLaFoto | Ya existe |
| `RESEND_FROM_EMAIL` | ComprameLaFoto | Nueva: `info@compramelafoto.com` |
| `RESEND_FROM_NAME` | ComprameLaFoto | Nueva: `DNX Suite` |
| `RESEND_ALLOWED_RECIPIENTS` | ComprameLaFoto | Nueva: `dnxfotografia@gmail.com` |
| `COMMUNICATIONS_LIVE_SEND` | ComprameLaFoto | Nueva: `true` |
| `COMMUNICATIONS_ENVIRONMENT` | ComprameLaFoto | Nueva: `production` |
| `DAILY_REPORT_RECIPIENTS` | ComprameLaFoto | Nueva, con `dnxfotografia@gmail.com` por defecto |
| `DAILY_REPORT_ENABLED` | ComprameLaFoto | Nueva, para poder apagar el envío sin desplegar |
| `CLF_READONLY_DATABASE_URL` | ComprameLaFoto | **Falta dar de alta en Vercel** (solo para la Etapa 3) |

### El candado de envío de DNX Comunicaciones

El módulo no envía nada real salvo que se cumplan **tres** condiciones a la vez:
`COMMUNICATIONS_LIVE_SEND=true`, el destinatario dentro de
`RESEND_ALLOWED_RECIPIENTS`, y una confirmación explícita desde el código que
lo invoca. Es una protección deliberada para que un entorno de prueba no mande
correos reales.

Si alguna falta, el informe **igual se genera y se guarda**, pero la entrega
queda registrada como omitida con el motivo. No es un fallo silencioso.

La única acción manual fuera del código es cargar estas variables en Vercel.
`CLF_READONLY_DATABASE_URL` recién hace falta en la Etapa 3, cuando se sume el
legacy.

---

## 10. Pruebas

- **Recolectores:** cada uno con datos de prueba en base, verificando que
  excluye pedidos de prueba, que respeta la ventana horaria argentina y que
  devuelve la sección vacía en lugar de romperse cuando no hay datos.
- **Ventana de tiempo:** casos de borde alrededor de la medianoche argentina y
  del cambio de mes.
- **Motor de alertas:** que el orden resultante sea el esperado con alertas
  mezcladas.
- **Tolerancia a fallos:** un recolector que lanza error no impide el informe.
- **Plantilla:** que rinda sin datos, con datos completos y con secciones
  faltantes, en HTML y en texto.
- **Cron:** rechaza pedidos sin el secreto correcto; no genera dos veces el
  mismo día.

---

## 11. Etapas de entrega

Una sola arquitectura, conectada por partes, para que recibas algo real pronto.

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Paquete, contratos, ventana horaria, tablas, cron, plantilla, envío + ComprameLaFoto monorepo + incidentes + reconocimiento facial | **Hecha** (2026-08-24) |
| 2 | Panel web `/admin/informe-diario` + Clickatón | **Hecha** (2026-08-25) |
| 3 | ComprameLaFoto legacy + FotoRank | Pendiente |
| 4 | InfoSpot + FotOffice + ajuste fino de umbrales | Pendiente |

### Lo verificado en la Etapa 2

- **Ranking de ediciones de Clickatón** probado contra la base real con datos
  sembrados y revertidos: 4 accesos contados, la inscripción de modo test
  excluida, $23.000 bien convertidos desde centavos, y el orden correcto por
  cantidad de accesos.
- **Unidad de importes**: Clickatón guarda centavos reales; ComprameLaFoto
  guarda pesos enteros pese al nombre `totalCents`. La diferencia está fijada
  por test para que nadie las mezcle.
- **Panel**: ciclo completo de guardar, releer y listar verificado; regenerar el
  mismo día no duplica la fila. El build de producción genera ambas rutas.
- **Hallazgo colateral**: el build de ComprameLaFoto estaba roto antes de este
  trabajo, porque `lib/template-v2/presets/types.ts` no incluía `"fotorank"`,
  valor que el paquete `@repo/template-engine` sí tiene. Se corrigió en un
  commit aparte porque bloqueaba cualquier despliegue.

---

## 12. Fuera de alcance (por ahora)

- Monitoreo de servicios externos (Vercel, Cloudflare, MercadoPago como estado
  de servicio). Decidido para una segunda etapa.
- Herramienta de captura de errores tipo Sentry.
- Envío por WhatsApp o Telegram.
- Informes semanales o mensuales.
- Acumulados históricos totales (consultas pesadas que requieren precálculo).
