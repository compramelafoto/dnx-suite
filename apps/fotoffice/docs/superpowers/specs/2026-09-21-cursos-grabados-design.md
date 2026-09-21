# Cursos grabados

Ampliación del módulo `courses-sales` de FotoOffice. Diseño acordado el 2026-09-21.

Un fotógrafo graba su curso una vez y lo vende muchas veces. El alumno paga, entra a su aula
dentro de FotoOffice, mira las clases a su ritmo, pregunta lo que no entendió y, si llega al
final, se lleva su certificado.

---

## 1. Qué se construye y por qué

Hoy el módulo vende **cursos presenciales**: un curso, sus ediciones con fecha y lugar, una
inscripción y un cobro. El "online" que existe es un campo de texto donde el organizador pega
un link de Google Classroom, que se le muestra al alumno cuando el pago se aprueba. No hay
video, no hay avance y no hay aula. La portada de fotoffice.com anuncia cursos online y la
pantalla de Ventas del panel lo desmiente: *"Cursos online / grabados — Próximamente"*.

Esto cierra esa brecha. Un curso pasa a tener **modalidad**: presencial, en vivo o grabado. El
presencial sigue funcionando exactamente igual. El grabado no tiene ediciones ni cupo: tiene
**clases**, y cada clase tiene su video.

La decisión de fondo, tomada el 2026-09-21: **el aula de un curso grabado vive dentro de
FotoOffice, no en Google Classroom.** Classroom queda para los cursos en vivo, donde hay
cohorte, fechas y tareas con entrega. En un grabado cada uno va a su ritmo, la consulta es
sobre el minuto 14 de la clase 3, y el video no está en Classroom — con lo cual Google no
podría medir el avance, y nosotros tampoco. Además obligaría al alumno a tener cuenta de
Google para ver un curso que ya pagó.

---

## 2. Lo que ya existe y se reutiliza

| Necesidad | Qué se usa |
|---|---|
| Encender/apagar el módulo por workspace | `MODULE_REGISTRY` + `WorkspaceFeatureModule` |
| Guard de servidor del módulo | `requireCoursesSalesContext()` en `lib/workspace.ts` |
| Curso, inscripción y cobro | `Course`, `CourseEnrollment` y el flujo de Mercado Pago que ya existe |
| Comisión de la plataforma | `WorkspaceModuleFee` + `splitByPlatformFee` (`lib/platform-fee/`) |
| Enlace por correo con token | `lib/members/invitation-tokens.ts`: 32 bytes, SHA-256 en base, crudo una sola vez |
| Verificación pública por token | El patrón de `c/[token]` del carnet de socio |
| Correo con la firma institucional | `lib/communications/send-email` + `loadWorkspaceSignature` |
| Archivos (materiales de clase) | R2, el mismo bucket y las mismas credenciales que ya usa FotoOffice |
| Render de un diseño a imagen/PDF | `editorADocumento`, que ya corre dentro de Vercel sin navegador |

Lo único verdaderamente nuevo es **Cloudflare Stream**, y entra por una razón concreta que la
sección 4 explica.

---

## 3. Decisiones tomadas

| Decisión | Qué se eligió | Por qué |
|---|---|---|
| Protección del video | Video troceado con permiso por alumno y marca de agua con sus datos | El DRM arranca en ~USD 100 por mes fijos antes de vender un curso. Con 0 alumnos es plata tirada, y la marca de agua identifica al que filtra, que es el caso real |
| Dónde vive el aula | Dentro de FotoOffice | El avance y las consultas son el activo del negocio; en Classroom quedarían afuera y sin medir |
| Fin del curso | Porcentaje de clases vistas, configurable, default 80% | Automático y sin pantallas nuevas: el avance ya se registra para el reproductor |
| Duración del acceso | 12 meses desde la compra, configurable por curso | Vitalicio suena generoso hasta que el video de 2026 sigue costando almacenamiento en 2031 |
| Tareas y calificaciones | No se construyen | Un curso grabado no las lleva. Si un día hacen falta, Evaluaciones ya existe y se conecta |

**Dependencia dura:** esto va después de arreglar el cobro del módulo. Hoy en producción no se
puede pagar un curso — el código lee `MP_ACCESS_TOKEN` y en Vercel la variable se llama
`FOTOFFICE_MP_ACCESS_TOKEN`, y falta `MP_WEBHOOK_SECRET`, sin el cual el webhook responde 401.
Sin cobro no hay acceso que otorgar.

---

## 4. Entrega y protección del video

