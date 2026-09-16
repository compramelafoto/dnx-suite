# Volver atrás

*Etapa 4. Ensayo del 2026-09-15.*

Volver atrás no es una cosa sola. Hay **tres capas** y se deshacen distinto, en este orden
de facilidad:

| Capa | ¿Se puede volver? | Cuánto tarda |
|---|---|---|
| El código desplegado | Sí, con un clic | Segundos |
| Las variables de entorno | Sí, a mano | Un minuto |
| La base y los archivos | **Casi nunca** | — |

La regla que sale de eso: **si algo puede salir mal, que salga mal en la capa de arriba.**

---

## 1. El código: promover el despliegue anterior

Es lo único verdaderamente reversible.

```bash
cd apps/subilafoto
npx vercel ls --prod        # el de más arriba es el que está sirviendo
npx vercel promote <url-del-anterior>
```

También se hace desde el panel de Vercel, en el despliegue anterior, con *Promote to
Production*.

**Tarda segundos y no toca la base.** Es lo primero que hay que probar cuando algo se
rompió después de un deploy.

### Lo que un rollback de código NO deshace

- Las migraciones que ya se aplicaron.
- Las fotos que ya se subieron a R2.
- Los correos que ya salieron.
- Los pagos que ya entraron.

---

## 2. Las variables de entorno

Se cambian en Vercel y **hay que volver a desplegar para que tomen efecto**. Un cambio de
variable sin deploy no hace nada, y eso confunde más de lo que parece.

El caso interesante: **apagar los correos** sin tocar código. Sacando `RESEND_API_KEY`, el
runtime de comunicaciones vuelve al modo seco y los avisos quedan anotados como `DRY_RUN`
en vez de salir. Es el freno de mano si algo del contenido está mal.

---

## 3. La base y los archivos: acá no hay vuelta atrás

Tres cosas destruyen datos y no se deshacen:

1. **El borrado de retención** (`/api/eventos/purgar`). Borra archivos de R2. Se protege con
   el candado, que frena si hay plata o una entrega en el aire.
2. **Una migración que borra una columna.** Los datos se van con ella.
3. **Un `DELETE` a mano.**

### Antes de una migración destructiva

Neon guarda una copia recuperable. Antes de aplicar algo que borre, tomar una foto de la
rama y anotar el punto en el tiempo. Restaurar es crear una rama nueva desde ese momento y
mirar, **no** pisar producción.

### El interruptor de emergencia del borrado

Si hay que frenar el borrado automático ya mismo, sin desplegar: sacar la fila del cron de
`/api/eventos/purgar` de `vercel.json` requiere deploy. **Más rápido: borrar `CRON_SECRET`
en Vercel.** Con la variable ausente, las cinco tareas devuelven 503 y no hacen nada.

Es un martillo: también frena la moderación, el cierre, los paquetes y los correos. Sirve
para diez minutos mientras se piensa, no para un día.

---

## Qué mirar después de volver atrás

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/diagnostico
```

Y después las cinco tareas, una por una: si una devuelve 503, falta una variable en la
versión que quedó sirviendo.

**Ojo con el orden.** Si el despliegue nuevo trajo una migración y se vuelve al código
anterior, la base queda **adelante** del código. Prisma no se rompe con una columna de más,
pero sí con un `enum` que no conoce o una columna obligatoria que no sabe llenar. Antes de
promover una versión vieja, mirar si en el medio hubo migración.

---

## El ensayo

Se hizo el 2026-09-15 sobre el proyecto de producción:

1. Se listaron los despliegues y se identificó el anterior al vigente.
2. Se verificó que `vercel promote` está disponible y que el panel ofrece *Promote to
   Production* en cada despliegue viejo.
3. Se confirmó que **sacar `CRON_SECRET` frena las cinco tareas**: las rutas devuelven 503
   —no 401— justamente para distinguir "no está configurado" de "no estás autorizado".
4. Se confirmó que ninguna migración de SubiLaFoto borró columnas hasta hoy, así que
   cualquier rollback de código actual es seguro.

Lo que **no** se ensayó, porque implicaba romper producción a propósito: promover de verdad
una versión vieja. Queda para el ensayo general del 8 de octubre, cuando haya un evento de
prueba andando y se pueda medir qué se ve mientras tanto.
