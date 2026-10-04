# Los cursos viven en el portal

Ampliación de "Cursos grabados" de FOTOFFICE. Diseño acordado con Daniel el 2026-10-04. Reemplaza
la forma de entrar al aula de la etapa 2
(`docs/superpowers/plans/2026-10-03-cursos-grabados-etapa-2-aula.md`), que todavía no salió a
producción. El resto de esa etapa (video protegido, marca de agua, avance, clase de muestra,
compra del grabado) se conserva.

---

## 1. Qué se decide y por qué

**Un solo camino.** Quien compra un curso lo ve dentro del portal de FOTOFFICE, con su usuario y
contraseña (o Google), sea socio o no. No hay enlace suelto al aula.

La etapa 2 había resuelto la entrada con un enlace personal por correo, sin cuenta, porque el
portal era sólo para socios. Daniel no quiere dos caminos distintos: el socio y el alumno entran
por el mismo lugar, y el alumno que no es socio queda a un paso de asociarse.

| Decisión | Qué se eligió | Por qué |
|---|---|---|
| Cuándo se crea la cuenta del comprador nuevo | **Después de pagar** | Comprar sigue pidiendo sólo nombre, correo, DNI y WhatsApp. Nadie abandona la compra por tener que registrarse, y no hace falta construir un autorregistro |
| Cómo se reconoce a quien ya tiene cuenta | **Por el correo** | Simple y seguro. El formulario avisa "usá el mismo correo con el que entrás al portal". Reconocer por DNI permitiría mandarle una compra a otra persona escribiendo un DNI ajeno |
| Cómo se invita a asociarse | **Tarjeta en el portal + línea en el correo** | Lleva al formulario de Asociarse que ya existe. Sin precios distintos para socios |
| Cursos gratis para socios | **El curso se vende al público y el socio activo lo toma gratis** | Es el argumento para asociarse |
| Si el socio deja de estar activo | **Pierde los cursos que tomó gratis mientras no esté activo** | Protege el beneficio. Si se pone al día, vuelven con su avance. Lo pagado no se toca nunca |
| Plazo del curso gratis | **Sin vencimiento por plazo: dura mientras sea socio activo** | El beneficio está atado a la condición de socio, no a una fecha |

---

## 2. Lo que ya existe y se reutiliza

| Necesidad | Qué se usa |
|---|---|
| La cuenta | `User` (`email` único, `password` opcional, `googleId`), con `role: "CUSTOMER"` como ya hace la activación de socios (`app/actions/member-activation.ts`) |
| Elegir contraseña | `PasswordResetToken` y la pantalla `/recuperar/[token]` |
| Sesión | `requireAuth()` de `lib/auth.ts`, cookie `dnx_session` |
| Quién es socio | `Member` con `userId` y `status` (`ACTIVE`, `SUSPENDED`, `INACTIVE`) |
| Tipo de persona al entrar | `resolveFotofficeUserKind` (`lib/portal/user-kind.ts`) y `resolveFotofficePostLoginDestination` (`lib/post-login.ts`) |
| Marco del portal | `app/portal/layout.tsx`, `loadPortalContext` (`lib/portal/access.ts`), `resolvePortalMenu` (`lib/portal/menu.ts`) |
| Hacerse socio | `/w/<institución>/asociarse`, que sólo se publica si la institución puede cobrar (`getWorkspaceCollectionStatus`) |
| Aula, video, avance | `lib/course-classroom/*`, `lib/courses-video/stream.ts`, `components/course-classroom/lesson-player.tsx` (etapa 2) |

---

## 3. Modelo de datos

La migración `20261004120000_cursos_aula_alumno` **todavía no se aplicó en ninguna base**: se
corrige en el lugar, no se agrega otra.

**`CourseAccess`** (acceso de una persona a un curso):

- Sale `tokenHash`. Entra `userId Int` → `User`, con borrado en cascada.
- Entra `origin CourseAccessOrigin` (`PURCHASE`, `MEMBER_BENEFIT`).
- `expiresAt` pasa a opcional: `null` en los de beneficio de socio.
- `enrollmentId` sigue único. Se agrega `@@unique([userId, courseId])`: una persona tiene un solo
  acceso por curso, y su avance no se parte en dos.

