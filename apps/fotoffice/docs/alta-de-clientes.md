# Alta de clientes nuevos en FOTOFFICE

Guía para dar de alta un cliente (escuela, productora, estudio, institución) de punta a punta.
La idea: **el cliente completa un formulario y Claude configura el resto con las respuestas.**
Cada alta nueva tiene que salir más rápido que la anterior; lo que se aprenda va acá.

Primer caso: F64 Productora (Andrea Defagot), noviembre de 2026. Ver `docs/proyecto-f64.md`.

Cuestionarios disponibles:

- `productora-docente-v1`: escuela o productora con cursos (F64, desde cero).
- `club-suscripcion-v1`: club por suscripción con clases en vivo, grabadas y un envío mensual (SOYBELUZ). Pensado para un espacio ya armado: confirma lo cargado y pregunta lo que falta (materiales de cada BOX, envíos, cobros, clases, textos).

## 1. Juntar lo público antes de preguntar

Antes de mandar el formulario, buscar en la web (Instagram, Facebook, sitio, notas de prensa) y
cargar lo que ya se sabe. El formulario pregunta sólo lo que no se puede averiguar, y confirma lo
dudoso. Distinguir confirmado de dudoso (homónimos, direcciones viejas, precios de otro año).

## 2. Crear el espacio con lo mínimo

Por SQL en la base de producción de FOTOFFICE (rama Neon `development`), con ids legibles
(`ws_<slug>`, `br_<slug>`, …) e `INSERT … ON CONFLICT DO NOTHING` para que sea repetible:

- `Workspace`, `FotofficeWorkspaceBranding` (slug público, colores, logo, contacto),
  `Membership` + `WorkspaceMembership` (user 4 = dnxfotografia@gmail.com, dueño).
- `WorkspaceFeatureModule` con lo que se va a usar seguro (`website`, `courses-sales`, `clients`,
  `communications`, `reports`, `sales`, `cash`). El resto se enciende según el formulario.
- `FotofficeWorkspaceWebsite` en **borrador** (sin `publishedAt`): no se publica hasta tener precios.
- Cursos grabados: `Course` (`deliveryMode = RECORDED`, `status = DRAFT`, `priceArs = NULL`),
  `CourseLesson` por clase, `CourseLessonAttachment` por PDF.

El generador de F64 (`scripts/alta/f64-generar-sql.py`; la lista de PDF con sus carpetas al azar no se sube al repositorio: se lee de `CourseLessonAttachment`) es el molde: datos arriba, SQL abajo.

### Archivos
- Logos, portadas y fotos del sitio: R2 `fotoffice-media`, carpeta `fotoffice/sitio/<slug>/`, con
  `npx wrangler r2 object put fotoffice-media/<clave> --file <archivo> --remote --content-type <tipo>`.
- **PDF pagos:** `fotoffice/courses/<courseId>/material/<carpeta al azar>/<archivo>.pdf`. El bucket
  es público: la carpeta al azar evita que se adivine la dirección. El alumno los baja desde la
  clase por `/api/portal/cursos/material/<id>`, que controla el acceso.
- Videos: desde el panel del curso, «Traer video» con el enlace de Drive de cada archivo (Stream lo
  baja solo). **Un curso sin precio se trata como gratuito y sólo acepta YouTube**: para traer
  videos de Drive a un curso en borrador, ponerle un precio provisorio y sacarlo al terminar.
- **Cupo de Stream:** la cuenta tiene minutos contratados. Medir antes cuánto suman los videos
  (`ffprobe`); si no entran, Stream rechaza con «10011 Storage capacity exceeded». Ampliar el plan
  es una compra: lo decide Daniel.

## 3. Mandar el formulario de alta

Las preguntas viven en código: `lib/alta-cliente/cuestionarios/`. Para un cliente del mismo tipo
se reusa el cuestionario y se cambia la lista de cursos ya cargados; para otro rubro se suma un
archivo nuevo y se registra en `cuestionarios/index.ts`. No hace falta migración.

Crear el enlace (token al azar, largo):

```sql
INSERT INTO "FotofficeAltaCliente" ("id","token","cuestionario","destinatario","workspaceId","updatedAt")
VALUES ('alta_<slug>', '<token>', 'productora-docente-v1', '<Nombre Apellido>', 'ws_<slug>', now());
```

El enlace es `https://fotoffice.com/alta/<token>`. Se guarda solo mientras la persona escribe, se
puede completar en varias veces, y al enviar llega un correo con el resumen a dnxfotografia@gmail.com.

## 4. Leer las respuestas y configurar

```sql
SELECT "estado", "enviadoAt", "respuestas" FROM "FotofficeAltaCliente" WHERE "token" = '<token>';
```

`respuestasEnTexto()` (`lib/alta-cliente/tipos.ts`) las pasa a texto, sección por sección, igual
que el correo. Con eso, qué se configura:

| Respuesta | Qué hacer en FOTOFFICE |
|---|---|
| Datos, correo de acceso | Crear o buscar el `User` y sumarlo como `WORKSPACE_ADMIN` |
| Bio, lema, redes, horarios | Textos del sitio y `FotofficeWorkspaceBranding` |
| Dominio | `FotofficeWorkspaceDomain` + DNS en Vercel |
| Mercado Pago | Mandarle el enlace para conectar su cuenta (OAuth). Sin eso no se cobra |
| Facturación ARCA | Módulo `invoicing` y certificado |
| Precio y acceso de cada curso | `Course.priceArs`, `accessMonths` (0 = sin vencimiento), clase de muestra `isPreview`, y `PUBLISHED` |
| Alumnos previos | «Invitar alumnos sin cargo» en el panel del curso |
| Reventa | `offeredToResellers` y `suggestedResellerBps` |
| Presenciales | `Course` `PRESENCIAL` + `CourseInstance` por fecha |
| Clases en vivo | Módulo de transmisión en vivo |
| Agenda de sesiones | Turnos de servicio (tipos de cita, franjas, seña) |
| Comunidad paga | Módulos `members` + `membership-dues`, `MemberCategory` con `selfRenew`, precio en `MembershipFeeValue`, cursos «gratis para socios» |
| Eventos | Módulo `eventos` |
| Tienda | Módulo `store` |
| Equipo | Roles y Comisión |

Al terminar: publicar el sitio, probar una compra real y avisarle al cliente.
