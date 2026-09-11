# Migraciones, pruebas y despliegue

Responde a los entregables 11, 12 y 13 del capítulo 37.

## Primero: "base compartida" no significa lo que parece

En DNX Suite el schema Prisma es uno solo, pero **las bases son varias y no comparten
usuarios**. Verificado el 2026-09-11 contra Neon:

| Base | Qué corre ahí | Usuarios | Tablas |
|---|---|---:|---:|
| `divine-hall` rama `production` | CompraMeLaFoto | **797** (272 con Mercado Pago conectado) | 462 |
| `divine-hall` rama `development` | Fotoffice y FotoRank | 202 | 440 |
| `bitter-math` | Clickatón | — | — |
| `wandering-pine` | InfoSpot | — | — |
| `fragrant-union` | Staging de la suite | — | — |

Un fotógrafo registrado en CompraMeLaFoto **no existe** en la base de Fotoffice. Compartir
el código de login no comparte las cuentas.

Por eso "Subí la Foto usa el login compartido" todavía no está resuelto del todo: falta
decir **en qué base vive**. Es la decisión bloqueante número uno del documento 07.

## Las 19 tablas nuevas son la parte fácil

Al contrario de lo que suele pasar con este schema, agregar Subí la Foto es de **bajo
riesgo** para las otras aplicaciones:

- Son **tablas nuevas**. Ninguna app existente las conoce, así que no puede romperse por
  ellas.
- Las relaciones hacia `User` y `Workspace` son relaciones inversas de Prisma: la clave
  foránea vive en la tabla nueva, **no agrega ninguna columna a `User`**. Ese es
  precisamente el caso que provoca el error P2022 en las otras apps, y acá no ocurre.
- El único cambio a algo existente es **agregar `SUBILAFOTO` al enum `SuiteApp`**, que en
  Postgres es un `ALTER TYPE ... ADD VALUE`: no bloquea y no reescribe la tabla.

## Procedimiento de migración

<!-- Ningún build corre `prisma migrate deploy`. Aplicar y registrar son dos pasos. -->

1. Generar la migración en local contra una rama Neon de prueba, nunca contra producción.
2. Correr `pnpm --filter @repo/db db:drift` para ver qué falta en cada base.
3. Aplicar el SQL en la base donde vive Subí la Foto.
4. Aplicar **sólo el `ALTER TYPE` del enum** en las demás bases que tengan `SuiteApp`.
5. Registrar la migración en `_prisma_migrations` de cada base, copiando el checksum de una
   base donde ya esté aplicada y verificándolo con `shasum -a 256` contra el archivo local.
6. Confirmar con `prisma migrate status` que ninguna base la denuncia como modificada.

El paso 5 no es burocracia: si el SQL se aplica pero no se registra, la tabla existe y
Prisma cree que no. La próxima migración falla o, peor, se aplica dos veces.

**Antes de cada migración en la base de producción, crear una rama de respaldo en Neon.**
Ya es la costumbre del proyecto — hay más de una docena de ramas `backup-*` — y es lo que
convierte un error de migración en un susto de diez minutos.

## Plan de pruebas

### Automáticas

| Qué | Cómo |
|---|---|
| Cálculo de la ventana de 12 horas | Unitarias, con casos de horario de verano y cambio de fecha |
| Motor de reglas de moderación | Unitarias, con respuestas de Rekognition guardadas como fixtures |
| **Falla cerrada** | Simular timeout, error 500 y credenciales inválidas: ninguna publica |
| Cálculo de comisión y adicional | Unitarias, en centavos, con casos de redondeo |
| Idempotencia del webhook | El mismo aviso tres veces produce un evento y un cobro |
| Deduplicación de emails | El worker reintentado no manda dos veces el mismo recordatorio |
| Permisos | Una prueba por celda "✗" de la matriz de roles |
| Recorrido crítico | E2E con Playwright: QR → carga → moderación simulada → pantalla |

`packages/e2e` ya existe en el monorepo y hay Playwright disponible en la sesión.

### Manuales, sin sustituto posible

Estas no se automatizan y son las que evitan el papelón el día del evento:

- Un iPhone y un Android **reales**, en el salón, con el wifi del salón.
- Un televisor o proyector real, dos horas seguidas de proyección.
- Modo avión a mitad de la carga; wifi cortado a mitad de la proyección.
- Cien fotos entrando en diez minutos desde varios teléfonos a la vez.
- La pantalla vista desde el fondo del salón: ¿se lee el QR?

## Despliegue

- Proyecto Vercel propio, `subilafoto.com` como dominio canónico.
- Rama `main` a producción; cada rama de trabajo con su preview.
- Variables nuevas: credenciales de Rekognition (o reutilizar las de CLF), bucket R2
  propio, secreto del webhook de Mercado Pago, secreto de firma de las cookies de invitado.
- **Bucket R2 propio para Subí la Foto**, no compartido con CLF. Las políticas de retención
  son distintas: acá se borra a los 30 días, y un borrado masivo apuntando al bucket
  equivocado es irreversible.

### Rollback

| Falla | Qué se hace |
|---|---|
| Un despliegue rompe la app | Rollback instantáneo al anterior desde Vercel |
| Una migración rompe algo | Restaurar desde la rama de respaldo de Neon |
| Rekognition caído | Todo queda retenido (así está diseñado). Se activa el permiso de aprobación manual y el fotógrafo modera desde el panel |
| SSE caído | La pantalla cae sola al respaldo por consulta cada 15 s. Se nota, no se rompe |
| Mercado Pago caído | No se pueden vender eventos nuevos. Los ya pagados no se ven afectados |

El caso de Rekognition caído merece un ensayo real durante la Etapa 4: es el único que
obliga a operar distinto en vivo, y hay que saber que el camino manual funciona **antes**
de necesitarlo un sábado a las once de la noche.
