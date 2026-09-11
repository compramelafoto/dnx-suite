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
| Descargar una foto suelta | ✓ | ✓ | ✓ ² | | | según config | |
| **Exportar todo el evento** | ✓ | **✗** ³ | ✓ ² | | | | |
| Invitar proveedores | ✓ | ✓ | | | | | |
| Completar ficha de proveedor | ✓ | ✓ | | | | | ✓ |
| Ver auditoría | ✓ | ✓ propia | | | | | |
| Cambiar la comisión global | ✓ | | | | | | |

¹ Sólo antes de que el evento se active. Después queda auditado y requiere permiso de
administración (capítulo 7.4).
² Si compró el adicional de descarga.
³ **Esta celda es el punto delicado.** Ver abajo.

## La regla anti-bypass

El capítulo 12.4 plantea un problema real: si el paquete completo es un adicional cuyo
ingreso es 100% de la plataforma, y el fotógrafo puede bajarse todos los originales de un
clic, entonces puede pasárselos a su cliente y el adicional no se vende nunca.

La solución no puede ser desconfiar del fotógrafo ni impedirle trabajar. La propuesta:

**El profesional tiene acceso operativo, no acceso de entrega.**

- Puede ver todo el contenido en el panel, en calidad de pantalla.
- Puede descargar **fotos sueltas** (para corregir una, para publicar una en su Instagram).
- Puede descargar hasta **20 originales por evento**, con registro de cuáles y cuándo.
- **No** tiene un botón de "descargar todo". Ese botón produce el paquete del cliente y
  vive detrás del pago del adicional.
- Si necesita el paquete completo por una razón legítima, lo pide y queda auditado.

Este límite tiene que estar **escrito en las condiciones que el profesional acepta al
publicar su perfil de venta**, no descubrirse el día del evento. Un límite razonable y
avisado se respeta; uno sorpresa se percibe como una trampa y arruina la relación con los
fotógrafos, que son el canal de venta del producto.

El número 20 es una propuesta, no un dogma. Está en la lista de decisiones abiertas.

## Cómo se aplica en el código

Un único módulo `lib/permissions.ts` con una función por acción sensible, y **ninguna
verificación de permisos escrita a mano en un componente**. El patrón ya existe en
`packages/partners/src/permissions.ts` y conviene copiarlo.

Toda acción de la columna "delicada" (override de moderación, cambio de ventana, descarga
de original, revocación de enlace) escribe en `SubilafotoAudit` **en la misma transacción**
que el cambio. Si la auditoría falla, el cambio no ocurre. Auditar después, en un
`try/catch` aparte, es una auditoría que se pierde justo cuando hace falta.
