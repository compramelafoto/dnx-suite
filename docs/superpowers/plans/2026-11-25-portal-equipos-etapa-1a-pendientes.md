# Portal de equipos — Etapa 1a: pendientes y decisiones

Fecha: 26/11/2026. Etapa 1a construida, revisada tarea por tarea y en una revisión final de toda la rama.
Falta la Task 13 del plan (paso a producción), que requiere el OK de Daniel.

## Orden obligatorio para publicar (Task 13)

1. Aplicar `packages/db/prisma/migrations/20270308090000_portal_equipos_etapa_1a/migration.sql` en la base de
   producción de CLF (`br-autumn-rain-ad18wq7y`) **antes de fusionar a `main`**: fusionar despliega CLF, y sin la
   migración se rompen el cambio de correo, el panel `/admin/equipos-robados`, el cruce de robados y las denuncias de
   CLF. Por la deriva de esa base, aplicar con `prisma db execute` + `prisma migrate resolve --applied`, igual que en la
   rama de prueba.
2. Crear un bucket R2 **privado, sin dominio público**, para el portal y cargar `EQUIPOS_R2_BUCKET` en Vercel de
   `equipos` **y de CLF** (CLF lo usa para abrir los comprobantes subidos desde el portal).
3. Proyecto de Vercel nuevo sólo para `apps/equipos`, variables de `apps/equipos/.env.example`, crons de `vercel.json`.

## Antes de abrir el portal al público

- Elegir el proveedor de identidad real (cotizar Didit, MetaMap, Veriff, Truora) e implementarlo sobre
  `lib/identidad/proveedor.ts`. Sin proveedor real, `/api/identidad/iniciar` falla en producción a propósito.
- Número de WhatsApp propio del portal y su webhook (`WHATSAPP_*`).
- Páginas `/terminos` y `/privacidad`: hoy dan 404 y el registro exige aceptarlas. Texto legal del consentimiento
  biométrico e inscripción de la base ante la AAIP.
- Token de verificación de correo consumido al abrir el enlace (GET): los antivirus de correo pueden gastarlo.
- Nombre y dominio definitivos; diseño visual (las pantallas de la 1a no tienen estilos).
- Límites de intentos en registro, recuperación de clave y reenvío de correo.

## Pendientes menores (no bloquean)

- Identidad: guardar el resultado del webhook con `updateMany` condicionado al estado (carrera mínima que podría
  borrar un rechazo del admin); nonce/fecha en la firma para el proveedor real; tope de reintentos; captura de
  P2002 → 409 en la aprobación manual; extraer la búsqueda del dueño del DNI duplicada en webhook y panel admin.
- Teléfono: límite de intentos; aviso «ya verificado» al reenviar el mismo número.
- Inventario y denuncias: archivos huérfanos en R2 si falla la transacción; carrera del límite de 6 fotos y de la
  doble denuncia; eventos «actualizado» sin cambios; cruce diario con una consulta por denuncia; si el fotógrafo
  retira la denuncia desde CLF, el equipo sigue «robado» en el portal; CLF muestra las pérdidas como «robada el…».
- Informe: el recordatorio busca el día exacto (si el cron no corre ese día, no hay aviso); fecha del correo en formato
  corto «10/1/27»; la página pública muestra `createdAt` en vez de `issuedAt`.
- Sello en CLF: la consulta corre también en modo embebido.

## Decisiones tomadas durante la construcción

Las reglas R1 a R13 están en la descripción del pedido de cambios (PR) y en la conversación del 25-26/11/2026.
