# Roles y permisos

Responde a los capítulos 4 y 12.4 del documento maestro.

## Los siete roles

| Rol | Cómo se identifica | Alcance |
|---|---|---|
| Superadministrador DNX | `User.globalRole` | Toda la plataforma |
| Profesional (vendedor) | `WorkspaceAppAccess` con `app = SUBILAFOTO` | Sus propios eventos |
| Cliente contratante | Token por email, sin contraseña | Un evento |
| Colaborador | `SubilafotoCollaborator` | Un evento, según su rol |
| Invitado | Cookie de `SubilafotoGuestSession` | Un evento, sólo lo suyo |
| Proveedor | Token de un solo uso | Su propia ficha |
| Operador de pantalla | Código de emparejamiento | Controlar la proyección |

El cliente **no tiene cuenta**. Recibe un enlace firmado a su email. Pedirle que invente
otra contraseña para ver las fotos de su casamiento es fricción sin ninguna ganancia.

## Matriz

| Acción | Super | Profesional | Cliente | Moderador | Operador | Invitado | Proveedor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Crear perfil de venta | ✓ | ✓ | | | | | |
| Configurar el evento | ✓ | ✓ | parcial | | | | |
| Elegir plantilla y portada | ✓ | ✓ | parcial | | | | |
| Cambiar la ventana de 12 h | ✓ | ✓ ¹ | | | | | |
| Probar en modo DEMO | ✓ | ✓ | | | | | |
| Subir contenido | ✓ | ✓ | ✓ | | | ✓ | |
| Ver contenido retenido | ✓ | ✓ | | ✓ | | | |
| Aprobar un falso positivo | ✓ | ✓ | | ✓ | | | |
| Ocultar una foto publicada | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Borrar lo que subió uno mismo | ✓ | ✓ | | | | ✓ | |
| Controlar la pantalla | ✓ | ✓ | | ✓ | ✓ | | |
| Ver la galería | ✓ | ✓ | ✓ | ✓ | | según config | |
| Descargar una foto suelta | ✓ | **✗** ³ | ✓ ² | | | según config | |
| **Exportar todo el evento** | ✓ | **✗** ³ | ✓ ² | | | | |
| Invitar proveedores | ✓ | ✓ | | | | | |
| Completar ficha de proveedor | ✓ | ✓ | | | | | ✓ |
| Ver auditoría | ✓ | ✓ propia | | | | | |
| Cambiar la comisión global | ✓ | | | | | | |

¹ Sólo antes de que el evento se active. Después queda auditado y requiere permiso de
administración (capítulo 7.4).
² Si compró el adicional de descarga.
³ Decidido el 2026-09-11: **ninguna descarga**. Ver abajo.

## La regla anti-bypass

El capítulo 12.4 plantea el problema: si el paquete completo es un adicional cuyo ingreso es
100% de la plataforma, y el fotógrafo puede bajarse los originales, puede pasárselos a su
cliente y el adicional no se vende nunca.

**Decisión del titular: el profesional no descarga ninguna foto del evento.**

- Ve **todo** el contenido en el panel, en calidad de pantalla, incluido lo retenido y lo
  bloqueado.
- Modera, oculta, destaca, recupera falsos positivos y controla la proyección.
- **No** tiene descarga: ni masiva, ni de originales, ni de fotos sueltas.
- La única descarga del evento es la del cliente, detrás del pago del adicional.

Consecuencias que hay que tener presentes al construirlo:

- No existe ningún botón de descarga en el panel del profesional. No es un permiso que se
  evalúa: la funcionalidad no está.
- Las imágenes del panel se sirven como derivados con marca de agua discreta, y las URL
  prefirmadas de los originales nunca se emiten hacia el rol profesional.
- Esto debe estar **escrito en las condiciones que el profesional acepta al publicar su
  perfil de venta**. Un fotógrafo que descubre el día después del casamiento que no puede
  bajar ni una foto se enoja con razón; uno que lo aceptó por escrito, no.
- El contenido oficial que el propio fotógrafo suba al evento (`origin = PHOTOGRAPHER`) es
  suyo y sí puede recuperarlo. La restricción es sobre lo que aportaron los invitados.

## Cómo se aplica en el código

Un único módulo `lib/permissions.ts` con una función por acción sensible, y **ninguna
verificación de permisos escrita a mano en un componente**. El patrón ya existe en
`packages/partners/src/permissions.ts` y conviene copiarlo.

Toda acción de la columna "delicada" (override de moderación, cambio de ventana, descarga
de original, revocación de enlace) escribe en `SubilafotoAudit` **en la misma transacción**
que el cambio. Si la auditoría falla, el cambio no ocurre. Auditar después, en un
`try/catch` aparte, es una auditoría que se pierde justo cuando hace falta.