**`Course.freeForMembers Boolean @default(false)`**: "Gratis para socios".

**`CourseEnrollmentPaymentMethod`** suma `MEMBER_BENEFIT`. La inscripción del beneficio queda en
$0, aprobada, con comisión 0, para que aparezca en los números y se sepa quién lo tomó.

`CourseLessonProgress` no cambia: cuelga del acceso.

---

## 4. Cuándo vale un acceso

Una regla pura, con test:

- **`PURCHASE`**: vale si no está revocado y no venció (`expiresAt`).
- **`MEMBER_BENEFIT`**: vale si no está revocado y la persona es **socia `ACTIVE` de la
  institución del curso** en este momento. Sin socio activo no se ve; al volver a estar activo,
  vuelve con su avance.

Todo lo que muestra un curso o firma un permiso de video pasa por esta regla.

---

## 5. Después del pago

Al aprobarse el pago de un curso grabado (`approveCourseEnrollment`, camino sin edición, antes
del CRM como ya quedó en la etapa 2):

1. Se busca la cuenta por el correo de la inscripción (normalizado). Si no existe, se crea con
   `role: "CUSTOMER"` y sin contraseña.
2. Se crea el acceso `PURCHASE` con su vencimiento (`Course.accessMonths`). Es idempotente, como
   en la etapa 2. Si la persona ya tenía acceso a ese curso (por ejemplo, de beneficio), se
   convierte en `PURCHASE`: pagó, y lo pagado no depende de ser socio.
3. Se manda **un solo correo**:
   - con cuenta que ya tiene forma de entrar (contraseña o Google): "Tu curso ya está en tu
     portal", con botón a `/portal/cursos`;
   - con cuenta nueva o sin contraseña: "Bienvenido", con botón **Crear mi contraseña** (enlace de
     `PasswordResetToken` a `/recuperar/<token>`) y la alternativa de entrar con Google;
   - en los dos, si no es socio de esa institución y Asociarse está publicado, una línea "Hacete
     socio de <institución>".

Si alguien compra con un correo ajeno, el correo para crear la contraseña le llega al dueño de
ese correo: nadie se queda con la cuenta de otro.

Si algo falla después de aprobar, la persona puede igual entrar a su cuenta con "Olvidé mi
contraseña". El acceso faltante se repara solo la próxima vez que entra al portal: Mis cursos
otorga los accesos de sus inscripciones aprobadas que no lo tengan (mismo criterio que el
reenvío de la etapa 2, que desaparece).

---

## 6. El portal acepta al alumno

El portal reconoce dos tipos de persona:

- **Socio**: tiene `Member` `ACTIVE`. Ve el portal de siempre y, si tiene algún curso, el ítem
  **Mis cursos** en el menú.
- **Alumno**: no es socio activo, pero tiene al menos un acceso que vale, o una inscripción
  aprobada a un curso grabado. Ve sólo **Mis cursos** y **Hacete socio**.

Cambios:

- `app/portal/layout.tsx` deja pasar a los dos tipos. Las pantallas de socios (cuotas, carnet,
  coberturas, reservas, recomendados, portfolio, sorteos, perfil) siguen exigiendo socio: un
  alumno que llega a una de ellas va a `/portal/cursos`.
- `resolveFotofficeUserKind` suma el tipo alumno, y `resolveFotofficePostLoginDestination` lo
  manda a `/portal/cursos` en vez de `/bienvenida`.
- El selector de perfil (`/elegir-perfil`) suma "Mis cursos" para quien es del equipo de una
  institución y además tiene cursos.
- **Requisito no negociable: un socio entra y ve exactamente lo mismo que hoy.** Va con tests.

Una persona con cursos de varias instituciones los ve todos en Mis cursos, agrupados por
institución.

---

## 7. El aula dentro del portal

- `/portal/cursos`: los cursos de la persona con su avance y "Seguir mirando". Después, si es
  socia activa, el bloque **"Gratis para vos"**. Si no lo es, la tarjeta **"Hacete socio"**.