### Por qué no alcanza con R2

R2 guarda **archivos** y los entrega enteros. Un link firmado que vence impide compartir el
link, pero no impide bajar el archivo y reenviarlo — que es exactamente lo que hay que evitar
en un curso pago. Para servir un video de a pedacitos, con varias calidades según la conexión
y sin un archivo descargable, hay que trocearlo, empaquetarlo y mantener un reproductor. Eso
es trabajo de semanas que Cloudflare Stream trae hecho, en la misma cuenta y la misma factura
que R2, por USD 5 cada 1.000 minutos guardados y USD 1 cada 1.000 minutos vistos.

### Las cuatro capas

1. **Firma obligatoria.** Cada video se crea con `requireSignedURLs: true` y
   `allowedOrigins: ["fotoffice.com"]`. Un link suelto no reproduce en ningún lado.
2. **Permiso por alumno.** El servidor firma un token de 2 horas para *un* video, y sólo si esa
   persona tiene un acceso vigente y pagado a ese curso. El token no sirve para otra clase ni
   para otra persona.
3. **Marca de agua sobre la imagen**, con el nombre, el documento y el número de inscripción del
   alumno, cambiando de posición cada 25 segundos. **Es disuasión, no blindaje**: alguien con
   conocimientos la quita desde el navegador. Contra el caso real —filmar la pantalla y pasar el
   archivo— funciona, porque la copia lleva escrito quién la filtró. Queda escrito acá para que
   nadie la venda como seguridad.
4. **Registro de reproducciones.** Quién miró qué y cuándo. Sirve para el avance y para detectar
   la cuenta compartida: el mismo acceso reproduciendo desde tres lugares a la vez. Se **registra
   y se avisa**, no se bloquea — un bloqueo automático castigaría al que mira en el celular y en
   la computadora.

### La subida

El panel pide a nuestra API una URL de subida de un solo uso y **el navegador sube directo a
Cloudflare**. El archivo no pasa por Vercel en ningún momento: las funciones rechazan cualquier
pedido de más de 4,5 MB con `413 FUNCTION_PAYLOAD_TOO_LARGE`, y un video de una clase pesa
cientos de megas. Es el mismo camino que FotoRank usa para las fotos grandes, ya probado en
producción con originales de hasta 14,46 MB.

**Trampa conocida:** el preflight CORS del lado del proveedor. En FotoRank eso tuvo la subida
directa frenada once días. Va en la lista de verificación del despliegue, no en la de "después
vemos".

### El avance

El reproductor informa cada 15 segundos cuántos segundos lleva vistos. El servidor **nunca
acumula un salto mayor al intervalo**: arrastrar la barra hasta el final no marca la clase como
vista. Una clase se da por completada al 90% de su duración.

---

## 5. Modelo de datos

Todo nuevo, salvo dos retoques sobre lo que existe.

**Retoques:**

- `Course.deliveryMode` — enum nuevo `CourseDeliveryMode { PRESENCIAL, LIVE, RECORDED }`, default
  `PRESENCIAL`. Los cursos que ya existen no cambian de comportamiento.
- `Course.accessMonths` — entero, default 12. Sólo se lee en cursos grabados.
- `Course.completionPercent` — entero, default 80. Ídem.
- `CourseEnrollment.courseInstanceId` pasa a **opcional**. Un curso grabado no tiene ediciones.
  La regla "presencial exige edición, grabado no la admite" se valida en la aplicación, con test.
  Es seguro: en las cinco bases hay 0 inscripciones.

**Tablas nuevas:**

| Tabla | Qué guarda |
|---|---|
| `CourseLesson` | La clase: título, descripción, orden, duración, id del video en Stream, estado del procesamiento, y si es clase de muestra gratuita |
| `CourseLessonAttachment` | Material de la clase: nombre, clave en R2, tamaño. Descargable a propósito |
| `CourseAccess` | Quién compró qué: workspace, curso, inscripción (única), desde cuándo, hasta cuándo, y el hash del token del enlace de acceso |
| `CourseLessonProgress` | Por acceso y clase: segundos vistos, última posición y cuándo se completó |
| `CourseLessonQuestion` | La consulta del alumno sobre una clase, y su respuesta |
| `CourseCertificate` | Emitido por acceso: cuándo, su token público de verificación y el archivo generado |

Todas cuelgan de `workspaceId` o de algo que lo tiene, con borrado en cascada, como el resto del
esquema.

