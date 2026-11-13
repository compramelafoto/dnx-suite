# Cursos compartidos entre espacios

Diseño acordado con Daniel el 2026-11-13. Amplía el Mercado de cursos
(`2026-10-05-mercado-de-cursos-design.md`, en producción desde el 05/10 y todavía sin uso real).

## Por qué

Daniel maneja varios espacios (DNX Estudio, SOYBELUZ, SFPR, F64…). Quiere que los cursos circulen
entre ellos: por ejemplo, DNX Estudio le regala "Fotografía Inicial" a SOYBELUZ, y a SFPR se lo
comparte a cambio de un porcentaje de lo que SFPR venda. Belén va a grabar 20 cursos teóricos en
SOYBELUZ que otros espacios también tienen que poder ofrecer. Cada parte gana su parte.

## Decisiones (de Daniel)

| Tema | Decisión |
|---|---|
| Visibilidad del curso | **Privado** (sólo su espacio), **Público** (en el Mercado, cualquiera pide venderlo) o **compartido con espacios elegidos** (el dueño invita) |
| Quién inicia | Las dos puntas: el espacio pide desde el Mercado (ya existe) **o el dueño invita** (nuevo) |
| Condiciones por acuerdo | El dueño fija el % que se queda el otro espacio. **Puede ser 100%** = regalarlo |
| Socios del que recibe | **Gratis para sus socios activos**; si deja de ser socio, lo pierde |
| No socios | Lo compran; cada venta se reparte según el acuerdo |
| Precio | **Único, lo fija el dueño**, igual en todos los espacios |
| Construcción | Ampliar el Mercado de cursos (un solo curso, sin copias) |
| Permisos | El admin del que recibe **ve** el curso y a sus alumnos; **sólo el dueño edita** |

## Approaches

1. **Ampliar el acuerdo de reventa existente** (elegida): un solo curso, las correcciones llegan a
   todos, el motor de reparto y el split ya están hechos y probados.
2. Copiar el curso a cada espacio (descartada): videos duplicados, las correcciones no llegan, se
   pierde de quién es el curso y el split no sabría a quién pagarle.

## Diseño

### Datos (migración aditiva, aplicada a mano en FOTOFFICE y registrada con `migrate resolve`)

`CourseResaleAgreement` suma:
- `invitedByOwner Boolean @default(false)`: lo inició el dueño. En `PENDIENTE` lo acepta el espacio invitado (no el dueño).
- `membersFree Boolean @default(false)`: los socios activos del que recibe lo toman gratis.

`shareBps` pasa a admitir **10000 (100%)** sólo en invitaciones del dueño.

No hace falta un campo de visibilidad nuevo: **Público = `offeredToResellers`**; **Privado** = no ofrecido y sin acuerdos; **Compartido** = tiene acuerdos de invitación. La ficha del curso lo muestra así.

### Reglas (puras, con tests)

- **Invitar** (dueño o admin del espacio dueño, curso grabado y publicado con precio): elige un
  espacio de FOTOFFICE con el módulo de cursos, su % (de 1% a 100%) y si es gratis para sus
  socios. Queda `PENDIENTE` con `invitedByOwner = true`; el invitado acepta o rechaza. No hace
  falta que el curso sea público.
- **100% o gratis para socios sólo si el dueño es el único beneficiario** del curso: si hay
  docente o productor con su parte, regalarlo los dejaría sin cobrar (misma regla que hoy).
- **Pedido desde el Mercado**: igual que hoy (hasta el sugerido se activa solo). Si pide
  "gratis para mis socios", queda `PENDIENTE` y lo aprueba el dueño.
- **Venta sin split**: si el que recibe se queda con el **100%** y el dueño es el único
  beneficiario, la venta es "sin reparto": cobra el que vende con su Mercado Pago, con el 5% de
  FOTOFFICE encima, y no se escriben partes para el dueño. Con un % menor sigue
  "Disponible próximamente" hasta que se encienda el split 1:N (se programa ya, como hoy).
- **Gratis para socios**: el socio activo del espacio que recibe lo toma desde su portal. El
  acceso queda `MEMBER_BENEFIT` con `CourseAccess.workspaceId` = **el espacio que lo dio**, y
  la vigencia se mide contra la membresía en **ese** espacio (hoy se mide contra el dueño del
  curso; con los cursos propios no cambia nada porque coinciden).
- **Revocar**: pausar o terminar desde cualquiera de las dos puntas, como hoy. Las compras
  conservan el acceso. El acceso gratis de socios sigue mientras el acuerdo esté vigente
  (activo o pausado); al **terminar**, los nuevos ya no pueden tomarlo y quienes lo tienen lo
  conservan (mi decisión: es lo que se prometió al socio; se puede cambiar).

### Pantallas

- **Ficha del curso (dueño)**, sección "Compartir": visibilidad (Privado / Público con % sugerido),
  lista de espacios con quienes está compartido (%, gratis para socios, estado, alumnos de cada
  uno) y el botón **"Compartir con un espacio"**.
- **Acuerdos** (`/dashboard/mercado-de-cursos/acuerdos`): las invitaciones recibidas con
  Aceptar / Rechazar y la simulación "por cada venta recibís $X".
- **Curso compartido, vista del que recibe** (nueva, sólo lectura): ficha, clases, precio y su
  parte; sus alumnos y socios inscriptos con su avance.
- **Portal del socio**: los cursos compartidos con `membersFree` aparecen con "Tomar gratis".
- Correos: aviso de invitación al invitado y de respuesta al dueño (reusar los avisos de reventa).

## Fuera de alcance

- Encender el split 1:N (depende de Mercado Pago).
- Que el que recibe edite el curso o ponga su propio precio.
- Ver los videos desde el panel del que recibe (ve la lista de clases; para mirar, la clase de muestra).

## Lo que queda al constructor

Nombres de componentes y rutas, textos finales, y la forma de elegir el espacio a invitar
(buscador entre los espacios con el módulo de cursos encendido).