- `/portal/cursos/<curso>/clase/<clase>`: el video, la marca de agua y la descripción, igual que
  en la etapa 2.
- El avance se guarda en `POST /api/portal/cursos/avance`, autenticado por la sesión. Las reglas
  de `aplicarReporte` no cambian.
- La marca de agua sigue llevando nombre, DNI y número de la inscripción.
- Desaparecen `/aula/[token]`, `/aula/recuperar`, `/api/aula/[token]/avance`, `reenviarEnlaces`,
  `lookup.ts` por token y el correo de reenvío.
- **Riesgo heredado de la etapa 2:** el video sólo reproduce desde `fotoffice.com`, y el portal
  vive ahí. En un dominio propio (`sfpr.com.ar`), `/portal` ya redirige a FOTOFFICE.

---

## 8. Cursos gratis para socios

- **Panel:** en la ficha del curso grabado, el interruptor **"Gratis para socios"**.
- **Página pública de venta:** un aviso "Gratis para socios de <institución>: entrá a tu portal y
  anotate sin pagar", que lleva a `/login?next=/portal/cursos`.
- **Portal del socio activo**, bloque "Gratis para vos": los cursos `freeForMembers`,
  `PUBLISHED`, grabados, de su institución, que todavía no tiene. Botón **Anotarme**: crea la
  inscripción de beneficio y el acceso `MEMBER_BENEFIT`, sin pasar por Mercado Pago. La acción
  vuelve a comprobar en el servidor que sea socio activo y que el curso sea gratis para socios.
- **Si deja de ser socio activo**, esos cursos dejan de verse (sección 4).

---

## 9. "Hacete socio"

- En Mis cursos de un alumno, una tarjeta por cada institución de sus cursos en la que no es
  socio, **sólo si esa institución tiene Asociarse publicado**.
- Texto: "Hacete socio de <institución>". Si esa institución tiene cursos gratis para socios:
  "y estos cursos te salen gratis", con la lista.
- Botón al formulario `/w/<institución>/asociarse`.
- Cuando la solicitud se aprueba y acepta la invitación con la misma cuenta, pasa a socio y
  conserva cursos y avance: la cuenta es la misma.

---

## 10. Lo que no se construye

Precio rebajado para socios, cursos exclusivos para socios, vincular una compra hecha con otro
correo, pantalla de inscriptos y avance en el panel, consultas (etapa 3) y certificado (etapa 4).

---

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Cambiar la entrada del portal deja afuera a un socio | Tests de la guarda con los tres tipos de persona; la rama de socio no cambia de criterio |
| Un alumno ve una pantalla de socio | Cada pantalla de socio conserva su propia comprobación (`loadPortalContext` sigue siendo sólo de socios) |
| Alguien toma gratis un curso sin ser socio | La acción Anotarme comprueba en el servidor; el acceso de beneficio se revalida en cada visita |
| Socio con dos cuentas por usar otro correo | Aviso en el formulario de compra; vincular queda para después |
| Dos correos en vez de uno a la persona nueva | El correo de bienvenida lleva el enlace de crear contraseña; no se llama a `requestPasswordReset` (que manda su propio correo) |

---

## 12. Etapas

| # | Qué entrega | Cómo se comprueba |
|---|---|---|
| 1 | Datos corregidos y regla de acceso | Tests de la regla con los dos orígenes y los tres estados de socio |
| 2 | Cuenta y correo después del pago | Tests: cuenta existente, cuenta nueva, sin contraseña, compra de un curso ya tomado de beneficio |
| 3 | Portal con alumno | Tests de la guarda y del destino al iniciar sesión; un socio ve lo mismo que hoy |
| 4 | Aula en el portal | Mis cursos y la clase funcionan con sesión; las rutas por token ya no existen |
| 5 | Gratis para socios | Un socio activo se anota; uno suspendido deja de ver el curso y lo recupera al reactivarse |
| 6 | Hacete socio | La tarjeta aparece sólo para no socios y sólo si Asociarse está publicado |
| 7 | Despliegue | Compra real de un no socio: le llega el correo, crea la contraseña, ve el curso y la tarjeta |