**Aplicación de la migración:** a mano en las cinco bases Neon, registrándola en
`_prisma_migrations` con el checksum de una base sana. El repositorio comparte un solo
`schema.prisma` entre cinco bases y el despliegue no corre `prisma migrate deploy`.

---

## 6. El panel del fotógrafo

En el curso, al elegir modalidad **Grabado**, la sección "Ediciones" se reemplaza por "Clases":

- Agregar clase: título, descripción, y arrastrar el video. Barra de progreso, después
  *"Procesando…"* y después *"Lista"*.
- Reordenar, editar, borrar. Marcar una clase como **muestra gratuita** — se ve sin pagar, y es
  la mejor herramienta de venta que tiene un curso grabado.
- Adjuntar materiales a la clase.
- El precio vive en el curso, no en la edición.

El fotógrafo nunca ve el nombre del proveedor de video, ni tiene cuenta en ningún lado. La
cuenta es de DNX, una sola para toda la suite, igual que R2 hoy.

---

## 7. El aula del alumno

Ruta pública con token, sin cuenta de Google y sin contraseña nueva: el enlace llega por correo
cuando el pago se aprueba, con el mismo mecanismo que la invitación del socio.

- **Mis cursos** → el curso → la lista de clases con lo visto marcado y la barra de avance.
- La clase: el video, su descripción, sus materiales y sus consultas.
- El video **retoma donde quedó**. Sale casi gratis, porque la última posición ya se guarda.

---

## 8. Consultas

Un hilo por clase: el alumno pregunta, el docente responde, y a cada uno le llega un correo.
No hay foro general, ni menciones, ni adjuntos, ni moderación. La bandeja del docente muestra
las consultas sin responder de todos sus cursos, ordenadas por antigüedad.

---

## 9. Certificado

Se emite solo al alcanzar el porcentaje configurado. Lleva el nombre del alumno, el curso, la
fecha y un token de verificación pública, igual que el carnet de socio: cualquiera puede entrar
a la dirección del QR y comprobar que ese certificado existe y a quién pertenece. El archivo se
arma con `editorADocumento`, que ya genera documentos dentro de Vercel sin navegador.

---

## 10. Lo que no se construye

Tareas, notas, rúbricas, cuestionarios, foro general, subtítulos automáticos, DRM, descarga del
video, aplicación móvil, y cualquier conexión con Google Classroom para cursos grabados.

Cada una tiene su motivo en la sección 3 o en la 1. Si alguna hace falta después, entra como
etapa nueva, no como agregado silencioso.

---

## 11. Configuración

Variables nuevas en Vercel, todas del lado del servidor:

| Variable | Para qué |
|---|---|
| `STREAM_ACCOUNT_ID` | Cuenta de Cloudflare. Es el mismo valor que `R2_ACCOUNT_ID` |
| `STREAM_API_TOKEN` | Crear videos y pedir URLs de subida |
| `STREAM_SIGNING_KEY_ID` y `STREAM_SIGNING_KEY_PEM` | Firmar el permiso de reproducción de cada alumno |

Sin ellas, el panel muestra "la carga de video no está configurada" y no rompe nada más: el
curso presencial sigue andando. Se sigue el criterio de `lib/payments/connect/config.ts`, que
informa qué falta en vez de lanzar una excepción.

---

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| CORS del proveedor sin habilitar | Verificación explícita en el despliegue, con preflight OPTIONS, antes de anunciar |
| La migración no llega a las cinco bases | Se aplica a mano y se registra el checksum; queda como criterio del tablero |
| El costo de video se dispara | El costo es por minuto guardado y visto, sin fijos. Se mide con el primer curso real |
| Alguien vende la marca de agua como seguridad | Está escrito en la sección 4 y en el panel: "disuade, no impide" |
| Se construye sobre un cobro roto | La etapa 0 es arreglar el cobro. Sin eso no hay acceso que otorgar |

---

## 13. Etapas

| # | Qué entrega | Cómo se comprueba |
|---|---|---|
| 0 | El cobro del módulo funciona | Una inscripción pagada de verdad en producción, con su comisión correcta |
| 1 | Modalidad, clases y carga de video | Un curso grabado con tres clases cargadas y en estado "Lista" |
| 2 | Acceso, reproductor protegido y avance | Un alumno paga, entra por su enlace, mira una clase y el avance queda registrado. El link del video, pegado en otra pestaña, no reproduce |
| 3 | Consultas por clase | Una consulta enviada, respondida, y los dos correos en el registro de envíos |
| 4 | Certificado por porcentaje visto | Un certificado emitido al llegar al 80% y verificable por su QR |
