# Firma de email — Firma institucional del workspace

**Fecha:** 2026-08-21
**Estado:** Diseño aprobado, pendiente de implementación
**Etapa:** 1 de N

## Qué es y qué no es

Esto es una **firma de email**: el bloque de cierre que acompaña a los correos que envía
la plataforma. Nada de esto es una firma criptográfica ni una firma electrónica con validez
legal — no hay claves, ni sellado de tiempo, ni prueba de integridad de documentos.

Esta etapa implementa específicamente la **firma institucional del workspace**: la
identidad de la organización (nombre, logo, contacto, redes, nota institucional).

**No es una solución completa de firmas personales.** Que un email salga firmado por
"Juan Pérez, Tesorero" con su foto es una etapa posterior, descrita en
[Etapa siguiente](#etapa-siguiente-firmante-personal).

## Requisito futuro que este diseño debe sostener

Confirmado, y la API de esta etapa no puede impedirlo:

- Un workspace puede tener varios OWNER/ADMIN.
- El workspace elige un **responsable o firmante predeterminado**.
- Distintos módulos podrán usar **distintos firmantes** (ej. Cuotas firma el Tesorero,
  Actas firma el Secretario).
- El email debe poder llevar **nombre, cargo, fotografía** y datos del responsable.
- El `Reply-To` puede corresponder al responsable.
- **Nunca se selecciona automáticamente al primer OWNER**: la elección es explícita.

Por eso `EmailSignatureData` (abajo) ya contempla los campos personales como opcionales,
aunque en esta etapa el mapper solo complete los institucionales.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Qué se firma | Firma de email (pie institucional), no firma digital |
| Alcance | Por workspace |
| Origen de los datos | Se leen en vivo de `FotofficeWorkspaceBranding` |
| Datos formales extra | Un campo de texto libre |
| Arquitectura | Renderer compartido en `@repo/communications`, datos mapeados desde FotoOffice |

**Por qué leer del branding y no duplicar**: `FotofficeWorkspaceBranding` ya guarda
`commercialName`, `logoUrl`, `contactEmail`, `phone`, `whatsapp`, `instagram`, `website`,
`city`, `province` y la paleta. Una fuente de verdad: cambiar el teléfono una vez lo
actualiza en el sitio público y en los emails. Es el mismo criterio que ya tomó el Website
Builder, documentado en el schema: *"Colores/logo NO están acá — siguen viviendo en
FotofficeWorkspaceBranding y se leen en vivo"*.

## 1. Modelo de datos

Un solo campo nuevo en `FotofficeWorkspaceBranding`:

```prisma
/// Texto libre institucional para el pie de los emails (razón social, CUIT, personería,
/// aviso legal). Texto plano: nunca HTML. null = no se muestra nada.
emailSignatureNote String?
```

Migración **aditiva**, una columna nullable. No se agregan columnas personales ni se
selecciona ningún owner en esta etapa.

### Validación server-side de `emailSignatureNote`

- `trim` antes de guardar.
- Máximo **1.500 caracteres**.
- **Texto plano únicamente**: no se acepta HTML. Si el administrador pega etiquetas, se
  guardan como texto y se escapan al renderizar — nunca se interpretan.
- Vacío o solo espacios se guarda como `null`, nunca `""`.
- Se **respetan los saltos de línea** del administrador.
- Una nota vacía no genera separadores, espacios ni líneas colgadas en la firma.

## 2. Paquete `@repo/communications`

Módulo nuevo `src/signature/`, agnóstico de aplicación — mismo criterio que
`CommunicationBrand`, que ya está desacoplado de las apps:

```
src/signature/
  types.ts   → EmailSignatureData
  render.ts  → renderEmailSignature(data) → { html, text }
  index.ts
```

Export: `@repo/communications/signature`.

### `EmailSignatureData`

Objeto plano. Sin Prisma, sin tipos de FotoOffice. **Todos los campos opcionales salvo
`organizationName`**, para que la etapa siguiente no rompa la API:

```ts
export type EmailSignatureData = {
  organizationName: string;
  organizationLogoUrl?: string;
  /** Etapa siguiente: firmante personal. Hoy el mapper no lo completa. */
  signerName?: string;
  signerRole?: string;
  signerPhotoUrl?: string;
  phone?: string;
  email?: string;
  /**
   * Cabecera del email, NO contenido del cuerpo. El renderer nunca lo dibuja:
   * lo lee quien envía para setear el header Reply-To.
   */
  replyToEmail?: string;
  website?: string;
  instagram?: string;
  city?: string;
  /** Cierre ("Saludos", "Gracias por elegirnos"). Vacío si el template ya cierra. */
  closingText?: string;
  institutionalNote?: string;
  accentColor?: string;
};
```

**`replyToEmail` es una cabecera, no contenido.** El renderer produce cuerpo; no puede
setear headers. Vive en el tipo para que la etapa siguiente lo tenga a mano, pero
`renderEmailSignature` lo ignora deliberadamente.

### `renderEmailSignature(data) → { html, text }`

Función **pura**: mismos datos, misma salida. Sin I/O, sin fecha, sin azar.

#### HTML apto para email

Los clientes de correo no son navegadores. Outlook usa el motor de Word para renderizar.
Restricciones **obligatorias**:

- Tablas para el layout.
- Estilos **inline** únicamente.
- Sin flexbox, sin grid, sin CSS externo, sin `<style>`.
- Sin JavaScript, sin formularios, sin SVG inline.
- Estructura razonablemente compatible con Outlook, Gmail y Apple Mail.

**El preview web no prueba compatibilidad de correo.** Que se vea bien en el panel no dice
nada sobre Outlook. Los tests verifican estructura (que use tablas, que no haya flex/grid),
no apariencia.

#### Accesibilidad

Una firma que solo se entiende viendo imágenes y colores deja gente afuera, y además se
rompe en el escenario más común: imágenes bloqueadas.

- Las tablas usadas **solo para layout** llevan `role="presentation"`, para que un lector
  de pantalla no las anuncie como tablas de datos.
- `alt` **útil** en el logo (el nombre de la organización), no `alt=""` ni "logo".
- Fuentes con **pila de fallback** (`Arial, Helvetica, sans-serif`): las fuentes
  personalizadas no cargan en la mayoría de los clientes.
- **Contraste suficiente** entre texto y fondo.
- Enlaces con **texto entendible**, no "hacé clic acá".
- **La información esencial no depende del color ni de la imagen**: si el logo no carga y
  todo se ve en negro sobre blanco, la firma sigue diciendo quién es y cómo contactarlo.

#### Texto plano

No es un descarte del HTML: es una versión propia con la misma información relevante, en
orden lógico, con las URLs visibles (no ocultas tras un texto de enlace), sin restos de
HTML, sin líneas ni espacios sobrantes, y legible aunque no haya logo.

## 3. Seguridad

### Escapado de HTML

`organizationName` y `institutionalNote` los escribe un administrador. Inyectados crudos
abren un XSS que **viaja por email** y además se renderiza en el preview dentro del panel.

Todo valor se escapa. **El orden importa**: primero escapar, después convertir saltos de
línea a `<br>`. Al revés, los `<br>` que genera el sistema quedarían escapados y se verían
como texto literal.

### Saltos de línea en `emailSignatureNote`

Se almacena como **texto plano**. El tratamiento difiere según la salida:

**Para HTML:**
1. Escapar primero.
2. Recién entonces convertir los saltos de línea a `<br>`.
3. **Nunca interpretar etiquetas ingresadas**: si el administrador escribe `<b>`, se ve
   `<b>`, no texto en negrita.

**Para texto plano:**
- Conservar los saltos de línea tal como los escribió el administrador.
- **Normalizar `CRLF` a `LF`**: un texto pegado desde Windows trae `\r\n` y produce líneas
  dobles en algunos clientes.
- Eliminar espacios finales innecesarios al final de cada línea y del bloque.

### Validación de URLs

Escapar HTML no alcanza para URLs — `javascript:` sobrevive al escapado.

| Regla | Motivo |
|---|---|
| Imágenes: **solo `https:`** | Un logo por `http:` dispara avisos de contenido mixto |
| Web e Instagram: **solo `http:` o `https:`** | Cualquier otro esquema se descarta |
| Nunca `javascript:` | Ejecución de código |
| **`data:` no se acepta en esta etapa** | Vector de ofuscación; además muchos clientes lo bloquean. Habilitarlo requiere una decisión explícita posterior |
| Nunca URLs locales (`/uploads/...`) | FotoOffice tiene un fallback local cuando R2 no está configurado. Esas URLs **no cargan nunca** en un email |
| Logo con URL **absoluta** | |
| `alt` obligatorio, `width` y `height` fijos | |
| Sin deformar la imagen | |
| URL inválida → **se omite el logo entero** | Mejor sin logo que con un ícono roto |

**El email tiene que seguir siendo entendible con las imágenes bloqueadas**, que es el
comportamiento por defecto de muchos clientes.

## 4. FotoOffice

### Mapper

`apps/fotoffice/lib/communications/workspace-signature.ts` — la única pieza que conoce
los dos mundos. Mapea `FotofficeWorkspaceBranding` → `EmailSignatureData`.

En esta etapa completa **solo los campos institucionales**. `signerName`, `signerRole` y
`signerPhotoUrl` quedan sin completar.

### Resolución de `organizationName`

Es el único campo obligatorio, así que **nunca puede quedar vacío, `undefined` ni `null`**.
El mapper lo resuelve por prioridad, tomando el primero que tenga contenido real
(tras `trim`):

1. `FotofficeWorkspaceBranding.commercialName` — el nombre comercial.
2. `Workspace.name` — el nombre real del workspace.
3. `"FotoOffice"` — último fallback técnico.

El tercer nivel no debería alcanzarse nunca en datos reales; existe para que un branding
a medio cargar no produzca una firma rota.

**`closingText` se deja sin completar**: el email de cursos ya cierra con "Gracias por
elegirnos.". Si la firma agregara su propio cierre habría dos. El cierre sigue siendo del
template; la firma arranca en el bloque institucional.

### Configuración

En `/workspace/configuracion`, donde ya se edita el branding: campo de texto para la nota
+ vista previa.

### Preview

Muestra:
- HTML renderizado
- Texto plano
- Estado sin logo
- Estado sin nota
- Datos actuales del workspace

Con una aclaración visible:

> "Esta es la firma institucional. Más adelante podrás seleccionar un firmante personal."

**El preview nunca envía emails.** Renderiza la salida ya escapada, nunca los valores crudos.

### Aislamiento del preview

El preview inyecta HTML generado a partir de datos que escribe un administrador. Aunque el
renderer escapa, el aislamiento es la segunda barrera: si alguna vez se filtra algo, no
debe poder tocar la aplicación.

Se muestra dentro de un **`<iframe sandbox>`**, con estas restricciones:

- **Sin `allow-scripts`** — nada se ejecuta.
- Sin navegación de la ventana principal (no `allow-top-navigation`).
- Sin formularios (no `allow-forms`).
- Sin acceso a cookies ni al origen de la app (no `allow-same-origin`).

**No se usa `dangerouslySetInnerHTML` sobre el DOM principal.** El contenido va al `srcdoc`
del iframe aislado. Usarlo directamente solo sería admisible con sanitización y aislamiento
demostrables — y acá el iframe ya resuelve el problema sin esa deuda.

**El preview no sustituye las pruebas del HTML final**: que se vea bien en el panel no dice
nada sobre Outlook.

## 5. Integración con cursos

En `apps/fotoffice/lib/presential-courses/email.ts`.

**El email hoy manda solo `html`, sin texto plano** (verificado en el código). Para que la
firma llegue a ambas variantes hay que **agregar `text`** al envío. Eso no cambia reglas de
cursos, ni destinatarios, ni asuntos: suma la variante que faltaba.

Restricciones:
- No cambiar reglas de cursos.
- No enviar emails reales (ni en tests ni en desarrollo).
- No modificar destinatarios ni asuntos.
- **No duplicar la firma**: el template ya cierra, así que el mapper no aporta `closingText`.
- Test que demuestre que HTML y texto reciben la firma **exactamente una vez**.

## 6. Flujo

```
FotofficeWorkspaceBranding (DB)
        ↓  mapper (apps/fotoffice)
EmailSignatureData
        ↓  renderEmailSignature (@repo/communications)
{ html, text }
        ↓
email de cursos (html + text)
```

## 7. Pruebas

El renderer es puro, así que se prueba sin infraestructura. **Ningún test envía un email real.**

- URL `javascript:` rechazada.
- URL relativa rechazada para el logo.
- URL `https:` válida aceptada.
- Nota con saltos de línea → se preservan.
- Nota vacía → sin separadores ni líneas colgadas.
- Límite de longitud (1.500).
- Firma sin imágenes → sigue siendo legible.
- Campos personales opcionales ausentes → no rompen el render.
- HTML sin `undefined`, `null` ni separadores vacíos.
- Texto plano sin restos de HTML.
- Firma agregada una sola vez al email del curso (HTML y texto).
- Escapado: `<script>` en nombre y nota queda inerte.
- Estructura de email: usa tablas, no usa flex/grid/`<style>`.
- `organizationName`: cae a `Workspace.name` si no hay nombre comercial, y a `"FotoOffice"`
  si tampoco hay; nunca queda vacío, `undefined` ni `null`.
- Etiquetas ingresadas en la nota (`<b>`, `<img>`) se ven literales, no se interpretan.
- `CRLF` en la nota se normaliza a `LF` en la versión texto.
- Espacios finales de línea eliminados en la versión texto.
- Tablas de layout con `role="presentation"`.
- Logo con `alt` igual al nombre de la organización, no vacío.

## Etapa siguiente: firmante personal

Documentado para que la API de hoy no tenga que romperse mañana. **No se implementa ahora.**

- `CommunicationSenderProfile`: perfil de firmante (nombre, cargo, foto, email, teléfono).
- Firmante **predeterminado** del workspace, elegido explícitamente.
- Firmante **por módulo** (Cuotas → Tesorero, Actas → Secretario).
- Selección puntual para un envío concreto.
- **Snapshot de la firma por email enviado**: qué firma se usó, congelada, igual que el
  snapshot de fee por transacción o las versiones del sitio.
- `Reply-To` dinámico según el firmante.
- Integración con las invitaciones Socio–Usuario.

## Fuera de alcance de esta etapa

- Selección de owner.
- Firmas personales persistidas.
- Envío de invitaciones por email.
- Campañas.
- Migración general de todos los emails a `@repo/communications`.

## Nota sobre el historial de este spec

Este documento se commiteó primero solo (`4815959d`), antes de escribir una línea de
código. **No se pushea de forma independiente**: se integra junto con la implementación
validada, dentro del flujo productivo de FotoOffice, preservando su autoría e historial.
